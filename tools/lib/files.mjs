import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = fileURLToPath(new URL('../..', import.meta.url));
export const fixturesDir = join(root, 'fixtures');

export function listFiles(dir, suffix) {
  return readdirSync(dir, { withFileTypes: true })
    .flatMap((entry) => {
      const path = join(dir, entry.name);
      return entry.isDirectory() ? listFiles(path, suffix) : [path];
    })
    .filter((path) => path.endsWith(suffix))
    .sort();
}
