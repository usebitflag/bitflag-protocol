// bucket-sha256-v1 reference utility. Generates and checks fixtures/bucketing/bucket-sha256-v1.json.
//   node tools/bucket.mjs --write   regenerate the vector file
//   node tools/bucket.mjs --check   fail if the file differs from the generated vectors or any vector is wrong
// This is a reference for generating vectors. It is not one of the two evaluators.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fixturesDir } from './lib/files.mjs';

const BUCKETS = 100000n;
const TAG = 'bitflag-bucket-v1';
export const vectorsPath = join(fixturesDir, 'bucketing', 'bucket-sha256-v1.json');

function field(text) {
  const bytes = Buffer.from(text, 'utf8');
  const length = Buffer.alloc(4);
  length.writeUInt32BE(bytes.length);
  return Buffer.concat([length, bytes]);
}

export function inputBytes(salt, kind, value) {
  return Buffer.concat([field(TAG), field(salt), field(kind), field(value)]);
}

export function digestOf(salt, kind, value) {
  return createHash('sha256').update(inputBytes(salt, kind, value)).digest();
}

export function bucket(salt, kind, value) {
  return Number(digestOf(salt, kind, value).readBigUInt64BE(0) % BUCKETS);
}

// The same result from two 32-bit halves, as an evaluator without unsigned 64-bit integers computes it.
// 2^32 mod 100000 = 67296; every intermediate fits in a signed 64-bit integer.
export function bucketFromHalves(digest) {
  const hi = digest.readUInt32BE(0);
  const lo = digest.readUInt32BE(4);
  return ((hi % 100000) * 67296 + lo) % 100000;
}

function vector(salt, kind, value) {
  const digest = digestOf(salt, kind, value);
  return {
    salt,
    kind,
    value,
    inputHex: inputBytes(salt, kind, value).toString('hex'),
    digestPrefixHex: digest.subarray(0, 8).toString('hex'),
    bucket: bucket(salt, kind, value),
  };
}

// Finds the first value "<prefix><n>" whose bucket is `target`; deterministic.
function find(target, salt, kind, prefix) {
  for (let n = 0; ; n += 1) {
    const value = `${prefix}${n}`;
    if (bucket(salt, kind, value) === target) return value;
  }
}

// First `count` values whose digest has the top bit set (or clear), so both halves of the range are covered.
function findTopBit(set, count, salt, kind, prefix) {
  const found = [];
  for (let n = 0; found.length < count; n += 1) {
    const value = `${prefix}${n}`;
    if ((digestOf(salt, kind, value)[0] >= 0x80) === set) found.push(value);
  }
  return found;
}

export function generate() {
  const inputs = [];
  const add = (salt, kind, value) => inputs.push([salt, kind, value]);

  // The worked example, and Unicode normalization forms that must differ.
  add('s_9f2c', 'user', 'u_20931');
  add('s_9f2c', 'user', 'José');
  add('s_9f2c', 'user', 'José');

  // Buckets at the boundaries and at the edge of the modulo-bias region (2^64 mod 100000 = 51616).
  for (const target of [0, 1, 51615, 51616, 99998, 99999]) {
    add('s_edge', 'user', find(target, 's_edge', 'user', 'edge_'));
  }
  // Slot edges used by percentage rollouts.
  for (const target of [19999, 20000, 49999, 50000]) {
    add('s_slot', 'user', find(target, 's_slot', 'user', 'slot_'));
  }

  // Both halves of the digest's first byte.
  for (const value of findTopBit(true, 8, 's_top', 'user', 'high_')) add('s_top', 'user', value);
  for (const value of findTopBit(false, 8, 's_top', 'user', 'low_')) add('s_top', 'user', value);

  // Plain ASCII keys across salts and kinds.
  for (let n = 0; n < 60; n += 1) add(`s_${(n * 7919).toString(16).padStart(4, '0')}`, n % 3 === 0 ? 'organization' : 'user', `u_${10000 + n * 37}`);
  for (const kind of ['user', 'organization', 'device', 'a', 'kind-with_dash9']) add('s_kinds', kind, 'same-key');

  // Boundaries of the length prefix and of key size limits.
  for (const length of [1, 2, 255, 256, 257, 1024]) add('s_len', 'user', 'k'.repeat(length));
  add('x'.repeat(128), 'user', 'u_1');
  add('s', 'user', '1');

  // Multibyte text, emoji, combining marks, controls and delimiters that a naive concatenation would confuse.
  const text = ['é', 'ß', 'İ', 'ı', '中文', 'مرحبا', '😀', '👨‍👩‍👧', '🇵🇭', 'a\u0000b', 'tab\there', 'line\nbreak', ' leading', 'trailing ', 'U_20931', 'u_20931 '];
  for (const value of text) add('s_text', 'user', value);
  add('s_text', 'user', 'Ḱ'); // K + combining acute
  add('s_text', 'user', 'Ḱ'); // precomposed K with acute
  add('s_text', 'user', 'K'); // Kelvin sign
  add('s_text', 'user', 'K');
  // Salt/kind/value splits that give the same concatenation without length prefixes.
  add('ab', 'c', 'd');
  add('a', 'bc', 'd');
  add('a', 'b', 'cd');
  add('sé', 'user', 'u_1');
  add('s_9f2c', 'user', 'José ');

  // Fill to a round count with sequential keys.
  for (let n = 0; inputs.length < 240; n += 1) add('s_fill', 'user', `fill_${n}`);

  const seen = new Set();
  return inputs
    .filter(([salt, kind, value]) => !seen.has(`${salt}\u0000${kind}\u0000${value}`) && seen.add(`${salt}\u0000${kind}\u0000${value}`))
    .map(([salt, kind, value]) => vector(salt, kind, value));
}

const serialize = (vectors) => `${JSON.stringify(vectors, null, 2)}\n`;

function check() {
  const problems = [];
  const expected = serialize(generate());
  const actual = existsSync(vectorsPath) ? readFileSync(vectorsPath, 'utf8') : '';
  if (actual !== expected) problems.push('fixtures/bucketing/bucket-sha256-v1.json is not current. Run `npm run bucket`.');

  const vectors = actual ? JSON.parse(actual) : [];
  for (const v of vectors) {
    const digest = digestOf(v.salt, v.kind, v.value);
    if (bucketFromHalves(digest) !== v.bucket) problems.push(`32-bit split disagrees for ${JSON.stringify(v.value)}.`);
  }
  const want = (salt, kind, value, expectedBucket) => {
    if (bucket(salt, kind, value) !== expectedBucket) problems.push(`Worked example ${JSON.stringify(value)} is not bucket ${expectedBucket}.`);
  };
  want('s_9f2c', 'user', 'u_20931', 76138);
  want('s_9f2c', 'user', 'José', 60341);
  want('s_9f2c', 'user', 'José', 99140);
  for (const edge of [0, 51615, 51616, 99999]) {
    if (!vectors.some((v) => v.bucket === edge)) problems.push(`No vector lands on bucket ${edge}.`);
  }
  return problems;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.argv.includes('--write')) {
    const vectors = generate();
    writeFileSync(vectorsPath, serialize(vectors));
    console.log(`Wrote ${vectors.length} bucket vectors.`);
  } else {
    const problems = check();
    for (const problem of problems) console.error(problem);
    if (problems.length > 0) process.exit(1);
    console.log('Bucket vectors are current.');
  }
}
