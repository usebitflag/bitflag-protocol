// Builds or checks fixtures/manifest.json.
//   node tools/manifest.mjs           write the manifest
//   node tools/manifest.mjs --check   fail if the manifest is not current
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const fixturesDir = join(root, 'fixtures');
const manifestPath = join(fixturesDir, 'manifest.json');

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

function listFiles(dir) {
  return readdirSync(dir, { withFileTypes: true })
    .flatMap((entry) => {
      const path = join(dir, entry.name);
      return entry.isDirectory() ? listFiles(path) : [path];
    })
    .filter((path) => path !== manifestPath);
}

export function buildManifest() {
  const files = listFiles(fixturesDir)
    .map((path) => ({
      path: relative(fixturesDir, path).split(sep).join('/'),
      sha256: sha256(readFileSync(path)),
    }))
    .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));

  // The aggregate covers the sorted "path:checksum" lines, so renames and edits both change it.
  const aggregate = sha256(files.map((file) => `${file.path}:${file.sha256}\n`).join(''));

  return { algorithm: 'sha256', checksum: aggregate, files };
}

const serialize = (manifest) => `${JSON.stringify(manifest, null, 2)}\n`;

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const expected = serialize(buildManifest());

  if (process.argv.includes('--check')) {
    const actual = existsSync(manifestPath) ? readFileSync(manifestPath, 'utf8') : '';
    if (actual !== expected) {
      console.error('fixtures/manifest.json is not current. Run `npm run manifest` and commit the result.');
      process.exit(1);
    }
    console.log('fixtures/manifest.json is current.');
  } else {
    writeFileSync(manifestPath, expected);
    console.log(`Wrote fixtures/manifest.json (${buildManifest().files.length} files).`);
  }
}
