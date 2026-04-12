/**
 * Action Registry Types
 * Define the structure of actions and their parameter contracts
 */

export type ParameterType =
  | 'none'
  | 'text'
  | 'xpath'
  | 'boolean'
  | 'enum'
  | 'regex'
  | 'column-header'
  | 'saved-key'
  | 'csv-saved-keys'
  | 'dictionary'
  | 'union'
  | 'unknown';

export type AuthoringMode = 'standard' | 'copy-existing-only' | 'enum-only';

export interface ActionParameter {
  used: boolean;
  required: boolean;
  type: ParameterType;
  allowedValues?: string[];     // For enum types
  formats?: string[];            // For union types
  fields?: string[];             // For dictionary types
  description?: string;
}

export interface ActionContract {
  id: string;                    // e.g., "CLICK", "VERIFY_DELAY"
  label: string;                 // Display name (e.g., "Click Element")
  categoryId: string;            // Category ID (e.g., "generic_browser")
  authoringMode: AuthoringMode;
  notes: string;                 // Description/notes
  tags: string[];               // Search tags
  params: {
    element: ActionParameter;
    value: ActionParameter;
    expectedValue: ActionParameter;
    key: ActionParameter;
    headers: ActionParameter;
  };
}

export interface ActionCategory {
  id: string;                    // e.g., "generic_browser"
  label: string;                 // Display label
  description: string;           // Category description
  actionIds: string[];           // Action IDs in this category
}

export interface ActionRegistryMeta {
  id: string;
  title: string;
  sourceType: string;            // e.g., "appendix"
  contractFields: string[];      // ["element", "value", "expectedValue", "key", "headers"]
  authoringModes: string[];      // Authoring modes supported
}

export interface ActionRegistry {
  meta: ActionRegistryMeta;
  categories: ActionCategory[];
  actions: Record<string, ActionContract>;  // ID → ActionContract
}

export interface ActionSearchResult {
  action: ActionContract;
  category: ActionCategory;
  score: number;                 // Search relevance score
}

export interface ActionStats {
  totalCategories: number;
  totalActionsLoaded: number;
  visibleCount: number;
  standardCount: number;
  copyExistingOnlyCount: number;
  enumOnlyCount: number;
}
