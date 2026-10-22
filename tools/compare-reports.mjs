// Compares conformance reports from two or more evaluators (see spec/10-conformance.md).
//   node tools/compare-reports.mjs report-a.json report-b.json [...]
// Exits with 1 when any case or snapshot fixture differs in value, variation, reason, error kind, rule ID,
// prerequisite key, bucket, experiment fields, revision or generation.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const FIELDS = ['value', 'variationKey', 'reason', 'ruleId', 'prerequisiteKey', 'errorKind', 'revision', 'generation', 'bucket', 'experimentId', 'allocationId'];

// Numbers compare numerically, so 20 and 20.0 are the same; everything else compares by JSON value.
const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

export function compare(reports) {
  const differences = [];
  const [first, ...others] = reports;
  const index = (report) => new Map(report.results.map((r) => [`${r.fixture}#${r.case}`, r]));
  const snapshots = (report) => new Map(report.snapshots.map((r) => [r.fixture, r]));
  for (const other of others) {
    const a = index(first);
    const b = index(other);
    for (const key of new Set([...a.keys(), ...b.keys()])) {
      const x = a.get(key);
      const y = b.get(key);
      if (!x || !y) {
        differences.push(`${key}: reported by ${x ? first.evaluator.name : other.evaluator.name} only`);
      } else if ('threw' in x || 'threw' in y) {
        if (x.threw !== y.threw) differences.push(`${key}: threw ${x.threw} vs ${y.threw}`);
      } else {
        for (const field of FIELDS) {
          if (!same(x.result[field], y.result[field])) differences.push(`${key}: ${field} ${JSON.stringify(x.result[field])} (${first.evaluator.name}) vs ${JSON.stringify(y.result[field])} (${other.evaluator.name})`);
        }
      }
    }
    const sa = snapshots(first);
    const sb = snapshots(other);
    for (const key of new Set([...sa.keys(), ...sb.keys()])) {
      const x = sa.get(key);
      const y = sb.get(key);
      if (!x || !y) differences.push(`${key}: reported by one evaluator only`);
      else for (const field of ['accepted', 'errorKind', 'path', 'code']) if (!same(x[field], y[field])) differences.push(`${key}: ${field} ${JSON.stringify(x[field])} vs ${JSON.stringify(y[field])}`);
    }
  }
  return differences;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const files = process.argv.slice(2);
  if (files.length < 2) {
    console.error('Usage: node tools/compare-reports.mjs report-a.json report-b.json [...]');
    process.exit(1);
  }
  const differences = compare(files.map((file) => JSON.parse(readFileSync(file, 'utf8'))));
  for (const line of differences) console.error(line);
  console.log(differences.length === 0 ? `No differences between ${files.length} reports.` : `${differences.length} difference(s).`);
  process.exit(differences.length === 0 ? 0 : 1);
}
