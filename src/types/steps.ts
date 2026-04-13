/**
 * Step Data Types
 * Represents test automation steps in JSON format (parsed from XML)
 */

export type ElementCategory =
  | 'XPATH'
  | 'ID'
  | 'TAGNAME'
  | 'CSSSELECTOR'
  | 'LINKTEXT'
  | 'NAME'
  | 'URL'
  | 'JSPATH'
  | 'VERIFY'
  | 'VERIFYERROR';

export interface StepData {
  // Core fields
  id: string;                    // Unique ID (UUID)
  action: string;               // Action type from registry (e.g., "CLICK", "VERIFY_DELAY")

  // Element specification
  element: string;              // Locator text (XPath, CSS selector, etc.)
  elementCategory: ElementCategory;

  // Parameters
  value: string;                // Overloaded parameter (input/mode/filter value)
  expectedValue: string;        // Expected/result field (ExpectedVl in XML)
  key: string;                  // DataStore key (DataKey in XML)
  headers: string;              // Overloaded config field (comma-separated values)

  // Metadata
  description: string;          // Step description
  stepDescription?: string;     // Full text for error reporting

  // Advanced fields
  isConcatenated?: boolean;     // Toggle concatenated compare logic
  isElementPathDynamic?: boolean; // Enable dynamic locator replacement
  elementReplaceTextDataKey?: string; // Dynamic locator replacement key

  // Optional fields
  expectedResult?: string;
  variantId?: string;
  extraFields?: Record<string, unknown>;

  // UI state
  order?: number;               // Display order in list
  createdAt?: string;           // ISO timestamp
  updatedAt?: string;           // ISO timestamp
}

export interface XMLParseResult {
  steps: StepData[];
  errors: string[];
  warnings: string[];
}
