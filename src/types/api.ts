/**
 * Azure DevOps API Response Types
 */

export interface ADOWorkItem {
  id: number;
  rev: number;
  fields: Record<string, any>;
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
    self: { href: string };
    clientUrl: { href: string };
    rootSuite: { href: string };
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
    self: { href: string };
    testCases: { href: string };
    childSuites: { href: string };
  };
}

export interface ADOTestCase {
  id: number;
  name: string;
  state: 'Active' | 'Design' | 'Ready' | 'Inactive';
  priority: 1 | 2 | 3 | 4;
  assignedTo?: {
    displayName: string;
    uniqueName: string;
  };
  lastUpdatedDate: string;
  lastUpdatedBy?: {
    displayName: string;
    uniqueName: string;
  };
  fields: Record<string, any>;
  _links: {
    self: { href: string };
  };
}

export interface ConnectionConfig {
  organization: string;      // https://dev.azure.com/your-org
  project: string;           // Project name
  patToken: string;          // Personal Access Token (encrypted)
  apiVersion: string;        // e.g., "7.1"
  connected: boolean;
  lastConnected?: string;    // ISO timestamp
}

export interface APIError {
  message: string;
  statusCode: number;
  innerException?: string;
  typeKey?: string;
}
