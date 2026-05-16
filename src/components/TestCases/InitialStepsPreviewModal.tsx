import { useEffect, useState, type ReactNode } from 'react';
import { IconX } from '../Common/Icons';
import type { WorkspaceSettingsValues } from '../pages/WorkspaceSettings';

interface InitialStepsPreviewModalProps {
  /** Raw Initial Steps field value (one or more comma-separated names). */
  names: string;
  /** Active plan id, when known — narrows the DB search to its mapped DB. */
  planId?: number;
  workspaceSettings: WorkspaceSettingsValues;
  onClose: () => void;
}

function formatStepTextWithBoldLabels(text: string): ReactNode[] {
  const parts: ReactNode[] = [];
  const segments = text.split(/(\|)/);
  segments.forEach((segment, index) => {
    if (segment === '|') {
      parts.push('|');
    } else if (segment.trim()) {
      const match = segment.match(/^(\s*)([^=]+)(=.*)$/);
      if (match) {
        const [, leading, label, rest] = match;
        if (leading) parts.push(leading);
        parts.push(<strong key={`label-${index}`}>{label.trim()}</strong>);
        parts.push(rest);
      } else {
        parts.push(segment);
      }
    }
  });
  return parts;
}

function buildStepFullText(step: DesktopInitialStepEntry): string {
  return [
    step.actionType && `Action=${step.actionType}`,
    step.elementCategory && `ElementCategory=${step.elementCategory}`,
    step.element && `Element=${step.element}`,
    step.value && `Value=${step.value}`,
    step.expectedValue && `ExpectedVl=${step.expectedValue}`,
    step.key && `DataKey=${step.key}`,
    step.headers && `Headers=${step.headers}`,
  ]
    .filter(Boolean)
    .join(' | ');
}

export function InitialStepsPreviewModal({
  names,
  planId,
  workspaceSettings,
  onClose,
}: InitialStepsPreviewModalProps) {
  const [data, setData] = useState<DesktopInitialStepSearchResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const trimmed = names.trim();
    if (!trimmed) {
      setIsLoading(false);
      setErrorMessage('The Initial Steps field is empty. Enter one or more step names (comma-separated) to search.');
      return;
    }
    if (!window.desktop?.searchInitialSteps) {
      setIsLoading(false);
      setErrorMessage('The local database bridge is unavailable in this build. Initial step search needs the desktop app.');
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setErrorMessage(null);
    setData(null);

    window.desktop
      .searchInitialSteps(workspaceSettings, { names: trimmed, planId })
      .then((result) => {
        if (cancelled) return;
        setData(result);
        if (result.error) setErrorMessage(result.error);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setErrorMessage(error instanceof Error ? error.message : 'Could not search the local database.');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [names, planId, workspaceSettings]);

  useEffect(() => {
    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeydown);
    return () => document.removeEventListener('keydown', handleKeydown);
  }, [onClose]);

  const results = data?.results ?? [];

  return (
    <div
      className="settings-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Initial steps preview"
    >
      <button
        type="button"
        className="settings-overlay__backdrop"
        onClick={onClose}
        aria-label="Close initial steps preview"
      />
      <div className="settings-dock settings-dock--no-aside">
        <section className="settings-workbench">
          <header className="settings-workbench__header">
            <div className="shared-step-preview__heading-copy">
              <p className="settings-workbench__crumb">Initial Steps Preview</p>
              <h1 className="settings-workbench__title shared-step-preview__title">
                {names.trim() || 'Initial steps'}
              </h1>
              <p className="settings-workbench__subtitle">
                Read-only — all matching initial steps found in the local test database.
              </p>
            </div>
            <button
              type="button"
              className="settings-workbench__close"
              onClick={onClose}
              aria-label="Close initial steps preview"
              title="Close"
            >
              <IconX size={18} />
            </button>
          </header>

          <div className="settings-workbench__body">
            <div className="settings-content">
              {isLoading && (
                <p className="text-sm text-secondary">Searching local database…</p>
              )}

              {!isLoading && errorMessage && (
                <div className="case-detail-edit-errors">
                  <p className="case-detail-edit-error">⚠ {errorMessage}</p>
                </div>
              )}

              {!isLoading && !errorMessage && results.length === 0 && (
                <div className="case-detail-edit-errors">
                  <p className="case-detail-edit-error">
                    No initial steps matched
                    {data?.query?.length ? ` "${data.query.join('", "')}"` : ''}
                    {data?.searchedDbs?.length
                      ? ` in ${data.searchedDbs.join(', ')}.`
                      : '.'}
                    {data?.missingDbs?.length
                      ? ` (Not on disk: ${data.missingDbs.join(', ')} — run the DB Updater first.)`
                      : ''}
                  </p>
                </div>
              )}

              {!isLoading && results.length > 0 && (
                <section className="settings-pane">
                  <p className="text-sm text-secondary mb-sm">
                    {results.length} initial step{results.length === 1 ? '' : 's'} found
                    {data?.searchedDbs?.length ? ` in ${data.searchedDbs.join(', ')}` : ''}.
                  </p>

                  {results.map((entry) => (
                    <div
                      key={`${entry.dbName}-${entry.id}`}
                      className="initial-steps-preview__result"
                    >
                      <p className="initial-steps-preview__result-head">
                        <span className="initial-steps-preview__result-id">#{entry.id}</span>
                        <strong className="initial-steps-preview__result-name">{entry.title}</strong>
                        <span className="initial-steps-preview__tag">{entry.label}</span>
                        {entry.matchedName && (
                          <span className="initial-steps-preview__tag initial-steps-preview__tag--muted">
                            matched “{entry.matchedName}”
                          </span>
                        )}
                      </p>

                      {entry.initialSteps.length > 0 && (
                        <p className="initial-steps-preview__chain">
                          Initial steps: {entry.initialSteps.join(' → ')}
                        </p>
                      )}

                      {entry.steps.length > 0 ? (
                        <div className="case-detail-steps-list pt-sm">
                          {entry.steps.map((step, idx) => {
                            const fullText = buildStepFullText(step);
                            const title =
                              step.description?.trim()
                              || step.actionType
                              || `Step ${idx + 1}`;
                            return (
                              <article key={idx} className="case-detail-step-item">
                                <p className="case-detail-step-item__title">
                                  <span className="case-detail-step-item__index">
                                    Step {step.stepNumber ?? idx + 1}:
                                  </span>
                                  <strong className="case-detail-step-item__name">{title}</strong>
                                </p>
                                {fullText && (
                                  <pre className="case-detail-step-item__full">
                                    {formatStepTextWithBoldLabels(fullText)}
                                  </pre>
                                )}
                              </article>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-sm text-secondary">No step definition stored for this entry.</p>
                      )}
                    </div>
                  ))}
                </section>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
