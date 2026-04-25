/**
 * Test Case Data Builder
 * Shared logic for building test case request data for both create and update operations
 */

import { serializeStepsToXML } from './xmlParser';
import type { ParsedStep } from '../components/TestCases/StepsEditor';
import { getActionDefinition } from './actionRegistry';

export interface TestCaseDataRequest {
  title?: string;
  description?: string;
  status?: string;
  method?: string;
  region?: string;
  execProcess?: string;
  pltpProcess?: string;
  initialSteps?: string;
  stepsXml?: string;
}

export interface TestCaseFormData {
  title?: string;
  description?: string;
  status?: string;
  method?: string;
  region?: string;
  execProcess?: string;
  pltpProcess?: string;
  initialSteps?: string;
}

function sanitizeStepForPersistence(step: ParsedStep): ParsedStep {
  const actionDef = getActionDefinition(step.action);
  const contract = actionDef?.contract;

  if (!contract) {
    return step;
  }

  const allowsDynamicLocator = (
    contract.locator === 'required'
    && contract.locatorType === 'required'
    && contract.isElementPathDynamic !== 'not-used'
  );

  return {
    ...step,
    element: contract.locator === 'not-used' ? '' : step.element,
    elementCategory: contract.locatorType === 'not-used' ? '' : step.elementCategory,
    value: contract.value === 'not-used' ? '' : step.value,
    expectedValue: contract.expectedVl === 'not-used' ? '' : step.expectedValue,
    key: contract.dataKey === 'not-used' ? '' : step.key,
    headers: contract.headers === 'not-used' ? '' : step.headers,
    elementReplaceTextDataKey: contract.elementPathReplaceKey === 'not-used' ? '' : step.elementReplaceTextDataKey,
    isElementPathDynamic: allowsDynamicLocator ? step.isElementPathDynamic : false,
    isConcatenated: contract.isConcatenated === 'not-used' ? false : step.isConcatenated,
  };
}

/**
 * Build test case data for API requests (create or update)
 * Reuses the same format for both operations
 *
 * @param formData - Form field values
 * @param steps - Array of parsed steps to serialize
 * @returns Test case data object ready for API
 */
export function buildTestCaseData(
  formData: TestCaseFormData,
  steps: ParsedStep[],
): TestCaseDataRequest {
  const sanitizedSteps = steps.map(sanitizeStepForPersistence);
  const stepsXml = sanitizedSteps.length > 0 ? serializeStepsToXML(sanitizedSteps) : '';

  return {
    title: formData.title,
    description: formData.description,
    status: formData.status,
    method: formData.method,
    region: formData.region,
    execProcess: formData.execProcess,
    pltpProcess: formData.pltpProcess,
    initialSteps: formData.initialSteps,
    stepsXml,
  };
}
