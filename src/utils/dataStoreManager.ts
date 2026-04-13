/**
 * DataStore Manager
 * Manages saved keys and provides validation/autocomplete for key references.
 */
import type { ParsedStep } from '../components/TestCases/StepsEditor';
import { getActionDefinition } from './actionRegistry';

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

const KEY_OUTPUT_ACTIONS = new Set([
  'ENTER_MARK',
  'SAVE_STAFF_CODE',
  'SAVE_XML_DATA_TO_LIST',
  'SELECT_SAVE_SELECTED_OPTION_TEXT',
  'UPDATE_DICTIONARY_KEY_VALUE',
]);

const KEY_INPUT_CSV_ACTIONS = new Set([
  'ADD_MULTIPLE_NUMBERS',
  'CALCULATE_PERCENTAGE',
  'CALCULATE_SUPERANNUATION',
  'COMPARE_TWO_LISTS',
  'COMPARE_TWO_TEXT',
  'MATCH_FILTER_STATUS_COUNT',
]);

function splitCsvKeys(value: string): string[] {
  return value
    .split(',')
    .map((token) => token.trim())
    .filter((token) => token.length > 0);
}

function isLikelyOutputKeyAction(action: string): boolean {
  if (KEY_OUTPUT_ACTIONS.has(action)) return true;
  if (action.startsWith('SAVE')) return true;
  if (action.includes('_SAVE_')) return true;
  return false;
}

function extractOutputKeysFromStep(step: ParsedStep): string[] {
  if (!step.key) return [];

  if (step.action === 'CALCULATE_ALLOWANCE') {
    const [_, outputKey] = splitCsvKeys(step.key);
    return outputKey ? [outputKey] : [];
  }

  if (!isLikelyOutputKeyAction(step.action)) {
    return [];
  }

  return splitCsvKeys(step.key);
}

/**
 * Initialize DataStore state from steps.
 */
export function extractSavedKeysFromSteps(steps: ParsedStep[]): SavedKey[] {
  const keys = new Map<string, SavedKey>();

  steps.forEach((step) => {
    const outputKeys = extractOutputKeysFromStep(step);
    if (!outputKeys.length) return;

    const dataType = inferDataType(step.action);
    outputKeys.forEach((keyName) => {
      const existingKey = keys.get(keyName);
      if (existingKey) {
        existingKey.usedInSteps.push(step.index);
        return;
      }

      keys.set(keyName, {
        name: keyName,
        dataType,
        description: step.description,
        usedInSteps: [step.index],
      });
    });
  });

  return Array.from(keys.values());
}

/**
 * Infer data type from save/update action.
 */
function inferDataType(action: string): SavedKey['dataType'] {
  const upper = action.toUpperCase();

  if (
    upper.includes('COUNT')
    || upper.includes('NUMBER')
    || upper.includes('PERCENTAGE')
    || upper.includes('TOTAL')
    || upper.includes('SALARY')
    || upper.includes('ALLOWANCE')
  ) {
    return 'number';
  }

  if (upper.includes('LIST')) return 'list';

  if (
    upper.includes('TABLE')
    || upper.includes('DICTIONARY')
    || upper.includes('JSON')
    || upper.includes('ROW_COLUMN')
  ) {
    return 'object';
  }

  if (
    upper.includes('DATE')
    || upper.includes('TITLE')
    || upper.includes('TEXT')
    || upper.includes('CLASS')
    || upper.includes('DATA')
  ) {
    return 'string';
  }

  return 'unknown';
}

/**
 * Validate if a key reference exists.
 */
export function validateKeyExists(
  keyName: string,
  availableKeys: SavedKey[]
): boolean {
  return availableKeys.some((k) => k.name === keyName);
}

/**
 * Validate CSV keys.
 */
export function validateCSVKeysExist(
  csvKeys: string,
  availableKeys: SavedKey[]
): { isValid: boolean; missingKeys: string[] } {
  const keys = splitCsvKeys(csvKeys);

  const missingKeys = keys.filter(
    (k) => !availableKeys.some((ak) => ak.name === k)
  );

  return {
    isValid: missingKeys.length === 0,
    missingKeys,
  };
}

/**
 * Get autocomplete suggestions for keys.
 */
export function getKeySuggestions(
  input: string,
  availableKeys: SavedKey[],
  limit: number = 10
): SavedKey[] {
  if (!input.trim()) return availableKeys.slice(0, limit);

  const lowerInput = input.toLowerCase();

  return availableKeys
    .filter(
      (key) =>
        key.name.toLowerCase().includes(lowerInput)
        || (key.description?.toLowerCase().includes(lowerInput) ?? false)
    )
    .slice(0, limit);
}

/**
 * Get keys of specific data type.
 */
export function getKeysByType(
  dataType: SavedKey['dataType'],
  availableKeys: SavedKey[]
): SavedKey[] {
  return availableKeys.filter((k) => k.dataType === dataType);
}

/**
 * Validate step key references against available keys.
 */
export function validateStepKeyReferences(
  step: ParsedStep,
  availableKeys: SavedKey[]
): { valid: boolean; issues: string[] } {
  const issues: string[] = [];
  const actionDef = getActionDefinition(step.action);

  if (step.key && !isLikelyOutputKeyAction(step.action)) {
    if (KEY_INPUT_CSV_ACTIONS.has(step.action) || step.key.includes(',')) {
      const { isValid, missingKeys } = validateCSVKeysExist(step.key, availableKeys);
      if (!isValid) issues.push(`Missing keys: ${missingKeys.join(', ')}`);
    } else if (!validateKeyExists(step.key, availableKeys)) {
      issues.push(`Data key "${step.key}" not found in saved keys`);
    }
  }

  if (step.elementReplaceTextDataKey && step.isElementPathDynamic) {
    splitCsvKeys(step.elementReplaceTextDataKey).forEach((keyName) => {
      if (!validateKeyExists(keyName, availableKeys)) {
        issues.push(`Element replacement key "${keyName}" not found`);
      }
    });
  }

  if (actionDef?.contract.key === 'required' && !step.key?.trim()) {
    issues.push('Data key is required for this action');
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}

/**
 * Get key usage information.
 */
export function getKeyUsageInfo(keyName: string, steps: ParsedStep[]): {
  savedInStep?: number;
  usedInSteps: number[];
} {
  const usedInSteps: number[] = [];
  let savedInStep: number | undefined;

  steps.forEach((step) => {
    if (extractOutputKeysFromStep(step).includes(keyName)) {
      savedInStep = step.index;
    }

    if (
      (step.key && splitCsvKeys(step.key).includes(keyName) && !isLikelyOutputKeyAction(step.action))
      || (step.elementReplaceTextDataKey && splitCsvKeys(step.elementReplaceTextDataKey).includes(keyName))
    ) {
      usedInSteps.push(step.index);
    }
  });

  return { savedInStep, usedInSteps };
}

/**
 * Detect unused keys.
 */
export function detectUnusedKeys(
  steps: ParsedStep[],
  availableKeys: SavedKey[]
): string[] {
  const usedKeys = new Set<string>();

  steps.forEach((step) => {
    if (step.key && !isLikelyOutputKeyAction(step.action)) {
      splitCsvKeys(step.key).forEach((token) => usedKeys.add(token));
    }

    if (step.elementReplaceTextDataKey) {
      splitCsvKeys(step.elementReplaceTextDataKey).forEach((token) => usedKeys.add(token));
    }
  });

  return availableKeys
    .filter((k) => !usedKeys.has(k.name) && k.usedInSteps.length === 1)
    .map((k) => k.name);
}

/**
 * Get data type compatible keys for an action.
 */
export function getCompatibleKeys(
  action: string,
  availableKeys: SavedKey[]
): SavedKey[] {
  const numericActions = new Set([
    'VERIFY_PERCENTAGE_VALUE',
    'ARITHMETIC_OPERATION_ON_NUMBER_AND_VERIFY',
    'CALCULATE_PERCENTAGE',
    'CALCULATE_SUPERANNUATION',
    'CALCULATE_SALARY_TOTAL',
    'CALCULATE_BASIC',
    'ADD_MULTIPLE_NUMBERS',
    'MATCH_FILTER_STATUS_COUNT',
  ]);

  const stringActions = new Set([
    'VERIFYDATA',
    'VERIFY_DYNAMIC_STRING',
    'SELECT_LIST_ITEM_BY_TEXT',
    'CHECK_URL',
  ]);

  if (numericActions.has(action)) return getKeysByType('number', availableKeys);
  if (stringActions.has(action)) return getKeysByType('string', availableKeys);

  return availableKeys;
}

/**
 * Generate key name suggestion based on action.
 */
export function suggestKeyName(action: string, existingKeys: string[]): string {
  const baseSuggestions: Record<string, string> = {
    SAVEDATA: 'saved_data',
    SAVE_TABLE_ROW_COUNT: 'table_row_count',
    SAVE_TABLE_DATA: 'table_data',
    SAVE_LIST_COUNT: 'list_count',
    SAVE_DATE_TIME: 'current_date_time',
    SAVE_CURRENT_PERIOD: 'current_period',
    SAVE_DROPDOWN_LIST: 'dropdown_values',
    SAVE_SELECTED_ROW_IN_DICTIONARY: 'selected_row_data',
  };

  const base = baseSuggestions[action] || 'saved_value';
  let suggestion = base;
  let counter = 1;

  while (existingKeys.includes(suggestion)) {
    suggestion = `${base}_${counter}`;
    counter++;
  }

  return suggestion;
}

/**
 * ===== ELEMENT + ELEMENTCATEGORY WITH DATASTORE KEYS =====
 * Validate element authoring combinations that use saved keys for dynamic locators
 */
export interface ElementAuthoringKeyValidation {
  valid: boolean;
  pattern: 'static' | 'dynamic-single' | 'dynamic-multi' | 'unknown';
  issues: string[];
}

/**
 * Validate element authoring pattern with DataStore key integration
 * Used for dynamic locators that reference saved keys
 */
export function validateElementAuthoringWithKeys(
  step: ParsedStep,
  availableKeys: SavedKey[]
): ElementAuthoringKeyValidation {
  const issues: string[] = [];
  let pattern: 'static' | 'dynamic-single' | 'dynamic-multi' | 'unknown' = 'unknown';

  // No element - this is fine for some actions
  if (!step.element) {
    return { valid: true, pattern: 'unknown', issues: [] };
  }

  const hasDynamicToken = step.element.includes('$$') || step.element.match(/Datakey\d+/);

  // Static locator pattern
  if (!step.isElementPathDynamic && !hasDynamicToken) {
    pattern = 'static';
    return { valid: true, pattern, issues: [] };
  }

  // Dynamic locator pattern - requires ElementReplaceTextDataKey
  if (hasDynamicToken) {
    if (!step.elementReplaceTextDataKey) {
      issues.push(
        'Element contains replacement tokens but ElementReplaceTextDataKey is empty. ' +
        'Provide the key name(s) to replace.'
      );
    } else {
      // Validate that referenced keys exist
      const keys = splitCsvKeys(step.elementReplaceTextDataKey);
      const singleKeyPattern = step.element.includes('$$');

      if (singleKeyPattern && keys.length === 1) {
        pattern = 'dynamic-single';
        if (!validateKeyExists(keys[0], availableKeys)) {
          issues.push(`Saved key "${keys[0]}" not found. Need to save this key first.`);
        }
      } else if (keys.length > 1) {
        pattern = 'dynamic-multi';
        const tokensInElement = (step.element.match(/Datakey\d+/g) || []).length;
        if (tokensInElement !== keys.length) {
          issues.push(
            `Mismatch: Element has ${tokensInElement} Datakey tokens but ` +
            `ElementReplaceTextDataKey specifies ${keys.length} keys`
          );
        }
        keys.forEach((keyName) => {
          if (!validateKeyExists(keyName, availableKeys)) {
            issues.push(`Saved key "${keyName}" not found`);
          }
        });
      } else {
        issues.push(
          'ElementReplaceTextDataKey format issue: provide comma-separated key names'
        );
      }
    }
  }

  // IsElementPathDynamic is set but no tokens in element
  if (step.isElementPathDynamic && !hasDynamicToken) {
    issues.push(
      'IsElementPathDynamic=true but Element has no replacement tokens. ' +
      'Add $$ or Datakey1, Datakey2 to Element'
    );
  }

  return {
    valid: issues.length === 0,
    pattern,
    issues,
  };
}
