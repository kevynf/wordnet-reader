import type { LemmaIndexItem } from '../types';

const DATABASE = 'open-wordnet-preferences';
const STORE = 'items';
const HISTORY_KEY = 'history';
const FAVORITES_KEY = 'favorites';

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function read<T>(key: string, fallback: T): Promise<T> {
  try {
    const database = await openDatabase();
    return await new Promise<T>((resolve, reject) => {
      const request = database.transaction(STORE).objectStore(STORE).get(key);
      request.onsuccess = () => resolve((request.result as T | undefined) ?? fallback);
      request.onerror = () => reject(request.error);
    });
  } catch {
    return fallback;
  }
}

async function write<T>(key: string, value: T): Promise<void> {
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const request = database.transaction(STORE, 'readwrite').objectStore(STORE).put(value, key);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export const preferences = {
  history: () => read<LemmaIndexItem[]>(HISTORY_KEY, []),
  favorites: () => read<LemmaIndexItem[]>(FAVORITES_KEY, []),
  saveHistory: (items: LemmaIndexItem[]) => write(HISTORY_KEY, items.slice(0, 30)),
  saveFavorites: (items: LemmaIndexItem[]) => write(FAVORITES_KEY, items),
};
