import type { DictionaryData, EntryRecord, LemmaIndexItem, SynsetRecord } from '../types';
import { compareNormalized, normalizeLemma, preferredLemma, synsetBucket } from './normalize';
import { parseLemmaIndex, parseManifest } from './schema';

type EntryShard = Record<string, EntryRecord[]>;
type SynsetShard = Record<string, SynsetRecord>;

export interface LookupResult {
  item: LemmaIndexItem;
  entries: EntryRecord[];
  synsets: Map<string, SynsetRecord>;
}

export class DictionaryClient {
  private baseUrl = '';
  private data?: DictionaryData;
  private entryShards = new Map<string, EntryShard>();
  private synsetShards = new Map<string, SynsetShard>();

  async initialize(): Promise<DictionaryData> {
    if (this.data) return this.data;
    const candidates = ['data/2025-plus/', 'data/demo/'];
    let lastError: unknown;

    for (const candidate of candidates) {
      const baseUrl = new URL(candidate, document.baseURI).href;
      try {
        const [manifestResponse, indexResponse] = await Promise.all([
          fetch(`${baseUrl}manifest.json`),
          fetch(`${baseUrl}index.json`),
        ]);
        if (!manifestResponse.ok || !indexResponse.ok) throw new Error('Dictionary files unavailable');
        const manifest = parseManifest(await manifestResponse.json());
        const index = parseLemmaIndex(await indexResponse.json());
        if (index.length !== manifest.counts.lemmas) throw new Error('Dictionary index count mismatch');
        this.baseUrl = baseUrl;
        this.data = { manifest, index };
        return this.data;
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError instanceof Error ? lastError : new Error('Unable to load dictionary data');
  }

  getBaseUrl(): string {
    return this.baseUrl;
  }

  search(query: string, limit = 12): LemmaIndexItem[] {
    return this.data ? searchIndex(this.data.index, query, limit) : [];
  }

  async lookup(lemma: string): Promise<LookupResult | null> {
    await this.initialize();
    const normalized = normalizeLemma(lemma);
    const position = this.data ? lowerBound(this.data.index, normalized) : -1;
    const item = position >= 0 ? this.data?.index[position] : undefined;
    if (item?.normalized !== normalized) return null;
    const shard = await this.loadEntryShard(item.bucket);
    const entries = shard[normalized] ?? [];
    const lemmaSenseCounts = new Map<string, number>();
    for (const entry of entries) {
      lemmaSenseCounts.set(entry.lemma, (lemmaSenseCounts.get(entry.lemma) ?? 0) + entry.senses.length);
    }
    const displayLemma = [...lemmaSenseCounts].reduce(
      (current, [candidate, candidateSenseCount]) =>
        preferredLemma(current, lemmaSenseCounts.get(current) ?? 0, candidate, candidateSenseCount),
      item.lemma,
    );
    const synsetIds = entries.flatMap((entry) => entry.senses.map((sense) => sense.synsetId));
    const synsets = await this.loadSynsets(synsetIds);
    return {
      item: displayLemma === item.lemma ? item : { ...item, lemma: displayLemma },
      entries,
      synsets,
    };
  }

  async loadSynsets(ids: string[]): Promise<Map<string, SynsetRecord>> {
    const buckets = [...new Set(ids.map(synsetBucket))];
    await Promise.all(buckets.map((bucket) => this.loadSynsetShard(bucket)));
    const result = new Map<string, SynsetRecord>();
    for (const id of ids) {
      const synset = this.synsetShards.get(synsetBucket(id))?.[id];
      if (synset) result.set(id, synset);
    }
    return result;
  }

  private async loadEntryShard(bucket: string): Promise<EntryShard> {
    const cached = this.entryShards.get(bucket);
    if (cached) return cached;
    const response = await fetch(`${this.baseUrl}entries/${bucket}.json`);
    if (!response.ok) throw new Error(`Unable to load entry shard ${bucket}`);
    const shard = (await response.json()) as EntryShard;
    this.entryShards.set(bucket, shard);
    return shard;
  }

  private async loadSynsetShard(bucket: string): Promise<SynsetShard> {
    const cached = this.synsetShards.get(bucket);
    if (cached) return cached;
    const response = await fetch(`${this.baseUrl}synsets/${bucket}.json`);
    if (!response.ok) throw new Error(`Unable to load synset shard ${bucket}`);
    const shard = (await response.json()) as SynsetShard;
    this.synsetShards.set(bucket, shard);
    return shard;
  }
}

export function searchIndex(index: LemmaIndexItem[], query: string, limit = 12): LemmaIndexItem[] {
  const normalized = normalizeLemma(query);
  if (!normalized || limit <= 0) return [];
  const start = lowerBound(index, normalized);
  const matches: LemmaIndexItem[] = [];
  for (let position = start; position < index.length && matches.length < limit; position += 1) {
    const item = index[position];
    if (!item.normalized.startsWith(normalized)) break;
    matches.push(item);
  }
  return matches.sort((left, right) => {
    const exactLeft = left.normalized === normalized ? 0 : 1;
    const exactRight = right.normalized === normalized ? 0 : 1;
    return (
      exactLeft - exactRight ||
      left.normalized.length - right.normalized.length ||
      compareNormalized(left.normalized, right.normalized)
    );
  });
}

function lowerBound(index: LemmaIndexItem[], normalized: string): number {
  let low = 0;
  let high = index.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (compareNormalized(index[middle].normalized, normalized) < 0) low = middle + 1;
    else high = middle;
  }
  return low;
}

export const dictionary = new DictionaryClient();
