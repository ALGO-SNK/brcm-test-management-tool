/**
 * Dynamic Step Field Renderer
 * Renders fields based on action parameter contracts using flexbox layout.
 *
 * Field layout (flex-wrap with smart sizing):
 *   Row 1: [Action 30%]              [Summary 70%]           — together, summary bigger
 *   Row 2: [Locator Type 25%]        [Locator 75%]           — together, locator bigger (XPATH)
 *   Row 3: [Dynamic Toggle]          [Replacement Key 100%]  — replacement key full-width when dynamic ON
 *   Row 4: [Value 100%]                                      — full-width, bigger size
 *   Row 5: [Expected Value ~48%]     [Data Key ~48%]         — advanced/optional, smaller width
 *   Row 6: [Headers ~48%]            [Concatenated ~48%]     — advanced/optional, smaller width
 *
 * showAdvanced controls whether 'optional' fields (expectedValue, key, headers,
 * isConcatenated) are visible. Required fields and core locator fields always show.
 */
import { getElementAuthoringFields } from '../../utils/actionRegistry';
import { ACTION_REGISTRY } from '../../utils/actionRegistry';
import type { ParameterContract } from '../../utils/actionRegistry';
import type { ParsedStep } from './StepsEditor';

interface StepFieldRendererProps {
  step: ParsedStep;
  onFieldChange: (field: keyof ParsedStep, value: string | boolean) => void;
  showAdvanced: boolean;
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
 * - Advanced/optional fields (expectedValue, key, headers, isConcatenated):
 *   show when required OR (optional AND showAdvanced)
 * - Dynamic fields (isElementPathDynamic, elementReplaceTextDataKey):
 *   only show when optional/required by contract
 */

function shouldRenderField(
  fieldName: string,
  contract: ParameterContract | undefined,
  showAdvanced: boolean,
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

  // Core fields that should always show when optional: element, elementCategory, value
  // These are the fundamental UI targeting and value input fields
  if (['element', 'elementCategory', 'value'].includes(fieldName)) return true;

  // Advanced/optional fields → only when showAdvanced
  return showAdvanced;
}

function isFieldRequired(fieldName: string, contract: ParameterContract | undefined): boolean {
  if (!contract) return false;
  return contract[fieldName as keyof ParameterContract] === 'required';
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
    description: 'Describe this step…',
    elementReplaceTextDataKey: 'saved_key or key1,key2',
  };
  return placeholders[fieldName] || '';
}

function labelClass(required: boolean): string {
  return `steps-editor__label${required ? '' : ' steps-editor__label--optional'}`;
}

export function StepFieldRenderer({ step, onFieldChange, showAdvanced }: StepFieldRendererProps) {
  const actionDef = ACTION_REGISTRY[step.action];
  const contract = actionDef?.contract;
  const elementFields = getElementAuthoringFields(actionDef, step.elementCategory ?? 'XPATH');

  const showSummary    = shouldRenderField('description',         contract, showAdvanced);
  const showLocType    = shouldRenderField('elementCategory',     contract, showAdvanced) && elementFields.showElementCategory;
  const showLocator    = shouldRenderField('element',             contract, showAdvanced) && elementFields.showElement;
  // Dynamic checkbox only shows when locator field is visible
  const showDynamic    = showLocator && shouldRenderField('isElementPathDynamic',contract, showAdvanced) && elementFields.showIsElementPathDynamic;
  // Replacement key only shows when dynamic checkbox is visible AND checked
  const showReplaceKey = showDynamic && step.isElementPathDynamic && elementFields.showElementReplaceTextDataKey;
  const showValue      = shouldRenderField('value',               contract, showAdvanced) && elementFields.showValue;
  const showExpected   = shouldRenderField('expectedValue',       contract, showAdvanced);
  const showKey        = shouldRenderField('key',                 contract, showAdvanced);
  const showHeaders    = shouldRenderField('headers',             contract, showAdvanced);
  const showConcat     = shouldRenderField('isConcatenated',      contract, showAdvanced);

  return (
    <>
      {/* ── Summary (70%, same flex row as Action) ──────────────────────────── */}
      {showSummary && (
        <div className="steps-editor__field steps-editor__field--summary-inline">
          <label className={labelClass(isFieldRequired('description', contract))}>
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

      {/* ── Locator Type (25%, flex row with Locator) ───────────────────────── */}
      {showLocType && (
        <div className="steps-editor__field steps-editor__field--locator-type">
          <label className={labelClass(isFieldRequired('elementCategory', contract))}>
            {getFieldLabel('elementCategory')}
          </label>
          <select
            className="steps-editor__select"
            value={step.elementCategory || 'XPATH'}
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
            {ELEMENT_CATEGORY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* ── Locator / XPath (75%, bigger size, flex row with Type) ──────────── */}
      {showLocator && (
        <div className="steps-editor__field steps-editor__field--locator">
          <label className={labelClass(isFieldRequired('element', contract))}>
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

      {/* ── Dynamic toggle (auto, flex row with Replacement Key when enabled) */}
      {showDynamic && (
        <div className="steps-editor__field steps-editor__field--dynamic-toggle-row">
          <label className="steps-editor__label steps-editor__label--optional">
            {getFieldLabel('isElementPathDynamic')}
          </label>
          <div className="steps-editor__checkbox-wrapper">
            <input
              type="checkbox"
              id={`dynamic-${step.index ?? 'new'}`}
              className="steps-editor__checkbox"
              checked={step.isElementPathDynamic || false}
              onChange={(e) => onFieldChange('isElementPathDynamic', e.target.checked)}
              title="Enable to inject saved data-store keys into the locator"
            />
            <label htmlFor={`dynamic-${step.index ?? 'new'}`} className="steps-editor__checkbox-label">
              {step.isElementPathDynamic ? 'Dynamic' : 'Static'}
            </label>
          </div>
        </div>
      )}

      {/* ── Replacement Key (100%, full-width, bigger size, when dynamic ON) ─ */}
      {showReplaceKey && (
        <div className="steps-editor__field steps-editor__field--replace-key-full">
          <label
            className="steps-editor__label"
            style={{ color: !step.elementReplaceTextDataKey ? 'var(--color-danger)' : undefined }}
          >
            {getFieldLabel('elementReplaceTextDataKey')} *
          </label>
          <input
            type="text"
            className="steps-editor__input"
            style={{
              fontFamily: 'var(--font-mono)',
              borderColor: !step.elementReplaceTextDataKey ? 'var(--color-danger-border)' : undefined,
            }}
            value={step.elementReplaceTextDataKey || ''}
            onChange={(e) => onFieldChange('elementReplaceTextDataKey', e.target.value)}
            placeholder={getFieldPlaceholder('elementReplaceTextDataKey')}
            title="Key name(s) from DataStore to substitute into the locator. Separate multiple with a comma."
          />
          {!step.elementReplaceTextDataKey ? (
            <small className="steps-editor__field-error">
              Required when Dynamic Locator is enabled
            </small>
          ) : (
            <small className="steps-editor__hint">
              {step.element?.match(/Datakey\d+/g)
                ? `${(step.element.match(/Datakey\d+/g) ?? []).length} token(s) — provide that many keys`
                : step.element?.includes('$$')
                ? 'Provide 1 key to replace $$'
                : 'Enter key name(s)'}
            </small>
          )}
        </div>
      )}

      {/* ── Value (100%, full-width, bigger size) ──────────────────────────── */}
      {showValue && (
        <div className="steps-editor__field steps-editor__field--value">
          <label className={labelClass(isFieldRequired('value', contract))}>
            {getFieldLabel('value')}
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
        </div>
      )}

      {/* ── Advanced / Optional fields ──────────────────────────────────────── */}

      {showExpected && (
        <div className="steps-editor__field steps-editor__field--expected-value">
          <label className={labelClass(isFieldRequired('expectedValue', contract))}>
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

      {showKey && (
        <div className="steps-editor__field steps-editor__field--key">
          <label className={labelClass(isFieldRequired('key', contract))}>
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

      {showHeaders && (
        <div className="steps-editor__field steps-editor__field--headers">
          <label className={labelClass(isFieldRequired('headers', contract))}>
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

      {showConcat && (
        <div className="steps-editor__field steps-editor__field--concatenated">
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
