import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { BookOpen, Check, ChevronRight, Download, History, Search, Star, Trash2, X } from 'lucide-preact';
import { useRegisterSW } from 'virtual:pwa-register/preact';
import { dictionary, type LookupResult } from './lib/dictionary';
import { posLabels, relationLabel } from './lib/labels';
import {
  downloadDictionary,
  isDictionaryDownloaded,
  removeDownloadedDictionary,
  type OfflineProgress,
} from './lib/offline';
import { normalizeLemma } from './lib/normalize';
import { preferences } from './lib/preferences';
import type { DictionaryData, LemmaIndexItem, PartOfSpeech, SynsetRecord } from './types';

type View = 'dictionary' | 'history' | 'favorites';

const navItems: Array<{ id: View; label: string; icon: typeof BookOpen }> = [
  { id: 'dictionary', label: 'Dictionary', icon: BookOpen },
  { id: 'history', label: 'History', icon: History },
  { id: 'favorites', label: 'Favorites', icon: Star },
];

const initialWord = () => new URL(window.location.href).searchParams.get('word') ?? '';

export function App() {
  const [data, setData] = useState<DictionaryData>();
  const [loadingError, setLoadingError] = useState('');
  const [query, setQuery] = useState(initialWord);
  const [lookup, setLookup] = useState<LookupResult | null>();
  const [relatedSynsets, setRelatedSynsets] = useState(new Map<string, SynsetRecord>());
  const [view, setView] = useState<View>('dictionary');
  const [historyItems, setHistoryItems] = useState<LemmaIndexItem[]>([]);
  const [favorites, setFavorites] = useState<LemmaIndexItem[]>([]);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(0);
  const searchRef = useRef<HTMLInputElement>(null);

  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  useEffect(() => {
    dictionary
      .initialize()
      .then((loaded) => {
        setData(loaded);
        if (initialWord()) void openWord(initialWord(), false);
      })
      .catch((error: unknown) =>
        setLoadingError(error instanceof Error ? error.message : 'Unable to load the dictionary'),
      );
    void Promise.all([preferences.history(), preferences.favorites()]).then(([history, saved]) => {
      setHistoryItems(history);
      setFavorites(saved);
    });

    const onPopState = () => {
      const word = initialWord();
      setQuery(word);
      setView('dictionary');
      if (word) void openWord(word, false);
      else setLookup(undefined);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const suggestions = useMemo(() => dictionary.search(query), [data, query]);
  const currentFavorite = lookup ? favorites.some((item) => item.normalized === lookup.item.normalized) : false;

  async function openWord(word: string, pushState = true) {
    const cleanWord = word.trim();
    if (!cleanWord) return;
    setQuery(cleanWord);
    setSuggestionsOpen(false);
    setView('dictionary');
    setLookup(undefined);
    try {
      const result = await dictionary.lookup(cleanWord);
      setLookup(result);
      setRelatedSynsets(new Map());
      if (result) {
        setQuery(result.item.lemma);
        const nextHistory = [
          result.item,
          ...historyItems.filter((item) => item.normalized !== result.item.normalized),
        ].slice(0, 30);
        setHistoryItems(nextHistory);
        void preferences.saveHistory(nextHistory);
        const targets = [...result.synsets.values()].flatMap((synset) =>
          synset.relations.map((relation) => relation.target),
        );
        void dictionary.loadSynsets(targets).then(setRelatedSynsets);
      }
      if (pushState) {
        const url = new URL(window.location.href);
        url.search = '';
        url.searchParams.set('word', result?.item.lemma ?? cleanWord);
        window.history.pushState({}, '', url);
      }
    } catch (error) {
      setLoadingError(error instanceof Error ? error.message : 'Lookup failed');
    }
  }

  function toggleFavorite() {
    if (!lookup) return;
    const next = currentFavorite
      ? favorites.filter((item) => item.normalized !== lookup.item.normalized)
      : [lookup.item, ...favorites];
    setFavorites(next);
    void preferences.saveFavorites(next);
  }

  function clearHistory() {
    setHistoryItems([]);
    void preferences.saveHistory([]);
  }

  function selectView(nextView: View) {
    setView(nextView);
    setSuggestionsOpen(false);
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (!suggestionsOpen || suggestions.length === 0) {
      if (event.key === 'Enter') void openWord(query);
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveSuggestion((value) => Math.min(value + 1, suggestions.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveSuggestion((value) => Math.max(value - 1, 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      void openWord(suggestions[activeSuggestion]?.lemma ?? query);
    } else if (event.key === 'Escape') {
      setSuggestionsOpen(false);
    }
  }

  return (
    <div class="app-shell">
      <header class="topbar">
        <div class="topbar-primary">
          <button class="brand" onClick={() => selectView('dictionary')} aria-label="Dictionary home">
            <span class="brand-copy">
              <strong class="brand-full">Wordnet Reader</strong>
              <strong class="brand-short">Reader</strong>
            </span>
          </button>
          <nav class="desktop-nav" aria-label="Main navigation">
            <div class="desktop-nav-links">
              {navItems.map(({ id, label, icon: Icon }) => (
                <button class={view === id ? 'active' : ''} onClick={() => selectView(id)} key={id}>
                  <Icon size={17} /> <span>{label}</span>
                  {id === 'favorites' && favorites.length > 0 && <small>{favorites.length}</small>}
                </button>
              ))}
            </div>
          </nav>
        </div>
        <div class="search-wrap">
          <Search class="search-icon" size={19} aria-hidden="true" />
          <input
            ref={searchRef}
            value={query}
            onInput={(event) => {
              setQuery(event.currentTarget.value);
              setSuggestionsOpen(Boolean(event.currentTarget.value));
              setActiveSuggestion(0);
            }}
            onFocus={() => setSuggestionsOpen(Boolean(query))}
            onKeyDown={handleKeyDown}
            placeholder="Search"
            aria-label="Search for a word or phrase"
            aria-expanded={suggestionsOpen}
            aria-controls="search-suggestions"
            autocomplete="off"
          />
          {query && (
            <button
              class="icon-button clear-search"
              onClick={() => {
                setQuery('');
                searchRef.current?.focus();
              }}
              title="Clear search"
              aria-label="Clear search"
            >
              <X size={17} />
            </button>
          )}
          {suggestionsOpen && (
            <div class="suggestions" id="search-suggestions" role="listbox">
              {suggestions.length ? (
                suggestions.map((item, index) => (
                  <button
                    key={item.normalized}
                    class={index === activeSuggestion ? 'active' : ''}
                    role="option"
                    aria-selected={index === activeSuggestion}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => void openWord(item.lemma)}
                  >
                    <span>{item.lemma}</span>
                    <small>{item.partsOfSpeech.map((pos) => posLabels[pos]).join(' · ')}</small>
                  </button>
                ))
              ) : (
                <div class="no-suggestions">No matching entries</div>
              )}
            </div>
          )}
        </div>
      </header>

      <div class="workspace">
        <main class="content">
          {loadingError && <ErrorNotice message={loadingError} onClose={() => setLoadingError('')} />}
          {view === 'dictionary' && (
            <DictionaryView
              query={query}
              loading={!data || (lookup === undefined && Boolean(initialWord()))}
              lookup={lookup}
              relatedSynsets={relatedSynsets}
              favorite={currentFavorite}
              onFavorite={toggleFavorite}
              onOpen={(word) => void openWord(word)}
              recent={historyItems.slice(0, 8)}
            />
          )}
          {view === 'history' && (
            <WordList
              title="History"
              description="Entries you have recently viewed"
              items={historyItems}
              onOpen={(word) => void openWord(word)}
              onClear={clearHistory}
            />
          )}
          {view === 'favorites' && (
            <WordList
              title="Favorites"
              description="Entries saved on this device"
              items={favorites}
              onOpen={(word) => void openWord(word)}
            />
          )}
        </main>
      </div>

      {data && (
        <footer class="app-footer">
          <div class="app-footer-inner">
            <div class="dataset-summary">
              <span>
                {data.manifest.edition} {data.manifest.variant === 'demo' ? 'Demo' : 'Plus'}
              </span>
              <span>{data.manifest.counts.lemmas.toLocaleString()} entries</span>
            </div>
            <div class="footer-tools">
              <details class="footer-about">
                <summary>About</summary>
                <div class="footer-about-content">
                  <strong>Wordnet Reader</strong>
                  <p>A readability-focused browser for the Open English Wordnet lexical database.</p>
                  <div class="footer-about-links">
                    <a href={data.manifest.source} target="_blank" rel="noreferrer">
                      Source
                    </a>
                    <a href={data.manifest.license.url} target="_blank" rel="noreferrer">
                      {data.manifest.license.name}
                    </a>
                  </div>
                  <small>{data.manifest.license.attribution}</small>
                  <div class="footer-about-offline">
                    <span>Offline access</span>
                    <OfflineControl data={data} baseUrl={dictionary.getBaseUrl()} />
                  </div>
                </div>
              </details>
            </div>
          </div>
        </footer>
      )}

      <nav class="bottom-nav" aria-label="Mobile navigation">
        {navItems.map(({ id, label, icon: Icon }) => (
          <button class={view === id ? 'active' : ''} onClick={() => selectView(id)} key={id}>
            <Icon size={20} />
            <span>{label}</span>
          </button>
        ))}
      </nav>

      {needRefresh && (
        <div class="update-toast" role="status">
          <span>An update is ready</span>
          <button onClick={() => void updateServiceWorker(true)}>Update</button>
        </div>
      )}
    </div>
  );
}

function DictionaryView({
  query,
  loading,
  lookup,
  relatedSynsets,
  favorite,
  onFavorite,
  onOpen,
  recent,
}: {
  query: string;
  loading: boolean;
  lookup: LookupResult | null | undefined;
  relatedSynsets: Map<string, SynsetRecord>;
  favorite: boolean;
  onFavorite: () => void;
  onOpen: (word: string) => void;
  recent: LemmaIndexItem[];
}) {
  const urlPos = new URL(window.location.href).searchParams.get('pos') as PartOfSpeech | null;
  const availablePos = lookup ? [...new Set(lookup.entries.map((entry) => entry.partOfSpeech))] : [];
  const [selectedPos, setSelectedPos] = useState<PartOfSpeech | null>(urlPos);
  const activePos = selectedPos && availablePos.includes(selectedPos) ? selectedPos : availablePos[0];

  useEffect(() => setSelectedPos(null), [lookup?.item.normalized]);

  if (loading) return <LoadingState />;
  if (lookup === null) {
    return (
      <div class="empty-state">
        <Search size={32} />
        <h1>No entry for “{query}”</h1>
        <p>Check the spelling or choose an entry from the search suggestions.</p>
      </div>
    );
  }
  if (!lookup) {
    return (
      <section class="welcome">
        <div class="welcome-heading">
          <p class="eyebrow">Open English Wordnet</p>
          <h1>Look up an English word</h1>
          <p>Explore definitions, examples, synonyms, and semantic relations.</p>
        </div>
        {recent.length > 0 && (
          <div class="recent-section">
            <h2>Recent searches</h2>
            <div class="word-grid">
              {recent.map((item) => (
                <WordButton item={item} onOpen={onOpen} key={item.normalized} />
              ))}
            </div>
          </div>
        )}
      </section>
    );
  }

  const entries = lookup.entries.filter((entry) => entry.partOfSpeech === activePos);
  const pronunciations = lookup.entries
    .flatMap((entry) => entry.pronunciations ?? [])
    .filter(
      (item, index, all) =>
        all.findIndex((other) => other.value === item.value && other.variety === item.variety) === index,
    );

  return (
    <article class="entry-page">
      <header class="entry-header">
        <div>
          <p class="eyebrow">ENTRY</p>
          <div class="headword-line">
            <h1>{lookup.item.lemma}</h1>
            {pronunciations.length > 0 && (
              <div class="pronunciations">
                {pronunciations.map((item) => (
                  <span key={`${item.variety}-${item.value}`}>
                    <small>{item.variety === 'GB' ? 'BrE' : item.variety === 'US' ? 'NAmE' : item.variety}</small>/
                    {item.value}/
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
        <button
          class={`favorite-button ${favorite ? 'active' : ''}`}
          onClick={onFavorite}
          aria-label={favorite ? 'Remove from favorites' : 'Add to favorites'}
          title={favorite ? 'Remove from favorites' : 'Add to favorites'}
        >
          <Star size={20} fill={favorite ? 'currentColor' : 'none'} />
        </button>
      </header>

      {availablePos.length > 1 && (
        <div class="pos-tabs" role="tablist" aria-label="Part of speech">
          {availablePos.map((pos) => (
            <button
              class={activePos === pos ? 'active' : ''}
              role="tab"
              aria-selected={activePos === pos}
              onClick={() => setSelectedPos(pos)}
              key={pos}
            >
              {posLabels[pos]}
            </button>
          ))}
        </div>
      )}

      <div class="sense-group">
        <h2>
          <small>{entries.reduce((count, entry) => count + entry.senses.length, 0)} senses</small>
        </h2>
        {entries
          .flatMap((entry) => entry.senses)
          .map((sense, index) => {
            const synset = lookup.synsets.get(sense.synsetId);
            if (!synset) return null;
            const synonyms = synset.members.filter((member) => normalizeLemma(member) !== lookup.item.normalized);
            return (
              <section class="sense" key={sense.id}>
                <span class="sense-number">{index + 1}</span>
                <div class="sense-body">
                  {synset.definitions.map((definition) => (
                    <p class="definition" key={definition}>
                      {definition}
                    </p>
                  ))}
                  {synset.examples.map((example) => (
                    <blockquote key={example.text}>
                      <span>{example.text}</span>
                      {example.source && <cite>{example.source}</cite>}
                    </blockquote>
                  ))}
                  {(synonyms.length > 0 || synset.relations.length > 0) && (
                    <div class="relations">
                      {synonyms.length > 0 && (
                        <div class="relation-row relation-row--synonym">
                          <span>synonyms</span>
                          <div>
                            {synonyms.map((word) => (
                              <button onClick={() => onOpen(word)} key={word}>
                                {word}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                      {Object.entries(groupRelations(synset.relations)).map(([type, relations]) => (
                        <div class={`relation-row relation-row--${type}`} key={type}>
                          <span>{relationLabel(type)}</span>
                          <div>
                            {relations?.map((relation) => {
                              const target = relatedSynsets.get(relation.target);
                              return target
                                ? target.members.slice(0, 4).map((word) => (
                                    <button onClick={() => onOpen(word)} key={`${relation.target}-${word}`}>
                                      {word}
                                    </button>
                                  ))
                                : null;
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <div class="sense-meta">
                    <span>{synset.id}</span>
                    {synset.ili && <span>{synset.ili}</span>}
                  </div>
                </div>
              </section>
            );
          })}
      </div>
    </article>
  );
}

function WordList({
  title,
  description,
  items,
  onOpen,
  onClear,
}: {
  title: string;
  description: string;
  items: LemmaIndexItem[];
  onOpen: (word: string) => void;
  onClear?: () => void;
}) {
  return (
    <section class="list-view">
      <header>
        <div>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        {onClear && items.length > 0 && (
          <button class="text-button danger" onClick={onClear}>
            <Trash2 size={16} /> Clear
          </button>
        )}
      </header>
      {items.length ? (
        <div class="word-list">
          {items.map((item) => (
            <WordButton item={item} onOpen={onOpen} key={item.normalized} />
          ))}
        </div>
      ) : (
        <div class="empty-state compact">
          <BookOpen size={28} />
          <h2>Nothing here yet</h2>
          <p>Entries will appear here after you look them up.</p>
        </div>
      )}
    </section>
  );
}

function WordButton({ item, onOpen }: { item: LemmaIndexItem; onOpen: (word: string) => void }) {
  return (
    <button class="word-button" onClick={() => onOpen(item.lemma)}>
      <span>
        <strong>{item.lemma}</strong>
        <small>{item.partsOfSpeech.map((pos) => posLabels[pos]).join(' · ')}</small>
      </span>
      <ChevronRight size={18} />
    </button>
  );
}

function OfflineControl({ data, baseUrl }: { data: DictionaryData; baseUrl: string }) {
  const [downloaded, setDownloaded] = useState(false);
  const [progress, setProgress] = useState<OfflineProgress>({
    completed: 0,
    total: data.manifest.files.length + 2,
    state: 'idle',
  });
  const controllerRef = useRef<AbortController>();

  useEffect(() => {
    void isDictionaryDownloaded(baseUrl, data.manifest).then(setDownloaded);
  }, [baseUrl, data.manifest.id]);
  async function startDownload() {
    const controller = new AbortController();
    controllerRef.current = controller;
    try {
      await downloadDictionary(baseUrl, data.manifest, setProgress, controller.signal);
      setDownloaded(true);
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError'))
        setProgress((value) => ({ ...value, state: 'error' }));
      else setProgress((value) => ({ ...value, state: 'idle' }));
    }
  }

  async function removeDownload() {
    await removeDownloadedDictionary(data.manifest.id);
    setDownloaded(false);
    setProgress({ completed: 0, total: data.manifest.files.length + 2, state: 'idle' });
  }

  return (
    <div class="offline-control">
      {progress.state === 'downloading' && (
        <>
          <span>
            Downloading {progress.completed} / {progress.total}
          </span>
          <progress value={progress.completed} max={progress.total} />
          <button class="footer-button" onClick={() => controllerRef.current?.abort()}>
            Cancel
          </button>
        </>
      )}
      {progress.state === 'error' && <span class="offline-error">Download failed</span>}
      {downloaded && (
        <>
          <span class="offline-ready">
            <Check size={15} /> Available offline
          </span>
          <button
            class="footer-icon-button"
            onClick={() => void removeDownload()}
            title="Remove offline data"
            aria-label="Remove offline data"
          >
            <Trash2 size={15} />
          </button>
        </>
      )}
      {!downloaded && progress.state !== 'downloading' && (
        <button class="footer-button" onClick={() => void startDownload()}>
          <Download size={15} /> Download for offline use
        </button>
      )}
    </div>
  );
}

function LoadingState() {
  return (
    <div class="loading-state" aria-label="Loading">
      <span />
      <span />
      <span />
    </div>
  );
}

function ErrorNotice({ message, onClose }: { message: string; onClose: () => void }) {
  return (
    <div class="error-notice" role="alert">
      <span>{message}</span>
      <button class="icon-button" onClick={onClose} aria-label="Close">
        <X size={16} />
      </button>
    </div>
  );
}

function groupRelations(relations: Array<{ type: string; target: string }>) {
  return relations.reduce<Record<string, Array<{ type: string; target: string }>>>((groups, relation) => {
    (groups[relation.type] ??= []).push(relation);
    return groups;
  }, {});
}
