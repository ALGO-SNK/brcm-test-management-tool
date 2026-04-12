/**
 * Step Validation
 * Validates steps against action registry with strict rules
 */

import type {
  StepData,
  ActionRegistry,
  ActionContract,
  StepValidationResult,
  BulkValidationResult,
  ValidationMessage,
  ValidationContext,
  ValidationConfig,
} from '../types';

const DEFAULT_VALIDATION_CONFIG: ValidationConfig = {
  strict: true,
  allowUnused: false,
  validateXPath: true,
  validateRegex: true,
};

/**
 * Validate a single step against action registry
 */
export function validateStep(
  step: StepData,
  registry: ActionRegistry,
  context?: ValidationContext,
  config: ValidationConfig = DEFAULT_VALIDATION_CONFIG
): StepValidationResult {
  const errors: ValidationMessage[] = [];
  const warnings: ValidationMessage[] = [];
  const suggestions: ValidationMessage[] = [];

  // Check 1: Action exists in registry
  const actionContract = registry.actions[step.action];
  if (!actionContract) {
    errors.push({
      field: 'action',
      message: `Action "${step.action}" not found in registry. Available actions: ${Object.keys(registry.actions).slice(0, 5).join(', ')}...`,
      severity: 'error',
    });

    return {
      stepId: step.id,
      isValid: false,
      errors,
      warnings,
      suggestions,
    };
  }

  // Check 2: Validate parameters against contract
  const paramValidation = validateParameters(step, actionContract, registry, context, config);
  errors.push(...paramValidation.errors);
  warnings.push(...paramValidation.warnings);
  suggestions.push(...paramValidation.suggestions);

  // Check 3: ElementCategory validation
  if (step.element && !isValidElementCategoryForType(step.elementCategory, step.element)) {
    warnings.push({
      field: 'elementCategory',
      message: `ElementCategory "${step.elementCategory}" may not match element value. Expected one of: ${getElementCategoriesForElement(step.element)}`,
      severity: 'warning',
    });
  }

  // Check 4: Action-specific validations
  const actionSpecificValidation = validateActionSpecific(step, actionContract);
  errors.push(...actionSpecificValidation.errors);
  warnings.push(...actionSpecificValidation.warnings);

  const isValid = errors.length === 0 && (!config.strict || warnings.length === 0);

  return {
    stepId: step.id,
    isValid,
    errors,
    warnings,
    suggestions,
    details: generateValidationDetails(step, actionContract),
  };
}

/**
 * Validate all steps in an array
 */
export function validateSteps(
  steps: StepData[],
  registry: ActionRegistry,
  context?: ValidationContext,
  config: ValidationConfig = DEFAULT_VALIDATION_CONFIG
): BulkValidationResult {
  const stepResults = steps.map((step) => validateStep(step, registry, context, config));

  const summary = {
    totalSteps: steps.length,
    validSteps: stepResults.filter((r) => r.isValid).length,
    stepsWithErrors: stepResults.filter((r) => r.errors.length > 0).length,
    stepsWithWarnings: stepResults.filter((r) => r.warnings.length > 0).length,
  };

  const isValid = stepResults.every((r) => r.isValid);

  return {
    isValid,
    stepResults,
    summary,
  };
}

/**
 * Validate step parameters against action contract
 */
function validateParameters(
  step: StepData,
  actionContract: ActionContract,
  _registry: ActionRegistry,
  _context?: ValidationContext,
  config: ValidationConfig = DEFAULT_VALIDATION_CONFIG
): { errors: ValidationMessage[]; warnings: ValidationMessage[]; suggestions: ValidationMessage[] } {
  const errors: ValidationMessage[] = [];
  const warnings: ValidationMessage[] = [];
  const suggestions: ValidationMessage[] = [];

  const params = actionContract.params;

  // Validate each parameter field
  const paramFields = ['element', 'value', 'expectedValue', 'key', 'headers'] as const;

  for (const fieldName of paramFields) {
    const fieldValue = step[fieldName];
    const paramContract = params[fieldName];

    if (!paramContract) {
      continue;
    }

    // Check: Required field is empty
    if (paramContract.required && !fieldValue) {
      errors.push({
        field: fieldName,
        message: `${fieldName} is required for action "${actionContract.label}"`,
        severity: 'error',
        code: 'REQUIRED_FIELD_MISSING',
      });
      continue;
    }

    // Check: Field is used but empty
    if (paramContract.used && !fieldValue) {
      suggestions.push({
        field: fieldName,
        message: `${fieldName} is expected for this action but is empty`,
        severity: 'info',
      });
      continue;
    }

    // Check: Field is not used but has value
    if (!paramContract.used && fieldValue) {
      if (!config.allowUnused) {
        warnings.push({
          field: fieldName,
          message: `${fieldName} is not used for action "${actionContract.label}" - consider removing it`,
          severity: 'warning',
          code: 'UNUSED_FIELD',
        });
      }
      continue;
    }

    if (!fieldValue) {
      continue; // Skip validation for empty fields that aren't required
    }

    // Validate parameter type
    const typeValidation = validateParameterType(fieldValue, paramContract, fieldName);
    if (typeValidation.error) {
      errors.push({
        field: fieldName,
        message: typeValidation.error,
        severity: 'error',
        code: 'INVALID_TYPE',
      });
    }

    // Check: Allowed values
    if (paramContract.allowedValues && !paramContract.allowedValues.includes(fieldValue)) {
      errors.push({
        field: fieldName,
        message: `${fieldName} must be one of: ${paramContract.allowedValues.join(', ')}. Got: "${fieldValue}"`,
        severity: 'error',
        code: 'INVALID_VALUE',
        suggestedValue: paramContract.allowedValues[0],
      });
    }

    // Check: Format/pattern matching for union types
    if (paramContract.formats) {
      if (!matchesFormat(fieldValue, paramContract.formats)) {
        errors.push({
          field: fieldName,
          message: `${fieldName} format invalid. Expected one of: ${paramContract.formats.join(', ')}`,
          severity: 'error',
          code: 'FORMAT_MISMATCH',
        });
      }
    }

    // Check: Dictionary fields present
    if (paramContract.fields && paramContract.type === 'dictionary') {
      const dictValidation = validateDictionary(fieldValue, paramContract.fields);
      if (!dictValidation.valid) {
        warnings.push({
          field: fieldName,
          message: `Dictionary may be missing fields: ${dictValidation.missing.join(', ')}`,
          severity: 'warning',
        });
      }
    }
  }

  return { errors, warnings, suggestions };
}

/**
 * Validate parameter type
 */
function validateParameterType(
  value: string,
  paramContract: any,
  fieldName: string
): { error?: string } {
  const { type } = paramContract;

  switch (type) {
    case 'none':
      if (value) {
        return { error: `${fieldName} should be empty for this action` };
      }
      break;

    case 'xpath':
      if (!isValidXPath(value)) {
        return { error: `${fieldName} appears to be invalid XPath syntax` };
      }
      break;

    case 'boolean':
      if (!['true', 'false', 'True', 'False'].includes(value)) {
        return { error: `${fieldName} must be 'true' or 'false'` };
      }
      break;

    case 'regex':
      try {
        new RegExp(value);
      } catch {
        return { error: `${fieldName} is not a valid regex pattern` };
      }
      break;

    case 'text':
    case 'saved-key':
    case 'column-header':
      if (typeof value !== 'string' || value.trim() === '') {
        return { error: `${fieldName} must be a non-empty string` };
      }
      break;

    case 'csv-saved-keys':
      // Validate comma-separated keys
      const keys = value.split(',').map((k) => k.trim());
      if (keys.length === 0 || keys.some((k) => !k)) {
        return { error: `${fieldName} must be comma-separated key names` };
      }
      break;

    // Other types: allow any string
    default:
      break;
  }

  return {};
}

/**
 * Validate XPath syntax (basic check)
 */
function isValidXPath(xpath: string): boolean {
  if (!xpath) {
    return true; // Empty is valid
  }

  try {
    // Very basic check - just ensure it starts with // or / or contains [ or @
    if (xpath.includes('//') || xpath.startsWith('/') || xpath.includes('[') || xpath.includes('@')) {
      return true;
    }
    return xpath.length > 0;
  } catch {
    return false;
  }
}

/**
 * Check if value matches any of the allowed formats
 */
function matchesFormat(value: string, formats: string[]): boolean {
  return formats.some((format) => {
    if (format === 'count') {
      return /^\d+$/.test(value);
    }
    if (format.startsWith('take:')) {
      return /^take:\d+,skip:\d+$/.test(value);
    }
    if (format === 'ascending' || format === 'descending') {
      return value === format;
    }
    // For other formats, just check if exact match
    return value === format;
  });
}

/**
 * Validate dictionary structure
 */
function validateDictionary(
  value: string,
  expectedFields: string[]
): { valid: boolean; missing: string[] } {
  const missing: string[] = [];

  // Try to parse as key:value pairs
  const pairs = value.split(',').map((p) => p.trim());

  for (const field of expectedFields) {
    const found = pairs.some((p) => p.startsWith(`${field}:`));
    if (!found) {
      missing.push(field);
    }
  }

  return {
    valid: missing.length === 0,
    missing,
  };
}

/**
 * Action-specific validation rules
 */
function validateActionSpecific(
  step: StepData,
  _actionContract: ActionContract
): { errors: ValidationMessage[]; warnings: ValidationMessage[] } {
  const errors: ValidationMessage[] = [];
  const warnings: ValidationMessage[] = [];

  const action = step.action.toUpperCase();

  // Example specific rules
  if (action === 'DRAG_DROP') {
    if (!step.element) {
      errors.push({
        field: 'element',
        message: 'DRAG_DROP requires source element (drag from this)',
        severity: 'error',
      });
    }
    if (!step.value) {
      errors.push({
        field: 'value',
        message: 'DRAG_DROP requires target element in Value field (drag to this)',
        severity: 'error',
      });
    }
  }

  if (action === 'FILTER_BY' || action === 'FILTER_BY_DYNAMIC_VALUE') {
    if (!step.headers) {
      errors.push({
        field: 'headers',
        message: `${action} requires column header in Headers field`,
        severity: 'error',
      });
    }
  }

  if (action === 'VERIFY_DICTIONARY_KEY_VALUE' || action === 'COMPARE_TWO_TEXT') {
    if (!step.key) {
      errors.push({
        field: 'key',
        message: `${action} requires dictionary key in Key field`,
        severity: 'error',
      });
    }
  }

  return { errors, warnings };
}

/**
 * Check if ElementCategory matches element format
 */
function isValidElementCategoryForType(category: string, element: string): boolean {
  if (!element) {
    return true;
  }

  switch (category.toUpperCase()) {
    case 'XPATH':
      return element.includes('/') || element.includes('@');
    case 'ID':
      return !element.includes('/') && !element.includes('[');
    case 'CSSSELECTOR':
      return element.includes('.') || element.includes('#') || element.includes('[');
    case 'TAGNAME':
      return /^[a-z]+$/i.test(element);
    default:
      return true;
  }
}

/**
 * Get suggested element categories for a given element string
 */
function getElementCategoriesForElement(element: string): string[] {
  const suggestions: string[] = [];

  if (element.includes('/') || element.includes('@')) {
    suggestions.push('XPATH');
  }
  if (!element.includes('/')) {
    suggestions.push('ID', 'CSSSELECTOR');
  }
  if (/^[a-z]+$/i.test(element)) {
    suggestions.push('TAGNAME');
  }

  return suggestions.length > 0 ? suggestions : ['XPATH'];
}

/**
 * Generate human-readable validation details
 */
function generateValidationDetails(step: StepData, actionContract: ActionContract): string {
  return `Step: ${actionContract.label} (${step.action})
  Element: ${step.element || '(none)'}
  Category: ${step.elementCategory}
  Category Notes: ${actionContract.notes}`;
}

/**
 * Get validation error summary
 */
export function getValidationSummary(result: BulkValidationResult): string {
  const { summary } = result;
  return `Validation: ${summary.validSteps}/${summary.totalSteps} valid, ${summary.stepsWithErrors} errors, ${summary.stepsWithWarnings} warnings`;
}
