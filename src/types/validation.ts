/**
 * Validation Result Types
 */

export type ValidationSeverity = 'error' | 'warning' | 'info';

export interface ValidationMessage {
  field: string;
  message: string;
  severity: ValidationSeverity;
  suggestedValue?: string;
  code?: string;                 // Error code for i18n
}

export interface StepValidationResult {
  stepId: string;
  isValid: boolean;
  errors: ValidationMessage[];   // Blocking issues
  warnings: ValidationMessage[];  // Non-blocking issues
  suggestions: ValidationMessage[];  // Helpful hints
  details?: string;              // Extended info for user
}

export interface BulkValidationResult {
  isValid: boolean;
  stepResults: StepValidationResult[];
  summary: {
    totalSteps: number;
    validSteps: number;
    stepsWithErrors: number;
    stepsWithWarnings: number;
  };
}

export interface ValidationContext {
  actionRegistry: import('./actions').ActionRegistry;
  savedKeys?: string[];          // Available DataStore keys
  columnHeaders?: string[];      // Available table columns
}

export interface ValidationConfig {
  strict: boolean;               // If true, warnings block save
  allowUnused: boolean;          // If false, warn on unused fields
  validateXPath: boolean;        // Validate XPath syntax
  validateRegex: boolean;        // Validate regex patterns
}

export interface ValidationError extends Error {
  stepId?: string;
  field?: string;
  code?: string;
}
