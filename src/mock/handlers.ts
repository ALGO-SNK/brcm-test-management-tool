import type { ADOTestPlan, ADOTestSuite, ADOTestCase, StepData } from '../types';
import { mockTestPlans, getCaseById, getSuiteById, getCasesBySuite, getMockStepsForCase } from './data';
import { parseXMLSteps } from '../utils/xmlParser';

// Simulate API delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Test Plans
export async function fetchTestPlans(): Promise<ADOTestPlan[]> {
  await delay(500);
  return mockTestPlans;
}

export async function fetchTestPlanById(planId: number): Promise<ADOTestPlan | null> {
  await delay(300);
  return mockTestPlans.find(p => p.id === planId) || null;
}

export async function fetchTestSuiteById(suiteId: number): Promise<ADOTestSuite | null> {
  await delay(300);
  return getSuiteById(suiteId) || null;
}

// Test Cases
export async function fetchTestCases(_planId: number, suiteId: number): Promise<ADOTestCase[]> {
  await delay(500);
  return getCasesBySuite(suiteId);
}

export async function fetchTestCaseById(caseId: number): Promise<ADOTestCase | null> {
  await delay(300);
  return getCaseById(caseId) || null;
}

// Steps
export async function fetchStepsForCase(caseId: number): Promise<StepData[]> {
  await delay(400);
  const testCase = getCaseById(caseId);

  if (!testCase) {
    return [];
  }

  const rawStepsXml = testCase.fields?.['Microsoft.VSTS.TCM.Steps'];
  const stepsXml = typeof rawStepsXml === 'string' ? rawStepsXml : '';

  if (stepsXml) {
    const parseResult = parseXMLSteps(stepsXml);
    if (parseResult.steps.length > 0) {
      return parseResult.steps;
    }
  }

  // Return mock steps if parsing fails or XML is empty
  return getMockStepsForCase();
}

export async function saveSteps(caseId: number, steps: StepData[]): Promise<void> {
  await delay(600);

  // In real scenario, this would:
  // 1. Serialize steps to XML
  // 2. Call ADO API PATCH endpoint
  // 3. Update work item

  console.log(`[MOCK] Saved ${steps.length} steps for case ${caseId}:`, steps);
}
