import { useState } from 'react';
import { NOT_SELECTED_LABEL } from '../../utils/selectLabels';
import { IconInfo } from '../Common/Icons';
import { InitialStepsPreviewModal } from './InitialStepsPreviewModal';
import type { WorkspaceSettingsValues } from '../pages/WorkspaceSettings';

interface TestCaseFormFieldsProps {
  formData: {
    title?: string;
    status: string;
    method: string;
    region: string;
    execProcess: string;
    pltpProcess: string;
    initialSteps: string;
  };
  onChange: (updatedData: Partial<{
    title: string;
    status: string;
    method: string;
    region: string;
    execProcess: string;
    pltpProcess: string;
    initialSteps: string;
  }>) => void;
  isLoading?: boolean;
  showTitle?: boolean;
  validationErrors?: string[];
  showValidationSummary?: boolean;
  invalidFields?: Set<'title' | 'status' | 'method' | 'region' | 'execProcess' | 'pltpProcess' | 'initialSteps'>;
  titlePlaceholder?: string;
  /** When provided, enables the "Find initial steps" DB-search control. */
  workspaceSettings?: WorkspaceSettingsValues;
  /** Active plan id — narrows the DB search to its mapped database. */
  planId?: number;
}

const DEFAULT_STATUS_OPTIONS = ['Design', 'Ready', 'Closed', 'Removed'];
const DEFAULT_METHOD_OPTIONS = ['Appium', 'Manual', 'Selenium', 'Testim'];

export function TestCaseFormFields({
  formData,
  onChange,
  isLoading = false,
  showTitle = true,
  validationErrors = [],
  showValidationSummary = true,
  invalidFields = new Set(),
  titlePlaceholder = 'Enter test case title',
  workspaceSettings,
  planId,
}: TestCaseFormFieldsProps) {
  const [showInitialStepsPreview, setShowInitialStepsPreview] = useState(false);
  const handleChange = (field: string, value: string) => {
    onChange({ [field]: value } as any);
  };
  const canSearchInitialSteps = Boolean(workspaceSettings);
  const hasInitialStepsValue = formData.initialSteps.trim().length > 0;

  const statusOptions = DEFAULT_STATUS_OPTIONS.includes(formData.status)
    ? DEFAULT_STATUS_OPTIONS
    : [formData.status, ...DEFAULT_STATUS_OPTIONS].filter((value, index, arr) => value && arr.indexOf(value) === index);

  const methodOptions = DEFAULT_METHOD_OPTIONS.includes(formData.method)
    ? DEFAULT_METHOD_OPTIONS
    : [formData.method, ...DEFAULT_METHOD_OPTIONS].filter((value, index, arr) => value && arr.indexOf(value) === index);

  return (
    <>
      {/* Validation Errors */}
      {showValidationSummary && validationErrors.length > 0 && (
        <div className="case-detail-edit-errors">
          {validationErrors.map((error, idx) => (
            <p key={idx} className="case-detail-edit-error">{error}</p>
          ))}
        </div>
      )}

      {/* ONE MERGED FORM CARD - All fields together */}
      <div className="case-detail-edit-form">
        {/* Row 1: Title + Initial Steps */}
        <div style={{ display: 'flex', gap: '16px', gridColumn: 'span 6' }}>
          {showTitle && (
            <div className="case-detail-edit-form__field" style={{ flex: 1 }}>
              <label className="case-detail-edit-form__label">Test Case Title *</label>
              <input
                type="text"
                className={`case-detail-edit-form__input${invalidFields.has('title') ? ' case-detail-edit-form__input--invalid' : ''}`}
                value={formData.title || ''}
                onChange={(e) => handleChange('title', e.target.value)}
                placeholder={titlePlaceholder}
                disabled={isLoading}
                autoFocus
                aria-invalid={invalidFields.has('title')}
              />
            </div>
          )}
          <div className="case-detail-edit-form__field" style={{ flex: 1 }}>
            <div className="initial-steps-label-row">
              <label className="case-detail-edit-form__label">Initial Steps</label>
              {canSearchInitialSteps && (
                <button
                  type="button"
                  className="initial-steps-info-btn"
                  onClick={() => setShowInitialStepsPreview(true)}
                  disabled={!hasInitialStepsValue}
                  title={
                    hasInitialStepsValue
                      ? 'Preview these initial steps from the local test database'
                      : 'Enter one or more initial step names first'
                  }
                  aria-label="Preview initial steps from the local database"
                >
                  <IconInfo size={14} />
                </button>
              )}
            </div>
            <input
              type="text"
              className={`case-detail-edit-form__input${invalidFields.has('initialSteps') ? ' case-detail-edit-form__input--invalid' : ''}`}
              value={formData.initialSteps}
              onChange={(e) => handleChange('initialSteps', e.target.value)}
              placeholder="Enter initial setup steps or preconditions..."
              disabled={isLoading}
              aria-invalid={invalidFields.has('initialSteps')}
            />
          </div>
        </div>

        {/* Row 2: Status + Method + Region */}
        <div style={{ display: 'flex', gap: '16px', gridColumn: 'span 6' }}>
          <div className="case-detail-edit-form__field" style={{ flex: 1 }}>
            <label className="case-detail-edit-form__label">Status</label>
            <select
              className={`steps-editor__select${invalidFields.has('status') ? ' steps-editor__select--invalid' : ''}`}
              value={formData.status || ''}
              onChange={(e) => handleChange('status', e.target.value)}
              disabled={isLoading}
              aria-invalid={invalidFields.has('status')}
            >
              {!formData.status && (
                <option value="" disabled>
                  {NOT_SELECTED_LABEL}
                </option>
              )}
              {statusOptions.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>
          <div className="case-detail-edit-form__field" style={{ flex: 1 }}>
            <label className="case-detail-edit-form__label">Testing Method</label>
            <select
              className={`case-detail-edit-form__input${invalidFields.has('method') ? ' case-detail-edit-form__input--invalid' : ''}`}
              value={formData.method || ''}
              onChange={(e) => handleChange('method', e.target.value)}
              disabled={isLoading}
              aria-invalid={invalidFields.has('method')}
            >
              {!formData.method && (
                <option value="" disabled>
                  {NOT_SELECTED_LABEL}
                </option>
              )}
              {methodOptions.map((method) => (
                <option key={method} value={method}>
                  {method}
                </option>
              ))}
            </select>
          </div>
          <div className="case-detail-edit-form__field" style={{ flex: 1 }}>
            <label className="case-detail-edit-form__label">Region</label>
            <input
              type="text"
              className={`case-detail-edit-form__input${invalidFields.has('region') ? ' case-detail-edit-form__input--invalid' : ''}`}
              value={formData.region}
              onChange={(e) => handleChange('region', e.target.value)}
              placeholder="e.g., All Regions, US, EU"
              disabled={isLoading}
              aria-invalid={invalidFields.has('region')}
            />
          </div>
        </div>

        {/* Row 3: Executive Process + PLTP Process */}
        <div style={{ display: 'flex', gap: '16px', gridColumn: 'span 6' }}>
          <div className="case-detail-edit-form__field" style={{ flex: 1 }}>
            <label className="case-detail-edit-form__label">Executive Process</label>
            <input
              type="text"
              className={`case-detail-edit-form__input${invalidFields.has('execProcess') ? ' case-detail-edit-form__input--invalid' : ''}`}
              value={formData.execProcess}
              onChange={(e) => handleChange('execProcess', e.target.value)}
              placeholder="Enter executive process"
              disabled={isLoading}
              aria-invalid={invalidFields.has('execProcess')}
            />
          </div>
          <div className="case-detail-edit-form__field" style={{ flex: 1 }}>
            <label className="case-detail-edit-form__label">PLTP Process</label>
            <input
              type="text"
              className={`case-detail-edit-form__input${invalidFields.has('pltpProcess') ? ' case-detail-edit-form__input--invalid' : ''}`}
              value={formData.pltpProcess}
              onChange={(e) => handleChange('pltpProcess', e.target.value)}
              placeholder="Enter PLTP process area"
              disabled={isLoading}
              aria-invalid={invalidFields.has('pltpProcess')}
            />
          </div>
        </div>
      </div>

      {showInitialStepsPreview && workspaceSettings && (
        <InitialStepsPreviewModal
          names={formData.initialSteps}
          planId={planId}
          workspaceSettings={workspaceSettings}
          onClose={() => setShowInitialStepsPreview(false)}
        />
      )}
    </>
  );
}
