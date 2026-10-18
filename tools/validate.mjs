// Checks that every schema compiles and that the fixture manifest is current.
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

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

const manifest = spawnSync(process.execPath, [join(root, 'tools/manifest.mjs'), '--check'], { stdio: 'inherit' });
if (manifest.status !== 0) failed = true;

process.exit(failed ? 1 : 0);
