export type PartOfSpeech = 'n' | 'v' | 'a' | 's' | 'r';

export interface Pronunciation {
  value: string;
  variety?: string;
}

export interface RelationRef {
  type: string;
  target: string;
}

export interface SenseRecord {
  id: string;
  synsetId: string;
  relations?: RelationRef[];
  frames?: string[];
}

export interface EntryRecord {
  lemma: string;
  normalized: string;
  partOfSpeech: PartOfSpeech;
  pronunciations?: Pronunciation[];
  senses: SenseRecord[];
}

export interface ExampleRecord {
  text: string;
  source?: string;
}

export interface SynsetRecord {
  id: string;
  partOfSpeech: PartOfSpeech;
  definitions: string[];
  examples: ExampleRecord[];
  members: string[];
  relations: RelationRef[];
  ili?: string;
  subject?: string;
  source?: string;
}

export interface LemmaIndexItem {
  lemma: string;
  normalized: string;
  partsOfSpeech: PartOfSpeech[];
  bucket: string;
}

export interface DataFile {
  path: string;
  bytes: number;
}

export interface DictionaryManifest {
  schemaVersion: 1;
  id: string;
  title: string;
  edition: string;
  variant: string;
  source: string;
  generatedAt: string;
  counts: { lemmas: number; entries: number; synsets: number };
  files: DataFile[];
  license: { name: string; attribution: string; url: string };
}

export interface DictionaryData {
  manifest: DictionaryManifest;
  index: LemmaIndexItem[];
}
