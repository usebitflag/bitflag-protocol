// Generates the input of the differential fuzz test (see spec/10-conformance.md).
//   node tools/fuzz/generate.mjs --seed 7 --parse 3000 --evaluate 300 --out fuzz-input.json
// The same seed always gives the same input. Two kinds of cases are generated:
//   parse     snapshot texts made by mutating a rich valid snapshot: members deleted, types changed, edge values
//             inserted (1e999, 2^53 + 1, -0, long strings, unknown members). Every evaluator must accept or reject
//             each text in the same way, with the same error kind, path and code.
//   evaluate  random valid snapshots (every operator, segments, prerequisites, overrides, rollouts, capabilities,
//             dangling references) with 25 random evaluations and 3 evaluateAll calls each. Every evaluator must
//             produce the same result, trace included.
// This is a reference tool for generating cases. It is not an evaluator.
import { writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { checksumOf } from '../checksum.mjs';

const { values: args } = parseArgs({ options: { seed: { type: 'string', default: '1' }, parse: { type: 'string', default: '3000' }, evaluate: { type: 'string', default: '300' }, out: { type: 'string', default: 'fuzz-input.json' } } });

let state = Number(args.seed) >>> 0;
const rnd = () => {
  state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
  return state / 4294967296;
};
const pick = (list) => list[Math.floor(rnd() * list.length)];
const chance = (p) => rnd() < p;
const int = (low, high) => low + Math.floor(rnd() * (high - low + 1));
const copy = (value) => JSON.parse(JSON.stringify(value));
const eq = (attribute, value) => ({ attribute, op: 'eq', values: [value] });

// ---------------------------------------------------------------- snapshot mutation

function richSnapshot() {
  const flag = (extra = {}) => ({ type: 'boolean', enabled: true, variations: { on: true, off: false }, offVariation: 'off', defaultVariation: 'off', prerequisites: [], overrides: [], rules: [], ...extra });
  return {
    protocolVersion: 1,
    algorithmVersion: 'bucket-sha256-v1',
    environment: { id: 'env_1', key: 'production' },
    revision: 42,
    generation: 1,
    projection: 'server',
    publishedAt: '2026-10-06T07:00:00Z',
    requiredCapabilities: ['segments.v1'],
    flags: {
      checkout: flag({
        requires: ['segments.v1'],
        prerequisites: [{ flagKey: 'base', variations: ['on'] }],
        overrides: [{ kind: 'user', key: 'u_vip', variation: 'on', expiresAt: '2026-10-06T09:00:00Z' }, { kind: 'user', key: 'u_2', variation: 'off', expiresAt: null }],
        rules: [
          { id: 'r1', match: { all: [eq('country', 'PH'), { any: [{ attribute: 'age', op: 'gte', values: [18] }, { attribute: 'v', op: 'semver_gte', values: ['1.2.3'] }, { attribute: 'seen', op: 'before', values: ['2026-01-01T00:00:00Z'] }] }, { op: 'in_segment', values: ['beta'] }, { attribute: 'tags', op: 'in', values: ['a', 'b'] }, { attribute: 'e', op: 'ends_with', values: ['@acme.dev'], ignoreCase: true }, { attribute: 'x', op: 'exists' }] }, serve: { variation: 'on' } },
          { id: 'r2', enabled: false, match: { all: [] }, serve: { variation: 'off' } },
          { id: 'r3', match: { any: [eq('plan', 'pro')] }, serve: { rollout: { bucketBy: 'key', salt: 'salt-1', slots: [{ variation: 'on', weight: 30000 }, { variation: 'off', weight: 20000 }], remainderVariation: 'on', allocationId: 'alc_1', experimentId: 'exp_1' } } },
        ],
      }),
      base: flag({ rules: [{ id: 'b1', match: { all: [eq('plan', 'pro')] }, serve: { variation: 'on' } }] }),
      text: { type: 'string', enabled: true, variations: { a: 'A', b: 'B' }, offVariation: 'a', defaultVariation: 'b', prerequisites: [], overrides: [], rules: [] },
      num: { type: 'number', enabled: true, variations: { one: 1, half: 0.5 }, offVariation: 'one', defaultVariation: 'half', prerequisites: [], overrides: [], rules: [] },
      conf: { type: 'json', enabled: false, variations: { on: { a: [1, { b: null }] }, off: [] }, offVariation: 'off', defaultVariation: 'on', prerequisites: [], overrides: [], rules: [] },
    },
    segments: { beta: { version: 2, match: { all: [eq('beta', true)] }, include: [{ kind: 'user', key: 'u_in' }], exclude: [{ kind: 'user', key: 'u_out' }] } },
    checksum: `sha256:${'0'.repeat(64)}`,
  };
}

// Literals JSON.stringify cannot write are put in as placeholders and replaced in the text.
const LITERALS = { __INF__: '1e999', __NINF__: '-1e999', __BIG__: '9007199254740993', __BIGF__: '1.5e300', __NEGZ__: '-0' };
const withLiterals = (text) => Object.entries(LITERALS).reduce((out, [name, literal]) => out.replaceAll(`"${name}"`, literal), text);
const asNumbers = (text) => Object.keys(LITERALS).reduce((out, name) => out.replaceAll(`"${name}"`, '1'), text);

const POOL = [null, true, false, 0, -1, 1, 2, 1.5, 100000, 100001, 9007199254740991, 'x', '', 'é', 'A'.repeat(300), '1.2.3', '2026-10-06T00:00:00Z', 'on', 'off', [], {}, [1], ['a'], [null], { a: 1 }, '__INF__', '__NINF__', '__BIG__', '__BIGF__', '__NEGZ__', `sha256:${'a'.repeat(64)}`, '-', 'a/b', '__proto__', 'user', 'key', 'bitflag-bucket-v1', 'PH', 'segments.v1', 'future.v9', `1.0.0-${'a'.repeat(300)}`];

function pathsOf(node, prefix = []) {
  const out = [prefix];
  if (Array.isArray(node)) node.forEach((child, index) => out.push(...pathsOf(child, [...prefix, index])));
  else if (node && typeof node === 'object') for (const [key, child] of Object.entries(node)) out.push(...pathsOf(child, [...prefix, key]));
  return out;
}
const at = (root, path) => path.reduce((node, key) => node[key], root);

function mutate(root) {
  const result = copy(root);
  for (let i = 0; i < int(1, 2); i += 1) {
    const path = pick(pathsOf(result).filter((p) => p.length > 0));
    const parent = at(result, path.slice(0, -1));
    const key = path[path.length - 1];
    const roll = rnd();
    if (roll < 0.2) {
      if (Array.isArray(parent)) parent.splice(key, 1);
      else delete parent[key];
    } else if (roll < 0.75) parent[key] = copy(pick(POOL));
    else if (roll < 0.85 && !Array.isArray(parent)) parent[pick(['extra', 'type', 'kind', 'key', '__proto__x', 'a b'])] = copy(pick(POOL));
    else if (roll < 0.92 && Array.isArray(at(result, path))) {
      const list = at(result, path);
      list.push(...list.slice(0, 3).map(copy));
    } else {
      const value = at(result, path);
      if (typeof value === 'string') parent[key] = value + pick(['x', ' ', '\n', 'é', '\u0000']);
      else if (typeof value === 'number') parent[key] = value + pick([1, -1, 0.5]);
      else parent[key] = copy(pick(POOL));
    }
  }
  return result;
}

function snapshotText(snapshot, recomputeChecksum) {
  let document = snapshot;
  if (recomputeChecksum && document !== null && typeof document === 'object' && !Array.isArray(document)) {
    try {
      document = { ...document, checksum: checksumOf(JSON.parse(asNumbers(JSON.stringify(document)))) };
    } catch {
      // leave the checksum stale
    }
  }
  return withLiterals(JSON.stringify(document));
}

// ---------------------------------------------------------------- random valid snapshots and evaluations

const ATTRS = ['country', 'plan', 'age', 'ver', 'seen', 'tags', 'email', 'beta', 'org', 'n', 'x'];
const STRS = ['PH', 'US', 'pro', 'free', 'team', 'a', 'b', 'c', 'José', 'José', '@acme.dev', 'sam@acme.dev', 'SAM@ACME.DEV', '', ' ', 'é', 'İ', 'i', 'I'];
const VERS = ['1.0.0', '1.2.3', '1.2.3-rc.1', '1.10.0', '2.0.0', '1.0.0+b', '0.9.9', '1.2', 'v1', 'latest'];
const DATES = ['2026-10-06T08:00:00Z', '2026-10-06T16:00:00+08:00', '2026-01-01T00:00:00Z', '2027-01-01T00:00:00.5Z', '2026-10-05T23:59:59.999Z', '2026-10-06', 'soon'];
const NUMS = [0, -0, 1, 18, 18.5, 20, 100, -5, 0.1, 9007199254740991, 9007199254740993];
const SAFE_NUMS = NUMS.filter((n) => Math.abs(n) < 1e15);
const KINDS = ['user', 'organization', 'device'];
const KEYS = ['u_1', 'u_2', 'u_vip', 'o_1', 'é', 'k_0', 'k_1', 'k_2'];
const SEGS = ['s0', 's1', 's2', 'ghost'];
const FLAGS = ['f0', 'f1', 'f2', 'f3', 'f4'];
const CAPS = ['operators.v1', 'semver.v1', 'segments.v1', 'future.v9'];

function conditionValues(op) {
  if (op.startsWith('semver_')) return [pick(VERS.slice(0, 7))];
  if (op === 'before' || op === 'after') return [pick(DATES.slice(0, 5))];
  if (['gt', 'gte', 'lt', 'lte'].includes(op)) return [pick(SAFE_NUMS)];
  if (op === 'eq' || op === 'neq') return [pick([pick(STRS), pick(SAFE_NUMS), pick([true, false])])];
  if (op === 'in' || op === 'not_in') return chance(0.5) ? Array.from({ length: int(1, 3) }, () => pick(STRS)) : Array.from({ length: int(1, 3) }, () => pick(SAFE_NUMS));
  return Array.from({ length: int(1, 2) }, () => pick(STRS));
}

function condition() {
  const op = pick(['eq', 'neq', 'in', 'not_in', 'starts_with', 'ends_with', 'contains', 'gt', 'gte', 'lt', 'lte', 'exists', 'not_exists', 'semver_eq', 'semver_neq', 'semver_gt', 'semver_gte', 'semver_lt', 'semver_lte', 'before', 'after', 'in_segment', 'not_in_segment']);
  if (op === 'in_segment' || op === 'not_in_segment') return { op, values: Array.from({ length: int(1, 2) }, () => pick(SEGS)) };
  if (op === 'exists' || op === 'not_exists') return { attribute: pick([...ATTRS, 'kind', 'key']), op };
  const c = { attribute: pick([...ATTRS, 'kind', 'key']), op, values: conditionValues(op) };
  if (chance(0.3)) c.ignoreCase = true;
  return c;
}

function group(depth = 1) {
  return { [pick(['all', 'any'])]: Array.from({ length: int(0, 4) }, () => (depth < 3 && chance(0.2) ? group(depth + 1) : condition())) };
}

function rollout(variationKeys) {
  const total = pick([100000, 50000, 30000, 0, 99999]);
  const first = int(0, total);
  const r = { bucketBy: pick(['key', 'key', 'org', 'n']), salt: pick(['salt-a', 'salt-b', 'és']), slots: [{ variation: pick(variationKeys), weight: first }, { variation: pick(variationKeys), weight: total - first }] };
  if (total < 100000 || chance(0.3)) r.remainderVariation = pick(variationKeys);
  if (chance(0.3)) {
    r.allocationId = `alc_${int(1, 3)}`;
    r.experimentId = `exp_${int(1, 3)}`;
  }
  return r;
}

function randomFlag(index) {
  const type = pick(['boolean', 'boolean', 'boolean', 'string', 'number', 'json']);
  const variations = type === 'boolean' ? { on: true, off: false, maybe: true } : type === 'string' ? { a: 'A', b: 'B', c: '' } : type === 'number' ? { a: 1, b: 2.5, c: 0 } : { a: { x: [1, 2] }, b: null, c: 'text' };
  const keys = Object.keys(variations);
  const variation = () => (chance(0.004) ? 'ghost' : pick(keys));
  const f = { type, enabled: chance(0.9), variations, offVariation: variation(), defaultVariation: variation(), prerequisites: [], overrides: [], rules: [] };
  if (chance(0.25)) f.requires = [pick(chance(0.1) ? CAPS : CAPS.slice(0, 3))];
  for (let i = 0; i < int(0, 2); i += 1) {
    f.prerequisites.push({ flagKey: pick(index >= FLAGS.length - 1 ? ['f0'] : FLAGS.slice(index + 1)), variations: Array.from(new Set(Array.from({ length: int(1, 2) }, () => pick(['on', 'off', 'a', 'b', 'maybe'])))) });
  }
  const seen = new Set();
  for (let i = 0; i < int(0, 3); i += 1) {
    const kind = pick(KINDS);
    const key = pick(KEYS);
    if (seen.has(kind + key)) continue;
    seen.add(kind + key);
    f.overrides.push({ kind, key, variation: variation(), expiresAt: pick([null, null, '2026-10-06T08:00:00Z', '2026-10-06T16:00:00+08:00', '2026-10-06T08:00:00.0009Z', '2030-01-01T00:00:00Z']) });
  }
  for (let i = 0; i < int(0, 4); i += 1) f.rules.push({ id: `r${i}`, ...(chance(0.15) ? { enabled: false } : {}), match: group(), serve: chance(0.6) ? { variation: variation() } : { rollout: rollout(keys) } });
  return f;
}

function randomSnapshot() {
  const flags = {};
  FLAGS.forEach((key, index) => {
    flags[key] = randomFlag(index);
  });
  const segments = {};
  for (const key of ['s0', 's1', 's2']) {
    segments[key] = { version: 1, match: group() };
    if (chance(0.5)) segments[key].include = [{ kind: pick(KINDS), key: pick(KEYS) }];
    if (chance(0.4)) segments[key].exclude = [{ kind: pick(KINDS), key: pick(KEYS) }];
  }
  const snapshot = {
    protocolVersion: 1, algorithmVersion: 'bucket-sha256-v1', environment: { id: 'env_1', key: 'production' }, revision: int(1, 99), generation: 1, projection: 'server', publishedAt: '2026-10-06T07:00:00Z',
    requiredCapabilities: Array.from(new Set(Object.values(flags).flatMap((f) => f.requires ?? []))), flags, segments, checksum: `sha256:${'0'.repeat(64)}`,
  };
  snapshot.checksum = checksumOf(snapshot);
  return snapshot;
}

function attributeValue(name) {
  if (chance(0.1)) return null;
  if (name === 'age' || name === 'n') return pick([...NUMS, '18', true]);
  if (name === 'tags') return pick([['a', 'b'], ['c'], [], [1, 2], ['pro']]);
  if (name === 'ver') return pick([...VERS, 4.2, null]);
  if (name === 'seen') return pick([...DATES, 1791273600]);
  if (name === 'beta') return pick([true, false, 'true', 1]);
  return pick([...STRS, pick(SAFE_NUMS), true, ['x'], ['PH', 'US']]);
}

function randomContext() {
  if (chance(0.02)) return pick([{ kind: 'User' }, { key: 'u_1' }, null, 'u', [], { kind: 'user', key: 5 }, { kind: 'user', attributes: { key: 1 } }, { kind: 'user', attributes: { x: { a: 1 } } }, { kind: 'user', attributes: { x: [1, 'a'] } }, { kind: 'user', extra: 1 }]);
  const context = { kind: pick(KINDS) };
  if (chance(0.9)) context.key = pick(KEYS);
  if (chance(0.9)) {
    context.attributes = {};
    for (const name of ATTRS) if (chance(0.5)) context.attributes[name] = attributeValue(name);
  }
  return context;
}

function randomEvaluation(snapshot) {
  const flagKey = chance(0.05) ? 'nope' : pick(FLAGS);
  const real = snapshot.flags[flagKey]?.type ?? 'boolean';
  const type = chance(0.08) ? pick(['boolean', 'string', 'number', 'json']) : real;
  const fallback = chance(0.04) ? pick([null, 'x', 5, true]) : type === 'boolean' ? false : type === 'string' ? 'fb' : type === 'number' ? 7 : { fb: true };
  return { flagKey, type, fallback, context: randomContext(), at: pick(['2026-10-06T08:00:00Z', '2026-10-06T07:59:59.999Z', '2026-10-06T08:00:00.001Z', '2026-10-06T09:00:00Z', '2025-01-01T00:00:00Z', '2031-01-01T00:00:00Z']), details: chance(0.5), trace: chance(0.6) };
}

const input = { version: 1, seed: Number(args.seed), parse: [], evaluate: [] };
const rich = richSnapshot();
for (let i = 0; i < Number(args.parse); i += 1) {
  input.parse.push({ id: i, text: i === 0 ? snapshotText(rich, true) : snapshotText(mutate(rich), chance(0.5)) });
}
for (let i = 0; i < Number(args.evaluate); i += 1) {
  const snapshot = randomSnapshot();
  input.evaluate.push({
    id: i,
    snapshotText: JSON.stringify(snapshot),
    cases: Array.from({ length: 25 }, () => randomEvaluation(snapshot)),
    bulk: Array.from({ length: 3 }, () => ({ context: randomContext(), at: '2026-10-06T08:00:00Z', details: chance(0.5), trace: chance(0.5) })),
  });
}
writeFileSync(args.out, JSON.stringify(input));
console.log(`Wrote ${args.out}: seed ${args.seed}, ${input.parse.length} snapshot texts, ${input.evaluate.length} snapshots with ${input.evaluate.length * 28} evaluations.`);
