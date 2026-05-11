// Recursive variable row for the debug panel.
// Lazily fetches children via window.desktop.debuggerVariables when expanded.
//
// A variable is expandable iff variablesReference > 0 (DAP convention).

import { useState } from 'react';

interface DebugVariableRowProps {
  runId: string | null;
  variable: DesktopDebuggerVariable;
  depth: number;
}

export function DebugVariableRow({ runId, variable, depth }: DebugVariableRowProps) {
  const [expanded, setExpanded] = useState(false);
  const [children, setChildren] = useState<DesktopDebuggerVariable[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canExpand = (variable.variablesReference ?? 0) > 0;

  const toggle = async () => {
    if (!canExpand) return;
    if (expanded) {
      setExpanded(false);
      return;
    }
    setExpanded(true);
    if (children !== null || !runId || !window.desktop?.debuggerVariables) return;
    setLoading(true);
    setError(null);
    try {
      const res = await window.desktop.debuggerVariables(runId, variable.variablesReference!);
      if (res.ok) {
        setChildren(res.variables);
      } else {
        setError(res.error || 'Failed to load.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div
        className={`debug-panel__var${canExpand ? ' is-expandable' : ''}`}
        style={{ paddingLeft: `${8 + depth * 14}px` }}
        onClick={() => { void toggle(); }}
        role={canExpand ? 'button' : undefined}
        tabIndex={canExpand ? 0 : -1}
        onKeyDown={(e) => {
          if (canExpand && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            void toggle();
          }
        }}
      >
        <span className="debug-panel__var-chevron" aria-hidden="true">
          {canExpand ? (expanded ? '▾' : '▸') : ''}
        </span>
        <span className="debug-panel__var-name">{variable.name}</span>
        <span className="debug-panel__var-eq">=</span>
        <span
          className="debug-panel__var-value"
          title={`${variable.type ?? ''} ${variable.value}`.trim()}
        >
          {variable.value}
        </span>
      </div>
      {expanded && (
        <>
          {loading && (
            <div
              className="debug-panel__var-state"
              style={{ paddingLeft: `${8 + (depth + 1) * 14}px` }}
            >
              Loading…
            </div>
          )}
          {error && (
            <div
              className="debug-panel__var-state debug-panel__var-state--error"
              style={{ paddingLeft: `${8 + (depth + 1) * 14}px` }}
            >
              {error}
            </div>
          )}
          {children?.map((child, idx) => (
            <DebugVariableRow
              key={`${child.name}:${idx}:${child.variablesReference ?? 0}`}
              runId={runId}
              variable={child}
              depth={depth + 1}
            />
          ))}
          {children && children.length === 0 && !loading && !error && (
            <div
              className="debug-panel__var-state"
              style={{ paddingLeft: `${8 + (depth + 1) * 14}px` }}
            >
              (empty)
            </div>
          )}
        </>
      )}
    </>
  );
}
