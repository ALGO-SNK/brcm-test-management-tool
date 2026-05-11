// Quick Open (Ctrl+P) — fuzzy file finder for the repo browser.
// Lightweight overlay; in-house fuzzy match (no extra dependency).

import { useEffect, useMemo, useRef, useState } from 'react';

interface FileItem {
  path: string;
  name: string;
  dirPath: string;
}

interface MatchedFile extends FileItem {
  score: number;
  matchIndices: number[];
}

/**
 * Fuzzy match: returns score (higher = better) + which chars of the name matched.
 * Returns null if not a match. Score boosts: exact prefix, consecutive matches.
 */
function fuzzyMatch(name: string, query: string): { score: number; indices: number[] } | null {
  if (!query) return { score: 0, indices: [] };
  const lowerName = name.toLowerCase();
  const lowerQuery = query.toLowerCase();

  // Quick contiguous-substring boost (e.g., "Stud" in "StudentList")
  const contigIdx = lowerName.indexOf(lowerQuery);
  if (contigIdx !== -1) {
    const indices: number[] = [];
    for (let i = 0; i < lowerQuery.length; i += 1) indices.push(contigIdx + i);
    // Earlier match = higher score; prefix match = best
    return { score: 1000 - contigIdx * 2 + (contigIdx === 0 ? 200 : 0), indices };
  }

  // Subsequence fuzzy (e.g., "stl" matches "StudentList")
  const indices: number[] = [];
  let lastMatchedIdx = -1;
  let consecutive = 0;
  let totalScore = 0;
  let qi = 0;
  for (let i = 0; i < lowerName.length && qi < lowerQuery.length; i += 1) {
    if (lowerName[i] === lowerQuery[qi]) {
      indices.push(i);
      // Bonus for consecutive matches, bonus if matching a "boundary" (uppercase or after separator)
      const isBoundary = i === 0
        || name[i] === name[i].toUpperCase()
        || lowerName[i - 1] === '.'
        || lowerName[i - 1] === '_'
        || lowerName[i - 1] === '/'
        || lowerName[i - 1] === '\\';
      consecutive = lastMatchedIdx === i - 1 ? consecutive + 1 : 0;
      totalScore += 10 + consecutive * 5 + (isBoundary ? 15 : 0);
      lastMatchedIdx = i;
      qi += 1;
    }
  }
  if (qi < lowerQuery.length) return null;
  // Penalize long names (closer match score for shorter filenames)
  totalScore -= Math.max(0, name.length - lowerQuery.length) * 0.5;
  return { score: totalScore, indices };
}

interface QuickOpenProps {
  isOpen: boolean;
  onClose: () => void;
  files: FileItem[];
  onSelect: (path: string) => void;
  /** Most-recently-opened file paths (most recent first). Surfaced when the query is empty. */
  recentPaths?: string[];
}

export function QuickOpen({ isOpen, onClose, files, onSelect, recentPaths = [] }: QuickOpenProps) {
  const [query, setQuery] = useState('');
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const resultsRef = useRef<HTMLDivElement | null>(null);

  // Reset on open and focus the input
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setActiveIdx(0);
      // Focus once mounted
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    }
  }, [isOpen]);

  // Match + sort
  const matches: MatchedFile[] = useMemo(() => {
    if (!isOpen) return [];
    if (!query.trim()) {
      // Empty query: recents first (in MRU order), then any other files up to 30.
      const byPath = new Map(files.map((f) => [f.path, f] as const));
      const recents: MatchedFile[] = [];
      const seen = new Set<string>();
      for (const p of recentPaths) {
        const f = byPath.get(p);
        if (f && !seen.has(f.path)) {
          recents.push({ ...f, score: 0, matchIndices: [] });
          seen.add(f.path);
          if (recents.length >= 10) break;
        }
      }
      const rest: MatchedFile[] = [];
      for (const f of files) {
        if (seen.has(f.path)) continue;
        rest.push({ ...f, score: 0, matchIndices: [] });
        if (recents.length + rest.length >= 30) break;
      }
      return [...recents, ...rest];
    }
    const out: MatchedFile[] = [];
    for (const f of files) {
      const match = fuzzyMatch(f.name, query);
      if (match) out.push({ ...f, score: match.score, matchIndices: match.indices });
    }
    // Boost recents within the matched set so a recently-opened match wins ties.
    const recentRank = new Map(recentPaths.map((p, i) => [p, recentPaths.length - i] as const));
    out.sort((a, b) => {
      const scoreDiff = b.score - a.score;
      if (scoreDiff !== 0) return scoreDiff;
      return (recentRank.get(b.path) ?? 0) - (recentRank.get(a.path) ?? 0);
    });
    return out.slice(0, 30);
  }, [query, files, isOpen, recentPaths]);

  // Keep active index in bounds when results change
  useEffect(() => {
    if (activeIdx >= matches.length) {
      setActiveIdx(Math.max(0, matches.length - 1));
    }
  }, [matches.length, activeIdx]);

  // Scroll active row into view
  useEffect(() => {
    if (!resultsRef.current) return;
    const el = resultsRef.current.querySelector<HTMLElement>(`[data-idx="${activeIdx}"]`);
    if (el) {
      el.scrollIntoView({ block: 'nearest' });
    }
  }, [activeIdx]);

  if (!isOpen) return null;

  const choose = (idx: number) => {
    const file = matches[idx];
    if (!file) return;
    onSelect(file.path);
    onClose();
  };

  const renderHighlight = (name: string, indices: number[]) => {
    if (indices.length === 0) return name;
    const out: React.ReactNode[] = [];
    let last = 0;
    indices.forEach((i, k) => {
      if (i > last) out.push(<span key={`p${k}`}>{name.slice(last, i)}</span>);
      out.push(<mark key={`m${k}`}>{name[i]}</mark>);
      last = i + 1;
    });
    if (last < name.length) out.push(<span key="end">{name.slice(last)}</span>);
    return out;
  };

  return (
    <div className="quick-open-overlay" role="dialog" aria-label="Quick open file" onClick={onClose}>
      <div className="quick-open" onClick={(e) => e.stopPropagation()}>
        <div className="quick-open__input-row">
          <span className="quick-open__caret" aria-hidden="true">›</span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            placeholder="Go to file by name…"
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIdx(0);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.preventDefault();
                onClose();
              } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                setActiveIdx((i) => Math.min(matches.length - 1, i + 1));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setActiveIdx((i) => Math.max(0, i - 1));
              } else if (e.key === 'Enter') {
                e.preventDefault();
                choose(activeIdx);
              }
            }}
          />
        </div>
        <div className="quick-open__results" ref={resultsRef}>
          {matches.length === 0 ? (
            <div className="quick-open__empty">
              {query.trim() ? `No files match "${query}"` : 'Loading workspace files…'}
            </div>
          ) : (
            matches.map((m, idx) => {
              const isRecent = !query.trim() && recentPaths.includes(m.path);
              return (
                <button
                  key={m.path}
                  type="button"
                  data-idx={idx}
                  className={`quick-open__result${idx === activeIdx ? ' is-active' : ''}`}
                  onClick={() => choose(idx)}
                  onMouseEnter={() => setActiveIdx(idx)}
                  title={m.path}
                >
                  <span className="quick-open__result-name">
                    {renderHighlight(m.name, m.matchIndices)}
                  </span>
                  <span className="quick-open__result-dir">{m.dirPath}</span>
                  {isRecent && <span className="quick-open__result-badge">recent</span>}
                </button>
              );
            })
          )}
        </div>
        <div className="quick-open__footer">
          <span><kbd>↑</kbd><kbd>↓</kbd> Navigate</span>
          <span><kbd>↵</kbd> Open</span>
          <span><kbd>Esc</kbd> Close</span>
          <span className="quick-open__count">
            {matches.length} of {files.length} files
          </span>
        </div>
      </div>
    </div>
  );
}

export type { FileItem };
