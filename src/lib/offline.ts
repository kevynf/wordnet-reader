import type { DictionaryManifest } from '../types';

export interface OfflineProgress {
  completed: number;
  total: number;
  state: 'idle' | 'downloading' | 'ready' | 'error';
}

const DATA_CACHE = 'wordnet-data-runtime';

export async function downloadDictionary(
  baseUrl: string,
  manifest: DictionaryManifest,
  onProgress: (progress: OfflineProgress) => void,
  signal: AbortSignal,
): Promise<void> {
  const cache = await caches.open(DATA_CACHE);
  const paths = ['manifest.json', 'index.json', ...manifest.files.map((file) => file.path)];
  let completed = 0;
  let cursor = 0;
  onProgress({ completed, total: paths.length, state: 'downloading' });

  async function worker() {
    while (cursor < paths.length) {
      const path = paths[cursor++];
      if (signal.aborted) throw new DOMException('Download cancelled', 'AbortError');
      const request = new Request(new URL(path, baseUrl));
      const response = await fetch(request, { signal });
      if (!response.ok) throw new Error(`Download failed: ${path}`);
      await cache.put(request, response);
      completed += 1;
      onProgress({ completed, total: paths.length, state: 'downloading' });
    }
  }
  await Promise.all(Array.from({ length: 4 }, worker));
  await cache.put(new Request(new URL(`.complete-${manifest.id}`, baseUrl)), new Response('ready'));
  onProgress({ completed, total: paths.length, state: 'ready' });
}

export async function removeDownloadedDictionary(id: string): Promise<void> {
  void id;
  await caches.delete(DATA_CACHE);
}

export async function isDictionaryDownloaded(baseUrl: string, manifest: DictionaryManifest): Promise<boolean> {
  const cache = await caches.open(DATA_CACHE);
  return Boolean(await cache.match(new Request(new URL(`.complete-${manifest.id}`, baseUrl))));
}
