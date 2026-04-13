/**
 * Smart Defaults for Step Fields
 * Provides suggestions and auto-population based on action type
 */

import { ParsedStep } from '../components/TestCases/StepsEditor';
import { ACTION_REGISTRY } from './actionRegistry';

export interface SmartDefaultSuggestion {
  field: keyof ParsedStep;
  value: string;
  reason: string;
}

/**
 * Get smart default suggestions for a step
 */
export function getSmartDefaults(step: ParsedStep): SmartDefaultSuggestion[] {
  const suggestions: SmartDefaultSuggestion[] = [];
  const actionDef = ACTION_REGISTRY[step.action];

  if (!actionDef) {
    return suggestions;
  }

  const contract = actionDef.contract;

  // Suggest ElementCategory if Element is provided but ElementCategory is not
  if (
    step.element &&
    !step.elementCategory &&
    contract.elementCategory !== 'not-used'
  ) {
    const suggestedCategory = inferElementCategory(step.element);
    if (suggestedCategory) {
      suggestions.push({
        field: 'elementCategory',
        value: suggestedCategory,
        reason: `Inferred from element pattern: "${step.element.substring(0, 30)}..."`,
      });
    }
  }

  // Suggest ExpectedValue for verification actions
  if (contract.expectedValue === 'required' && !step.expectedValue) {
    const suggested = suggestExpectedValueForAction(step.action);
    if (suggested) {
      suggestions.push({
        field: 'expectedValue',
        value: suggested.value,
        reason: suggested.reason,
      });
    }
  }

  // Suggest Value for common actions
  if (contract.value === 'required' && !step.value) {
    const suggested = suggestValueForAction(step.action);
    if (suggested) {
      suggestions.push({
        field: 'value',
        value: suggested.value,
        reason: suggested.reason,
      });
    }
  }

  return suggestions;
}

/**
 * Infer element category from element pattern
 */
function inferElementCategory(element: string): string | null {
  // XPath detection
  if (element.match(/^(\/\/|\/|\.)/)) {
    return 'XPATH';
  }

  // ID detection - single word or alphanumeric with underscores
  if (element.match(/^[a-zA-Z_][a-zA-Z0-9_]*$/) && !element.includes(' ')) {
    return 'ID';
  }

  // CSS Selector detection
  if (element.match(/^[.#\[]/)) {
    return 'CSS';
  }

  // JavaScript detection
  if (element.includes('document') || element.includes('window')) {
    return 'JSPATH';
  }

  // Default to XPath for safety
  return null;
}

/**
 * Suggest ExpectedValue based on action type
 */
function suggestExpectedValueForAction(
  action: string
): { value: string; reason: string } | null {
  const suggestions: Record<string, { value: string; reason: string }> = {
    ISVISIBLE: {
      value: 'true',
      reason: 'Standard visibility assertion',
    },
    ISENABLED: {
      value: 'true',
      reason: 'Standard enabled state assertion',
    },
    CHECKED: {
      value: 'true',
      reason: 'Checkbox should be checked',
    },
    UNCHECKED: {
      value: 'false',
      reason: 'Checkbox should be unchecked',
    },
    VERIFYDATA: {
      value: 'true',
      reason: 'Standard data verification mode',
    },
    VERIFY_CLASS_EQUAL: {
      value: 'true',
      reason: 'Verify class match',
    },
    VERIFY_STYLE: {
      value: 'true',
      reason: 'Verify style presence',
    },
    ISEMPTY: {
      value: 'true',
      reason: 'Check for empty value',
    },
    EQUAL: {
      value: '',
      reason: 'Replace with expected text value',
    },
  };

  return suggestions[action] || null;
}

/**
 * Suggest Value based on action type
 */
function suggestValueForAction(
  action: string
): { value: string; reason: string } | null {
  const suggestions: Record<string, { value: string; reason: string }> = {
    TYPE: {
      value: '',
      reason: 'Text to type into the element',
    },
    TYPE_DATE: {
      value: '0',
      reason: 'Days offset from today (0 = today, 1 = tomorrow, -1 = yesterday)',
    },
    TYPE_RANDOM_STRING: {
      value: '',
      reason: 'Optional prefix text for random string',
    },
    SELECT: {
      value: '',
      reason: 'Visible dropdown option text to select',
    },
    SELECT_BY_INDEX: {
      value: '1',
      reason: 'Index of option to select (1-based)',
    },
    MULTIPLE_CLICK: {
      value: '2',
      reason: 'Number of times to click',
    },
    DRAG_DROP: {
      value: '',
      reason: 'Target element XPath for drop destination',
    },
    DRAG_DROP_BY_OFFSET: {
      value: '10,20',
      reason: 'Offset in pixels: offsetX,offsetY',
    },
    POPUP_TEXT: {
      value: '',
      reason: 'Text fragment to find in alert message',
    },
    FILTER_BY: {
      value: '',
      reason: 'Filter text to apply to table column',
    },
    SORT_BY: {
      value: 'ascending',
      reason: 'Sort order: ascending or descending',
    },
    SELECT_LIST_ITEM: {
      value: '1',
      reason: 'Item count or take:x,skip:y format',
    },
    TABLE_CLICK_ROW: {
      value: '1',
      reason: 'Row count or take:x,skip:y format',
    },
    CALCULATE_PERCENTAGE: {
      value: '',
      reason: 'Output key for saving result',
    },
  };

  return suggestions[action] || null;
}

/**
 * Get action-specific help text
 */
export function getActionHelpText(action: string): string | null {
  const helpTexts: Record<string, string> = {
    CLICK: 'Clicks the specified element. Element locator is required.',
    VERIFYDATA: 'Compares element text with expected value. Can use saved data via Key field.',
    ISVISIBLE: 'Asserts element visibility. Set ExpectedValue to true or false.',
    DRAG_DROP: 'Drags source element to target. Target XPath goes in Value field.',
    HOVER: 'Moves mouse to element without clicking.',
    DOUBLE_CLICK: 'Double-clicks the specified element.',
    RIGHT_CLICK: 'Right-clicks (context click) the element.',
    TYPE: 'Types text into input field. Can use Key to type saved data instead of Value.',
    SELECT: 'Selects option from dropdown by visible text.',
    ACCEPT_ALERT: 'Accepts/clicks OK on JavaScript alert dialog.',
    CANCEL_ALERT: 'Cancels/clicks Cancel on JavaScript alert dialog.',
    POPUP_TEXT: 'Reads alert text and asserts it contains the specified Value text.',
    FILTER_BY: 'Filters table by column. Requires: Element (table body), Value (filter text), Headers (column name).',
    SORT_BY: 'Sorts table column and verifies. Requires: Key (saved table data), Headers (column name), Value (ascending/descending).',
    SAVEDATA: 'Saves element text/value to DataStore under the specified Key.',
    SAVE_HARDCODE_DATA: 'Saves literal text value to DataStore under the specified Key.',
    ENTER_MARK: 'Toggles attendance mark between ? and /. Key stores previous mark.',
    CALCULATE_PERCENTAGE: 'Calculates percentage from two saved numeric keys. Key format: key1,key2.',
    VERIFY_DELAY: 'Waits up to 60 seconds for XPath element to exist before normal element resolution.',
    IS_COLUMN_VISIBLE: 'Asserts table column visibility. Optional Key saves visibility status.',
    CHECK_IF_UNCHECKED: 'Clicks checkbox only if currently unchecked.',
    UNCHECK_IF_CHECKED: 'Unclicks checkbox only if currently checked.',
    EQUAL: 'Asserts element text equals ExpectedValue exactly (with whitespace trimming).',
    SCROLL_TO_TOP: 'Scrolls page to the top.',
  };

  return helpTexts[action] || null;
}

/**
 * Get parameter usage examples
 */
export function getParameterExamples(
  action: string,
  parameterField: string
): string | null {
  const examples: Record<string, Record<string, string>> = {
    FILTER_BY: {
      element: '//table//tbody',
      value: 'Active',
      headers: 'Status',
    },
    SORT_BY: {
      element: '//table//tbody',
      headers: 'Date',
      value: 'ascending',
      key: 'saved_table_data',
    },
    DRAG_DROP: {
      element: '//div[@id="source"]',
      value: '//div[@id="target"]',
    },
    CALCULATE_PERCENTAGE: {
      value: 'percentage_output',
      key: 'count_key,total_key',
      expectedValue: 'PERCENT',
    },
    SELECT_LIST_ITEM: {
      element: '//ul[@class="items"]',
      value: '3 or take:5,skip:2',
    },
    TYPE_RANDOM_STRING: {
      value: 'USER',
      expectedValue: 'letter or number',
      headers: '10',
    },
  };

  return examples[action]?.[parameterField] || null;
}

/**
 * Get common mistakes and tips
 */
export function getActionTips(action: string): string[] {
  const tips: Record<string, string[]> = {
    DRAG_DROP: [
      'Copy an existing working test - source/target ordering is easy to misread',
      'Verify both source and target elements exist before running',
      'Test in isolation to debug locator issues',
    ],
    FILTER_BY: [
      'Use the exact column header text in Headers field',
      'Filter value is case-sensitive',
      'Element should be the table body (//table//tbody)',
    ],
    SORT_BY: [
      'Must have saved table data in Key field from a previous SAVE_TABLE_DATA step',
      'Column header must match exactly (case-sensitive)',
      'Currently only supports ascending/descending',
    ],
    TYPE: [
      'Use KEY field to type saved data instead of literal Value',
      'Use TYPE_INVISIBLE_ELEMENT for hidden inputs',
      'Clear the field first with CLEAR_TEXT if needed',
    ],
    SELECT: [
      'Option text must match visible text exactly',
      'Use PartialMatch in Headers field if text changes slightly',
      'If Key exists, it overrides Value with saved data',
    ],
    CALCULATE_PERCENTAGE: [
      'Requires two saved numeric keys (comma-separated in Key field)',
      'Formula: (key1 / key2) * 100',
      'Set Headers=SAVEPERCENTAGEVALUE to save result',
    ],
    ENTER_MARK: [
      'Special attendance marking action',
      'Key stores the previous mark for later verification',
      'Toggles between "?" and "/"',
    ],
  };

  return tips[action] || [];
}
