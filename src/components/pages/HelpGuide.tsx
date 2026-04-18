import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { IconHelp, IconSearch, IconX } from '../Common/Icons';
import matrixGuideHtml from '../../help/ACTION_PARAMETER_MATRIX.html?raw';
import appendixGuideHtml from '../../help/ACTION_PARAMETER_APPENDIX.html?raw';

interface HelpGuideProps {
  onBack: () => void;
}

type HelpSection = 'overview' | 'matrix' | 'appendix';

interface GuideDoc {
  id: Exclude<HelpSection, 'overview'>;
  label: string;
  html: string;
  text: string;
}

const MIN_SEARCH_QUERY_LENGTH = 2;
const SEARCH_DEBOUNCE_MS = 50; // Quick debounce for responsive typing

function extractTextFromHtml(rawHtml: string): string {
  const doc = new DOMParser().parseFromString(rawHtml, 'text/html');
  return (doc.body.textContent ?? '').replace(/\s+/g, ' ').trim();
}

function sanitizeGuideHtml(rawHtml: string): string {
  const doc = new DOMParser().parseFromString(rawHtml, 'text/html');

  doc.querySelectorAll('script, style, iframe, object, embed, link, meta').forEach((node) => {
    node.remove();
  });

  doc.querySelectorAll('[style]').forEach((element) => {
    element.removeAttribute('style');
  });

  doc.querySelectorAll('a').forEach((anchor) => {
    const text = (anchor.textContent ?? '').trim() || (anchor.getAttribute('href') ?? '').trim();
    const span = doc.createElement('span');
    span.className = 'help-guide__link-text';
    span.textContent = text;
    anchor.replaceWith(span);
  });

  doc.querySelectorAll('table').forEach((table) => {
    table.classList.add('help-guide__table');
    const wrapper = doc.createElement('div');
    wrapper.className = 'help-guide__table-wrap';
    table.parentNode?.insertBefore(wrapper, table);
    wrapper.appendChild(table);
  });

  doc.querySelectorAll('h1').forEach((heading) => heading.classList.add('help-guide__h1'));
  doc.querySelectorAll('h2').forEach((heading) => heading.classList.add('help-guide__h2'));
  doc.querySelectorAll('h3').forEach((heading) => heading.classList.add('help-guide__h3'));
  doc.querySelectorAll('h4').forEach((heading) => heading.classList.add('help-guide__h4'));
  doc.querySelectorAll('p').forEach((paragraph) => paragraph.classList.add('help-guide__paragraph'));
  doc.querySelectorAll('ul, ol').forEach((list) => list.classList.add('help-guide__list'));
  doc.querySelectorAll('code').forEach((code) => code.classList.add('help-guide__code'));

  return doc.body.innerHTML;
}

function getMatchCount(text: string, query: string): number {
  const cleanQuery = query.trim().toLowerCase();
  if (!cleanQuery) return 0;
  const escapedQuery = cleanQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return text.toLowerCase().match(new RegExp(escapedQuery, 'g'))?.length ?? 0;
}

function clearHighlightMarks(container: HTMLElement) {
  container.querySelectorAll('mark.help-guide__highlight').forEach((highlight) => {
    const parent = highlight.parentNode;
    if (!parent) return;
    parent.replaceChild(document.createTextNode(highlight.textContent ?? ''), highlight);
    parent.normalize();
  });
}

function highlightGuideMatches(container: HTMLElement, query: string): HTMLElement[] {
  clearHighlightMarks(container);

  const cleanQuery = query.trim();
  if (cleanQuery.length < MIN_SEARCH_QUERY_LENGTH) return [];

  const escapedQuery = cleanQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(escapedQuery, 'gi');
  const queryLower = cleanQuery.toLowerCase();

  const textNodes: Text[] = [];
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) => {
      const parent = node.parentElement;
      const value = node.nodeValue ?? '';
      if (!parent) return NodeFilter.FILTER_REJECT;
      if (parent.closest('script, style, noscript, mark')) return NodeFilter.FILTER_REJECT;
      if (!value.trim()) return NodeFilter.FILTER_SKIP;
      return value.toLowerCase().includes(queryLower)
        ? NodeFilter.FILTER_ACCEPT
        : NodeFilter.FILTER_SKIP;
    },
  });

  let currentNode = walker.nextNode();
  while (currentNode) {
    textNodes.push(currentNode as Text);
    currentNode = walker.nextNode();
  }

  const highlights: HTMLElement[] = [];
  let matchIndex = 0;

  textNodes.forEach((textNode) => {
    const rawText = textNode.nodeValue ?? '';
    regex.lastIndex = 0;
    if (!regex.test(rawText)) return;
    regex.lastIndex = 0;

    const fragment = document.createDocumentFragment();
    let lastIndex = 0;
    let match = regex.exec(rawText);

    while (match) {
      const matchedText = match[0];
      const start = match.index;
      const end = start + matchedText.length;

      if (start > lastIndex) {
        fragment.appendChild(document.createTextNode(rawText.slice(lastIndex, start)));
      }

      const mark = document.createElement('mark');
      mark.className = 'help-guide__highlight';
      mark.dataset.matchIndex = String(matchIndex);
      mark.tabIndex = -1;
      mark.textContent = matchedText;
      fragment.appendChild(mark);
      highlights.push(mark);
      matchIndex += 1;

      lastIndex = end;
      match = regex.exec(rawText);
    }

    if (lastIndex < rawText.length) {
      fragment.appendChild(document.createTextNode(rawText.slice(lastIndex)));
    }

    textNode.parentNode?.replaceChild(fragment, textNode);
  });

  return highlights;
}

function smoothScrollToMatch(target: HTMLElement, article: HTMLElement | null) {
  target.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });

  const tableWrap = target.closest('.help-guide__table-wrap') as HTMLElement | null;
  if (tableWrap) {
    const targetRect = target.getBoundingClientRect();
    const wrapRect = tableWrap.getBoundingClientRect();
    const nextLeft = tableWrap.scrollLeft + (targetRect.left - wrapRect.left) - (wrapRect.width / 2 - targetRect.width / 2);
    const nextTop = tableWrap.scrollTop + (targetRect.top - wrapRect.top) - (wrapRect.height / 2 - targetRect.height / 2);

    tableWrap.scrollTo({
      left: Math.max(0, nextLeft),
      top: Math.max(0, nextTop),
      behavior: 'smooth',
    });
  }

  if (article) {
    const targetRect = target.getBoundingClientRect();
    const articleRect = article.getBoundingClientRect();
    const nextTop = article.scrollTop + (targetRect.top - articleRect.top) - (articleRect.height * 0.35);
    article.scrollTo({ top: Math.max(0, nextTop), behavior: 'smooth' });
  }
}

function getMatchSnippet(text: string, query: string): string {
  const cleanQuery = query.trim().toLowerCase();
  if (!cleanQuery) return '';

  const lowerText = text.toLowerCase();
  const hitIndex = lowerText.indexOf(cleanQuery);
  if (hitIndex < 0) return '';

  const start = Math.max(0, hitIndex - 120);
  const end = Math.min(text.length, hitIndex + cleanQuery.length + 120);
  const prefix = start > 0 ? '…' : '';
  const suffix = end < text.length ? '…' : '';
  return `${prefix}${text.slice(start, end)}${suffix}`;
}

export function HelpGuide({ onBack }: HelpGuideProps) {
  const [section, setSection] = useState<HelpSection>('overview');
  const [searchBySection, setSearchBySection] = useState<Record<HelpSection, string>>({
    overview: '',
    matrix: '',
    appendix: '',
  });
  const [debouncedSearchBySection, setDebouncedSearchBySection] = useState<Record<HelpSection, string>>({
    overview: '',
    matrix: '',
    appendix: '',
  });
  const [activeMatchIndex, setActiveMatchIndex] = useState(0);
  const [highlightMatchCount, setHighlightMatchCount] = useState(0);
  const [isSearching, setIsSearching] = useState(false);
  const articleRef = useRef<HTMLElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const highlightMatchesRef = useRef<HTMLElement[]>([]);
  const activeMatchIndexRef = useRef(0);
  const shouldAutoScrollToFirstMatchRef = useRef(false);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentQuery = searchBySection[section];
  const debouncedQuery = debouncedSearchBySection[section];

  const setCurrentQuery = useCallback((value: string) => {
    setSearchBySection((previous) => ({
      ...previous,
      [section]: value,
    }));

    // Debounce the actual search
    setIsSearching(true);
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      setDebouncedSearchBySection((previous) => ({
        ...previous,
        [section]: value,
      }));
      setIsSearching(false);
    }, SEARCH_DEBOUNCE_MS);
  }, [section]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onBack();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [onBack]);

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  // Keep focus on search input when clicking within search area or when search controls appear
  useEffect(() => {
    const handleClickInSearchArea = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      const searchContainer = document.querySelector('.help-guide__search-container');
      const searchControls = document.querySelector('.help-guide__search-controls');

      if (!searchContainer || !searchControls) return;

      // Check if click was within search area (container or controls)
      const isInSearchArea =
        searchContainer.contains(target) ||
        searchControls.contains(target);

      if (isInSearchArea) {
        // Defer focus to allow button clicks to register first
        setTimeout(() => {
          if (searchInputRef.current && document.activeElement !== searchInputRef.current) {
            searchInputRef.current.focus();
          }
        }, 0);
      }
    };

    document.addEventListener('click', handleClickInSearchArea);
    return () => document.removeEventListener('click', handleClickInSearchArea);
  }, []);


  const guides = useMemo<Record<Exclude<HelpSection, 'overview'>, GuideDoc>>(() => ({
    matrix: {
      id: 'matrix',
      label: 'Action Authoring Rules',
      html: sanitizeGuideHtml(matrixGuideHtml),
      text: extractTextFromHtml(matrixGuideHtml),
    },
    appendix: {
      id: 'appendix',
      label: 'Action Reference Catalog',
      html: sanitizeGuideHtml(appendixGuideHtml),
      text: extractTextFromHtml(appendixGuideHtml),
    },
  }), []);

  const searchResults = useMemo(() => {
    const cleanQuery = debouncedSearchBySection.overview.trim();
    if (cleanQuery.length < MIN_SEARCH_QUERY_LENGTH) return [];

    return (Object.values(guides) as GuideDoc[])
      .map((guide) => {
        const matches = getMatchCount(guide.text, cleanQuery);
        return {
          ...guide,
          matches,
          snippet: getMatchSnippet(guide.text, cleanQuery),
        };
      })
      .filter((item) => item.matches > 0)
      .sort((a, b) => b.matches - a.matches);
  }, [guides, debouncedSearchBySection.overview]);

  const activeGuide = section === 'overview' ? null : guides[section];

  // Separate effect to initialize article HTML (runs when guide changes)
  useEffect(() => {
    if (!activeGuide || !articleRef.current) return;
    // Only set innerHTML when the guide changes to avoid clearing our highlights
    articleRef.current.innerHTML = activeGuide.html;
  }, [activeGuide]);

  const activateMatch = useCallback((nextIndex: number, shouldScroll = true) => {
    const matches = highlightMatchesRef.current;
    if (matches.length === 0) return;

    const normalizedIndex = ((nextIndex % matches.length) + matches.length) % matches.length;
    matches.forEach((match, index) => {
      match.classList.toggle('is-active', index === normalizedIndex);
    });

    const target = matches[normalizedIndex];
    if (shouldScroll) {
      window.requestAnimationFrame(() => {
        smoothScrollToMatch(target, articleRef.current);
        // Do NOT call target.focus() — it steals focus from the search input
        // while the user is typing. Scrolling is sufficient visual feedback.
      });
    }

    activeMatchIndexRef.current = normalizedIndex;
    setActiveMatchIndex(normalizedIndex);
  }, []);

  useEffect(() => {
    if (!activeGuide || !articleRef.current) {
      highlightMatchesRef.current = [];
      setHighlightMatchCount(0);
      setActiveMatchIndex(0);
      return;
    }

    const matches = highlightGuideMatches(articleRef.current, debouncedQuery);
    highlightMatchesRef.current = matches;
    setHighlightMatchCount(matches.length);

    if (matches.length > 0) {
      activeMatchIndexRef.current = 0;
      shouldAutoScrollToFirstMatchRef.current = false;
      // Scroll to first match as user types, but don't disturb typing focus.
      // The activateMatch call below only scrolls — it no longer focuses the mark.
      activateMatch(0, true);
    } else {
      shouldAutoScrollToFirstMatchRef.current = false;
      activeMatchIndexRef.current = 0;
      setActiveMatchIndex(0);
    }
  }, [activeGuide, activateMatch, debouncedQuery]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Enter') return;
      if (!activeGuide) return;
      if (debouncedQuery.trim().length < MIN_SEARCH_QUERY_LENGTH) return;
      if (highlightMatchesRef.current.length === 0) return;

      const target = event.target as HTMLElement | null;
      if (target?.closest('button,a,input,select,textarea,[contenteditable="true"]')) return;

      event.preventDefault();
      // Navigate to next/previous match with scroll, wrapping around like Ctrl+F
      const nextIndex = activeMatchIndexRef.current + (event.shiftKey ? -1 : 1);
      activateMatch(nextIndex, true);
    };

    window.addEventListener('keydown', onKeyDown, true);
    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
    };
  }, [activeGuide, activateMatch, debouncedQuery]);

  return (
    <div className="settings-overlay" role="dialog" aria-modal="true" aria-label="Help guide">
      <button
        type="button"
        className="settings-overlay__backdrop"
        onClick={onBack}
        aria-label="Close help guide"
      />
      <div className="settings-dock settings-dock--help">
        <section className="settings-workbench help-guide">
          <header className="settings-workbench__header">
            <div>
              <p className="settings-workbench__crumb">Help / Action Authoring</p>
              <h1 className="settings-workbench__title">Help Guide</h1>
              <p className="settings-workbench__subtitle">
                Combined reference for parameter authoring, execution behavior, and action-specific field contracts.
              </p>
            </div>
            <button
              type="button"
              className="settings-workbench__close"
              onClick={onBack}
              aria-label="Close help guide"
              title="Close help guide"
            >
              <IconX size={18} />
            </button>

            {/* Search box in header - always visible */}
            <div className="help-guide__header-search">
              <div className="help-guide__search-container">
                <label className="help-guide__search" htmlFor="help-guide-search">
                  <IconSearch size={16} aria-hidden="true" />
                  <input
                    id="help-guide-search"
                    ref={searchInputRef}
                    type="text"
                    value={currentQuery}
                    onChange={(event) => setCurrentQuery(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key !== 'Enter') return;
                      if (debouncedQuery.trim().length < MIN_SEARCH_QUERY_LENGTH) return;

                      if (!activeGuide) {
                        if (searchResults.length === 0) return;
                        event.preventDefault();
                        shouldAutoScrollToFirstMatchRef.current = true;
                        setSection(searchResults[0].id);
                        return;
                      }

                      if (highlightMatchesRef.current.length === 0) return;

                      event.preventDefault();
                      const nextIndex = activeMatchIndexRef.current + (event.shiftKey ? -1 : 1);
                      activateMatch(nextIndex, true);
                    }}
                    placeholder={section === 'overview'
                      ? 'Search both guides…'
                      : 'Search this guide…'}
                    aria-label="Search help content"
                    aria-live="polite"
                  />
                  {currentQuery.length > 0 && (
                    <button
                      type="button"
                      className="help-guide__search-clear"
                      onClick={() => {
                        setCurrentQuery('');
                        searchInputRef.current?.focus();
                      }}
                      aria-label="Clear search"
                      title="Clear (Ctrl+A to select all)"
                    >
                      ×
                    </button>
                  )}
                </label>
              </div>

              {activeGuide && highlightMatchCount > 0 && (
                <div className="help-guide__search-controls">
                  <button
                    type="button"
                    className="btn btn--secondary btn--icon-sm"
                    onClick={() => {
                      activateMatch(activeMatchIndexRef.current - 1, true);
                      searchInputRef.current?.focus();
                    }}
                    title="Previous match (Shift+Enter)"
                    aria-label={`Previous match`}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="btn btn--secondary btn--icon-sm"
                    onClick={() => {
                      activateMatch(activeMatchIndexRef.current + 1, true);
                      searchInputRef.current?.focus();
                    }}
                    title="Next match (Enter)"
                    aria-label={`Next match`}
                  >
                    ↓
                  </button>
                  {!isSearching && (
                    <span className="help-guide__match-info">
                      {activeMatchIndex + 1} / {highlightMatchCount}
                    </span>
                  )}
                </div>
              )}

              {isSearching && currentQuery.length >= MIN_SEARCH_QUERY_LENGTH && (
                <span className="help-guide__match-info help-guide__match-info--searching">
                  searching…
                </span>
              )}
            </div>
          </header>

          <div className="settings-workbench__body">
            <aside className="settings-nav" aria-label="Help sections">
              <p className="settings-nav-label">Guide</p>
              <button
                type="button"
                className={`settings-nav-item${section === 'overview' ? ' is-active' : ''}`}
                onClick={() => setSection('overview')}
              >
                <span className="settings-nav-item__title">Start Here</span>
                <span className="settings-nav-item__sub">Quick search and section routing</span>
              </button>
              <button
                type="button"
                className={`settings-nav-item${section === 'matrix' ? ' is-active' : ''}`}
                onClick={() => setSection('matrix')}
              >
                <span className="settings-nav-item__title">Authoring Rules</span>
                <span className="settings-nav-item__sub">Execution path and parameter matrix</span>
              </button>
              <button
                type="button"
                className={`settings-nav-item${section === 'appendix' ? ' is-active' : ''}`}
                onClick={() => setSection('appendix')}
              >
                <span className="settings-nav-item__title">Reference Catalog</span>
                <span className="settings-nav-item__sub">Extended action-by-action notes</span>
              </button>
            </aside>

            <div className="settings-content help-guide__content">

              {section === 'overview' && (
                <section className="help-guide__overview">
                  <article className="help-guide__summary-card">
                    <div className="help-guide__summary-head">
                      <IconHelp size={18} />
                      <h2>How to use this guide</h2>
                    </div>
                    <p>
                      Use search to find parameter fields, action names, or runtime behaviors across both documents.
                      Then jump directly into Matrix or Appendix for full context.
                    </p>
                  </article>

                  {currentQuery.trim().length >= MIN_SEARCH_QUERY_LENGTH ? (
                    <div className="help-guide__results">
                      {searchResults.length > 0 ? (
                        searchResults.map((result) => (
                          <article key={result.id} className="help-guide__result-card">
                            <div className="help-guide__result-head">
                              <h3>{result.label}</h3>
                              <span className="meta-pill meta-pill--info">{result.matches} match{result.matches > 1 ? 'es' : ''}</span>
                            </div>
                            {result.snippet && (
                              <p className="help-guide__snippet">{result.snippet}</p>
                            )}
                            <button
                              type="button"
                              className="btn btn--secondary btn--sm"
                              onClick={() => {
                                shouldAutoScrollToFirstMatchRef.current = true;
                                setSection(result.id);
                              }}
                            >
                              Open {result.label}
                            </button>
                          </article>
                        ))
                      ) : (
                        <p className="text-sm text-secondary">
                          No results for <strong>{currentQuery.trim()}</strong>. Try action names such as
                          <code className="help-guide__inline-code"> VERIFYERROR </code>
                          or field names such as
                          <code className="help-guide__inline-code"> ElementCategory </code>.
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="help-guide__tips">
                      <p className="text-sm text-secondary">Popular terms to search:</p>
                      <div className="help-guide__chip-row">
                        <button type="button" className="meta-pill" onClick={() => setCurrentQuery('ElementCategory')}>ElementCategory</button>
                        <button type="button" className="meta-pill" onClick={() => setCurrentQuery('VERIFYERROR')}>VERIFYERROR</button>
                        <button type="button" className="meta-pill" onClick={() => setCurrentQuery('DataKey')}>DataKey</button>
                        <button type="button" className="meta-pill" onClick={() => setCurrentQuery('attendance')}>attendance</button>
                      </div>
                    </div>
                  )}
                </section>
              )}

              {activeGuide && (
                <section className="help-guide__document" aria-live="polite" aria-label="Document content">
                  {currentQuery.trim().length >= MIN_SEARCH_QUERY_LENGTH && (
                    <div className="help-guide__search-feedback">
                      <p className="help-guide__search-feedback-text">
                        {highlightMatchCount > 0
                          ? `Found ${highlightMatchCount} match${highlightMatchCount > 1 ? 'es' : ''} in ${activeGuide.label}`
                          : `No matches found in ${activeGuide.label}`}
                      </p>
                    </div>
                  )}
                  <article
                    className="help-guide__article"
                    ref={articleRef}
                    role="document"
                    onClick={(event) => {
                      const target = event.target as HTMLElement | null;
                      const highlight = target?.closest('mark.help-guide__highlight') as HTMLElement | null;
                      if (!highlight) return;
                      const clickedIndex = Number(highlight.dataset.matchIndex ?? '-1');
                      if (Number.isNaN(clickedIndex) || clickedIndex < 0) return;
                      activateMatch(clickedIndex, true);
                    }}
                  />
                </section>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
