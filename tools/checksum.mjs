// Computes snapshot checksums: "sha256:" + hex(SHA-256(canonical(snapshot without "checksum"))).
//   node tools/checksum.mjs --check   fail if a fixture snapshot carries a stale checksum
//   node tools/checksum.mjs --write   rewrite the checksum of every fixture snapshot
// Checked: fixtures/snapshots/*.json and the inline snapshot of evaluation fixtures.
// Snapshot-level fixtures are skipped because they may carry a deliberately wrong checksum.
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalize } from './lib/canonical.mjs';
import { fixturesDir, listFiles, root } from './lib/files.mjs';

export function checksumOf(snapshot) {
  const { checksum, ...rest } = snapshot;
  return `sha256:${createHash('sha256').update(canonicalize(rest), 'utf8').digest('hex')}`;
}

// Yields [file, document, snapshot] for every snapshot whose checksum this tool maintains.
function* maintained() {
  for (const file of listFiles(join(fixturesDir, 'snapshots'), '.json')) {
    const document = JSON.parse(readFileSync(file, 'utf8'));
    yield [file, document, document];
  }
  for (const file of listFiles(join(fixturesDir, 'evaluation'), '.json')) {
    const document = JSON.parse(readFileSync(file, 'utf8'));
    if (document.snapshot) yield [file, document, document.snapshot];
  }
}

const write = (file, document) => writeFileSync(file, `${JSON.stringify(document, null, 2)}\n`);

export function run(mode) {
  let stale = 0;
  for (const [file, document, snapshot] of maintained()) {
    const expected = checksumOf(snapshot);
    if (snapshot.checksum === expected) continue;
    stale += 1;
    if (mode === 'write') {
      snapshot.checksum = expected;
      write(file, document);
    } else {
      console.error(`Stale checksum in ${relative(root, file)}. Run \`npm run checksum\`.`);
    }
  }
  if (mode === 'write') console.log(`Updated ${stale} checksum(s).`);
  else if (stale === 0) console.log('Fixture snapshot checksums are current.');
  return stale;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const mode = process.argv.includes('--write') ? 'write' : 'check';
  const stale = run(mode);
  process.exit(mode === 'check' && stale > 0 ? 1 : 0);
}
