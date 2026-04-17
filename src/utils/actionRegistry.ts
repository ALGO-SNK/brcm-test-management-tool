/**
 * Action Registry - Wrapper around the auto-generated action catalog
 * Provides utility functions for accessing action definitions
 */

import { DOC_ACTION_DEFINITIONS } from './actionCatalog.generated';

// Export the type for parameter contracts
export type ParameterContract = {
  element: 'required' | 'optional' | 'not-used';
  elementCategory: 'required' | 'optional' | 'not-used';
  value: 'required' | 'optional' | 'not-used';
  expectedValue: 'required' | 'optional' | 'not-used';
  key: 'required' | 'optional' | 'not-used';
  headers: 'required' | 'optional' | 'not-used';
  elementReplaceTextDataKey?: 'required' | 'optional' | 'not-used';
  isElementPathDynamic?: 'required' | 'optional' | 'not-used';
  isConcatenated?: 'required' | 'optional' | 'not-used';
};

export type ActionDefinition = {
  name: string;
  category: string;
  description: string;
  notes: string;
  contract: ParameterContract;
};

/**
 * Dynamic locator controls only make sense when the action has a mandatory
 * locator and locator type. Keep this logic centralized so the menu and
 * renderer stay in sync.
 */
export function supportsDynamicLocatorControls(
  actionDef: ActionDefinition | undefined,
): boolean {
  if (!actionDef) {
    return false;
  }

  const contract = actionDef.contract;

  return (
    contract.element === 'required'
    && contract.elementCategory === 'required'
    && contract.isElementPathDynamic !== 'not-used'
  );
}

// Create the ACTION_REGISTRY from the definitions
export const ACTION_REGISTRY: Record<string, ActionDefinition> = DOC_ACTION_DEFINITIONS as Record<string, ActionDefinition>;

/**
 * Get an action definition by action name
 */
export function getActionDefinition(actionName: string): ActionDefinition | undefined {
  return ACTION_REGISTRY[actionName.toUpperCase()];
}

const ELEMENT_CATEGORY_HINTS: Record<string, string> = {
  XPATH: 'e.g., //div[@id="summary"]',
  ID: 'e.g., submitButton',
  CLASS: 'e.g., btn-primary',
  CSSSELECTOR: 'e.g., .form-group > input',
  TAGNAME: 'e.g., button',
  LINKTEXT: 'e.g., Click here',
  NAME: 'e.g., username',
  JSPATH: 'e.g., document.querySelector(...)',
  URL: 'https://example.com or #savedURLKey',
  VERIFY: 'e.g., //span[@class="status"]',
  VERIFYERROR: 'Expected error text',
};

/**
 * Get element authoring fields for an action and element category
 */
export function getElementAuthoringFields(
  actionDef: ActionDefinition | undefined,
  elementCategory: string
): {
  showElement: boolean;
  showElementCategory: boolean;
  showElementPath: boolean;
  showIsElementPathDynamic: boolean;
  showElementReplaceTextDataKey: boolean;
  showValue: boolean;
  elementCategoryHint: string;
} {
  if (!actionDef) {
    return {
      showElement: false,
      showElementCategory: false,
      showElementPath: false,
      showIsElementPathDynamic: false,
      showElementReplaceTextDataKey: false,
      showValue: false,
      elementCategoryHint: '',
    };
  }

  const contract = actionDef.contract;

  return {
    showElement: contract.element !== 'not-used',
    showElementCategory: contract.elementCategory !== 'not-used',
    showElementPath: contract.element !== 'not-used',
    showIsElementPathDynamic: supportsDynamicLocatorControls(actionDef),
    showElementReplaceTextDataKey: contract.elementReplaceTextDataKey !== 'not-used',
    showValue: contract.value !== 'not-used',
    elementCategoryHint: ELEMENT_CATEGORY_HINTS[elementCategory] ?? '',
  };
}

/**
 * Infer element category from an element locator
 */
export function inferElementCategory(element: string): string | null {
  if (!element || !element.trim()) return null;

  const normalized = element.trim();

  // XPath detection
  if (normalized.startsWith('//') || normalized.startsWith('(/')) {
    return 'XPATH';
  }

  // ID detection
  if (normalized.startsWith('#')) {
    return 'ID';
  }

  // CSS selector detection
  if (normalized.includes('.') || normalized.includes('[') || normalized.includes('>')) {
    return 'CSSSELECTOR';
  }

  return null;
}

/**
 * Validate element authoring combination (action + element category)
 */
export function validateElementAuthoringCombination(
  action: string,
  _elementCategory: string
): { valid: boolean; message?: string } {
  const actionDef = getActionDefinition(action);

  if (!actionDef) {
    return { valid: false, message: 'Unknown action' };
  }

  const contract = actionDef.contract;

  if (contract.element === 'not-used') {
    return { valid: false, message: 'This action does not use element locators' };
  }

  if (contract.elementCategory === 'not-used') {
    return { valid: false, message: 'This action does not use element categories' };
  }

  return { valid: true };
}
