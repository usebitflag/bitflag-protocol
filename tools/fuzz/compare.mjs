// Compares the outputs of the evaluators' fuzz harnesses (see spec/10-conformance.md).
//   node tools/fuzz/compare.mjs fuzz-input.json output-a.json output-b.json
// Exits 1 when the outputs differ in any value, or when a harness crashed (an output that is not a result).
import { readFileSync } from 'node:fs';

const [inputPath, pathA, pathB] = process.argv.slice(2);
if (!inputPath || !pathA || !pathB) {
  console.error('Usage: node tools/fuzz/compare.mjs fuzz-input.json output-a.json output-b.json');
  process.exit(2);
}
const read = (path) => JSON.parse(readFileSync(path, 'utf8'));
const input = read(inputPath);
const [a, b] = [read(pathA), read(pathB)];
const names = [a.evaluator ?? 'a', b.evaluator ?? 'b'];

const problems = [];
const show = (value) => JSON.stringify(value)?.slice(0, 600);
const crashed = (value) => typeof value === 'string' && value.startsWith('CRASH');

let parseSame = 0;
let accepted = 0;
for (const item of input.parse) {
  const x = a.parse[item.id];
  const y = b.parse[item.id];
  if (x?.accepted) accepted += 1;
  if (JSON.stringify(x) === JSON.stringify(y) && x !== undefined && x.thrown === undefined) parseSame += 1;
  else problems.push({ kind: 'parse', id: item.id, [names[0]]: x, [names[1]]: y });
}

let evaluations = 0;
let evaluationSame = 0;
let rejected = 0;
const reasons = {};
for (const item of input.evaluate) {
  const x = a.evaluate[item.id];
  const y = b.evaluate[item.id];
  if (!Array.isArray(x) || !Array.isArray(y)) {
    rejected += 1;
    if (JSON.stringify(x) !== JSON.stringify(y)) problems.push({ kind: 'snapshot', id: item.id, [names[0]]: x, [names[1]]: y });
    continue;
  }
  x.forEach((left, index) => {
    evaluations += 1;
    const right = y[index];
    if (left === right && !crashed(left)) {
      evaluationSame += 1;
      try {
        const reason = JSON.parse(left).reason;
        if (reason) reasons[reason] = (reasons[reason] ?? 0) + 1;
      } catch {
        // a thrown FallbackTypeError is recorded as text
      }
    } else problems.push({ kind: 'evaluate', id: item.id, index, [names[0]]: left, [names[1]]: right });
  });
}

console.log(`seed ${input.seed}: ${input.parse.length} snapshot texts (${parseSame} identical, ${accepted} accepted), ${evaluations} evaluations (${evaluationSame} identical), ${rejected} generated snapshots rejected`);
console.log(`reasons seen: ${JSON.stringify(reasons)}`);
for (const problem of problems.slice(0, 10)) console.log('DIFFERENCE', show(problem));
if (problems.length > 0) {
  console.error(`${problems.length} difference(s) between ${names[0]} and ${names[1]}.`);
  process.exit(1);
}
