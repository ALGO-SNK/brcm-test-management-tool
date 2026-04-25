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
  fields: Record<string, unknown>;
  _links: {
    self?: { href: string };
    _self?: { href: string };
    workItem?: { href: string };
    [key: string]: { href: string } | undefined;
  };
}

export interface ADOTestCaseListItem {
  order?: number;
  sequenceNumber?: number;
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
