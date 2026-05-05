/**
 * Step Field Validation
 * Implements validation rules from STEP_FIELD_RENDERING_RULES.md
 */
import type { ParsedStep } from '../components/TestCases/StepsEditor';
import { getActionDefinition, validateElementAuthoringCombination } from './actionRegistry';
import type { ParameterContract } from './actionRegistry';

// Step-data fields that the action contract governs. Step data uses
// `expectedValue` / `elementReplaceTextDataKey`, while the generated
// action catalog (ParameterContract) uses the Azure-template names
// `expectedVl` / `elementPathReplaceKey`. The CONTRACT_KEY_MAP below
// bridges the two when reading contract requirements.
type ContractField = Extract<
  keyof ParsedStep,
  | 'element'
  | 'elementCategory'
  | 'value'
  | 'expectedValue'
  | 'key'
  | 'headers'
  | 'elementReplaceTextDataKey'
  | 'isElementPathDynamic'
  | 'isConcatenated'
>;

const CONTRACT_FIELDS: ContractField[] = [
  'element',
  'elementCategory',
  'value',
  'expectedValue',
  'key',
  'headers',
  'elementReplaceTextDataKey',
  'isElementPathDynamic',
  'isConcatenated',
];

const CONTRACT_KEY_MAP: Record<ContractField, keyof ParameterContract> = {
  element: 'locator',
  elementCategory: 'locatorType',
  value: 'value',
  expectedValue: 'expectedVl',
  key: 'dataKey',
  headers: 'headers',
  elementReplaceTextDataKey: 'elementPathReplaceKey',
  isElementPathDynamic: 'isElementPathDynamic',
  isConcatenated: 'isConcatenated',
};

const CSV_INPUT_KEY_ACTIONS = new Set([
  'ADD_MULTIPLE_NUMBERS',
  'CALCULATE_PERCENTAGE',
  'CALCULATE_SUPERANNUATION',
  'COMPARE_TWO_LISTS',
  'COMPARE_TWO_TEXT',
  'MATCH_FILTER_STATUS_COUNT',
]);

const UNION_VALUE_ACTIONS = new Set([
  'SELECT_LIST_ITEM',
  'TABLE_CLICK_ROW',
]);

const DICTIONARY_VALUE_ACTIONS = new Set([
  'TABLE_CLICK_COLUMN_DIV_ICON',
  'TABLE_CLICK_COLUMN_ICON',
  'TABLE_COLUMN_DIV_CLICK',
  'TABLE_COLUMN_DIV_DIV_ICON_CLICK',
  'TABLE_COLUMN_DIV_UPDATE_INNERHTML',
  'TABLE_COLUMN_IS_CHECKED',
  'TABLE_SAVE_ROW_COLUMN_DIV_TEXT_IN_DICTIONARY',
  'TABLE_SAVE_ROW_COLUMN_SPAN_TEXT_IN_DICTIONARY',
  'TABLE_SAVE_ROW_COLUMN_WITH_MATCHED_STYLE',
  'TABLE_SELECTED_ROW_NO',
  'TABLE_SELECT_CHECKBOX',
  'TABLE_VERIFY_ANY_ROW_WITH_COLUMN_HAS_MATCH_REGEX',
  'TABLE_VERIFY_ATTRIBUTE_COLUMN_DIV_ICON',
  'TABLE_VERIFY_COLUMN_ANY_ICON_HAS_ATTRIBUTE_WITH_VALUE',
  'TABLE_VERIFY_COLUMN_DIV_HAS_STYLE',
  'TABLE_VERIFY_COLUMN_DIV_HAS_TAG',
  'TABLE_VERIFY_COLUMN_HEADER_HAS_ICON',
  'TABLE_VERIFY_COLUMN_HEADER_HAS_ICON_WITH_CLASS_VALUE',
  'TABLE_VERIFY_COLUMN_ICON_HAS_ATTRIBUTE_WITH_VALUE',
  'TABLE_VERIFY_COLUMN_VALUE_WITH_REGEX',
  'TABLE_VERIFY_ROW_COLUMN_DIV_TEXT_IN_DICTIONARY',
  'TABLE_VERIFY_ROW_COLUMN_DIV_VALUE',
  'TABLE_VERIFY_ROW_COLUMN_SPAN_TEXT_IN_DICTIONARY',
  'TABLE_VERIFY_SELECTED_ROW_COLUMN_HAS_ATTRIBUTE_WITH_VALUE',
  'TABLE_VERIFY_TEXT_BY_COLUMNS_DATA',
  'MATCH_TABLE_COULMN_DATA_BY_TEXT',
  'VERIFY_DICTIONARY_KEY_VALUE',
  'COMPARE_DICTIONARY_VALUES',
  'UPDATE_DICTIONARY_KEY_VALUE',
]);

const DICTIONARY_REQUIRED_FIELDS: Record<string, string[]> = {
  TABLE_SELECTED_ROW_NO: ['rowno', 'attribute', 'findvalue'],
  TABLE_COLUMN_IS_CHECKED: ['isfound'],
  TABLE_SAVE_ROW_COLUMN_DIV_TEXT_IN_DICTIONARY: ['rownumber', 'columnnumber'],
  TABLE_SAVE_ROW_COLUMN_SPAN_TEXT_IN_DICTIONARY: ['rownumber', 'columnnumber'],
  TABLE_VERIFY_ROW_COLUMN_DIV_TEXT_IN_DICTIONARY: ['rownumber', 'columnnumber'],
  TABLE_VERIFY_ROW_COLUMN_SPAN_TEXT_IN_DICTIONARY: ['rownumber', 'columnnumber'],
  TABLE_VERIFY_ROW_COLUMN_DIV_VALUE: ['rownumber', 'columnnumber', 'comparisontype'],
};

export interface ValidationError {
  field: keyof ParsedStep;
  message: string;
  severity: 'error' | 'warning';
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

/**
 * XPath Validation
 * Rules: Must start with //, /,or.
 * Warn if > 150 chars
 */
function validateXPath(xpath: string): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!xpath) {
    return errors;
  }

  // Must start with //, /, or .
  if (!xpath.match(/^(\/\/|\/|\.)/)) {
    errors.push({
      field: 'element',
      message: 'XPath must start with //, /, or .',
      severity: 'error',
    });
  }

  // Basic XPath syntax validation
  if (!xpath.match(/[@[\]()='"].*?['"]/) && xpath.includes('[')) {
    // Has brackets but might be malformed
    const openBrackets = (xpath.match(/\[/g) || []).length;
    const closeBrackets = (xpath.match(/]/g) || []).length;
    if (openBrackets !== closeBrackets) {
      errors.push({
        field: 'element',
        message: 'XPath bracket mismatch',
        severity: 'error',
      });
    }
  }

  // Warn if too complex
  if (xpath.length > 150) {
    errors.push({
      field: 'element',
      message: 'XPath is very long (>150 chars) - consider simplifying',
      severity: 'warning',
    });
  }

  return errors;
}

/**
 * Regex Validation
 * Rules: Must be a valid regex pattern
 */
function validateRegex(pattern: string): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!pattern) {
    return errors;
  }

  try {
    new RegExp(pattern);
  } catch (e) {
    errors.push({
      field: 'expectedValue',
      message: `Invalid regex: ${(e as Error).message}`,
      severity: 'error',
    });
  }

  return errors;
}

/**
 * CSV Saved Keys Validation
 * Rules: Comma-separated keys with count validation
 * Example: "key1, key2, key3"
 */
function validateCSVSavedKeys(value: string, expectedCount?: number): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!value) {
    return errors;
  }

  const keys = value
    .split(',')
    .map((k) => k.trim())
    .filter((k) => k.length > 0);

  // Validate each key format (alphanumeric, underscore, hyphen)
  keys.forEach((key, index) => {
    if (!key.match(/^[a-zA-Z0-9_-]+$/)) {
      errors.push({
        field: 'key',
        message: `Key ${index + 1} ("${key}") contains invalid characters. Use alphanumeric, underscore, or hyphen only.`,
        severity: 'error',
      });
    }
  });

  // Check count if expected
  if (expectedCount && keys.length !== expectedCount) {
    errors.push({
      field: 'key',
      message: `Expected ${expectedCount} comma-separated keys, got ${keys.length}`,
      severity: 'error',
    });
  }

  return errors;
}

/**
 * Union Type Validation
 * Rules: Must match one of the specified formats
 * Examples: "count", "take:x,skip:y"
 */
function validateUnionType(
  value: string,
  formats: string[]
): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!value) {
    return errors;
  }

  const isValid = formats.some(format => {
    if (format === 'count') {
      return /^\d+$/.test(value);
    }
    if (format === 'take:x,skip:y') {
      return /^take:\d+,skip:\d+$/.test(value);
    }
    return false;
  });

  if (!isValid) {
    errors.push({
      field: 'value',
      message: `Value must match one of: ${formats.join(' | ')}`,
      severity: 'error',
    });
  }

  return errors;
}

/**
 * Dictionary-style payload validation.
 * Expected format: key:value,key:value
 */
function validateDictionaryPayload(value: string, requiredFields: string[] = []): ValidationError[] {
  const errors: ValidationError[] = [];
  if (!value) return errors;

  const parts = value.split(',').map((part) => part.trim()).filter(Boolean);
  const parsedKeys = new Set<string>();

  parts.forEach((part) => {
    const [key, ...rest] = part.split(':');
    if (!key || rest.length === 0) {
      errors.push({
        field: 'value',
        message: `Invalid dictionary token "${part}". Use key:value format.`,
        severity: 'error',
      });
      return;
    }

    parsedKeys.add(key.trim().toLowerCase());
  });

  requiredFields.forEach((requiredField) => {
    if (!parsedKeys.has(requiredField.toLowerCase())) {
      errors.push({
        field: 'value',
        message: `Required dictionary field missing: ${requiredField}`,
        severity: 'error',
      });
    }
  });

  return errors;
}

/**
 * Required Field Validation
 * Rules: Field cannot be empty if marked required in the contract
 */
function validateRequired(
  value: string | boolean | undefined,
  field: ContractField,
  isRequired: boolean
): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!isRequired) {
    return errors;
  }

  if (value === undefined || value === null || value === '') {
    const fieldNames: Record<string, string> = {
      action: 'Action',
      element: 'locator',
      elementCategory: 'Locator Type',
      value: 'Value',
      expectedValue: 'Expected Value',
      key: 'Data Key',
      headers: 'Headers',
      elementReplaceTextDataKey: 'Dynamic Locator Key',
      isElementPathDynamic: 'Dynamic Element Path',
      isConcatenated: 'Concatenated Compare',
    };

    errors.push({
      field,
      message: `${fieldNames[String(field)] || String(field)} is required`,
      severity: 'error',
    });
  }

  return errors;
}

/**
 * Element Category Specific Validation
 */
function validateElementByCategory(
  element: string,
  category: string
): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!element || !category) {
    return errors;
  }

  switch (category) {
    case 'XPATH':
      return validateXPath(element);

    case 'ID':
      if (element.startsWith('#')) {
        errors.push({
          field: 'element',
          message: 'ID field should not include # symbol - use raw id only',
          severity: 'warning',
        });
      }
      break;

    case 'CSS':
      // CSS selectors are flexible, minimal validation
      if (element.length < 2) {
        errors.push({
          field: 'element',
          message: 'CSS selector seems too short',
          severity: 'warning',
        });
      }
      break;

    case 'JSPATH':
      if (!element.includes('document') && !element.includes('window')) {
        errors.push({
          field: 'element',
          message: 'JavaScript path should use document or window object',
          severity: 'warning',
        });
      }
      break;

    case 'LINKTEXT':
      // Link text should be human-readable
      if (element.length < 1) {
        errors.push({
          field: 'element',
          message: 'Link text is empty',
          severity: 'error',
        });
      }
      break;
  }

  return errors;
}

/**
 * Dynamic Locator Validation
 * Rules: If isElementPathDynamic=true, elementReplaceTextDataKey must exist
 * Element must contain $$ or Datakey tokens
 */
function validateDynamicLocator(step: ParsedStep): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!step.isElementPathDynamic) {
    return errors;
  }

  // Must have replacement key
  if (!step.elementReplaceTextDataKey) {
    errors.push({
      field: 'elementReplaceTextDataKey',
      message: 'Dynamic locator enabled but no replacement key provided',
      severity: 'error',
    });
  }

  // Element must contain replacement token
  if (step.element) {
    const hasToken = step.element.includes('$$') || /Datakey\d+/.test(step.element);
    if (!hasToken) {
      errors.push({
        field: 'element',
        message: 'Dynamic locator enabled but element contains no $$ or Datakey tokens',
        severity: 'error',
      });
    }
  }

  return errors;
}

/**
 * CSV Save Keys Format Validation
 * Used in actions like CALCULATE_PERCENTAGE with "two input keys"
 */
function parseCSVKeyCount(description?: string): number | null {
  if (!description) return null;

  const match = description.match(/(\d+|\w+)\s+(?:input\s+)?keys?/i);
  if (!match) return null;

  const words: Record<string, number> = {
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
  };

  const token = match[1].toLowerCase();
  if (/^\d+$/.test(token)) {
    return Number(token);
  }

  return words[token] || null;
}

/**
 * Main Validation Function
 */
export function validateStep(step: ParsedStep): ValidationResult {
  const errors: ValidationError[] = [];
  const actionDef = getActionDefinition(step.action);

  if (!actionDef) {
    return { isValid: true, errors: [] };
  }

  const contract = actionDef.contract;
  const normalizedStep: ParsedStep = {
    ...step,
    element: contract.locator === 'not-used' ? '' : step.element,
    elementCategory: contract.locatorType === 'not-used' ? '' : step.elementCategory,
    value: contract.value === 'not-used' ? '' : step.value,
    expectedValue: contract.expectedVl === 'not-used' ? '' : step.expectedValue,
    key: contract.dataKey === 'not-used' ? '' : step.key,
    headers: contract.headers === 'not-used' ? '' : step.headers,
    elementReplaceTextDataKey: contract.elementPathReplaceKey === 'not-used' ? '' : step.elementReplaceTextDataKey,
    isElementPathDynamic: (
      contract.locator === 'required'
      && contract.locatorType === 'required'
      && contract.isElementPathDynamic !== 'not-used'
    ) ? step.isElementPathDynamic : false,
    isConcatenated: contract.isConcatenated === 'not-used' ? false : step.isConcatenated,
  };

  // Validate required fields
  CONTRACT_FIELDS.forEach((field) => {
    const contractKey = CONTRACT_KEY_MAP[field];
    if (contract[contractKey] === 'required') {
      errors.push(...validateRequired(normalizedStep[field], field, true));
    }
  });

  // Validate element-specific rules
  if (normalizedStep.element && normalizedStep.elementCategory) {
    errors.push(...validateElementByCategory(normalizedStep.element, normalizedStep.elementCategory));
  }

  // Validate element + ElementCategory authoring combinations
  const combinationResult = validateElementAuthoringCombination(
    normalizedStep.action,
    normalizedStep.elementCategory ?? ''
  );
  if (
    !combinationResult.valid
    && combinationResult.message
    && (normalizedStep.element?.trim() || normalizedStep.elementCategory?.trim())
  ) {
    errors.push({ field: 'element', message: combinationResult.message, severity: 'error' });
  }

  // Validate dynamic locator
  errors.push(...validateDynamicLocator(normalizedStep));

  // Action-specific validation
  if (normalizedStep.action === 'COMPARE_ELEMENT_VALUE_WITH_REGEX' && normalizedStep.expectedValue) {
    errors.push(...validateRegex(normalizedStep.expectedValue));
  }

  if (normalizedStep.key && CSV_INPUT_KEY_ACTIONS.has(normalizedStep.action)) {
    const expectedCount = normalizedStep.action === 'CALCULATE_PERCENTAGE'
      ? 2
      : parseCSVKeyCount(`${actionDef.description} ${actionDef.notes ?? ''}`) ?? undefined;
    errors.push(...validateCSVSavedKeys(normalizedStep.key, expectedCount));
  }

  if (normalizedStep.value && UNION_VALUE_ACTIONS.has(normalizedStep.action)) {
    errors.push(...validateUnionType(normalizedStep.value, ['count', 'take:x,skip:y']));
  }

  if (normalizedStep.value && DICTIONARY_VALUE_ACTIONS.has(normalizedStep.action)) {
    errors.push(...validateDictionaryPayload(normalizedStep.value, DICTIONARY_REQUIRED_FIELDS[normalizedStep.action] ?? []));
  }

  if (
    normalizedStep.expectedValue
    && contract.expectedVl === 'required'
    && (
      normalizedStep.action.startsWith('IS')
      || normalizedStep.action.startsWith('CHECK_')
      || normalizedStep.action.includes('VERIFY_')
    )
  ) {
    const normalized = normalizedStep.expectedValue.trim().toLowerCase();
    if (normalized !== 'true' && normalized !== 'false') {
      errors.push({
        field: 'expectedValue',
        message: 'Expected Value should usually be "true" or "false" for this assertion action.',
        severity: 'warning',
      });
    }
  }

  return {
    isValid: errors.filter(e => e.severity === 'error').length === 0,
    errors,
  };
}

/**
 * Validate all steps
 */
export function validateAllSteps(steps: ParsedStep[]): Map<number, ValidationResult> {
  const results = new Map<number, ValidationResult>();

  steps.forEach((step) => {
    results.set(step.index, validateStep(step));
  });

  return results;
}

/**
 * Get validation status summary
 */
export function getValidationSummary(
  validationResults: Map<number, ValidationResult>
): {
  totalSteps: number;
  validSteps: number;
  stepsWithErrors: number;
  stepsWithWarnings: number;
  totalErrors: number;
  totalWarnings: number;
} {
  let validSteps = 0;
  let stepsWithErrors = 0;
  let stepsWithWarnings = 0;
  let totalErrors = 0;
  let totalWarnings = 0;

  validationResults.forEach((result) => {
    if (result.isValid && result.errors.length === 0) {
      validSteps++;
    }

    const hasErrors = result.errors.some(e => e.severity === 'error');
    const hasWarnings = result.errors.some(e => e.severity === 'warning');

    if (hasErrors) stepsWithErrors++;
    if (hasWarnings) stepsWithWarnings++;

    totalErrors += result.errors.filter(e => e.severity === 'error').length;
    totalWarnings += result.errors.filter(e => e.severity === 'warning').length;
  });

  return {
    totalSteps: validationResults.size,
    validSteps,
    stepsWithErrors,
    stepsWithWarnings,
    totalErrors,
    totalWarnings,
  };
}


