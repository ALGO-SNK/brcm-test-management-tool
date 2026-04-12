/**
 * JSON to XML Step Serializer
 * Converts JSON steps back to Azure DevOps XML format
 */

import type { StepData, XMLSerializeResult } from '../types';

/**
 * Serialize step array to XML string for ADO API
 */
export function stepsToXML(steps: StepData[]): XMLSerializeResult {
  const errors: string[] = [];

  if (!steps || steps.length === 0) {
    return { xml: '', errors };
  }

  try {
    const xmlParts = steps.map((step, index) => {
      try {
        return stepToXML(step);
      } catch (error) {
        errors.push(`Failed to serialize step ${index}: ${error instanceof Error ? error.message : String(error)}`);
        return null;
      }
    }).filter((xml) => xml !== null) as string[];

    const xml = xmlParts.join('');
    return { xml, errors };
  } catch (error) {
    errors.push(`Failed to serialize steps: ${error instanceof Error ? error.message : String(error)}`);
    return { xml: '', errors };
  }
}

/**
 * Serialize a single step to XML
 */
export function stepToXML(step: StepData): string {
  if (!step.action) {
    throw new Error('Step must have an action');
  }

  // Build attribute string
  const attributes: Record<string, string> = {
    Action: step.action,
    Element: escapeXML(step.element),
    ElementCategory: step.elementCategory,
    Value: escapeXML(step.value),
    ExpectedVl: escapeXML(step.expectedValue),
    DataKey: escapeXML(step.key),
    Headers: escapeXML(step.headers),
    Description: escapeXML(step.description),
  };

  // Add optional fields if present
  if (step.isConcatenated) {
    attributes['IsConcatenated'] = 'true';
  }

  if (step.isElementPathDynamic) {
    attributes['IsElementPathDynamic'] = 'true';
  }

  if (step.elementReplaceKey) {
    attributes['ElementPathReplaceKey'] = escapeXML(step.elementReplaceKey);
  }

  if (step.stepDescription) {
    attributes['StepDescription'] = escapeXML(step.stepDescription);
  }

  // Build attribute string
  const attrString = Object.entries(attributes)
    .filter(([, value]) => value !== undefined && value !== null)
    .map(([key, value]) => `${key}="${value}"`)
    .join(' ');

  // Return self-closing tag
  return `<Action=${attrString} />`;
}

/**
 * Escape XML special characters
 */
export function escapeXML(text: string): string {
  if (!text) {
    return text;
  }

  return text
    .replace(/&/g, '&amp;')      // Must be first
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Create XML field update payload for PATCH request
 */
export function createWorkItemPatchPayload(
  steps: StepData[],
  fieldName: string = 'Microsoft.VSTS.TCM.Steps'
): { op: string; path: string; value: string } {
  const { xml, errors } = stepsToXML(steps);

  if (errors.length > 0) {
    throw new Error(`Cannot serialize steps: ${errors.join('; ')}`);
  }

  return {
    op: 'replace',
    path: `/fields/${fieldName}`,
    value: xml,
  };
}

/**
 * Build complete PATCH request body for updating test case
 */
export function buildUpdateWorkItemBody(
  steps: StepData[],
  additionalFields?: Record<string, any>
): Record<string, any> {
  const operations: any[] = [];

  // Add steps update
  try {
    operations.push(createWorkItemPatchPayload(steps));
  } catch (error) {
    throw new Error(`Cannot update steps: ${error instanceof Error ? error.message : String(error)}`);
  }

  // Add any other field updates
  if (additionalFields) {
    for (const [fieldName, value] of Object.entries(additionalFields)) {
      operations.push({
        op: 'replace',
        path: `/fields/${fieldName}`,
        value,
      });
    }
  }

  return { value: operations };
}

/**
 * Validate step data before serialization
 */
export function validateStepForSerialization(step: StepData): string[] {
  const errors: string[] = [];

  if (!step.action) {
    errors.push('Action is required');
  }

  if (!step.elementCategory) {
    errors.push('ElementCategory is required');
  }

  // Check for invalid characters that might break XML
  const fieldsToCheck = ['element', 'value', 'expectedValue', 'key', 'headers', 'description'];
  for (const field of fieldsToCheck) {
    const value = step[field as keyof StepData];
    if (typeof value === 'string' && value.includes('\x00')) {
      errors.push(`${field} contains null character`);
    }
  }

  return errors;
}

/**
 * Get estimated XML size for a step
 */
export function estimateStepXMLSize(step: StepData): number {
  const xml = stepToXML(step);
  return new Blob([xml]).size; // Size in bytes
}

/**
 * Batch serialize steps with size limits
 * Useful for large step sets (ADO has field size limits)
 */
export function batchSerializeSteps(steps: StepData[], maxSizeBytes: number = 10000): XMLSerializeResult {
  const results: XMLSerializeResult[] = [];
  let currentBatch: StepData[] = [];
  let currentSize = 0;
  const errors: string[] = [];

  for (const step of steps) {
    const stepSize = estimateStepXMLSize(step);

    if (currentSize + stepSize > maxSizeBytes && currentBatch.length > 0) {
      // Flush current batch
      const batchResult = stepsToXML(currentBatch);
      results.push(batchResult);
      currentBatch = [];
      currentSize = 0;
    }

    currentBatch.push(step);
    currentSize += stepSize;
  }

  // Flush remaining batch
  if (currentBatch.length > 0) {
    const batchResult = stepsToXML(currentBatch);
    results.push(batchResult);
  }

  // Combine all XML and errors
  const xml = results.map((r) => r.xml).join('');
  const allErrors = results.flatMap((r) => r.errors);

  if (allErrors.length > 0) {
    errors.push(...allErrors);
  }

  if (results.length > 1) {
    errors.push(`Steps split into ${results.length} batches due to size limits`);
  }

  return { xml, errors };
}

/**
 * Pretty-print XML for debugging
 */
export function prettyPrintStepXML(xml: string, indent: number = 2): string {
  return xml
    .replace(/></g, `>\n${' '.repeat(indent)}<`)
    .replace(/^/, ' '.repeat(indent));
}

/**
 * Convert steps to CSV for export
 */
export function stepsToCSV(steps: StepData[], delimiter: string = ','): string {
  const headers = [
    'Order',
    'Action',
    'Element',
    'ElementCategory',
    'Value',
    'ExpectedValue',
    'Key',
    'Headers',
    'Description',
  ];

  const rows: string[] = [];

  // Add header row
  rows.push(headers.map((h) => `"${h}"`).join(delimiter));

  // Add data rows
  steps.forEach((step, index) => {
    const row = [
      index + 1,
      step.action,
      step.element,
      step.elementCategory,
      step.value,
      step.expectedValue,
      step.key,
      step.headers,
      step.description,
    ];

    rows.push(row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(delimiter));
  });

  return rows.join('\n');
}
