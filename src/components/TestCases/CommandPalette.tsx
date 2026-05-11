// Command palette (Ctrl+Shift+P) — fuzzy-searchable list of modal commands.
// Reuses the QuickOpen visual language for consistency.

import { useEffect, useMemo, useRef, useState } from 'react';

export interface PaletteCommand {
  id: string;
  label: string;
  /** Optional category shown to the left (e.g. "File", "View"). */
  category?: string;
  /** Optional shortcut hint shown on the right (e.g. "Ctrl+S"). */
  shortcut?: string;
  /** Disabled commands appear dim and are not executable. */
  disabled?: boolean;
  run: () => void;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  commands: PaletteCommand[];
}

interface MatchedCommand extends PaletteCommand {
  score: number;
}

// Cheap subsequence fuzzy match over "category label" text.
function scoreCommand(cmd: PaletteCommand, query: string): number | null {
  if (!query) return 0;
  const haystack = `${cmd.category ?? ''} ${cmd.label}`.toLowerCase();
  const needle = query.toLowerCase();
  // Substring boost
  const contig = haystack.indexOf(needle);
  if (contig !== -1) return 1000 - contig;
  // Subsequence
  let qi = 0;
  for (let i = 0; i < haystack.length && qi < needle.length; i += 1) {
    if (haystack[i] === needle[qi]) qi += 1;
  }
  if (qi < needle.length) return null;
  return 100 - Math.abs(haystack.length - needle.length);
}

export function CommandPalette({ isOpen, onClose, commands }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const resultsRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setActiveIdx(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [isOpen]);

  const matches: MatchedCommand[] = useMemo(() => {
    if (!isOpen) return [];
    const out: MatchedCommand[] = [];
    for (const c of commands) {
      const s = scoreCommand(c, query);
      if (s !== null) out.push({ ...c, score: s });
    }
    if (!query.trim()) return out;
    out.sort((a, b) => b.score - a.score);
    return out;
  }, [commands, query, isOpen]);

  useEffect(() => {
    if (activeIdx >= matches.length) {
      setActiveIdx(Math.max(0, matches.length - 1));
    }
  }, [matches.length, activeIdx]);

  useEffect(() => {
    if (!resultsRef.current) return;
    const el = resultsRef.current.querySelector<HTMLElement>(`[data-idx="${activeIdx}"]`);
    if (el) el.scrollIntoView({ block: 'nearest' });
  }, [activeIdx]);

  if (!isOpen) return null;

  const run = (idx: number) => {
    const cmd = matches[idx];
    if (!cmd || cmd.disabled) return;
    onClose();
    // Defer so the close state-flush happens first.
    setTimeout(() => cmd.run(), 0);
  };

  return (
    <div className="quick-open-overlay" role="dialog" aria-label="Command palette" onClick={onClose}>
      <div className="quick-open" onClick={(e) => e.stopPropagation()}>
        <div className="quick-open__input-row">
          <span className="quick-open__caret" aria-hidden="true">»</span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            placeholder="Type a command…"
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
                run(activeIdx);
              }
            }}
          />
        </div>
        <div className="quick-open__results" ref={resultsRef}>
          {matches.length === 0 ? (
            <div className="quick-open__empty">No matching commands</div>
          ) : (
            matches.map((m, idx) => (
              <button
                key={m.id}
                type="button"
                data-idx={idx}
                disabled={m.disabled}
                className={`quick-open__result command-palette__row${idx === activeIdx ? ' is-active' : ''}${m.disabled ? ' is-disabled' : ''}`}
                onClick={() => run(idx)}
                onMouseEnter={() => setActiveIdx(idx)}
                title={m.label}
              >
                {m.category && (
                  <span className="command-palette__category">{m.category}</span>
                )}
                <span className="command-palette__label">{m.label}</span>
                {m.shortcut && (
                  <span className="command-palette__shortcut">{m.shortcut}</span>
                )}
              </button>
            ))
          )}
        </div>
        <div className="quick-open__footer">
          <span><kbd>↑</kbd><kbd>↓</kbd> Navigate</span>
          <span><kbd>↵</kbd> Run</span>
          <span><kbd>Esc</kbd> Close</span>
          <span className="quick-open__count">{matches.length} commands</span>
        </div>
      </div>
    </div>
  );
}
