/**
 * Action Registry - Wrapper around the auto-generated action catalog
 * Provides utility functions for accessing action definitions
 */

import { DOC_ACTION_DEFINITIONS } from './actionCatalog.generated';

const ACTION_CATALOG_OVERRIDE_STORAGE_KEY = 'workspace-action-catalog-override:v1';
const ACTION_CATALOG_OVERRIDE_VERSION = 1;
const CONTRACT_REQUIREMENTS = new Set(['required', 'optional', 'not-used']);

export type ContractRequirement = 'required' | 'optional' | 'not-used';

export type ParameterContract = {
  locator: ContractRequirement;
  locatorType: ContractRequirement;
  value: ContractRequirement;
  expectedVl: ContractRequirement;
  dataKey: ContractRequirement;
  headers: ContractRequirement;
  elementPathReplaceKey: ContractRequirement;
  isElementPathDynamic: ContractRequirement;
  isConcatenated: ContractRequirement;
};

export type ActionDefinition = {
  name: string;
  category: string;
  description: string;
  notes: string;
  contract: ParameterContract;
};

type ActionRegistryRecord = Record<string, ActionDefinition>;

interface ActionCatalogOverridePayload {
  version: number;
  updatedAt: string;
  actions: Record<string, unknown>;
}

export interface ActionCatalogStatus {
  source: 'built-in' | 'override';
  totalActions: number;
  overrideActions: number;
  updatedAt: string | null;
}

const BUILT_IN_ACTION_REGISTRY = DOC_ACTION_DEFINITIONS as ActionRegistryRecord;
const listeners = new Set<() => void>();
let actionRegistryRevision = 0;
let activeOverrideActions: ActionRegistryRecord = {};
let activeOverrideUpdatedAt: string | null = null;

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asContractRequirement(
  value: unknown,
  fieldName: keyof ParameterContract,
  actionName: string,
): ContractRequirement {
  if (typeof value !== 'string' || !CONTRACT_REQUIREMENTS.has(value)) {
    throw new Error(`${actionName}: contract.${fieldName} must be required, optional, or not-used.`);
  }
  return value as ContractRequirement;
}

function normalizeActionContract(raw: unknown, actionName: string): ParameterContract {
  if (!isObjectRecord(raw)) {
    throw new Error(`${actionName}: contract must be an object.`);
  }

  return {
    locator: asContractRequirement(raw.locator, 'locator', actionName),
    locatorType: asContractRequirement(raw.locatorType, 'locatorType', actionName),
    value: asContractRequirement(raw.value, 'value', actionName),
    expectedVl: asContractRequirement(raw.expectedVl, 'expectedVl', actionName),
    dataKey: asContractRequirement(raw.dataKey, 'dataKey', actionName),
    headers: asContractRequirement(raw.headers, 'headers', actionName),
    elementPathReplaceKey: asContractRequirement(raw.elementPathReplaceKey, 'elementPathReplaceKey', actionName),
    isElementPathDynamic: asContractRequirement(raw.isElementPathDynamic, 'isElementPathDynamic', actionName),
    isConcatenated: asContractRequirement(raw.isConcatenated, 'isConcatenated', actionName),
  };
}

function normalizeActionDefinition(rawKey: string, rawDefinition: unknown): ActionDefinition {
  if (!isObjectRecord(rawDefinition)) {
    throw new Error(`${rawKey}: action definition must be an object.`);
  }

  const actionKey = rawKey.trim().toUpperCase();
  if (!actionKey) {
    throw new Error('Action name cannot be empty.');
  }

  const name = typeof rawDefinition.name === 'string' && rawDefinition.name.trim()
    ? rawDefinition.name.trim().toUpperCase()
    : actionKey;

  return {
    name,
    category: typeof rawDefinition.category === 'string' ? rawDefinition.category.trim() : '',
    description: typeof rawDefinition.description === 'string' ? rawDefinition.description : '',
    notes: typeof rawDefinition.notes === 'string' ? rawDefinition.notes : '',
    contract: normalizeActionContract(rawDefinition.contract, actionKey),
  };
}

function resolveImportedActions(rawPayload: unknown): Record<string, unknown> {
  if (!isObjectRecord(rawPayload)) {
    throw new Error('Action catalog payload must be a JSON object.');
  }

  if (isObjectRecord(rawPayload.actions)) {
    return rawPayload.actions;
  }

  return rawPayload;
}

function normalizeActionCatalogRecord(rawPayload: unknown): ActionRegistryRecord {
  const rawActions = resolveImportedActions(rawPayload);
  const normalized: ActionRegistryRecord = {};

  for (const [key, value] of Object.entries(rawActions)) {
    const trimmedKey = key.trim().toUpperCase();
    if (!trimmedKey) continue;
    normalized[trimmedKey] = normalizeActionDefinition(trimmedKey, value);
  }

  if (Object.keys(normalized).length === 0) {
    throw new Error('No valid actions found in imported catalog.');
  }

  return normalized;
}

function writeOverridePayload(payload: ActionCatalogOverridePayload): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(ACTION_CATALOG_OVERRIDE_STORAGE_KEY, JSON.stringify(payload));
}

function readOverridePayload(): ActionCatalogOverridePayload | null {
  if (typeof window === 'undefined') return null;

  const raw = window.localStorage.getItem(ACTION_CATALOG_OVERRIDE_STORAGE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<ActionCatalogOverridePayload>;
    const parsedActions = resolveImportedActions(parsed);
    return {
      version: Number(parsed.version) || ACTION_CATALOG_OVERRIDE_VERSION,
      updatedAt: typeof parsed.updatedAt === 'string' && parsed.updatedAt.trim()
        ? parsed.updatedAt
        : new Date().toISOString(),
      actions: parsedActions,
    };
  } catch (error) {
    console.error('Failed to parse action catalog override from local storage.', error);
    return null;
  }
}

function emitRegistryChange(): void {
  listeners.forEach((listener) => {
    try {
      listener();
    } catch {
      // Ignore listener failures
    }
  });
}

function replaceRegistry(nextRegistry: ActionRegistryRecord): void {
  Object.keys(ACTION_REGISTRY).forEach((key) => {
    delete ACTION_REGISTRY[key];
  });
  Object.assign(ACTION_REGISTRY, nextRegistry);
  actionRegistryRevision += 1;
  emitRegistryChange();
}

function applyBuiltInRegistry(): void {
  activeOverrideActions = {};
  activeOverrideUpdatedAt = null;
  replaceRegistry(BUILT_IN_ACTION_REGISTRY);
}

function applyOverrideRegistry(overrideActions: ActionRegistryRecord, updatedAt: string): void {
  activeOverrideActions = overrideActions;
  activeOverrideUpdatedAt = updatedAt;
  replaceRegistry({
    ...BUILT_IN_ACTION_REGISTRY,
    ...overrideActions,
  });
}

function initializeRegistry(): void {
  const payload = readOverridePayload();
  if (!payload) {
    applyBuiltInRegistry();
    return;
  }

  try {
    const overrideActions = normalizeActionCatalogRecord(payload.actions);
    applyOverrideRegistry(overrideActions, payload.updatedAt);
  } catch (error) {
    console.error('Invalid action catalog override. Reverting to built-in catalog.', error);
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(ACTION_CATALOG_OVERRIDE_STORAGE_KEY);
    }
    applyBuiltInRegistry();
  }
}

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
    contract.locator === 'required'
    && contract.locatorType === 'required'
    && contract.isElementPathDynamic !== 'not-used'
  );
}

// Mutable registry so runtime overrides can be applied without rebuild.
export const ACTION_REGISTRY: Record<string, ActionDefinition> = {};
initializeRegistry();

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
    showElement: contract.locator !== 'not-used',
    showElementCategory: contract.locatorType !== 'not-used',
    showElementPath: contract.locator !== 'not-used',
    showIsElementPathDynamic: supportsDynamicLocatorControls(actionDef),
    showElementReplaceTextDataKey: contract.elementPathReplaceKey !== 'not-used',
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

  if (contract.locator === 'not-used') {
    return { valid: false, message: 'This action does not use element locators' };
  }

  if (contract.locatorType === 'not-used') {
    return { valid: false, message: 'This action does not use element categories' };
  }

  return { valid: true };
}

export function subscribeActionRegistryChanges(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getActionRegistryRevision(): number {
  return actionRegistryRevision;
}

export function importActionCatalogOverrideFromJson(jsonText: string): ActionCatalogStatus {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid JSON payload.';
    throw new Error(`Could not parse JSON: ${message}`);
  }

  const overrideActions = normalizeActionCatalogRecord(parsed);
  const updatedAt = new Date().toISOString();
  writeOverridePayload({
    version: ACTION_CATALOG_OVERRIDE_VERSION,
    updatedAt,
    actions: overrideActions,
  });
  applyOverrideRegistry(overrideActions, updatedAt);
  return getActionCatalogStatus();
}

export function clearActionCatalogOverride(): ActionCatalogStatus {
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(ACTION_CATALOG_OVERRIDE_STORAGE_KEY);
  }
  applyBuiltInRegistry();
  return getActionCatalogStatus();
}

export function exportActionCatalogJson(): string {
  const serializedActions = Object.keys(ACTION_REGISTRY)
    .sort((left, right) => left.localeCompare(right))
    .reduce<Record<string, ActionDefinition>>((acc, key) => {
      acc[key] = ACTION_REGISTRY[key];
      return acc;
    }, {});

  return JSON.stringify(
    {
      version: ACTION_CATALOG_OVERRIDE_VERSION,
      exportedAt: new Date().toISOString(),
      source: activeOverrideUpdatedAt ? 'override' : 'built-in',
      actions: serializedActions,
    },
    null,
    2,
  );
}

export function getActionCatalogStatus(): ActionCatalogStatus {
  return {
    source: activeOverrideUpdatedAt ? 'override' : 'built-in',
    totalActions: Object.keys(ACTION_REGISTRY).length,
    overrideActions: Object.keys(activeOverrideActions).length,
    updatedAt: activeOverrideUpdatedAt,
  };
}

