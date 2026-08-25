import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { ARCHIVE, RELEASE, SOURCE_DIR } from './config.mjs';

await mkdir(SOURCE_DIR, { recursive: true });

let archive;
try {
  archive = await readFile(ARCHIVE);
  if (RELEASE.sha256 && digest(archive) !== RELEASE.sha256) archive = undefined;
} catch {
  archive = undefined;
}

if (!archive) {
  console.log(`Downloading ${RELEASE.title}...`);
  const response = await fetch(RELEASE.url, { redirect: 'follow' });
  if (!response.ok) throw new Error(`Download failed: ${response.status} ${response.statusText}`);
  archive = Buffer.from(await response.arrayBuffer());
  await writeFile(ARCHIVE, archive);
}

const checksum = digest(archive);
if (RELEASE.sha256 && checksum !== RELEASE.sha256) {
  throw new Error(`Checksum mismatch. Expected ${RELEASE.sha256}, received ${checksum}`);
}
console.log(`${archive.length.toLocaleString()} bytes, SHA-256 ${checksum}`);

function digest(value) {
  return createHash('sha256').update(value).digest('hex');
}
