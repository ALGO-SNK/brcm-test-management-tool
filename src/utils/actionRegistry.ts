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

// Create the ACTION_REGISTRY from the definitions
export const ACTION_REGISTRY: Record<string, ActionDefinition> = DOC_ACTION_DEFINITIONS as Record<string, ActionDefinition>;

/**
 * Get an action definition by action name
 */
export function getActionDefinition(actionName: string): ActionDefinition | undefined {
  return ACTION_REGISTRY[actionName.toUpperCase()];
}

/**
 * Get element authoring fields for an action and element category
 */
export function getElementAuthoringFields(
  actionDef: ActionDefinition,
  elementCategory: string
): {
  showElement: boolean;
  showElementCategory: boolean;
  showElementPath: boolean;
  showIsElementPathDynamic: boolean;
  showElementReplaceTextDataKey: boolean;
} {
  const contract = actionDef.contract;

  return {
    showElement: contract.element !== 'not-used',
    showElementCategory: contract.elementCategory !== 'not-used',
    showElementPath: contract.element !== 'not-used',
    showIsElementPathDynamic: contract.isElementPathDynamic !== 'not-used',
    showElementReplaceTextDataKey: contract.elementReplaceTextDataKey !== 'not-used',
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
  elementCategory: string
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
