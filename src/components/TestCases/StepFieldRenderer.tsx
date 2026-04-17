/**
 * Dynamic Step Field Renderer
 * Renders fields based on action parameter contracts using flexbox layout.
 *
 * Field layout (flex-wrap with smart sizing):
 *   Row 1: [Action 30%]              [Summary 70%]           — together, summary bigger
 *   Row 2: [Locator Type 25%]        [Locator 75%]           — together, locator bigger (XPATH)
 *   Row 3: [Dynamic Toggle]          [Replacement Key]       — same row, replacement key appears only when dynamic is on
 *   Row 4: [Value 100%]                                      — full-width, bigger size
 *   Row 5: [Expected Value ~48%]     [Data Key ~48%]         — advanced/optional, smaller width
 *   Row 6: [Headers ~48%]            [Concatenated ~48%]     — advanced/optional, smaller width
 *
 * Optional fields are hidden until added from the per-step popup, then remain
 * visible if they contain data. Required fields always show.
 */
import { getElementAuthoringFields } from '../../utils/actionRegistry';
import { ACTION_REGISTRY } from '../../utils/actionRegistry';
import { supportsDynamicLocatorControls } from '../../utils/actionRegistry';
import type { ParameterContract } from '../../utils/actionRegistry';
import type { ReactNode } from 'react';
import type { OptionalStepField, ParsedStep } from './StepsEditor';
import { NOT_SELECTED_LABEL } from '../../utils/selectLabels';

interface StepFieldRendererProps {
  step: ParsedStep;
  onFieldChange: (field: keyof ParsedStep, value: string | boolean) => void;
  visibleOptionalFields: OptionalStepField[];
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

/**
 * Field visibility rules:
 * - Summary (description): always show
 * - Required fields: always show
 * - Core locator/value fields (element, elementCategory, value): show when used
 * - Optional fields: show when selected from the popup or already populated
 * - Dynamic fields: follow the same contract-driven visibility rules
 */

function shouldRenderField(
  fieldName: string,
  contract: ParameterContract | undefined,
  visibleOptionalFields: OptionalStepField[],
): boolean {
  // Summary always visible
  if (fieldName === 'description') return true;

  // No contract yet (no action chosen) → show nothing else
  if (!contract) return false;

  const contractField = contract[fieldName as keyof ParameterContract];

  // Completely unused by this action
  if (contractField === undefined || contractField === 'not-used') return false;

  // Required → always visible
  if (contractField === 'required') return true;

  if (contractField === 'optional') {
    return visibleOptionalFields.includes(fieldName as OptionalStepField);
  }

  return false;
}

function isFieldRequired(fieldName: string, contract: ParameterContract | undefined): boolean {
  if (fieldName === 'description') return true;
  if (!contract) return false;
  return contract[fieldName as keyof ParameterContract] === 'required';
}

function getRequiredMessage(fieldName: string): string {
  const labels: Record<string, string> = {
    description: 'Summary',
    elementCategory: 'Locator Type',
    element: 'Locator',
    value: 'Value',
    expectedValue: 'Expected Value',
    key: 'Data Key',
    headers: 'Headers',
    elementReplaceTextDataKey: 'Replacement Key',
  };

  return `${labels[fieldName] ?? fieldName} is required`;
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
    elementCategory: NOT_SELECTED_LABEL,
    value: 'Enter value',
    expectedValue: 'e.g., true',
    key: 'e.g., step_result_1',
    headers: 'e.g., Student Name',
    description: 'Describe this step…',
    elementReplaceTextDataKey: 'saved_key or key1,key2',
  };
  return placeholders[fieldName] || '';
}

function labelClass(required: boolean): string {
  return `steps-editor__label${required ? '' : ' steps-editor__label--optional'}`;
}

function renderFieldLabel(
  fieldName: string,
  contract: ParameterContract | undefined,
  suffix?: string,
): ReactNode {
  return (
    <>
      {getFieldLabel(fieldName)}
      {suffix && <span>{suffix}</span>}
      {isFieldRequired(fieldName, contract) && (
        <span className="steps-editor__required-mark" aria-hidden="true">
          *
        </span>
      )}
    </>
  );
}

export function StepFieldRenderer({ step, onFieldChange, visibleOptionalFields }: StepFieldRendererProps) {
  const actionDef = ACTION_REGISTRY[step.action];
  const contract = actionDef?.contract;
  const elementFields = getElementAuthoringFields(actionDef, step.elementCategory ?? 'XPATH');

  const showSummary    = shouldRenderField('description',         contract, visibleOptionalFields);
  const showLocType    = shouldRenderField('elementCategory',     contract, visibleOptionalFields) && elementFields.showElementCategory;
  const showLocator    = shouldRenderField('element',             contract, visibleOptionalFields) && elementFields.showElement;
  const showDynamic    = supportsDynamicLocatorControls(actionDef)
    && shouldRenderField('isElementPathDynamic', contract, visibleOptionalFields);
  const showReplaceKey = supportsDynamicLocatorControls(actionDef) && step.isElementPathDynamic === true;
  const showValue      = shouldRenderField('value',               contract, visibleOptionalFields) && elementFields.showValue;
  const showExpected   = shouldRenderField('expectedValue',       contract, visibleOptionalFields);
  const showKey        = shouldRenderField('key',                 contract, visibleOptionalFields);
  const showHeaders    = shouldRenderField('headers',             contract, visibleOptionalFields);
  const showConcat     = shouldRenderField('isConcatenated',      contract, visibleOptionalFields);
  const showSummaryError = false;
  const showLocTypeError = showLocType && isFieldRequired('elementCategory', contract) && !step.elementCategory?.trim();
  const showLocatorError = showLocator && isFieldRequired('element', contract) && !step.element?.trim();
  const showValueError = showValue && isFieldRequired('value', contract) && !step.value?.trim();
  const showExpectedError = showExpected && isFieldRequired('expectedValue', contract) && !step.expectedValue?.trim();
  const showKeyError = showKey && isFieldRequired('key', contract) && !step.key?.trim();
  const showHeadersError = showHeaders && isFieldRequired('headers', contract) && !step.headers?.trim();
  const showReplaceKeyError = showReplaceKey
    && isFieldRequired('elementReplaceTextDataKey', contract)
    && !step.elementReplaceTextDataKey?.trim();

  return (
    <>
      {/* ── Summary (70%, same flex row as Action) ──────────────────────────── */}
      {showSummary && (
        <div className="steps-editor__field steps-editor__field--summary-inline">
          <label className={labelClass(isFieldRequired('description', contract))}>
            {renderFieldLabel('description', contract)}
          </label>
          <input
            type="text"
            className="steps-editor__input"
            value={step.description || ''}
            onChange={(e) => onFieldChange('description', e.target.value)}
            placeholder={getFieldPlaceholder('description')}
          />
          {showSummaryError && (
            <small className="steps-editor__field-error">{getRequiredMessage('description')}</small>
          )}
        </div>
      )}

      {/* ── Locator Type (25%, flex row with Locator) ───────────────────────── */}
      {showLocType && (
        <div className="steps-editor__field steps-editor__field--locator-type">
          <label className={labelClass(isFieldRequired('elementCategory', contract))}>
            {renderFieldLabel('elementCategory', contract)}
          </label>
          <select
            className="steps-editor__select"
            value={step.elementCategory || ''}
            onChange={(e) => {
              onFieldChange('elementCategory', e.target.value);
              if (!['URL', 'VERIFY', 'VERIFYERROR'].includes(e.target.value)) {
                if (step.isElementPathDynamic && !step.element?.includes('$$') && !step.element?.match(/Datakey\d+/)) {
                  onFieldChange('isElementPathDynamic', false);
                }
              }
            }}
            title={elementFields.elementCategoryHint}
          >
            <option value="" disabled>
              {NOT_SELECTED_LABEL}
            </option>
            {ELEMENT_CATEGORY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          {showLocTypeError && (
            <small className="steps-editor__field-error">{getRequiredMessage('elementCategory')}</small>
          )}
        </div>
      )}

      {/* ── Locator / XPath (75%, bigger size, flex row with Type) ──────────── */}
      {showLocator && (
        <div className="steps-editor__field steps-editor__field--locator">
          <label className={labelClass(isFieldRequired('element', contract))}>
            {renderFieldLabel('element', contract)}
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
          {showLocatorError && (
            <small className="steps-editor__field-error">{getRequiredMessage('element')}</small>
          )}
        </div>
      )}

      {/* ── Dynamic Locator (25%, like Locator Type) ─────────────────────────── */}
      {showDynamic && (
        <div className="steps-editor__field steps-editor__field--dynamic-locator">
          <label className={labelClass(isFieldRequired('isElementPathDynamic', contract))}>
            {renderFieldLabel('isElementPathDynamic', contract)}
          </label>
          <div className="steps-editor__readonly-pill" aria-readonly="true">
            <span className="steps-editor__readonly-pill-value">True</span>
          </div>
        </div>
      )}

      {/* ── Replacement Key (75%, like Locator) ────────────────────────────── */}
      {showReplaceKey && (
        <div className="steps-editor__field steps-editor__field--replace-key-inline">
          <label className={labelClass(isFieldRequired('elementReplaceTextDataKey', contract))}>
            {renderFieldLabel('elementReplaceTextDataKey', contract)}
          </label>
          <input
            type="text"
            className="steps-editor__input"
            style={{
              fontFamily: 'var(--font-mono)',
              borderColor: !step.elementReplaceTextDataKey ? '' : undefined,
            }}
            value={step.elementReplaceTextDataKey || ''}
            onChange={(e) => onFieldChange('elementReplaceTextDataKey', e.target.value)}
            placeholder={getFieldPlaceholder('elementReplaceTextDataKey')}
          />
          {showReplaceKeyError && (
            <small className="steps-editor__field-error">{getRequiredMessage('elementReplaceTextDataKey')}</small>
          )}
        </div>
      )}

      {/* ── Value (reduced width, still prominent) ─────────────────────────── */}
      {showValue && (
        <div className="steps-editor__field steps-editor__field--value">
          <label className={labelClass(isFieldRequired('value', contract))}>
            {renderFieldLabel('value', contract)}
            {step.elementCategory === 'URL' && <span title="Navigation URL"> (URL)</span>}
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
                ? 'Expected error message'
              : getFieldPlaceholder('value')
            }
          />
          {showValueError && (
            <small className="steps-editor__field-error">{getRequiredMessage('value')}</small>
          )}
        </div>
      )}

      {/* ── Advanced / Optional fields ──────────────────────────────────────── */}

      {showExpected && (
        <div className="steps-editor__field steps-editor__field--expected-value">
          <label className={labelClass(isFieldRequired('expectedValue', contract))}>
            {renderFieldLabel('expectedValue', contract)}
          </label>
          <input
            type="text"
            className="steps-editor__input"
            value={step.expectedValue || ''}
            onChange={(e) => onFieldChange('expectedValue', e.target.value)}
            placeholder={getFieldPlaceholder('expectedValue')}
          />
          {showExpectedError && (
            <small className="steps-editor__field-error">{getRequiredMessage('expectedValue')}</small>
          )}
        </div>
      )}

      {showKey && (
        <div className="steps-editor__field steps-editor__field--key">
          <label className={labelClass(isFieldRequired('key', contract))}>
            {renderFieldLabel('key', contract)}
          </label>
          <input
            type="text"
            className="steps-editor__input"
            value={step.key || ''}
            onChange={(e) => onFieldChange('key', e.target.value)}
            placeholder={getFieldPlaceholder('key')}
          />
          {showKeyError && (
            <small className="steps-editor__field-error">{getRequiredMessage('key')}</small>
          )}
        </div>
      )}

      {showHeaders && (
        <div className="steps-editor__field steps-editor__field--headers">
          <label className={labelClass(isFieldRequired('headers', contract))}>
            {renderFieldLabel('headers', contract)}
          </label>
          <input
            type="text"
            className="steps-editor__input"
            style={{ fontFamily: 'var(--font-mono)' }}
            value={step.headers || ''}
            onChange={(e) => onFieldChange('headers', e.target.value)}
            placeholder={getFieldPlaceholder('headers')}
          />
          {showHeadersError && (
            <small className="steps-editor__field-error">{getRequiredMessage('headers')}</small>
          )}
        </div>
      )}

      {showConcat && (
        <div className="steps-editor__field steps-editor__field--concatenated">
          <label className={labelClass(isFieldRequired('isConcatenated', contract))}>
            {renderFieldLabel('isConcatenated', contract)}
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
