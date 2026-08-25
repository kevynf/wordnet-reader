import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { OUTPUT_DIR } from './config.mjs';

const manifest = JSON.parse(await readFile(new URL('manifest.json', OUTPUT_DIR), 'utf8'));
const index = JSON.parse(await readFile(new URL('index.json', OUTPUT_DIR), 'utf8'));
const synsetIds = new Set();
const senseTargets = [];
let entryCount = 0;
let synsetCount = 0;

if (manifest.schemaVersion !== 1) throw new Error(`Unsupported schema version: ${manifest.schemaVersion}`);
if (index.length !== manifest.counts.lemmas) throw new Error('Lemma count does not match manifest.');
const normalizedLemmas = new Set();
for (let position = 1; position < index.length; position += 1) {
  if (compareNormalized(index[position - 1].normalized, index[position].normalized) > 0) {
    throw new Error(`Index is not sorted at ${index[position].normalized}.`);
  }
}
for (const item of index) {
  if (!item.lemma || normalizeLemma(item.lemma) !== item.normalized) {
    throw new Error(`Invalid normalized lemma: ${item.lemma}`);
  }
  if (normalizedLemmas.has(item.normalized)) throw new Error(`Duplicate normalized lemma: ${item.normalized}`);
  if (!Array.isArray(item.partsOfSpeech) || !item.partsOfSpeech.every((part) => /^[nvars]$/.test(part))) {
    throw new Error(`Invalid part of speech for ${item.lemma}`);
  }
  normalizedLemmas.add(item.normalized);
}

for (const file of manifest.files) {
  const content = await readFile(new URL(file.path, OUTPUT_DIR));
  if (content.length !== file.bytes) throw new Error(`Size mismatch: ${file.path}`);
  if (file.sha256 && createHash('sha256').update(content).digest('hex') !== file.sha256) {
    throw new Error(`Checksum mismatch: ${file.path}`);
  }
  const shard = JSON.parse(content);
  if (file.path.startsWith('entries/')) {
    for (const records of Object.values(shard)) {
      entryCount += records.length;
      for (const entry of records) for (const sense of entry.senses) senseTargets.push(sense.synsetId);
    }
  } else {
    for (const id of Object.keys(shard)) synsetIds.add(id);
    synsetCount += Object.keys(shard).length;
  }
}

if (entryCount !== manifest.counts.entries) throw new Error(`Entry count mismatch: ${entryCount}`);
if (synsetCount !== manifest.counts.synsets) throw new Error(`Synset count mismatch: ${synsetCount}`);
const missing = [...new Set(senseTargets.filter((id) => !synsetIds.has(id)))];
if (missing.length)
  throw new Error(`${missing.length} sense targets are missing, beginning with ${missing.slice(0, 5).join(', ')}.`);

for (const expected of ['ask', 'dictionary', 'a. noam chomsky']) {
  if (!index.some((item) => item.normalized === expected)) throw new Error(`Expected lemma missing: ${expected}`);
}

console.log(
  `Verified ${index.length.toLocaleString()} lemmas, ${entryCount.toLocaleString()} entries, ${synsetCount.toLocaleString()} synsets, and ${manifest.files.length} checksummed shards.`,
);

function normalizeLemma(value) {
  return value.normalize('NFKC').trim().replaceAll('_', ' ').replace(/\s+/g, ' ').toLocaleLowerCase('en-US');
}

function compareNormalized(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}
