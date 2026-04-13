import type { ADOTestPlan, ADOTestSuite, ADOTestCase, StepData } from '../types';
import { v4 as uuidv4 } from 'uuid';

// Mock Test Plans (based on ADO API samples)
export const mockTestPlans = [
  {
    id: 78806,
    name: 'BromCom TestPlan',
    project: { id: 'c158bd72-b3a7-4b06-937f-768ab2143f6b', name: 'Automated Testing Framework' },
    state: 'Active',
    owner: null,
    rootSuite: { id: 78807, name: 'BromCom TestPlan' },
    revision: 0,
    areaPath: 'Automated Testing Framework',
    iteration: 'Automated Testing Framework',
    _links: { self: { href: '' }, clientUrl: { href: '' }, rootSuite: { href: '' } },
  },
  {
    id: 139145,
    name: 'WorldPay TestPlan',
    project: { id: 'c158bd72-b3a7-4b06-937f-768ab2143f6b', name: 'Automated Testing Framework' },
    state: 'Active',
    owner: { displayName: 'QA Team', uniqueName: 'qa@company.com' },
    rootSuite: { id: 139146, name: 'WorldPay TestPlan' },
    revision: 0,
    areaPath: 'Automated Testing Framework',
    iteration: 'Automated Testing Framework',
    _links: { self: { href: '' }, clientUrl: { href: '' }, rootSuite: { href: '' } },
  },
  {
    id: 256832,
    name: 'Automation PLTP',
    project: { id: 'c158bd72-b3a7-4b06-937f-768ab2143f6b', name: 'Automated Testing Framework' },
    state: 'Active',
    owner: { displayName: 'John Doe', uniqueName: 'john@company.com' },
    rootSuite: { id: 256833, name: 'Automation_PLTP' },
    revision: 0,
    areaPath: 'Automated Testing Framework',
    iteration: 'Automated Testing Framework',
    _links: { self: { href: '' }, clientUrl: { href: '' }, rootSuite: { href: '' } },
  },
  {
    id: 310000,
    name: 'Integration Test Plan',
    project: { id: 'c158bd72-b3a7-4b06-937f-768ab2143f6b', name: 'Automated Testing Framework' },
    state: 'Active',
    owner: { displayName: 'Jane Smith', uniqueName: 'jane@company.com' },
    rootSuite: { id: 310001, name: 'Integration Tests' },
    revision: 0,
    areaPath: 'Automated Testing Framework',
    iteration: 'Automated Testing Framework',
    _links: { self: { href: '' }, clientUrl: { href: '' }, rootSuite: { href: '' } },
  },
] as ADOTestPlan[];

// Mock Test Suites
export const mockTestSuites = [
  {
    id: 101,
    name: 'Login Tests',
    sequenceNumber: 1,
    parent: { id: 1, name: 'BromCom User Authentication' },
    children: [],
    testCaseCount: 5,
    _links: { self: { href: '' }, testCases: { href: '' }, childSuites: { href: '' } },
  },
  {
    id: 102,
    name: 'Dashboard Navigation',
    sequenceNumber: 1,
    parent: { id: 2, name: 'Student Dashboard Flows' },
    children: [],
    testCaseCount: 3,
    _links: { self: { href: '' }, testCases: { href: '' }, childSuites: { href: '' } },
  },
  {
    id: 103,
    name: 'Payment Methods',
    sequenceNumber: 1,
    parent: { id: 3, name: 'Payment Processing Tests' },
    children: [],
    testCaseCount: 4,
    _links: { self: { href: '' }, testCases: { href: '' }, childSuites: { href: '' } },
  },
] as ADOTestSuite[];

// Mock Steps for Test Cases
const mockSteps: StepData[] = [
  {
    id: uuidv4(),
    action: 'NAVIGATE',
    element: '',
    elementCategory: 'URL',
    value: 'https://localhost:3000',
    expectedValue: '',
    key: '',
    headers: '',
    description: 'Navigate to application',
    stepDescription: 'Navigate to application',
    isConcatenated: false,
    isElementPathDynamic: false,
    elementReplaceTextDataKey: '',
    extraFields: {},
    order: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: uuidv4(),
    action: 'ENTER_TEXT',
    element: '//input[@id="email"]',
    elementCategory: 'XPATH',
    value: 'user@test.com',
    expectedValue: '',
    key: '',
    headers: '',
    description: 'Enter email address',
    stepDescription: 'Enter email address',
    isConcatenated: false,
    isElementPathDynamic: false,
    elementReplaceTextDataKey: '',
    extraFields: {},
    order: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: uuidv4(),
    action: 'ENTER_TEXT',
    element: '//input[@id="password"]',
    elementCategory: 'XPATH',
    value: 'password123',
    expectedValue: '',
    key: '',
    headers: '',
    description: 'Enter password',
    stepDescription: 'Enter password',
    isConcatenated: false,
    isElementPathDynamic: false,
    elementReplaceTextDataKey: '',
    extraFields: {},
    order: 2,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: uuidv4(),
    action: 'CLICK',
    element: '//button[@type="submit"]',
    elementCategory: 'XPATH',
    value: '',
    expectedValue: '',
    key: '',
    headers: '',
    description: 'Click login button',
    stepDescription: 'Click login button',
    isConcatenated: false,
    isElementPathDynamic: false,
    elementReplaceTextDataKey: '',
    extraFields: {},
    order: 3,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: uuidv4(),
    action: 'VERIFY_TEXT',
    element: '//h1',
    elementCategory: 'XPATH',
    value: 'Welcome',
    expectedValue: 'Welcome',
    key: '',
    headers: '',
    description: 'Verify welcome message',
    stepDescription: 'Verify welcome message',
    isConcatenated: false,
    isElementPathDynamic: false,
    elementReplaceTextDataKey: '',
    extraFields: {},
    order: 4,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

// Mock Test Cases
export const mockTestCases = [
  {
    id: 12345,
    name: 'Login with valid email and password',
    state: 'Active',
    priority: 1,
    assignedTo: { displayName: 'John Doe', uniqueName: 'john@company.com' },
    lastUpdatedDate: new Date().toISOString(),
    fields: {
      'System.Title': 'Login with valid email and password',
      'Microsoft.VSTS.TCM.Steps': '<steps id="0"><step id="2"><parameterizedString>&lt;DIV&gt;&lt;P&gt;Action=NAVIGATE|Value=https://localhost:3000|&lt;/P&gt;&lt;/DIV&gt;</parameterizedString></step></steps>',
    },
    _links: { self: { href: '' } },
  },
  {
    id: 12346,
    name: 'Login with invalid email',
    state: 'Active',
    priority: 2,
    assignedTo: { displayName: 'Jane Smith', uniqueName: 'jane@company.com' },
    lastUpdatedDate: new Date().toISOString(),
    fields: {
      'System.Title': 'Login with invalid email',
      'Microsoft.VSTS.TCM.Steps': '<steps id="0"><step id="3"><parameterizedString>&lt;DIV&gt;&lt;P&gt;Action=NAVIGATE|Value=https://localhost:3000|&lt;/P&gt;&lt;/DIV&gt;</parameterizedString></step></steps>',
    },
    _links: { self: { href: '' } },
  },
  {
    id: 12347,
    name: 'View student courses',
    state: 'Active',
    priority: 1,
    assignedTo: { displayName: 'John Doe', uniqueName: 'john@company.com' },
    lastUpdatedDate: new Date().toISOString(),
    fields: {
      'System.Title': 'View student courses',
      'Microsoft.VSTS.TCM.Steps': '<steps id="0"><step id="4"><parameterizedString>&lt;DIV&gt;&lt;P&gt;Action=NAVIGATE|Value=https://localhost:3000/dashboard|&lt;/P&gt;&lt;/DIV&gt;</parameterizedString></step></steps>',
    },
    _links: { self: { href: '' } },
  },
  {
    id: 12348,
    name: 'Update course enrollment',
    state: 'Active',
    priority: 2,
    assignedTo: null,
    lastUpdatedDate: new Date().toISOString(),
    fields: {
      'System.Title': 'Update course enrollment',
      'Microsoft.VSTS.TCM.Steps': '<steps id="0"><step id="5"><parameterizedString>&lt;DIV&gt;&lt;P&gt;Action=CLICK|Element=//button[@id="enroll"]|ElementCategory=XPATH|&lt;/P&gt;&lt;/DIV&gt;</parameterizedString></step></steps>',
    },
    _links: { self: { href: '' } },
  },
] as ADOTestCase[];

// Helper to get cases by suite
export function getCasesBySuite(suiteId: number): ADOTestCase[] {
  // Map suite IDs to approximate case ranges for demo
  const caseMapping: { [key: number]: ADOTestCase[] } = {
    101: mockTestCases.slice(0, 2), // Login Tests
    102: mockTestCases.slice(2, 4), // Dashboard Tests
    103: mockTestCases.slice(3, 4), // Payment Tests
  };
  return caseMapping[suiteId] || [];
}

// Helper to get suite by ID
export function getSuiteById(suiteId: number): ADOTestSuite | undefined {
  return mockTestSuites.find(s => s.id === suiteId);
}

// Helper to get case by ID
export function getCaseById(caseId: number): ADOTestCase | undefined {
  return mockTestCases.find(c => c.id === caseId);
}

// Helper to get default mock steps for a case
export function getMockStepsForCase(): StepData[] {
  return mockSteps.map((step, idx) => ({
    ...step,
    id: uuidv4(),
    order: idx,
  }));
}
