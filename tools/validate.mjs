// Checks that every schema compiles, that every fixture is well formed, and that the manifest and checksums are current.
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { readdirSync, readFileSync } from 'node:fs';
import { existsSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { listFiles } from './lib/files.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const schemasDir = join(root, 'schemas');

function schemaFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return schemaFiles(path);
    return entry.name.endsWith('.schema.json') ? [path] : [];
  });
}

const ajv = new Ajv2020({ strict: true, allErrors: true });
addFormats(ajv);

const files = schemaFiles(schemasDir);

let failed = false;
for (const file of files) {
  try {
    ajv.addSchema(JSON.parse(readFileSync(file, 'utf8')), file);
  } catch (error) {
    failed = true;
    console.error(`Schema is invalid: ${file}\n  ${error.message}`);
  }
}
for (const file of files) {
  try {
    ajv.getSchema(file);
  } catch (error) {
    failed = true;
    console.error(`Schema does not compile: ${file}\n  ${error.message}`);
  }
}
console.log(`${files.length} schema(s) checked.`);

// Fixtures: schema-valid, id matches path, unique ids, references resolve, snapshots valid.
const fixturesDir = join(root, 'fixtures');
const validate = (id) => ajv.getSchema(`urn:bitflag:protocol:v1:${id}`);
const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'));
const fail = (message) => {
  failed = true;
  console.error(message);
};

function check(schemaId, document, label) {
  const fn = validate(schemaId);
  if (fn(document)) return true;
  fail(`${label} does not match ${schemaId}:\n${ajv.errorsText(fn.errors, { separator: '\n  ', dataVar: '' })}`);
  return false;
}

const snapshotFiles = existsSync(join(fixturesDir, 'snapshots')) ? listFiles(join(fixturesDir, 'snapshots'), '.json') : [];
for (const file of snapshotFiles) check('snapshot', readJson(file), relative(root, file));

const fixtureFiles = ['evaluation', 'snapshot']
  .map((dir) => join(fixturesDir, dir))
  .filter(existsSync)
  .flatMap((dir) => listFiles(dir, '.json'));
const seen = new Set();
for (const file of fixtureFiles) {
  const label = relative(root, file);
  const fixture = readJson(file);
  if (!check('fixture', fixture, label)) continue;
  // fixtures/evaluation/<category>/<name>.json is "<category>/<name>"; fixtures/snapshot/<name>.json is "snapshot/<name>".
  const relativePath = relative(fixturesDir, file).split(sep).join('/').replace(/\.json$/, '');
  const expectedId = relativePath.replace(/^evaluation\//, '');
  if (fixture.id !== expectedId) fail(`${label}: id "${fixture.id}" must match its path ("${expectedId}").`);
  if (seen.has(fixture.id)) fail(`${label}: duplicate fixture id "${fixture.id}".`);
  seen.add(fixture.id);

  const refs = [fixture.snapshotRef, ...(fixture.cases ?? []).map((c) => c.snapshotRef)].filter(Boolean);
  for (const ref of refs) if (!existsSync(join(fixturesDir, ref))) fail(`${label}: snapshotRef "${ref}" does not exist.`);

  // Snapshots that must be accepted have to satisfy the schema; rejected ones are checked by the evaluators.
  if (fixture.kind === 'snapshot' && fixture.expect.accept && fixture.snapshot) check('snapshot', fixture.snapshot, `${label} (snapshot)`);
  if (fixture.snapshot && fixture.kind !== 'snapshot') check('snapshot', fixture.snapshot, `${label} (snapshot)`);
}
console.log(`${snapshotFiles.length} snapshot(s) and ${fixtureFiles.length} fixture(s) checked.`);

const vectorsFile = join(fixturesDir, 'bucketing', 'bucket-sha256-v1.json');
if (existsSync(vectorsFile)) check('bucket-vectors', readJson(vectorsFile), relative(root, vectorsFile));

const bucketing = spawnSync(process.execPath, [join(root, 'tools/bucket.mjs'), '--check'], { stdio: 'inherit' });
if (bucketing.status !== 0) failed = true;

const canonical = spawnSync(process.execPath, [join(root, 'tools/canonical.mjs'), '--check'], { stdio: 'inherit' });
if (canonical.status !== 0) failed = true;

const checksums = spawnSync(process.execPath, [join(root, 'tools/checksum.mjs'), '--check'], { stdio: 'inherit' });
if (checksums.status !== 0) failed = true;

const manifest = spawnSync(process.execPath, [join(root, 'tools/manifest.mjs'), '--check'], { stdio: 'inherit' });
if (manifest.status !== 0) failed = true;

process.exit(failed ? 1 : 0);
