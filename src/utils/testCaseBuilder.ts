/**
 * Test Case Data Builder
 * Shared logic for building test case request data for both create and update operations
 */

import { serializeStepsToXML } from './xmlParser';
import type { ParsedStep } from '../components/TestCases/StepsEditor';

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
  const stepsXml = steps.length > 0 ? serializeStepsToXML(steps) : '';

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
