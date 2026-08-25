import { describe, expect, it } from 'vitest';
import { entryBucket, normalizeLemma, preferredLemma, synsetBucket } from './normalize';

describe('normalizeLemma', () => {
  it('normalizes spacing, underscores, width, and case', () => {
    expect(normalizeLemma('  Ask_FOR  ')).toBe('ask for');
    expect(normalizeLemma('ＡＢＣ')).toBe('abc');
  });
});

describe('preferredLemma', () => {
  it('prefers the spelling backed by more senses', () => {
    expect(preferredLemma('Set', 1, 'set', 44)).toBe('set');
    expect(preferredLemma('set', 44, 'Set', 1)).toBe('set');
  });

  it('preserves the source preference when spellings have equal coverage', () => {
    expect(preferredLemma('WordNet', 1, 'wordnet', 1)).toBe('WordNet');
  });
});

describe('data buckets', () => {
  it('are deterministic', () => {
    expect(entryBucket('ask')).toMatch(/^[0-9a-f]{2}$/);
    expect(entryBucket('ask')).toBe(entryBucket('ask'));
    expect(synsetBucket('ewn-00754499-v')).toBe('007');
  });
});
