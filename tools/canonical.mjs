// Canonical JSON (RFC 8785) reference utility. Generates and checks fixtures/canonical/*.json.
//   node tools/canonical.mjs --write   regenerate the vector files
//   node tools/canonical.mjs --check   fail if the files differ from the generated vectors
// Each file is { "input", "canonical", "checksum" }: the input as written, its canonical form, and
// "sha256:" + hex(SHA-256(canonical UTF-8 bytes)). Inputs are kept as literal text so that forms such
// as -0, 1E2 or 1.0 reach the evaluators exactly as written.
// This is a reference for generating vectors. It is not one of the two evaluators.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalize } from './lib/canonical.mjs';
import { fixturesDir } from './lib/files.mjs';

const dir = join(fixturesDir, 'canonical');

// RFC 8785 Appendix B: IEEE 754 bit patterns and their canonical text.
const appendixB = [
  ['0000000000000000', '0'],
  ['8000000000000000', '0'],
  ['0000000000000001', '5e-324'],
  ['8000000000000001', '-5e-324'],
  ['7fefffffffffffff', '1.7976931348623157e+308'],
  ['ffefffffffffffff', '-1.7976931348623157e+308'],
  ['4340000000000000', '9007199254740992'],
  ['c340000000000000', '-9007199254740992'],
  ['4430000000000000', '295147905179352830000'],
  ['44b52d02c7e14af5', '9.999999999999997e+22'],
  ['44b52d02c7e14af6', '1e+23'],
  ['44b52d02c7e14af7', '1.0000000000000001e+23'],
  ['444b1ae4d6e2ef4e', '999999999999999700000'],
  ['444b1ae4d6e2ef4f', '999999999999999900000'],
  ['444b1ae4d6e2ef50', '1e+21'],
  ['3eb0c6f7a0b5ed8c', '9.999999999999997e-7'],
  ['3eb0c6f7a0b5ed8d', '0.000001'],
  ['41b3de4355555553', '333333333.3333332'],
  ['41b3de4355555554', '333333333.33333325'],
  ['41b3de4355555555', '333333333.3333333'],
  ['41b3de4355555556', '333333333.3333334'],
  ['41b3de4355555557', '333333333.33333343'],
  ['becbf647612f3696', '-0.0000033333333333333333'],
  ['43143ff3c1cb0959', '1424953923781206.2'],
];

function appendixBInput() {
  // A long exponential form of each double, parsed back to the same value by any conforming parser.
  const literal = ([hex]) => {
    const value = Buffer.from(hex, 'hex').readDoubleBE(0);
    return Object.is(value, -0) ? '-0' : value.toExponential(30);
  };
  return `[${appendixB.map(literal).join(', ')}]`;
}

// name -> literal JSON text of the input
export const inputs = {
  'rfc8785-sample': '{"numbers": [333333333.33333329, 1E30, 4.50, 2e-3, 0.000000000000000000000000001], "string": "\\u20ac$\\u000F\\u000aA\'\\u0042\\u0022\\u005c\\\\\\"\\/", "literals": [null, true, false]}',
  'key-order-utf16': '{"\\u20ac": "Euro Sign", "\\r": "Carriage Return", "\\ufb33": "Hebrew Letter Dalet With Dagesh", "1": "One", "\\ud83d\\ude00": "Emoji: Grinning Face", "\\u0080": "Control", "\\u00f6": "Latin Small Letter O With Diaeresis"}',
  'key-order-ascii': '{"b": 1, "a": 2, "B": 3, "_": 4, "A": 5, "10": 6, "9": 7, "": 8}',
  'key-order-nested': '{"z": {"y": [{"b": 1, "a": 2}], "x": {"d": null, "c": null}}, "a": []}',
  'whitespace-removed': '\n{ "a" :\t[ 1 ,\r\n 2 ] ,\n  "b" : { } }\n',
  'empty-containers': '{"c": "", "b": [], "a": {}}',
  'literals': '[null, true, false]',
  'array-order-kept': '[[3, 2, 1], [{"b": 1, "a": 2}], "b", "a"]',
  'numbers-integers': '[0, -0, 1, -1, 100, 1E2, 1.0, 10.50, 9007199254740991, -9007199254740991, 1e0, 12e1]',
  'numbers-fractions': '[0.1, 0.5, 1.5, 0.30000000000000004, 123.456, 1.0e-1, 0.10, 100.0e-2]',
  'numbers-exponent-boundaries': '[1e20, 100000000000000000000, 1e21, 1E+21, 999999999999999900000, 1e22, 1e-6, 0.000001, 1e-7, 0.0000001, 1.5e-7, 123456789e-15]',
  'numbers-extremes': '[1.7976931348623157e308, 5e-324, 2.2250738585072014e-308, 4.9e-324, 9007199254740993, 1e23]',
  'negative-zero': '{"a": -0, "b": -0.0, "c": [-0, -0e5], "d": 0}',
  'numbers-rfc8785-appendix-b': appendixBInput(),
  'strings-escapes': '["\\u0000\\u0001\\u001f", "\\b\\t\\n\\f\\r", "\\"\\\\", "\\/", "\\u007f", "\\u2028\\u2029", "\\u0008\\u000c"]',
  'strings-unicode-literal': '["\u00e9", "\u65e5\u672c\u8a9e", "\ud83d\ude00", "e\u0301", "\\u00e9", "\\ud83d\\ude00"]',
  'strings-normalization-forms': '{"\u00e9": "nfc", "e\u0301": "nfd"}',
  'checksum-member-is-ordinary': '{"checksum": "sha256:0000", "a": 1}',
};

function build() {
  const files = new Map();
  for (const [name, input] of Object.entries(inputs)) {
    const canonical = canonicalize(JSON.parse(input));
    const checksum = `sha256:${createHash('sha256').update(canonical, 'utf8').digest('hex')}`;
    files.set(`${name}.json`, `{\n  "input": ${input.trim()},\n  "canonical": ${JSON.stringify(canonical)},\n  "checksum": "${checksum}"\n}\n`);
  }
  return files;
}

function problems() {
  const found = [];
  const computed = JSON.parse(appendixBInput()).map((n) => canonicalize(n));
  appendixB.forEach(([hex, expected], index) => {
    if (computed[index] !== expected) found.push(`RFC 8785 Appendix B ${hex}: expected ${expected}, got ${computed[index]}.`);
  });

  const files = build();
  for (const [name, text] of files) {
    const path = join(dir, name);
    if (!existsSync(path) || readFileSync(path, 'utf8') !== text) found.push(`fixtures/canonical/${name} is not current. Run \`npm run canonical\`.`);
  }
  const present = existsSync(dir) ? readdirSync(dir) : [];
  for (const name of present) if (!files.has(name)) found.push(`fixtures/canonical/${name} is not generated by tools/canonical.mjs.`);
  return found;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.argv.includes('--write')) {
    mkdirSync(dir, { recursive: true });
    for (const name of readdirSync(dir)) rmSync(join(dir, name));
    const files = build();
    for (const [name, text] of files) writeFileSync(join(dir, name), text);
    console.log(`Wrote ${files.size} canonical vectors.`);
  } else {
    const found = problems();
    for (const message of found) console.error(message);
    if (found.length > 0) process.exit(1);
    console.log('Canonical vectors are current.');
  }
}
