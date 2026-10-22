// Builds the release archive and SHA256SUMS.
//   node tools/pack.mjs <version> [outDir]
// The archive holds spec/, schemas/, fixtures/, examples/, CHANGELOG.md and VERSION under
// bitflag-protocol-<version>/. It is reproducible: entries are sorted, owners and times are fixed, and the
// gzip stream carries no timestamp, so the same tree always gives the same checksum.
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { listFiles, root } from './lib/files.mjs';

const INCLUDE = ['spec', 'schemas', 'fixtures', 'examples'];
const VERSION_PATTERN = /^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/;

function header(path, size) {
  const block = Buffer.alloc(512);
  let name = path;
  let prefix = '';
  if (Buffer.byteLength(path) > 100) {
    const cut = path.lastIndexOf('/', 155);
    prefix = path.slice(0, cut);
    name = path.slice(cut + 1);
    if (Buffer.byteLength(name) > 100 || cut <= 0) throw new Error(`Path too long for the tar format: ${path}`);
  }
  block.write(name, 0, 'utf8');
  block.write('0000644\0', 100); // mode
  block.write('0000000\0', 108); // uid
  block.write('0000000\0', 116); // gid
  block.write(`${size.toString(8).padStart(11, '0')}\0`, 124);
  block.write('00000000000\0', 136); // mtime: the epoch
  block.write('        ', 148); // checksum placeholder: eight spaces
  block.write('0', 156); // regular file
  block.write('ustar\0', 257);
  block.write('00', 263);
  block.write(prefix, 345, 'utf8');
  let sum = 0;
  for (const byte of block) sum += byte;
  block.write(`${sum.toString(8).padStart(6, '0')}\0 `, 148);
  return block;
}

export function buildArchive(version) {
  const top = `bitflag-protocol-${version}`;
  const entries = [];
  for (const dir of INCLUDE) {
    for (const file of listFiles(join(root, dir), '')) {
      entries.push([`${top}/${relative(root, file).split(sep).join('/')}`, readFileSync(file)]);
    }
  }
  entries.push([`${top}/CHANGELOG.md`, readFileSync(join(root, 'CHANGELOG.md'))]);
  entries.push([`${top}/VERSION`, Buffer.from(`${version}\n`)]);
  entries.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));

  const parts = [];
  for (const [path, data] of entries) {
    parts.push(header(path, data.length), data, Buffer.alloc((512 - (data.length % 512)) % 512));
  }
  parts.push(Buffer.alloc(1024));
  const gz = gzipSync(Buffer.concat(parts), { level: 9 });
  gz[4] = gz[5] = gz[6] = gz[7] = 0; // zero the gzip modification time
  return gz;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const version = process.argv[2];
  if (!version || !VERSION_PATTERN.test(version)) {
    console.error('Usage: node tools/pack.mjs <version> [outDir]   (for example 0.1.0-alpha.1)');
    process.exit(1);
  }
  const outDir = process.argv[3] ?? join(root, 'dist');
  mkdirSync(outDir, { recursive: true });
  const archive = buildArchive(version);
  const name = `bitflag-protocol-${version}.tar.gz`;
  writeFileSync(join(outDir, name), archive);
  const sum = createHash('sha256').update(archive).digest('hex');
  writeFileSync(join(outDir, 'SHA256SUMS'), `${sum}  ${name}\n`);
  console.log(`${name}\n${sum}`);
}
