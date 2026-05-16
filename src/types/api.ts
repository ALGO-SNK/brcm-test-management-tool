/**
 * Azure DevOps API Response Types
 */

export interface ADOWorkItem {
  id: number;
  rev: number;
  fields: Record<string, unknown>;
  _links: {
    self: { href: string };
    workItemUpdates: { href: string };
    workItemRevisions: { href: string };
    html: { href: string };
    workItemType: { href: string };
    fields: { href: string };
  };
}

export interface ADOTestPlan {
  id: number;
  name: string;
  project: {
    id: string;
    name: string;
  };
  rootSuite: {
    id: number;
    name: string;
  };
  owner: {
    displayName: string;
    uniqueName: string;
  } | null;
  state: 'Active' | 'Inactive';
  revision: number;
  areaPath: string;
  iteration: string;
  _links: {
    self?: { href: string };
    _self?: { href: string };
    clientUrl?: { href: string };
    rootSuite?: { href: string };
    [key: string]: { href: string } | undefined;
  };
}

export interface ADOTestSuite {
  id: number;
  name: string;
  sequenceNumber: number;
  parent?: {
    id: number;
    name: string;
  };
  children?: ADOTestSuite[];
  testCaseCount?: number;
  requirementId?: number;
  _links: {
    self?: { href: string };
    _self?: { href: string };
    testCases?: { href: string };
    childSuites?: { href: string };
    [key: string]: { href: string } | undefined;
  };
}

export interface ADOListResponse<T> {
  value: T[];
  count?: number;
}

export interface WorkspaceConnectionSettings {
  organization: string;
  projectName: string;
  patToken: string;
  apiVersion: string;
}

export interface ADOIdentity {
  displayName: string;
  uniqueName: string;
  imageUrl?: string;
  avatarUrl?: string;
}

export interface ADOTestCase {
  id: number;
  name: string;
  state: string;
  outcome?: string;
  order?: number;
  priority: number;
  testPlanName?: string;
  testSuiteName?: string;
  configurationName?: string;
  automationStatus?: string;
  assignedTo?: ADOIdentity;
  tester?: ADOIdentity;
  lastUpdatedDate: string;
  lastUpdatedBy?: ADOIdentity;
  pointBreakdown?: Array<{
    configurationName?: string;
    outcome?: string;
    /** Test point state ("notReady" | "ready" | "completed" | "inProgress" | …). */
    state?: string;
    /** Last result state from ADO ("completed" | "pending" | …). */
    lastResultState?: string;
    /** Whether the test point is currently active (run pending/in-flight). */
    isActive?: boolean;
  }>;
  fields: Record<string, unknown>;
  _links: {
    self?: { href: string };
    _self?: { href: string };
    workItem?: { href: string };
    [key: string]: { href: string } | undefined;
  };
}

export interface ADOTestCaseListItem {
  order?: number | string;
  sequenceNumber?: number | string;
  testPlan?: {
    id: number;
    name: string;
  };
  testSuite?: {
    id: number;
    name: string;
  };
  workItem?: {
    id: number;
    name?: string;
    workItemFields?: Record<string, unknown>[];
  };
  pointAssignments?: Array<{
    id: number;
    configurationName?: string;
    configurationId?: number;
    tester?: {
      displayName?: string;
      uniqueName?: string;
      imageUrl?: string;
      _links?: {
        avatar?: { href?: string };
      };
    } | null;
  }>;
  links?: {
    _self?: { href: string };
    [key: string]: { href: string } | undefined;
  };
}

export interface ADOGlobalSearchResult {
  key: string;
  kind: 'plan' | 'suite' | 'case';
  label: string;
  meta: string;
  plan: ADOTestPlan;
  suite?: ADOTestSuite;
  testCase?: ADOTestCase;
}

/**
 * Scheduler Domain Models
 */

export interface TestSuiteMapping {
  testSuiteId: number;
  testSuiteName: string;
  // ADO XML rows may omit a release definition; null when absent.
  releaseDefinitionId: number | null;
  releaseDefinitionName: string;
  assignedPerson?: string;
  tag?: string;
  priority?: number | null;
}

export interface SchedulerSuiteModel {
  planId: number;
  planName: string;
  suiteId: number;
  suiteName: string;
  testPointIds: number[];
  automatedPointIds: number[];
  releaseDefinitionId: number;
  priority?: number | null;
  tag?: string;
  isSelected: boolean;
  didRun?: boolean;
}

export interface ReleaseLogRecord {
  id?: string;
  releaseId: number;
  releaseDefinitionId?: number;
  releaseDefinitionName?: string;
  testRunId?: number | null;
  suiteId: number;
  suiteName: string;
  planId: number;
  buildNumber: string;
  buildId: number;
  configurationId: number;
  batchIndex: number;
  releaseCutoffTime: number;
  createdAt: number;
  modifiedAt: number;
  runtime?: number | null;
  passCount?: number | null;
  failCount?: number | null;
  notes: string;
}

export interface ADOTestPoint {
  id: number;
  configurationId: number;
  configurationName?: string;
  testCaseId?: number;
  outcome?: string;
  state?: string;
  lastResultState?: string;
  isActive?: boolean;
  isAutomated?: boolean;
}

export interface ADOBuildSummary {
  id: number;
  buildNumber: string;
  status: string;
  result?: string;
  sourceBranch?: string;
  sourceVersion?: string;
  queueTime: string;
  repository?: {
    id: string;
    name?: string;
    type?: string;
  };
}

export interface ADOTestConfigurationSummary {
  id: number;
  name: string;
  isDefault?: boolean;
}

export interface ADOReleaseDefinitionAvailability {
  definitionId: number;
  definitionName: string;
  isAvailable: boolean;
  environmentStatus: string;
}

// export interface ConnectionConfig {
//   organization: string;      // https://dev.azure.com/your-org
//   project: string;           // Project name
//   patToken: string;          // Personal Access Token (encrypted)
//   apiVersion: string;        // e.g., "7.1"
//   connected: boolean;
//   lastConnected?: string;    // ISO timestamp
// }

// export interface APIError {
//   message: string;
//   statusCode: number;
//   innerException?: string;
//   typeKey?: string;
// }
