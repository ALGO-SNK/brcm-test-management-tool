import React, { useCallback, useEffect, useRef, useState } from 'react';
import { IconX } from '../Common/Icons';
import { StepsEditor } from './StepsEditor';
import { TestCaseFormFields } from './TestCaseFormFields';
import type { ParsedStep } from './StepsEditor';

interface CreateTestCaseFormProps {
  suiteName: string;
  isLoading?: boolean;
  apiError?: string | null;
  onCancel: () => void;
  onSubmit: (formData: {
    title: string;
    status: string;
    method: string;
    region: string;
    execProcess: string;
    pltpProcess: string;
    initialSteps: string;
    steps: ParsedStep[];
  }) => void;
}

export function CreateTestCaseForm({
  isLoading = false,
  apiError = null,
  onCancel,
  onSubmit,
}: CreateTestCaseFormProps) {
  const [formData, setFormData] = useState({
    title: '',
    status: 'Design',
    method: 'Selenium',
    region: 'All Region',
    execProcess: '',
    pltpProcess: '',
    initialSteps: '',
  });

  const [steps, setSteps] = useState<ParsedStep[]>([]);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [showUnsavedConfirm, setShowUnsavedConfirm] = useState(false);
  const [confirmDiscardRequested, setConfirmDiscardRequested] = useState(false);
  const [pendingDiscardAction, setPendingDiscardAction] = useState<'cancel' | 'window-close' | null>(null);
  const allowWindowCloseRef = useRef(false);

  const isDirty = formData.title.trim() !== ''
    || formData.status !== 'Design'
    || formData.method !== 'Selenium'
    || formData.region !== 'All Region'
    || formData.execProcess.trim() !== ''
    || formData.pltpProcess.trim() !== ''
    || formData.initialSteps.trim() !== ''
    || steps.length > 0;

  const handleSubmit = useCallback((e?: React.FormEvent) => {
    e?.preventDefault();

    // Validate required fields
    const errors: string[] = [];
    if (!formData.title.trim()) {
      errors.push('❌ Test case title is required');
    }
    if (!formData.status.trim()) {
      errors.push('❌ Status is required');
    }
    if (!formData.method.trim()) {
      errors.push('❌ Testing method is required');
    }
    if (!formData.region.trim()) {
      errors.push('❌ Region is required');
    }
    if (!formData.execProcess.trim()) {
      errors.push('❌ Executive process is required');
    }
    if (!formData.pltpProcess.trim()) {
      errors.push('❌ PLTP process area is required');
    }

    if (errors.length > 0) {
      setValidationErrors(errors);
      return;
    }

    setValidationErrors([]);
    onSubmit({
      ...formData,
      steps,
    });
  }, [formData, onSubmit, steps]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.repeat) return;
      const isSaveShortcut = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's';
      if (!isSaveShortcut) return;

      event.preventDefault();
      event.stopPropagation();
      handleSubmit();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleSubmit]);

  useEffect(() => {
    if (!isDirty) return;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (allowWindowCloseRef.current) {
        return;
      }

      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isDirty]);

  useEffect(() => {
    window.desktop?.setUnsavedChanges?.('create-test-case', isDirty);

    return () => {
      window.desktop?.setUnsavedChanges?.('create-test-case', false);
    };
  }, [isDirty]);

  useEffect(() => {
    if (!isDirty) return;

    return window.desktop?.onWindowCloseRequested?.(() => {
      setPendingDiscardAction('window-close');
      setShowUnsavedConfirm(true);
    });
  }, [isDirty]);

  useEffect(() => {
    if (showUnsavedConfirm || !confirmDiscardRequested || pendingDiscardAction === null) return;

    setConfirmDiscardRequested(false);
    const action = pendingDiscardAction;
    setPendingDiscardAction(null);

    if (action === 'window-close') {
      allowWindowCloseRef.current = true;
      window.desktop?.respondToWindowClose?.(true);
      return;
    }

    onCancel();
  }, [confirmDiscardRequested, onCancel, pendingDiscardAction, showUnsavedConfirm]);

  const keepEditing = useCallback(() => {
    allowWindowCloseRef.current = false;
    if (pendingDiscardAction === 'window-close') {
      window.desktop?.respondToWindowClose?.(false);
    }
    setPendingDiscardAction(null);
    setShowUnsavedConfirm(false);
  }, [pendingDiscardAction]);

  const requestCancel = () => {
    allowWindowCloseRef.current = false;
    if (isDirty) {
      setPendingDiscardAction('cancel');
      setShowUnsavedConfirm(true);
      return;
    }
    onCancel();
  };

  const discardChanges = () => {
    setShowUnsavedConfirm(false);
    setConfirmDiscardRequested(true);
  };

  return (
    <>
    <form onSubmit={handleSubmit} className="case-detail-pane case-detail-pane--edit">
      {apiError && (
        <div className="case-detail-edit-errors">
          <p className="case-detail-edit-error">❌ API Error: {apiError}</p>
        </div>
      )}

        <div className="case-detail-section__head case-detail-section__head--merged case-detail-section__head--fixed">
          <div>
            <h3>Details & Steps</h3>
          </div>
          <div className="case-detail-section__actions">
            <button
              type="submit"
              className="btn btn--primary btn--sm"
              disabled={isLoading}
            >
              {isLoading ? 'Creating...' : 'Create Test Case'}
            </button>
            <button
              type="button"
              className="btn btn--secondary btn--sm"
              onClick={requestCancel}
              disabled={isLoading}
            >
              Cancel
            </button>
          </div>
        </div>

        <div className="case-detail-pane__content">
          <section className="case-detail-edit-section">
            {/* Shared Form Fields - Identical to Edit Mode */}
            <TestCaseFormFields
              formData={formData}
              onChange={(updatedData) => setFormData(prev => ({ ...prev, ...updatedData }))}
              isLoading={isLoading}
              showTitle={true}
              validationErrors={validationErrors}
              titlePlaceholder="Enter test case title"
            />

            {/* Steps Editor - Identical to Edit Mode */}
            <StepsEditor
              rawSteps=""
              onChange={setSteps}
              errors={validationErrors.filter((e) => e.includes('step'))}
            />
          </section>
        </div>
      </form>
      {showUnsavedConfirm && (
        <div className="steps-editor__confirm-overlay" role="dialog" aria-modal="true" aria-label="Discard unsaved changes">
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
                  Discard the new test case?
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
              {pendingDiscardAction === 'window-close'
                ? 'You have unsaved changes in this create form. Closing the app now will discard the title, fields, and steps you entered.'
                : 'You have unsaved changes in this create form. Discarding them will remove the title, fields, and steps you entered.'}
            </p>

            <div className="steps-editor__confirm-actions">
              <button type="button" className="btn btn--secondary btn--sm" onClick={keepEditing}>
                Keep editing
              </button>
              <button type="button" className="btn btn--danger btn--sm" onClick={discardChanges}>
                {pendingDiscardAction === 'window-close' ? 'Close without saving' : 'Discard changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
