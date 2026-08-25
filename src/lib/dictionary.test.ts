import { describe, expect, it } from 'vitest';
import type { LemmaIndexItem } from '../types';
import { searchIndex } from './dictionary';
import { parseLemmaIndex, parseManifest } from './schema';

const item = (lemma: string, normalized = lemma.toLowerCase()): LemmaIndexItem => ({
  lemma,
  normalized,
  partsOfSpeech: ['n'],
  bucket: 'test',
});

describe('dictionary index', () => {
  it('finds normalized prefixes with punctuation and prioritizes exact matches', () => {
    const index = [item('co-op'), item('coax'), item('cobalt'), item('set'), item('setup')];
    expect(searchIndex(index, 'CO-').map((entry) => entry.lemma)).toEqual(['co-op']);
    expect(searchIndex(index, 'SET').map((entry) => entry.lemma)).toEqual(['set', 'setup']);
  });

  it('normalizes legacy index ordering and rejects duplicate entries', () => {
    expect(parseLemmaIndex([item('set'), item('ask')]).map((entry) => entry.lemma)).toEqual(['ask', 'set']);
    expect(() => parseLemmaIndex([item('set'), item('set')])).toThrow('Duplicate');
  });

  it('rejects unsupported manifest schemas', () => {
    expect(() => parseManifest({ schemaVersion: 2 })).toThrow('Unsupported dictionary schema');
  });
});
