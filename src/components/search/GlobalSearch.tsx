import {
  BriefcaseBusiness,
  CheckSquare,
  FileText,
  Gavel,
  LoaderCircle,
  ReceiptText,
  Search,
  UserRound,
  Users,
  X,
} from 'lucide-react';

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  useNavigate,
} from 'react-router-dom';

import {
  searchEverything,
  type GlobalSearchCategory,
  type GlobalSearchResult,
} from '../../services/globalSearchService';

import './GlobalSearch.css';

const categoryOrder: GlobalSearchCategory[] = [
  'Clients',
  'Cases',
  'Tasks',
  'Hearings',
  'Documents',
  'Invoices',
  'Staff',
];

export function GlobalSearch() {
  const navigate = useNavigate();

  const inputRef =
    useRef<HTMLInputElement>(null);

  const [open, setOpen] =
    useState(false);

  const [query, setQuery] =
    useState('');

  const [results, setResults] =
    useState<GlobalSearchResult[]>([]);

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  const [selectedIndex, setSelectedIndex] =
    useState(0);

  useEffect(() => {
    function handleShortcut(
      event: KeyboardEvent,
    ) {
      if (
        (event.ctrlKey || event.metaKey) &&
        event.key.toLowerCase() === 'k'
      ) {
        event.preventDefault();
        setOpen(true);
      }
    }

    window.addEventListener(
      'keydown',
      handleShortcut,
    );

    return () => {
      window.removeEventListener(
        'keydown',
        handleShortcut,
      );
    };
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }

    const timer = window.setTimeout(() => {
      inputRef.current?.focus();
    }, 30);

    return () => {
      window.clearTimeout(timer);
    };
  }, [open]);

  useEffect(() => {
    if (!open || query.trim().length < 2) {
      setResults([]);
      setError(null);
      setLoading(false);
      setSelectedIndex(0);
      return;
    }

    let active = true;

    const timer = window.setTimeout(
      async () => {
        try {
          setLoading(true);
          setError(null);

          const response =
            await searchEverything(query);

          if (!active) {
            return;
          }

          setResults(response.results);
          setSelectedIndex(0);

          if (
            response.errors.length > 0 &&
            response.results.length === 0
          ) {
            setError(
              'Search could not be completed.',
            );
          }
        } catch (searchError) {
          if (!active) {
            return;
          }

          setError(
            searchError instanceof Error
              ? searchError.message
              : 'Unable to search.',
          );

          setResults([]);
        } finally {
          if (active) {
            setLoading(false);
          }
        }
      },
      220,
    );

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [open, query]);

  const groupedResults = useMemo(
    () =>
      categoryOrder
        .map((category) => ({
          category,
          items: results.filter(
            (result) =>
              result.category === category,
          ),
        }))
        .filter(
          (group) => group.items.length > 0,
        ),
    [results],
  );

  function closeSearch() {
    setOpen(false);
    setQuery('');
    setResults([]);
    setError(null);
    setSelectedIndex(0);
  }

  function openResult(
    result: GlobalSearchResult,
  ) {
    closeSearch();
    navigate(result.to);
  }

  function handleKeyDown(
    event: React.KeyboardEvent<HTMLInputElement>,
  ) {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeSearch();
      return;
    }

    if (results.length === 0) {
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();

      setSelectedIndex((current) =>
        current >= results.length - 1
          ? 0
          : current + 1,
      );
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();

      setSelectedIndex((current) =>
        current <= 0
          ? results.length - 1
          : current - 1,
      );
    }

    if (event.key === 'Enter') {
      event.preventDefault();

      const selected =
        results[selectedIndex];

      if (selected) {
        openResult(selected);
      }
    }
  }

  return (
    <>
      <button
        type="button"
        className="global-search-trigger"
        onClick={() => setOpen(true)}
        aria-label="Open global search"
      >
        <Search size={17} />

        <span>Search anything…</span>

        <kbd>
          {isMacPlatform() ? '⌘' : 'Ctrl'} K
        </kbd>
      </button>

      {open ? (
        <div
          className="global-search-layer"
          role="dialog"
          aria-modal="true"
          aria-label="Global search"
        >
          <button
            type="button"
            className="global-search-backdrop"
            aria-label="Close search"
            onClick={closeSearch}
          />

          <section className="global-search-modal">
            <header className="global-search-input-row">
              <Search size={20} />

              <input
                ref={inputRef}
                value={query}
                onChange={(event) =>
                  setQuery(event.target.value)
                }
                onKeyDown={handleKeyDown}
                placeholder="Search clients, cases, tasks, documents, invoices…"
                aria-label="Search across SHAB"
              />

              {loading ? (
                <LoaderCircle
                  size={19}
                  className="global-search-loader"
                />
              ) : query ? (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  aria-label="Clear search"
                >
                  <X size={18} />
                </button>
              ) : null}
            </header>

            <div className="global-search-body">
              {query.trim().length < 2 ? (
                <div className="global-search-intro">
                  <div>
                    <Search size={25} />
                  </div>

                  <strong>
                    Search the entire practice
                  </strong>

                  <p>
                    Find clients, matters, tasks,
                    hearings, documents, invoices,
                    and staff.
                  </p>

                  <span>
                    Type at least two characters.
                  </span>
                </div>
              ) : error ? (
                <div className="global-search-state error">
                  <strong>
                    Unable to complete search
                  </strong>

                  <span>{error}</span>
                </div>
              ) : loading && results.length === 0 ? (
                <div className="global-search-state">
                  Searching SHAB records…
                </div>
              ) : results.length === 0 ? (
                <div className="global-search-state">
                  <strong>No results found</strong>

                  <span>
                    Try a client name, matter number,
                    invoice number, or document title.
                  </span>
                </div>
              ) : (
                <div className="global-search-groups">
                  {groupedResults.map((group) => (
                    <section
                      key={group.category}
                      className="global-search-group"
                    >
                      <header>
                        {getCategoryIcon(
                          group.category,
                        )}

                        <span>
                          {group.category}
                        </span>

                        <small>
                          {group.items.length}
                        </small>
                      </header>

                      <div>
                        {group.items.map((result) => {
                          const absoluteIndex =
                            results.findIndex(
                              (item) =>
                                item.id ===
                                result.id,
                            );

                          return (
                            <button
                              key={result.id}
                              type="button"
                              className={
                                absoluteIndex ===
                                selectedIndex
                                  ? 'selected'
                                  : ''
                              }
                              onMouseEnter={() =>
                                setSelectedIndex(
                                  absoluteIndex,
                                )
                              }
                              onClick={() =>
                                openResult(result)
                              }
                            >
                              <span className="global-search-result-icon">
                                {getCategoryIcon(
                                  result.category,
                                )}
                              </span>

                              <span className="global-search-result-copy">
                                <strong>
                                  {result.title}
                                </strong>

                                <small>
                                  {result.subtitle}
                                </small>
                              </span>

                              {result.meta ? (
                                <span className="global-search-result-meta">
                                  {result.meta}
                                </span>
                              ) : null}
                            </button>
                          );
                        })}
                      </div>
                    </section>
                  ))}
                </div>
              )}
            </div>

            <footer className="global-search-footer">
              <span>
                <kbd>↑</kbd>
                <kbd>↓</kbd>
                Navigate
              </span>

              <span>
                <kbd>Enter</kbd>
                Open
              </span>

              <span>
                <kbd>Esc</kbd>
                Close
              </span>
            </footer>
          </section>
        </div>
      ) : null}
    </>
  );
}

function getCategoryIcon(
  category: GlobalSearchCategory,
) {
  switch (category) {
    case 'Clients':
      return <Users size={15} />;

    case 'Cases':
      return <BriefcaseBusiness size={15} />;

    case 'Tasks':
      return <CheckSquare size={15} />;

    case 'Hearings':
      return <Gavel size={15} />;

    case 'Documents':
      return <FileText size={15} />;

    case 'Invoices':
      return <ReceiptText size={15} />;

    case 'Staff':
      return <UserRound size={15} />;
  }
}

function isMacPlatform(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    /Mac|iPhone|iPad/.test(
      navigator.platform,
    )
  );
}
