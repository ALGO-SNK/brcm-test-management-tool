/**
 * Dynamic Step Field Renderer
 * Renders fields based on action parameter contracts
 */

import { SearchableSelect } from '../Common/SearchableSelect';
import { ACTION_REGISTRY, ParameterContract } from '../../utils/actionRegistry';
import { ParsedStep } from './StepsEditor';

interface StepFieldRendererProps {
  step: ParsedStep;
  onFieldChange: (field: keyof ParsedStep, value: string | boolean) => void;
}

const ELEMENT_CATEGORY_OPTIONS = [
  { value: 'XPATH', label: 'XPATH' },
  { value: 'ID', label: 'ID' },
  { value: 'CLASS', label: 'CLASS' },
  { value: 'CSS', label: 'CSSSELECTOR' },
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
  if (!contract) return true;

  const contractField = contract[fieldName as keyof ParameterContract];
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
    element: 'LOCATOR OR TARGET',
    elementCategory: 'LOCATOR TYPE',
    value: 'VALUE',
    expectedValue: 'EXPECTED VALUE',
    key: 'DATA KEY',
    headers: 'HEADERS',
    description: 'STEP SUMMARY',
    elementReplaceTextDataKey: 'ELEMENT REPLACE KEY',
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
    elementReplaceTextDataKey: 'e.g., saved_key_1',
  };
  return placeholders[fieldName] || '';
}

export function StepFieldRenderer({ step, onFieldChange }: StepFieldRendererProps) {
  const actionDef = ACTION_REGISTRY[step.action];
  const contract = actionDef?.contract;

  return (
    <>
      {/* Element/Locator Fields */}
      {shouldRenderField('element', contract) && (
        <div className="steps-editor__field">
          <label className={`steps-editor__label ${isFieldRequired('element', contract) ? '' : 'steps-editor__label--optional'}`}>
            {getFieldLabel('element')} {isFieldRequired('element', contract) && '*'}
          </label>
          <input
            type="text"
            className="steps-editor__input"
            style={{ fontFamily: 'var(--font-mono)' }}
            value={step.element || ''}
            onChange={(e) => onFieldChange('element', e.target.value)}
            placeholder={getFieldPlaceholder('element')}
          />
        </div>
      )}

      {shouldRenderField('elementCategory', contract) && (
        <div className="steps-editor__field">
          <label className={`steps-editor__label ${isFieldRequired('elementCategory', contract) ? '' : 'steps-editor__label--optional'}`}>
            {getFieldLabel('elementCategory')} {isFieldRequired('elementCategory', contract) && '*'}
          </label>
          <select
            className="steps-editor__select"
            value={step.elementCategory || 'XPATH'}
            onChange={(e) => onFieldChange('elementCategory', e.target.value)}
          >
            {ELEMENT_CATEGORY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {shouldRenderField('value', contract) && (
        <div className="steps-editor__field">
          <label className={`steps-editor__label ${isFieldRequired('value', contract) ? '' : 'steps-editor__label--optional'}`}>
            {getFieldLabel('value')} {isFieldRequired('value', contract) && '*'}
          </label>
          <input
            type="text"
            className="steps-editor__input"
            value={step.value || ''}
            onChange={(e) => onFieldChange('value', e.target.value)}
            placeholder={getFieldPlaceholder('value')}
          />
        </div>
      )}

      {shouldRenderField('expectedValue', contract) && (
        <div className="steps-editor__field">
          <label className={`steps-editor__label ${isFieldRequired('expectedValue', contract) ? '' : 'steps-editor__label--optional'}`}>
            {getFieldLabel('expectedValue')} {isFieldRequired('expectedValue', contract) && '*'}
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

      {shouldRenderField('description', contract) && (
        <div className="steps-editor__field">
          <label className={`steps-editor__label ${isFieldRequired('description', contract) ? '' : 'steps-editor__label--optional'}`}>
            {getFieldLabel('description')} {isFieldRequired('description', contract) && '*'}
          </label>
          <textarea
            className="steps-editor__textarea"
            value={step.description || ''}
            onChange={(e) => onFieldChange('description', e.target.value)}
            placeholder={getFieldPlaceholder('description')}
            rows={2}
          />
        </div>
      )}

      {/* Data Store and Headers Fields */}
      {shouldRenderField('key', contract) && (
        <div className="steps-editor__field">
          <label className={`steps-editor__label ${isFieldRequired('key', contract) ? '' : 'steps-editor__label--optional'}`}>
            {getFieldLabel('key')} {isFieldRequired('key', contract) && '*'}
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
            {getFieldLabel('headers')} {isFieldRequired('headers', contract) && '*'}
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

      {/* Advanced Fields */}
      {shouldRenderField('elementReplaceTextDataKey', contract) && (
        <div className="steps-editor__field">
          <label className={`steps-editor__label steps-editor__label--optional`}>
            {getFieldLabel('elementReplaceTextDataKey')}
          </label>
          <input
            type="text"
            className="steps-editor__input"
            style={{ fontFamily: 'var(--font-mono)' }}
            value={step.elementReplaceTextDataKey || ''}
            onChange={(e) => onFieldChange('elementReplaceTextDataKey', e.target.value)}
            placeholder={getFieldPlaceholder('elementReplaceTextDataKey')}
          />
        </div>
      )}

      {shouldRenderField('isElementPathDynamic', contract) && (
        <div className="steps-editor__field">
          <label className="steps-editor__label steps-editor__label--optional">
            {getFieldLabel('isElementPathDynamic')}
          </label>
          <select
            className="steps-editor__select"
            value={step.isElementPathDynamic ? 'true' : 'false'}
            onChange={(e) => onFieldChange('isElementPathDynamic', e.target.value === 'true')}
          >
            <option value="false">False</option>
            <option value="true">True</option>
          </select>
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
