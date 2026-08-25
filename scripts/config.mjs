export const RELEASE = {
  id: '2025-plus',
  edition: '2025',
  variant: 'Plus',
  title: 'Open English Wordnet 2025 Plus',
  releasedAt: '2025-12-31T00:00:00.000Z',
  url: 'https://en-word.net/static/english-wordnet-2025-plus-json.zip',
  sha256: process.env.OEWN_SHA256 || '8832b8fa26a14c0ba8c99bb1ef8db6f9e122a6d9193b65ca9e0ef572580fee7e',
};

export const SOURCE_DIR = new URL('../data/source/', import.meta.url);
export const ARCHIVE = new URL('english-wordnet-2025-plus-json.zip', SOURCE_DIR);
export const OUTPUT_DIR = new URL('../public/data/2025-plus/', import.meta.url);
