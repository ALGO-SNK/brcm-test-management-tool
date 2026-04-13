/**
 * DataStore Manager
 * Manages saved keys and provides validation/autocomplete for key references
 */

import { ParsedStep } from '../components/TestCases/StepsEditor';

export interface SavedKey {
  name: string;
  dataType: 'string' | 'number' | 'object' | 'list' | 'unknown';
  description?: string;
  usedInSteps: number[];
}

export interface DataStoreState {
  keys: Map<string, SavedKey>;
  lastUpdated: Date;
}

/**
 * Initialize DataStore state from steps
 * Infers saved keys from SAVEDATA, SAVE_HARDCODE_DATA, and similar actions
 */
export function extractSavedKeysFromSteps(steps: ParsedStep[]): SavedKey[] {
  const keys = new Map<string, SavedKey>();

  const saveActions = [
    'SAVEDATA',
    'SAVE_HARDCODE_DATA',
    'SAVE_DATE_TIME',
    'SAVE_ELEMENT_TITLE',
    'SAVE_ELEMENTS_COUNT',
    'SAVE_ELEMENTS_ATTRIBUTE',
    'SAVE_CLASS_OF_ELEMENT',
    'SAVE_SPECIFIC_TEXT',
    'SAVE_TABLE_ROW_COUNT',
    'SAVE_TABLE_DATA',
    'SAVE_LIST_COUNT',
    'SAVE_DROPDOWN_LIST',
    'SAVE_CURRENT_PERIOD',
    'SAVE_WEEK_NAME',
    'SELECT_SAVE_SELECTED_OPTION_TEXT',
  ];

  steps.forEach((step) => {
    // If this is a save action, record the key
    if (saveActions.includes(step.action) && step.key) {
      const existingKey = keys.get(step.key);

      // Infer data type from action
      const dataType = inferDataType(step.action);

      if (existingKey) {
        existingKey.usedInSteps.push(step.index);
      } else {
        keys.set(step.key, {
          name: step.key,
          dataType,
          description: step.description,
          usedInSteps: [step.index],
        });
      }
    }
  });

  return Array.from(keys.values());
}

/**
 * Infer data type from action that saves data
 */
function inferDataType(
  action: string
): SavedKey['dataType'] {
  const stringTypes = [
    'SAVEDATA',
    'SAVE_ELEMENT_TITLE',
    'SAVE_CLASS_OF_ELEMENT',
    'SAVE_SPECIFIC_TEXT',
    'SELECT_SAVE_SELECTED_OPTION_TEXT',
    'SAVE_CURRENT_PERIOD',
    'SAVE_WEEK_NAME',
  ];

  const numberTypes = [
    'SAVE_ELEMENTS_COUNT',
    'SAVE_TABLE_ROW_COUNT',
    'SAVE_LIST_COUNT',
  ];

  const objectTypes = [
    'SAVE_TABLE_DATA',
    'SAVE_DROPDOWN_LIST',
    'SAVE_SELECTED_ROW_IN_DICTIONARY',
  ];

  if (stringTypes.includes(action)) return 'string';
  if (numberTypes.includes(action)) return 'number';
  if (objectTypes.includes(action)) return 'object';

  return 'unknown';
}

/**
 * Validate if a key reference exists
 */
export function validateKeyExists(
  keyName: string,
  availableKeys: SavedKey[]
): boolean {
  return availableKeys.some((k) => k.name === keyName);
}

/**
 * Validate CSV keys
 */
export function validateCSVKeysExist(
  csvKeys: string,
  availableKeys: SavedKey[]
): { isValid: boolean; missingKeys: string[] } {
  const keys = csvKeys
    .split(',')
    .map((k) => k.trim())
    .filter((k) => k.length > 0);

  const missingKeys = keys.filter(
    (k) => !availableKeys.some((ak) => ak.name === k)
  );

  return {
    isValid: missingKeys.length === 0,
    missingKeys,
  };
}

/**
 * Get autocomplete suggestions for keys
 */
export function getKeySuggestions(
  input: string,
  availableKeys: SavedKey[],
  limit: number = 10
): SavedKey[] {
  if (!input.trim()) {
    return availableKeys.slice(0, limit);
  }

  const lowerInput = input.toLowerCase();

  return availableKeys
    .filter(
      (key) =>
        key.name.toLowerCase().includes(lowerInput) ||
        (key.description?.toLowerCase().includes(lowerInput) ?? false)
    )
    .slice(0, limit);
}

/**
 * Get keys of specific data type
 */
export function getKeysByType(
  dataType: SavedKey['dataType'],
  availableKeys: SavedKey[]
): SavedKey[] {
  return availableKeys.filter((k) => k.dataType === dataType);
}

/**
 * Validate step key references against available keys
 */
export function validateStepKeyReferences(
  step: ParsedStep,
  availableKeys: SavedKey[]
): { valid: boolean; issues: string[] } {
  const issues: string[] = [];

  // Validate single key reference
  if (step.key && !step.action.startsWith('SAVE')) {
    if (!validateKeyExists(step.key, availableKeys)) {
      issues.push(`Data key "${step.key}" not found in saved keys`);
    }
  }

  // Validate CSV keys (used in actions like CALCULATE_PERCENTAGE)
  if (step.key && ['CALCULATE_PERCENTAGE', 'ADD_MULTIPLE_NUMBERS'].includes(step.action)) {
    const { isValid, missingKeys } = validateCSVKeysExist(step.key, availableKeys);
    if (!isValid) {
      issues.push(`Missing keys: ${missingKeys.join(', ')}`);
    }
  }

  // Validate element replacement key
  if (step.elementReplaceTextDataKey && step.isElementPathDynamic) {
    const keys = step.elementReplaceTextDataKey.split(',').map((k) => k.trim());
    keys.forEach((key) => {
      if (!validateKeyExists(key, availableKeys)) {
        issues.push(`Element replacement key "${key}" not found`);
      }
    });
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}

/**
 * Get key usage information
 */
export function getKeyUsageInfo(keyName: string, steps: ParsedStep[]): {
  savedInStep?: number;
  usedInSteps: number[];
} {
  const usedInSteps: number[] = [];
  let savedInStep: number | undefined;

  steps.forEach((step) => {
    // Check if this is where key is saved
    if (step.key === keyName && step.action.startsWith('SAVE')) {
      savedInStep = step.index;
    }

    // Check where key is used
    if (
      (step.key && step.key.includes(keyName) && !step.action.startsWith('SAVE')) ||
      (step.elementReplaceTextDataKey && step.elementReplaceTextDataKey.includes(keyName))
    ) {
      usedInSteps.push(step.index);
    }
  });

  return {
    savedInStep,
    usedInSteps,
  };
}

/**
 * Detect unused keys
 */
export function detectUnusedKeys(
  steps: ParsedStep[],
  availableKeys: SavedKey[]
): string[] {
  const usedKeys = new Set<string>();

  steps.forEach((step) => {
    if (step.key && !step.action.startsWith('SAVE')) {
      usedKeys.add(step.key);
    }
    if (step.elementReplaceTextDataKey) {
      step.elementReplaceTextDataKey.split(',').forEach((k) => {
        usedKeys.add(k.trim());
      });
    }
  });

  return availableKeys
    .filter((k) => !usedKeys.has(k.name) && k.usedInSteps.length === 1)
    .map((k) => k.name);
}

/**
 * Get data type compatible keys for an action
 */
export function getCompatibleKeys(
  action: string,
  availableKeys: SavedKey[]
): SavedKey[] {
  // Actions that need numeric keys
  const numericActions = [
    'COMPARE_SAVE_DROPDOWN_LIST_COUNT',
    'VERIFY_PERCENTAGE_VALUE',
    'ARITHMETIC_OPERATION_ON_NUMBER_AND_VERIFY',
    'CALCULATE_PERCENTAGE',
    'ADD_MULTIPLE_NUMBERS',
  ];

  // Actions that need string/text keys
  const stringActions = [
    'VERIFYDATA',
    'VERIFY_DYNAMIC_STRING',
    'SELECT_LIST_ITEM_BY_TEXT',
  ];

  if (numericActions.includes(action)) {
    return getKeysByType('number', availableKeys);
  }

  if (stringActions.includes(action)) {
    return getKeysByType('string', availableKeys);
  }

  // Default: return all keys
  return availableKeys;
}

/**
 * Generate key name suggestion based on action
 */
export function suggestKeyName(action: string, existingKeys: string[]): string {
  const baseSuggestions: Record<string, string> = {
    SAVEDATA: 'saved_data',
    SAVE_TABLE_ROW_COUNT: 'table_row_count',
    SAVE_TABLE_DATA: 'table_data',
    SAVE_LIST_COUNT: 'list_count',
    SAVE_DATE_TIME: 'current_date_time',
    SAVE_CURRENT_PERIOD: 'current_period',
  };

  let suggestion = baseSuggestions[action] || 'saved_value';
  let counter = 1;

  while (existingKeys.includes(suggestion)) {
    suggestion = `${baseSuggestions[action] || 'saved_value'}_${counter}`;
    counter++;
  }

  return suggestion;
}
