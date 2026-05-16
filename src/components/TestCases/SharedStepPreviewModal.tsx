import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { IconX, IconEdit, IconSave } from '../Common/Icons';
import { fetchTestCaseDetail, buildWorkItemAdoUrl } from '../../services/adoApi';
import { parseXMLSteps } from '../../utils/xmlParser';
import { useNotification } from '../../context/useNotification';
import { useTestCaseEditor } from './useTestCaseEditor';
import { TestCaseEditorBody } from './TestCaseEditorBody';
import type { ADOTestCase } from '../../types';
import type { WorkspaceSettingsValues } from '../pages/WorkspaceSettings';
import azureLogo from '../../assets/azure.png';

interface SharedStepPreviewModalProps {
  testId: string;
  workspaceSettings: WorkspaceSettingsValues;
  onClose: () => void;
}

function normalizeFieldText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  return '';
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

function describeFetchError(error: unknown, testId: string): string {
  const msg = error instanceof Error ? error.message : typeof error === 'string' ? error : '';
  const lower = msg.toLowerCase();

  if (lower.includes('404') || lower.includes('not found') || lower.includes('does not exist')) {
    return `Test case #${testId} was not found in Azure DevOps. Check the id and your project / organization settings.`;
  }
  if (lower.includes('401') || lower.includes('unauthor')) {
    return 'Authentication failed. Your Personal Access Token is missing, expired, or lacks "Test Management – Read" permission.';
  }
  if (lower.includes('403') || lower.includes('forbidden')) {
    return 'Access denied. The account tied to your PAT does not have permission to read this test case.';
  }
  if (lower.includes('network') || lower.includes('fetch') || lower.includes('failed to fetch')) {
    return 'Network error while contacting Azure DevOps. Check your connection and try again.';
  }
  if (lower.includes('settings') || lower.includes('organization') || lower.includes('project')) {
    return 'Workspace settings are incomplete. Configure Organization, Project, and PAT in Settings before previewing shared steps.';
  }
  if (msg) return `Unable to fetch shared step — ${msg}`;
  return `Unable to fetch shared step #${testId}.`;
}

export function SharedStepPreviewModal({
  testId,
  workspaceSettings,
  onClose,
}: SharedStepPreviewModalProps) {
  const [testCase, setTestCase] = useState<ADOTestCase | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [discardPrompt, setDiscardPrompt] = useState<null | 'close' | 'cancel'>(null);
  const { addNotification } = useNotification();

  const editor = useTestCaseEditor({
    workspaceSettings,
    onSaved: (updated) => {
      setTestCase(updated);
      setIsEditing(false);
      addNotification('success', `Shared step "${updated.name}" updated successfully.`);
    },
  });

  const attemptClose = () => {
    if (isEditing && editor.isDirty) {
      setDiscardPrompt('close');
      return;
    }
    onClose();
  };

  const startEditing = () => {
    if (!testCase) return;
    editor.beginEdit(testCase);
    setIsEditing(true);
  };

  const cancelEditing = () => {
    if (editor.isDirty) {
      setDiscardPrompt('cancel');
      return;
    }
    setIsEditing(false);
  };

  const keepEditing = () => setDiscardPrompt(null);

  const confirmDiscard = () => {
    const action = discardPrompt;
    setDiscardPrompt(null);
    if (action === 'close') {
      onClose();
    } else if (action === 'cancel') {
      setIsEditing(false);
    }
  };

  const handleSave = async () => {
    const result = await editor.save();
    if (!result.ok && result.error) {
      addNotification('error', result.error);
    }
  };

  useEffect(() => {
    const trimmed = testId.trim();
    const parsed = Number(trimmed);
    if (!trimmed) {
      setIsLoading(false);
      setErrorMessage('The Value field is empty. Enter a numeric test case id to preview its shared steps.');
      return;
    }
    if (!Number.isInteger(parsed) || parsed <= 0) {
      setIsLoading(false);
      setErrorMessage(
        `"${trimmed}" is not a valid test case id. FETCH_SHARED_STEPS expects a positive integer (the id of the test case whose steps should be reused).`,
      );
      return;
    }

    const controller = new AbortController();
    setIsLoading(true);
    setErrorMessage(null);
    setTestCase(null);

    fetchTestCaseDetail(workspaceSettings, parsed, undefined, undefined, controller.signal)
      .then((result) => {
        if (!result) {
          setErrorMessage(
            `Azure DevOps returned no test case for id #${parsed}. Verify that the id is correct and that it belongs to the current project.`,
          );
          return;
        }
        setTestCase(result);
      })
      .catch((error: unknown) => {
        if ((error as { name?: string })?.name === 'AbortError') return;
        setErrorMessage(describeFetchError(error, String(parsed)));
      })
      .finally(() => {
        setIsLoading(false);
      });

    return () => controller.abort();
  }, [testId, workspaceSettings]);

  useEffect(() => {
    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (discardPrompt) {
        setDiscardPrompt(null);
        return;
      }
      attemptClose();
    };
    document.addEventListener('keydown', handleKeydown);
    return () => document.removeEventListener('keydown', handleKeydown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditing, editor.isDirty, discardPrompt, onClose]);

  const parsedSteps = useMemo(() => {
    if (!testCase) return [];
    const raw = normalizeFieldText(testCase.fields?.['Microsoft.VSTS.TCM.Steps']).trim();
    if (!raw) return [];
    try {
      return parseXMLSteps(raw).steps;
    } catch {
      return [];
    }
  }, [testCase]);

  const initialSteps = useMemo(
    () => normalizeFieldText(testCase?.fields?.['Custom.InitialStep']).trim(),
    [testCase],
  );

  const mainRows = useMemo(() => {
    if (!testCase) return [] as Array<{ label: string; value: string }>;
    const f = testCase.fields || {};
    return [
      { label: 'ID', value: String(testCase.id) },
      { label: 'Status', value: normalizeFieldText(f['System.State']) },
      { label: 'Testing Method', value: normalizeFieldText(f['Custom.TestingMethod']) },
      { label: 'Region', value: normalizeFieldText(f['Custom.Region']) },
    ].filter((row) => row.value.trim().length > 0);
  }, [testCase]);

  const adoUrl = useMemo(() => {
    const parsed = Number(testId.trim());
    if (!Number.isInteger(parsed) || parsed <= 0) return '';
    try {
      return buildWorkItemAdoUrl(workspaceSettings, parsed);
    } catch {
      return '';
    }
  }, [testId, workspaceSettings]);

  return (
    <div
      className="settings-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Shared step preview"
    >
      <button
        type="button"
        className="settings-overlay__backdrop"
        onClick={attemptClose}
        aria-label="Close shared step preview"
      />
      <div className="settings-dock settings-dock--no-aside">
        <section className="settings-workbench">
          <header className="settings-workbench__header">
            <div className="shared-step-preview__heading-copy">
              <p className="settings-workbench__crumb">
                {isEditing ? 'Edit Shared Step' : 'Shared Step Preview'}
              </p>
              <h1 className="settings-workbench__title shared-step-preview__title" title={testCase?.name}>
                {(isEditing ? editor.formData.title : testCase?.name)
                  || `Test Case #${testId.trim() || '—'}`}
              </h1>
              <p className="settings-workbench__subtitle">
                {isEditing
                  ? 'Editing this shared step — changes save to Azure DevOps.'
                  : 'Read-only preview of the referenced shared step test case.'}
              </p>
            </div>
            <div className="shared-step-preview__actions">
              {!isLoading && !errorMessage && testCase && adoUrl && (
                <a
                  href={adoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shared-step-preview__ado-link"
                  title="Open in Azure DevOps"
                >
                  <img
                    className="case-detail__azure-icon"
                    src={azureLogo}
                    alt=""
                    width={16}
                    height={16}
                    aria-hidden="true"
                  />
                  <span>Open in ADO ↗</span>
                </a>
              )}
              {!isLoading && !errorMessage && testCase && !isEditing && (
                <button
                  type="button"
                  className="btn btn--secondary btn--sm"
                  onClick={startEditing}
                  title="Edit this shared step"
                >
                  <IconEdit size={14} />
                  Edit
                </button>
              )}
              {isEditing && (
                <>
                  <button
                    type="button"
                    className="btn btn--ghost btn--sm"
                    onClick={cancelEditing}
                    disabled={editor.isSaving}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn btn--primary btn--sm"
                    onClick={() => { void handleSave(); }}
                    disabled={editor.isSaving}
                  >
                    <IconSave size={14} />
                    {editor.isSaving ? 'Saving…' : 'Save'}
                  </button>
                </>
              )}
              <button
                type="button"
                className="settings-workbench__close"
                onClick={attemptClose}
                aria-label="Close shared step preview"
                title="Close"
              >
                <IconX size={18} />
              </button>
            </div>
          </header>

          <div className="settings-workbench__body">
            <div className="settings-content">
              {isLoading && (
                <p className="text-sm text-secondary">Loading shared step…</p>
              )}

              {!isLoading && errorMessage && (
                <div className="case-detail-edit-errors">
                  <p className="case-detail-edit-error">⚠ {errorMessage}</p>
                </div>
              )}

              {!isLoading && !errorMessage && testCase && (
                <section className="settings-pane">
                  {isEditing ? (
                    <TestCaseEditorBody
                      editor={editor}
                      rawStepsXml={testCase.fields?.['Microsoft.VSTS.TCM.Steps']}
                      workspaceSettings={workspaceSettings}
                    />
                  ) : (
                  <>
                  {mainRows.length > 0 && (
                    <div className="case-detail-grid">
                      {mainRows.map((row) => (
                        <article key={row.label} className="case-detail-card">
                          <span className="case-detail-card__label">{row.label}</span>
                          <p className="case-detail-card__value">{row.value || 'Not set'}</p>
                        </article>
                      ))}
                    </div>
                  )}

                  <div className="case-detail-steps-container mt-md">
                    {initialSteps && (
                      <article className="case-detail-step-item">
                        <p className="case-detail-step-item__title">
                          <span className="case-detail-step-item__index">Step 0:</span>
                          <strong className="case-detail-step-item__name">Initial Steps</strong>
                        </p>
                        <pre className="case-detail-step-item__full">{formatStepTextWithBoldLabels(initialSteps)}</pre>
                      </article>
                    )}

                    {parsedSteps.length > 0 ? (
                      <div className="case-detail-steps-list pt-md">
                        {parsedSteps.map((step, idx) => {
                          const partsList = [
                            step.action && `Action=${step.action}`,
                            step.elementCategory && `ElementCategory=${step.elementCategory}`,
                            step.element && `Element=${step.element}`,
                            step.value && `Value=${step.value}`,
                            step.expectedValue && `ExpectedVl=${step.expectedValue}`,
                            step.key && `DataKey=${step.key}`,
                            step.headers && `Headers=${step.headers}`,
                          ].filter(Boolean);
                          const fullText = partsList.join(' | ');
                          const title = step.description?.trim() || step.action || `Step ${idx + 1}`;
                          return (
                            <article key={idx} className="case-detail-step-item">
                              <p className="case-detail-step-item__title">
                                <span className="case-detail-step-item__index">Step {idx + 1}:</span>
                                <strong className="case-detail-step-item__name">{title}</strong>
                              </p>
                              <pre className="case-detail-step-item__full">{formatStepTextWithBoldLabels(fullText)}</pre>
                            </article>
                          );
                        })}
                      </div>
                    ) : (
                      !initialSteps && (
                        <p className="text-sm text-secondary">No step definition available.</p>
                      )
                    )}
                  </div>
                  </>
                  )}
                </section>
              )}
            </div>
          </div>
        </section>
      </div>

      {discardPrompt && (
        <div className="steps-editor__confirm-overlay" role="dialog" aria-modal="true" aria-label="Unsaved shared step changes">
          <button
            type="button"
            className="steps-editor__confirm-backdrop"
            onClick={keepEditing}
            aria-label="Close unsaved changes confirmation"
          />
          <div className="steps-editor__confirm-card steps-editor__confirm-card--warning" role="document">
            <div className="steps-editor__confirm-head">
              <div>
                <p className="steps-editor__confirm-kicker steps-editor__confirm-kicker--warning">Unsaved changes</p>
                <h3 className="steps-editor__confirm-title steps-editor__confirm-title--warning">
                  Discard edits on this shared step?
                </h3>
              </div>
              <button
                type="button"
                className="steps-editor__confirm-close"
                onClick={keepEditing}
                aria-label="Close unsaved changes confirmation"
                title="Close"
              >
                <IconX size={16} />
              </button>
            </div>

            <p className="steps-editor__confirm-copy">
              You have unsaved changes to this shared step. Discarding now will remove your
              updates to the title, fields, and steps.
            </p>

            <div className="steps-editor__confirm-actions">
              <button type="button" className="btn btn--secondary btn--sm" onClick={keepEditing}>
                Keep editing
              </button>
              <button type="button" className="btn btn--danger btn--sm" onClick={confirmDiscard}>
                Discard changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
