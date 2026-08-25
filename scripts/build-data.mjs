import { createHash } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import JSZip from 'jszip';
import { ARCHIVE, OUTPUT_DIR, RELEASE } from './config.mjs';

try {
  await readFile(ARCHIVE);
} catch {
  await import('./fetch-data.mjs');
}

const archive = await readFile(ARCHIVE);
const zip = await JSZip.loadAsync(archive);
const jsonFiles = Object.values(zip.files).filter((file) => !file.dir && file.name.endsWith('.json'));
if (!jsonFiles.length) throw new Error('The release archive does not contain JSON files.');

const entries = [];
const synsets = [];
const structuralFields = new Set([
  'id',
  'ili',
  'partOfSpeech',
  'pos',
  'definition',
  'definitions',
  'gloss',
  'example',
  'examples',
  'members',
  'member',
  'lemmas',
  'relations',
  'source',
  'subject',
  'lexfile',
  'wikidata',
]);
for (const file of jsonFiles) {
  const value = JSON.parse(await file.async('string'));
  const name = file.name.split('/').at(-1) ?? file.name;
  if (name.startsWith('entries-')) {
    for (const [lemma, partsOfSpeech] of Object.entries(value)) {
      for (const [partOfSpeech, entry] of Object.entries(partsOfSpeech)) {
        entries.push({ lemma, partOfSpeech, ...entry });
      }
    }
  } else if (name !== 'frames.json') {
    for (const [id, synset] of Object.entries(value)) synsets.push({ id, ...synset });
  }
}

if (!entries.length || !synsets.length) {
  throw new Error(`Unsupported release structure: found ${entries.length} entries and ${synsets.length} synsets.`);
}

const entryShards = new Map();
const synsetShards = new Map();
const indexMap = new Map();
const lemmaSenseCounts = new Map();
const skippedEntries = [];
let builtEntryCount = 0;

for (const source of entries) {
  const lemma =
    source.lemma ??
    source.writtenForm ??
    source.form ??
    source.id
      ?.replace(/^ewn-/, '')
      .replace(/-[nvars]$/, '')
      .replaceAll('_', ' ');
  const partOfSpeech = normalizePos(source.partOfSpeech ?? source.pos ?? inferPos(source.id));
  if (!lemma || !partOfSpeech) {
    skippedEntries.push(
      `${source.lemma ?? source.id ?? '(unknown)'}: invalid part of speech ${String(source.partOfSpeech ?? source.pos)}`,
    );
    continue;
  }
  const normalized = normalizeLemma(lemma);
  const bucket = entryBucket(normalized);
  const senses = toArray(source.senses ?? source.sense)
    .map((sense) => ({
      id: sense.id ?? `${normalized}%${partOfSpeech}`,
      synsetId: cleanId(sense.synset ?? sense.synsetId ?? sense.synset_id),
      relations: extractRelations(sense),
      frames: toArray(sense.frames ?? sense.subcat ?? sense.sent),
    }))
    .filter((sense) => sense.synsetId);
  if (!senses.length) {
    skippedEntries.push(`${lemma} (${partOfSpeech}): no synset-backed senses`);
    continue;
  }
  const record = {
    lemma,
    normalized,
    partOfSpeech,
    pronunciations: toArray(source.pronunciations ?? source.pronunciation)
      .map((item) => (typeof item === 'string' ? { value: item } : { value: item.value, variety: item.variety }))
      .filter((item) => item.value),
    senses,
  };
  const shard = entryShards.get(bucket) ?? Object.create(null);
  shard[normalized] = [...(shard[normalized] ?? []), record];
  entryShards.set(bucket, shard);
  builtEntryCount += 1;
  const formSenseCounts = lemmaSenseCounts.get(normalized) ?? new Map();
  formSenseCounts.set(lemma, (formSenseCounts.get(lemma) ?? 0) + senses.length);
  lemmaSenseCounts.set(normalized, formSenseCounts);
  const indexItem = indexMap.get(normalized) ?? { lemma, normalized, partsOfSpeech: [], bucket };
  if (!indexItem.partsOfSpeech.includes(partOfSpeech)) indexItem.partsOfSpeech.push(partOfSpeech);
  indexMap.set(normalized, indexItem);
}

for (const [normalized, indexItem] of indexMap) {
  const formSenseCounts = lemmaSenseCounts.get(normalized);
  if (!formSenseCounts) continue;
  indexItem.lemma = [...formSenseCounts].reduce(
    (current, [candidate, candidateSenseCount]) =>
      preferredLemma(current, formSenseCounts.get(current) ?? 0, candidate, candidateSenseCount),
    indexItem.lemma,
  );
}

for (const source of synsets) {
  const id = cleanId(source.id ?? source.synsetId);
  const partOfSpeech = normalizePos(source.partOfSpeech ?? source.pos ?? inferPos(id));
  if (!id || !partOfSpeech) continue;
  const record = {
    id,
    partOfSpeech,
    definitions: toArray(source.definitions ?? source.definition ?? source.gloss)
      .map(textOf)
      .filter(Boolean),
    examples: toArray(source.examples ?? source.example)
      .map((item) =>
        typeof item === 'string' ? { text: item } : { text: item.text ?? item.value, source: item.source },
      )
      .filter((item) => item.text),
    members: toArray(source.members ?? source.member ?? source.lemmas)
      .map((item) => (typeof item === 'string' ? item : (item.lemma ?? item.writtenForm ?? item.id)))
      .filter(Boolean),
    relations: extractRelations(source),
    ili: source.ili,
    subject: source.subject ?? source.lexfile,
    source: typeof source.source === 'string' ? source.source : undefined,
  };
  const bucket = synsetBucket(id);
  const shard = synsetShards.get(bucket) ?? Object.create(null);
  shard[id] = record;
  synsetShards.set(bucket, shard);
}

await rm(OUTPUT_DIR, { recursive: true, force: true });
await mkdir(new URL('entries/', OUTPUT_DIR), { recursive: true });
await mkdir(new URL('synsets/', OUTPUT_DIR), { recursive: true });

const files = [];
for (const [bucket, shard] of [...entryShards].sort(([a], [b]) => a.localeCompare(b)))
  files.push(await writeJson(`entries/${bucket}.json`, shard));
for (const [bucket, shard] of [...synsetShards].sort(([a], [b]) => a.localeCompare(b)))
  files.push(await writeJson(`synsets/${bucket}.json`, shard));

const index = [...indexMap.values()].sort((a, b) => compareNormalized(a.normalized, b.normalized));
await writeFile(new URL('index.json', OUTPUT_DIR), JSON.stringify(index));
const manifest = {
  schemaVersion: 1,
  id: RELEASE.id,
  title: RELEASE.title,
  edition: RELEASE.edition,
  variant: RELEASE.variant,
  source: 'https://github.com/globalwordnet/english-wordnet',
  generatedAt: RELEASE.releasedAt,
  counts: { lemmas: index.length, entries: builtEntryCount, synsets: synsets.length },
  files,
  license: {
    name: 'CC BY 4.0 and WordNet License',
    attribution:
      'This work incorporates Princeton WordNet and Open English Wordnet. Copyright Open English Wordnet contributors.',
    url: 'https://github.com/globalwordnet/english-wordnet/blob/master/LICENSE.md',
  },
};
await writeFile(new URL('manifest.json', OUTPUT_DIR), JSON.stringify(manifest, null, 2));
console.log(
  `Built ${index.length.toLocaleString()} lemmas, ${builtEntryCount.toLocaleString()} entries, and ${synsets.length.toLocaleString()} synsets in ${files.length} shards.`,
);
if (skippedEntries.length)
  console.warn(`Skipped ${skippedEntries.length} source entries. Examples: ${skippedEntries.slice(0, 5).join('; ')}`);

async function writeJson(path, value) {
  const content = JSON.stringify(value);
  await writeFile(new URL(path, OUTPUT_DIR), content);
  return { path, bytes: Buffer.byteLength(content), sha256: createHash('sha256').update(content).digest('hex') };
}

function toArray(value) {
  return value == null ? [] : Array.isArray(value) ? value : [value];
}
function textOf(value) {
  return typeof value === 'string' ? value : (value?.text ?? value?.value ?? '');
}
function cleanId(value) {
  return typeof value === 'string' ? value.replace(/^ewn-/, '') : '';
}
function inferPos(id = '') {
  return id.match(/-([nvars])(?:-|$)/)?.[1] ?? id.match(/-([nvars])$/)?.[1];
}
function normalizePos(value) {
  if (value === 'adjective_satellite') return 's';
  const named = { noun: 'n', verb: 'v', adjective: 'a', adverb: 'r' }[value];
  if (named) return named;
  return typeof value === 'string' && /^[nvars](?:-\d+)?$/.test(value) ? value[0] : undefined;
}
function normalizeLemma(value) {
  return value.normalize('NFKC').trim().replaceAll('_', ' ').replace(/\s+/g, ' ').toLocaleLowerCase('en-US');
}
function compareNormalized(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}
function preferredLemma(current, currentSenseCount, candidate, candidateSenseCount) {
  return candidateSenseCount > currentSenseCount ? candidate : current;
}
function entryBucket(value) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0').slice(0, 2);
}
function synsetBucket(id) {
  return id.match(/\d{3}/)?.[0] ?? 'other';
}

function extractRelations(record) {
  const output = [];
  for (const [type, values] of Object.entries(record)) {
    if (structuralFields.has(type) || !Array.isArray(values)) continue;
    for (const value of values) {
      const target = cleanId(typeof value === 'string' ? value : (value?.target ?? value?.id));
      if (target && /\d{4,}.*-[nvars]$/.test(target)) output.push({ type, target });
    }
  }
  for (const relation of toArray(record.relations)) {
    const target = cleanId(relation.target ?? relation.synset);
    if (target) output.push({ type: relation.type ?? relation.relType, target });
  }
  return output;
}
