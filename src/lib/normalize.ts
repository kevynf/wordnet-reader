export function normalizeLemma(value: string): string {
  return value.normalize('NFKC').trim().replace(/_/g, ' ').replace(/\s+/g, ' ').toLocaleLowerCase('en-US');
}

export function compareNormalized(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

export function preferredLemma(
  current: string,
  currentSenseCount: number,
  candidate: string,
  candidateSenseCount: number,
): string {
  return candidateSenseCount > currentSenseCount ? candidate : current;
}

export function entryBucket(normalized: string): string {
  let hash = 2166136261;
  for (let index = 0; index < normalized.length; index += 1) {
    hash ^= normalized.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0').slice(0, 2);
}

export function synsetBucket(id: string): string {
  const digits = id.match(/\d{3}/)?.[0];
  return digits ?? 'other';
}
