
import { NOT_SELECTED_LABEL } from '../../utils/selectLabels';

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
  titlePlaceholder?: string;
}

const DEFAULT_STATUS_OPTIONS = ['Design', 'Ready', 'Closed', 'Removed'];
const DEFAULT_METHOD_OPTIONS = ['Appium', 'Manual', 'Selenium', 'Testim'];

export function TestCaseFormFields({
  formData,
  onChange,
  isLoading = false,
  showTitle = true,
  validationErrors = [],
  titlePlaceholder = 'Enter test case title',
}: TestCaseFormFieldsProps) {
  const handleChange = (field: string, value: string) => {
    onChange({ [field]: value } as any);
  };

  const statusOptions = DEFAULT_STATUS_OPTIONS.includes(formData.status)
    ? DEFAULT_STATUS_OPTIONS
    : [formData.status, ...DEFAULT_STATUS_OPTIONS].filter((value, index, arr) => value && arr.indexOf(value) === index);

  const methodOptions = DEFAULT_METHOD_OPTIONS.includes(formData.method)
    ? DEFAULT_METHOD_OPTIONS
    : [formData.method, ...DEFAULT_METHOD_OPTIONS].filter((value, index, arr) => value && arr.indexOf(value) === index);

  return (
    <>
      {/* Validation Errors */}
      {validationErrors.length > 0 && (
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
                className="case-detail-edit-form__input"
                value={formData.title || ''}
                onChange={(e) => handleChange('title', e.target.value)}
                placeholder={titlePlaceholder}
                disabled={isLoading}
                autoFocus
              />
            </div>
          )}
          <div className="case-detail-edit-form__field" style={{ flex: 1 }}>
            <label className="case-detail-edit-form__label">Initial Steps</label>
            <input
              type="text"
              className="case-detail-edit-form__input"
              value={formData.initialSteps}
              onChange={(e) => handleChange('initialSteps', e.target.value)}
              placeholder="Enter initial setup steps or preconditions..."
              disabled={isLoading}
            />
          </div>
        </div>

        {/* Row 2: Status + Method + Region */}
        <div style={{ display: 'flex', gap: '16px', gridColumn: 'span 6' }}>
          <div className="case-detail-edit-form__field" style={{ flex: 1 }}>
            <label className="case-detail-edit-form__label">Status</label>
            <select
              className="steps-editor__select"
              value={formData.status || ''}
              onChange={(e) => handleChange('status', e.target.value)}
              disabled={isLoading}
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
              className="case-detail-edit-form__input"
              value={formData.method || ''}
              onChange={(e) => handleChange('method', e.target.value)}
              disabled={isLoading}
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
              className="case-detail-edit-form__input"
              value={formData.region}
              onChange={(e) => handleChange('region', e.target.value)}
              placeholder="e.g., All Region, US, EU"
              disabled={isLoading}
            />
          </div>
        </div>

        {/* Row 3: Executive Process + PLTP Process */}
        <div style={{ display: 'flex', gap: '16px', gridColumn: 'span 6' }}>
          <div className="case-detail-edit-form__field" style={{ flex: 1 }}>
            <label className="case-detail-edit-form__label">Executive Process</label>
            <input
              type="text"
              className="case-detail-edit-form__input"
              value={formData.execProcess}
              onChange={(e) => handleChange('execProcess', e.target.value)}
              placeholder="Enter executive process"
              disabled={isLoading}
            />
          </div>
          <div className="case-detail-edit-form__field" style={{ flex: 1 }}>
            <label className="case-detail-edit-form__label">PLTP Process</label>
            <input
              type="text"
              className="case-detail-edit-form__input"
              value={formData.pltpProcess}
              onChange={(e) => handleChange('pltpProcess', e.target.value)}
              placeholder="Enter PLTP process area"
              disabled={isLoading}
            />
          </div>
        </div>
      </div>
    </>
  );
}
