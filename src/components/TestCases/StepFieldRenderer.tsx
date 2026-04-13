/**
 * Dynamic Step Field Renderer
 * Renders fields based on action parameter contracts and element authoring patterns
 * Layout:
 * Row 1: Action | Element (Locator) | ElementCategory (LocatorType)
 * Row 2: Summary/Description (full width)
 * Row 3: [Dynamic Locator checkbox] [ElementReplaceKey - appears when checked]
 * Rows 4+: Other fields (Value, ExpectedValue, Key, Headers, etc.)
 */
import { ACTION_REGISTRY, getElementAuthoringFields } from '../../utils/actionRegistry';
import type { ParameterContract } from '../../utils/actionRegistry';
import type { ParsedStep } from './StepsEditor';

interface StepFieldRendererProps {
  step: ParsedStep;
  onFieldChange: (field: keyof ParsedStep, value: string | boolean) => void;
}

const ELEMENT_CATEGORY_OPTIONS = [
  { value: 'XPATH', label: 'XPATH' },
  { value: 'ID', label: 'ID' },
  { value: 'CLASS', label: 'CLASS' },
  { value: 'CSSSELECTOR', label: 'CSSSELECTOR' },
  { value: 'TAGNAME', label: 'TAGNAME' },
  { value: 'LINKTEXT', label: 'LINKTEXT' },
  { value: 'NAME', label: 'NAME' },
  { value: 'JSPATH', label: 'JSPATH' },
  { value: 'URL', label: 'URL' },
  { value: 'VERIFY', label: 'VERIFY' },
  { value: 'VERIFYERROR', label: 'VERIFYERROR' },
];

function shouldRenderField(
  fieldName: string,
  contract: ParameterContract | undefined
): boolean {
  if (fieldName === 'description') {
    return true;
  }

  if (!contract) {
    return [
      'element',
      'elementCategory',
      'value',
      'expectedValue',
      'key',
      'headers',
    ].includes(fieldName);
  }

  const contractField = contract[fieldName as keyof ParameterContract];
  if (contractField === undefined) return false;
  return contractField !== 'not-used';
}

function isFieldRequired(
  fieldName: string,
  contract: ParameterContract | undefined
): boolean {
  if (!contract) return false;

  const contractField = contract[fieldName as keyof ParameterContract];
  return contractField === 'required';
}

function getFieldLabel(fieldName: string): string {
  const labels: Record<string, string> = {
    element: 'LOCATOR',
    elementCategory: 'LOCATOR TYPE',
    value: 'VALUE',
    expectedValue: 'EXPECTED VALUE',
    key: 'DATA KEY',
    headers: 'HEADERS',
    description: 'SUMMARY',
    elementReplaceTextDataKey: 'REPLACEMENT KEY(S)',
    isElementPathDynamic: 'DYNAMIC LOCATOR',
    isConcatenated: 'CONCATENATED',
  };
  return labels[fieldName] || fieldName.toUpperCase();
}

function getFieldPlaceholder(fieldName: string): string {
  const placeholders: Record<string, string> = {
    element: 'e.g., //div[@id="summary"]',
    elementCategory: 'Select locator type',
    value: 'Enter value',
    expectedValue: 'e.g., true',
    key: 'e.g., step_result_1',
    headers: 'e.g., Student Name',
    description: 'e.g., Checking staff details tab is present',
    elementReplaceTextDataKey: 'saved_key or key1,key2',
  };
  return placeholders[fieldName] || '';
}

export function StepFieldRenderer({ step, onFieldChange }: StepFieldRendererProps) {
  const actionDef = ACTION_REGISTRY[step.action];
  const contract = actionDef?.contract;

  // Get element authoring field visibility based on element category
  const elementFields = getElementAuthoringFields(actionDef, step.elementCategory);

  return (
    <>
      {/* ===== ROW 1: Summary (spans 3 cols, next to Action) ===== */}
      {shouldRenderField('description', contract) && (
        <div className="steps-editor__field steps-editor__field--summary-inline">
          <label className={`steps-editor__label ${isFieldRequired('description', contract) ? '' : 'steps-editor__label--optional'}`}>
            {getFieldLabel('description')}
          </label>
          <input
            type="text"
            className="steps-editor__input"
            value={step.description || ''}
            onChange={(e) => onFieldChange('description', e.target.value)}
            placeholder={getFieldPlaceholder('description')}
          />
        </div>
      )}

      {/* ===== ROW 2: Locator Type (1 col) | Element/Locator (2 cols) ===== */}
      {elementFields.showElementCategory && (
        <div className="steps-editor__field steps-editor__field--locator-type">
          <label className={`steps-editor__label ${isFieldRequired('elementCategory', contract) ? '' : 'steps-editor__label--optional'}`}>
            {getFieldLabel('elementCategory')}
          </label>
          <select
            className="steps-editor__select"
            value={step.elementCategory || 'XPATH'}
            onChange={(e) => {
              onFieldChange('elementCategory', e.target.value);
              // Reset dynamic fields if switching categories
              if (!['URL', 'VERIFY', 'VERIFYERROR'].includes(e.target.value)) {
                if (step.isElementPathDynamic && !step.element?.includes('$$') && !step.element?.match(/Datakey\d+/)) {
                  onFieldChange('isElementPathDynamic', false);
                }
              }
            }}
            title={elementFields.elementCategoryHint}
          >
            {ELEMENT_CATEGORY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {elementFields.showElement && (
        <div className="steps-editor__field steps-editor__field--locator">
          <label className={`steps-editor__label ${isFieldRequired('element', contract) ? '' : 'steps-editor__label--optional'}`}>
            {getFieldLabel('element')}
          </label>
          <input
            type="text"
            className="steps-editor__input"
            style={{ fontFamily: 'var(--font-mono)' }}
            value={step.element || ''}
            onChange={(e) => onFieldChange('element', e.target.value)}
            placeholder={elementFields.elementCategoryHint || getFieldPlaceholder('element')}
            title={elementFields.elementCategoryHint}
          />
        </div>
      )}

      {/* ===== ROW 3: Value (if applicable) ===== */}
      {(elementFields.showValue || shouldRenderField('value', contract)) && (
        <div className="steps-editor__field">
          <label className={`steps-editor__label ${isFieldRequired('value', contract) ? '' : 'steps-editor__label--optional'}`}>
            {getFieldLabel('value')}
            {step.elementCategory === 'URL' && <span title="URL Navigation"> (URL)</span>}
            {step.elementCategory === 'VERIFYERROR' && <span title="Expected Error Text"> (Error Text)</span>}
          </label>
          <input
            type="text"
            className="steps-editor__input"
            value={step.value || ''}
            onChange={(e) => onFieldChange('value', e.target.value)}
            placeholder={
              step.elementCategory === 'URL'
                ? 'https://example.com or #SavedURLKey'
                : step.elementCategory === 'VERIFYERROR'
                ? 'Expected error message text'
                : getFieldPlaceholder('value')
            }
          />
        </div>
      )}

      {/* ===== ROW 4: Dynamic Locator Checkbox (1 col) + Replacement Key (3 cols) ===== */}
      {elementFields.showIsElementPathDynamic && (
        <div className="steps-editor__field steps-editor__field--dynamic-toggle-row">
          <label className="steps-editor__label steps-editor__label--optional">
            {getFieldLabel('isElementPathDynamic')}
          </label>
          <div className="steps-editor__checkbox-wrapper">
            <input
              type="checkbox"
              id={`dynamic-${step.index || 'new'}`}
              className="steps-editor__checkbox"
              checked={step.isElementPathDynamic || false}
              onChange={(e) => onFieldChange('isElementPathDynamic', e.target.checked)}
              title="Enable to use saved keys for element replacement"
            />
            <label htmlFor={`dynamic-${step.index || 'new'}`} className="steps-editor__checkbox-label">
              {step.isElementPathDynamic ? 'Dynamic' : 'Static'}
            </label>
          </div>
        </div>
      )}

      {elementFields.showElementReplaceTextDataKey && step.isElementPathDynamic && (
        <div className="steps-editor__field steps-editor__field--replace-key-full">
          <label className="steps-editor__label" style={{ color: !step.elementReplaceTextDataKey ? 'var(--accent-error-dark)' : 'var(--color-text-secondary)' }}>
            {getFieldLabel('elementReplaceTextDataKey')} *
          </label>
          <input
            type="text"
            className="steps-editor__input"
            style={{
              fontFamily: 'var(--font-mono)',
              borderColor: !step.elementReplaceTextDataKey ? 'var(--accent-error-light)' : undefined
            }}
            value={step.elementReplaceTextDataKey || ''}
            onChange={(e) => onFieldChange('elementReplaceTextDataKey', e.target.value)}
            placeholder={getFieldPlaceholder('elementReplaceTextDataKey')}
            title="Saved key name(s) to replace in Element. Use comma for multiple keys."
          />
          {!step.elementReplaceTextDataKey ? (
            <small className="steps-editor__field-error">
              Required: Dynamic locator enabled - must provide replacement key(s)
            </small>
          ) : (
            <small className="steps-editor__hint">
              {step.element?.match(/Datakey\d+/)
                ? `Found ${(step.element.match(/Datakey\d+/g) || []).length} token(s) - provide that many keys`
                : step.element?.includes('$$')
                ? 'Enter 1 key to replace $$'
                : 'Enter key name(s)'}
            </small>
          )}
        </div>
      )}

      {/* ===== ROW 5+: Other Fields (ExpectedValue, Key, Headers, etc.) ===== */}

      {shouldRenderField('expectedValue', contract) && (
        <div className="steps-editor__field">
          <label className={`steps-editor__label ${isFieldRequired('expectedValue', contract) ? '' : 'steps-editor__label--optional'}`}>
            {getFieldLabel('expectedValue')}
          </label>
          <input
            type="text"
            className="steps-editor__input"
            value={step.expectedValue || ''}
            onChange={(e) => onFieldChange('expectedValue', e.target.value)}
            placeholder={getFieldPlaceholder('expectedValue')}
          />
        </div>
      )}

      {/* Data Store and Headers Fields */}
      {shouldRenderField('key', contract) && (
        <div className="steps-editor__field">
          <label className={`steps-editor__label ${isFieldRequired('key', contract) ? '' : 'steps-editor__label--optional'}`}>
            {getFieldLabel('key')}
          </label>
          <input
            type="text"
            className="steps-editor__input"
            style={{ fontFamily: 'var(--font-mono)' }}
            value={step.key || ''}
            onChange={(e) => onFieldChange('key', e.target.value)}
            placeholder={getFieldPlaceholder('key')}
          />
        </div>
      )}

      {shouldRenderField('headers', contract) && (
        <div className="steps-editor__field">
          <label className={`steps-editor__label ${isFieldRequired('headers', contract) ? '' : 'steps-editor__label--optional'}`}>
            {getFieldLabel('headers')}
          </label>
          <input
            type="text"
            className="steps-editor__input"
            style={{ fontFamily: 'var(--font-mono)' }}
            value={step.headers || ''}
            onChange={(e) => onFieldChange('headers', e.target.value)}
            placeholder={getFieldPlaceholder('headers')}
          />
        </div>
      )}

      {shouldRenderField('isConcatenated', contract) && (
        <div className="steps-editor__field">
          <label className="steps-editor__label steps-editor__label--optional">
            {getFieldLabel('isConcatenated')}
          </label>
          <select
            className="steps-editor__select"
            value={step.isConcatenated ? 'true' : 'false'}
            onChange={(e) => onFieldChange('isConcatenated', e.target.value === 'true')}
          >
            <option value="false">False</option>
            <option value="true">True</option>
          </select>
        </div>
      )}
    </>
  );
}
