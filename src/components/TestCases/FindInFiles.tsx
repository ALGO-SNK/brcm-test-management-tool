// Find in Files (Ctrl+Shift+F) — project-wide content search overlay.
// Calls the desktop:search-in-files IPC and renders grouped results.
// Clicking a match opens the file and jumps to the line.

import { useEffect, useRef, useState } from 'react';

interface FindInFilesProps {
  isOpen: boolean;
  onClose: () => void;
  rootPath: string;
  onOpenMatch: (filePath: string, line: number, column: number) => void;
}

type SearchResult = DesktopSearchResult;

export function FindInFiles({ isOpen, onClose, rootPath, onOpenMatch }: FindInFilesProps) {
  const [query, setQuery] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [wholeWord, setWholeWord] = useState(false);
  const [isRegex, setIsRegex] = useState(false);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const inputRef = useRef<HTMLInputElement | null>(null);
  const debounceRef = useRef<number | null>(null);

  useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => inputRef.current?.focus());
    } else {
      setResult(null);
      setQuery('');
      setCollapsed({});
    }
  }, [isOpen]);

  // Debounced search on query / options change
  useEffect(() => {
    if (!isOpen) return;
    if (!query.trim()) {
      setResult(null);
      setIsSearching(false);
      return;
    }
    if (!window.desktop?.searchInFiles || !rootPath) return;
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await window.desktop!.searchInFiles!(rootPath, {
          query,
          caseSensitive,
          isRegex,
          wholeWord,
        });
        setResult(res);
      } catch (err) {
        setResult({
          matches: [],
          totalMatches: 0,
          truncated: false,
          error: err instanceof Error ? err.message : 'Search failed',
        });
      } finally {
        setIsSearching(false);
      }
    }, 250);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [query, caseSensitive, wholeWord, isRegex, isOpen, rootPath]);

  if (!isOpen) return null;

  const relativize = (full: string): string => {
    if (!rootPath) return full;
    const normalizedFull = full.replace(/\\/g, '/');
    const normalizedRoot = rootPath.replace(/\\/g, '/').replace(/\/$/, '');
    return normalizedFull.startsWith(normalizedRoot + '/')
      ? normalizedFull.slice(normalizedRoot.length + 1)
      : full;
  };

  const renderLine = (lineText: string, column: number, matchLength: number) => {
    const start = Math.max(0, column - 1);
    const end = start + matchLength;
    return (
      <>
        <span>{lineText.slice(0, start)}</span>
        <mark>{lineText.slice(start, end)}</mark>
        <span>{lineText.slice(end)}</span>
      </>
    );
  };

  const fileCount = result?.matches.length ?? 0;
  const total = result?.totalMatches ?? 0;

  return (
    <div className="find-in-files-overlay" role="dialog" aria-label="Find in files" onClick={onClose}>
      <div className="find-in-files" onClick={(e) => e.stopPropagation()}>
        <div className="find-in-files__header">
          <div className="find-in-files__input-row">
            <span className="find-in-files__caret" aria-hidden="true">⌕</span>
            <input
              ref={inputRef}
              type="text"
              value={query}
              placeholder="Search in files…"
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  e.preventDefault();
                  onClose();
                }
              }}
            />
            <div className="find-in-files__options" role="group" aria-label="Search options">
              <button
                type="button"
                className={`find-in-files__opt${caseSensitive ? ' is-on' : ''}`}
                onClick={() => setCaseSensitive((v) => !v)}
                title="Match case"
              >
                Aa
              </button>
              <button
                type="button"
                className={`find-in-files__opt${wholeWord ? ' is-on' : ''}`}
                onClick={() => setWholeWord((v) => !v)}
                title="Whole word"
              >
                ab
              </button>
              <button
                type="button"
                className={`find-in-files__opt${isRegex ? ' is-on' : ''}`}
                onClick={() => setIsRegex((v) => !v)}
                title="Regular expression"
              >
                .*
              </button>
            </div>
          </div>
          <div className="find-in-files__summary">
            {isSearching && <span>Searching…</span>}
            {!isSearching && result?.error && (
              <span className="find-in-files__error">{result.error}</span>
            )}
            {!isSearching && !result?.error && result && (
              <span>
                {total} {total === 1 ? 'result' : 'results'} in {fileCount}{' '}
                {fileCount === 1 ? 'file' : 'files'}
                {result.truncated && ' (results truncated)'}
              </span>
            )}
            {!isSearching && !result && query.trim() && (
              <span>Type to search…</span>
            )}
          </div>
        </div>

        <div className="find-in-files__results">
          {result?.matches.map((fileResult) => {
            const rel = relativize(fileResult.path);
            const fileName = rel.split(/[\\/]/).pop() ?? rel;
            const dirPath = rel.slice(0, rel.length - fileName.length);
            const isCollapsed = collapsed[fileResult.path];
            return (
              <div key={fileResult.path} className="find-in-files__file-group">
                <button
                  type="button"
                  className="find-in-files__file-header"
                  onClick={() => setCollapsed((c) => ({ ...c, [fileResult.path]: !c[fileResult.path] }))}
                  title={fileResult.path}
                >
                  <span className="find-in-files__chevron" aria-hidden="true">
                    {isCollapsed ? '▸' : '▾'}
                  </span>
                  <span className="find-in-files__file-name">{fileName}</span>
                  <span className="find-in-files__file-dir">{dirPath}</span>
                  <span className="find-in-files__file-count">{fileResult.matches.length}</span>
                </button>
                {!isCollapsed && (
                  <div className="find-in-files__matches">
                    {fileResult.matches.map((m, idx) => (
                      <button
                        key={`${m.line}:${m.column}:${idx}`}
                        type="button"
                        className="find-in-files__match"
                        onClick={() => {
                          onOpenMatch(fileResult.path, m.line, m.column);
                        }}
                        title={`Line ${m.line}, column ${m.column}`}
                      >
                        <span className="find-in-files__match-line">{m.line}</span>
                        <span className="find-in-files__match-text">
                          {renderLine(m.lineText, m.column, m.matchLength)}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          {!isSearching && result && result.matches.length === 0 && query.trim() && !result.error && (
            <div className="find-in-files__empty">No results found for "{query}"</div>
          )}
        </div>

        <div className="find-in-files__footer">
          <span><kbd>Esc</kbd> Close</span>
          <span><kbd>Enter</kbd> on a result to open</span>
        </div>
      </div>
    </div>
  );
}
