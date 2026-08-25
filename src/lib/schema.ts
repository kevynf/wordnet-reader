import type { DictionaryManifest, LemmaIndexItem, PartOfSpeech } from '../types';
import { compareNormalized, normalizeLemma } from './normalize';

const partsOfSpeech = new Set<PartOfSpeech>(['n', 'v', 'a', 's', 'r']);

export function parseManifest(value: unknown): DictionaryManifest {
  if (!isRecord(value) || value.schemaVersion !== 1) throw new Error('Unsupported dictionary schema');
  if (!isString(value.id) || !isString(value.title) || !isString(value.edition) || !isString(value.variant)) {
    throw new Error('Invalid dictionary manifest identity');
  }
  if (!isString(value.source) || !isString(value.generatedAt)) throw new Error('Invalid dictionary manifest source');
  if (
    !isRecord(value.counts) ||
    !isCount(value.counts.lemmas) ||
    !isCount(value.counts.entries) ||
    !isCount(value.counts.synsets)
  ) {
    throw new Error('Invalid dictionary manifest counts');
  }
  if (
    !Array.isArray(value.files) ||
    !value.files.every((file) => isRecord(file) && isString(file.path) && isCount(file.bytes))
  ) {
    throw new Error('Invalid dictionary manifest files');
  }
  if (
    !isRecord(value.license) ||
    !isString(value.license.name) ||
    !isString(value.license.attribution) ||
    !isString(value.license.url)
  ) {
    throw new Error('Invalid dictionary manifest license');
  }
  return value as unknown as DictionaryManifest;
}

export function parseLemmaIndex(value: unknown): LemmaIndexItem[] {
  if (!Array.isArray(value)) throw new Error('Invalid dictionary index');

  let previous = '';
  let sorted = true;
  const seen = new Set<string>();
  for (const item of value) {
    if (
      !isRecord(item) ||
      !isString(item.lemma) ||
      !isString(item.normalized) ||
      !isString(item.bucket) ||
      !Array.isArray(item.partsOfSpeech) ||
      item.partsOfSpeech.length === 0 ||
      !item.partsOfSpeech.every((part) => typeof part === 'string' && partsOfSpeech.has(part as PartOfSpeech))
    ) {
      throw new Error('Invalid dictionary index entry');
    }
    if (normalizeLemma(item.lemma) !== item.normalized) throw new Error(`Invalid normalized lemma: ${item.lemma}`);
    if (seen.has(item.normalized)) throw new Error(`Duplicate normalized lemma: ${item.normalized}`);
    if (previous && compareNormalized(previous, item.normalized) > 0) sorted = false;
    seen.add(item.normalized);
    previous = item.normalized;
  }
  const index = value as LemmaIndexItem[];
  return sorted ? index : [...index].sort((left, right) => compareNormalized(left.normalized, right.normalized));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function isCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}
