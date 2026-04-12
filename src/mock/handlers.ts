import type { ADOTestPlan, ADOTestSuite, ADOTestCase, StepData } from '../types';
import { mockTestPlans, mockTestSuites, mockTestCases, getCaseById, getSuiteById, getCasesBySuite, getMockStepsForCase } from './data';
import { v4 as uuidv4 } from 'uuid';
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

// Test Suites
export async function fetchTestSuites(): Promise<ADOTestSuite[]> {
  await delay(400);
  return mockTestSuites;
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

  const stepsXml = testCase.fields?.['Microsoft.VSTS.TCM.Steps'] || '';

  if (stepsXml) {
    const parseResult = parseXMLSteps(stepsXml);
    if (parseResult.steps.length > 0) {
      return parseResult.steps;
    }
  }

  // Return mock steps if parsing fails or XML is empty
  return getMockStepsForCase();
}

// Update Operations
export async function updateTestCase(caseId: number, updates: Partial<ADOTestCase>): Promise<ADOTestCase | null> {
  await delay(500);
  const testCase = getCaseById(caseId);

  if (!testCase) {
    return null;
  }

  // In real scenario, this would call ADO API
  console.log(`[MOCK] Updated test case ${caseId}:`, updates);

  return { ...testCase, ...updates };
}

export async function saveSteps(caseId: number, steps: StepData[]): Promise<void> {
  await delay(600);

  // In real scenario, this would:
  // 1. Serialize steps to XML
  // 2. Call ADO API PATCH endpoint
  // 3. Update work item

  console.log(`[MOCK] Saved ${steps.length} steps for case ${caseId}:`, steps);
}

export async function deleteTestCase(caseId: number): Promise<void> {
  await delay(400);
  console.log(`[MOCK] Deleted test case ${caseId}`);
}

export async function deleteStep(caseId: number, stepId: string): Promise<void> {
  await delay(300);
  console.log(`[MOCK] Deleted step ${stepId} from case ${caseId}`);
}

export async function duplicateStep(caseId: number, stepId: string): Promise<StepData | null> {
  await delay(300);
  const steps = await fetchStepsForCase(caseId);
  const stepToDuplicate = steps.find(s => s.id === stepId);

  if (!stepToDuplicate) {
    return null;
  }

  const duplicated: StepData = {
    ...stepToDuplicate,
    id: uuidv4(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  console.log(`[MOCK] Duplicated step ${stepId} for case ${caseId}`);
  return duplicated;
}

// Bulk Operations
export async function bulkUpdateTestCases(updates: { caseId: number; fields: Partial<ADOTestCase> }[]): Promise<void> {
  await delay(800 + updates.length * 100);
  console.log(`[MOCK] Bulk updated ${updates.length} test cases`);
}

export async function bulkDeleteTestCases(caseIds: number[]): Promise<void> {
  await delay(600 + caseIds.length * 50);
  console.log(`[MOCK] Bulk deleted ${caseIds.length} test cases`);
}

// Export/Import
export async function exportCasesToCSV(caseIds: number[]): Promise<string> {
  await delay(500);
  const cases = mockTestCases.filter(c => caseIds.includes(c.id));

  const header = 'ID,Name,State,Priority,Assigned To\n';
  const rows = cases.map(c => `${c.id},"${c.name}",${c.state},${c.priority},"${c.assignedTo?.displayName || 'Unassigned'}"\n`).join('');

  console.log(`[MOCK] Exported ${cases.length} test cases to CSV`);
  return header + rows;
}
