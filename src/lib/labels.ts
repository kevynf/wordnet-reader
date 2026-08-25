import type { PartOfSpeech } from '../types';

export const posLabels: Record<PartOfSpeech, string> = {
  n: 'noun',
  v: 'verb',
  a: 'adjective',
  s: 'adjective',
  r: 'adverb',
};

export const relationLabels: Record<string, string> = {
  antonym: 'antonym',
  hypernym: 'hypernym',
  hyponym: 'hyponym',
  instance_hypernym: 'instance hypernym',
  instance_hyponym: 'instance hyponym',
  holo_member: 'member holonym',
  holo_part: 'part holonym',
  holo_substance: 'substance holonym',
  mero_member: 'member meronym',
  mero_part: 'part meronym',
  mero_substance: 'substance meronym',
  similar: 'similar',
  also: 'also see',
  entailment: 'entails',
  cause: 'causes',
  derivation: 'derived form',
  domain_topic: 'topic domain',
  domain_region: 'region domain',
  exemplifies: 'usage',
  pertainym: 'pertainym',
};

export function relationLabel(type: string): string {
  return relationLabels[type] ?? type.replaceAll('_', ' ');
}
