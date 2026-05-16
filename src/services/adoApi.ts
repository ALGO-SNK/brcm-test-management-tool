import type {
  ADOListResponse,
  ADOTestCase,
  ADOTestCaseListItem,
  ADOTestPlan,
  ADOTestSuite,
  ADOWorkItem,
  WorkspaceConnectionSettings,
} from '../types';

interface CacheEnvelope<T> {
  data: T;
  updatedAt: number;
}

export interface CachedResource<T> {
  data: T;
  updatedAt: number;
  fresh: boolean;
}

const CACHE_STORAGE_PREFIX = 'ado-cache:v1';
const CACHE_FRESH_MS = 120_000;
const CACHE_MAX_AGE_MS = 86_400_000;
const inMemoryCache = new Map<string, CacheEnvelope<unknown>>();

class ADORequestError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ADORequestError';
    this.status = status;
  }
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

function extractAdoErrorText(body: string): string {
  const trimmed = body.trim();
  if (!trimmed) return '';

  try {
    const parsed = JSON.parse(trimmed) as {
      message?: unknown;
      error?: { message?: unknown };
    };
    if (typeof parsed.message === 'string') {
      return parsed.message.trim();
    }
    if (typeof parsed.error?.message === 'string') {
      return parsed.error.message.trim();
    }
  } catch {
    // Fall back to plain text.
  }

  return trimmed;
}

function buildAdoErrorMessage(action: string, status: number, body: string): string {
  const details = extractAdoErrorText(body).toLowerCase();

  if (status === 400) {
    if (details.includes('api-version')) {
      return `We couldn't ${action}. Check the Azure DevOps API version in Workspace Settings and try again.`;
    }
    return `We couldn't ${action} because Azure DevOps rejected the request. Please check the selected item and try again.`;
  }

  if (status === 401 || status === 403) {
    return `We couldn't ${action}. Check your Azure DevOps PAT token and permissions, then try again.`;
  }

  if (status === 404) {
    return `We couldn't ${action} because the item could not be found in Azure DevOps.`;
  }

  if (status === 408 || status === 429) {
    return `We couldn't ${action} right now because Azure DevOps is busy. Please try again in a moment.`;
  }

  if (status >= 500) {
    return `We couldn't ${action} because Azure DevOps had a temporary problem. Please try again in a moment.`;
  }

  return `We couldn't ${action}. Please try again.`;
}

function humanizeUnexpectedError(action: string, error: unknown): Error {
  if (isAbortError(error)) {
    return error as Error;
  }

  if (error instanceof Error) {
    const message = error.message.trim();
    if (message === 'No fields to update') {
      return new Error('There are no changes to save.');
    }
    if (
      message.startsWith("We couldn't")
      || message.startsWith('There are no changes')
      || message.includes('required')
    ) {
      return new Error(message);
    }
  }

  return new Error(`We couldn't ${action}. Please try again.`);
}

function getStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function normalizeOrganization(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return '';

  try {
    const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    const parsed = new URL(withProtocol);
    const host = parsed.hostname.toLowerCase();
    const pathSegments = parsed.pathname.split('/').filter(Boolean);

    if (host === 'dev.azure.com') {
      return pathSegments[0] ?? '';
    }

    const visualStudioMatch = host.match(/^([^.]+)\.visualstudio\.com$/i);
    if (visualStudioMatch?.[1]) {
      return visualStudioMatch[1];
    }
  } catch {
    // Fall through to string normalization.
  }

  const withoutProtocol = trimmed.replace(/^https?:\/\//i, '').replace(/^\/+|\/+$/g, '');
  const withoutKnownHosts = withoutProtocol
    .replace(/^dev\.azure\.com\//i, '')
    .replace(/^([^.]+)\.visualstudio\.com(?:\/|$)/i, '$1/');
  const firstSegment = withoutKnownHosts.split('/').filter(Boolean)[0] ?? '';
  return firstSegment.replace(/\.visualstudio\.com$/i, '');
}

function normalizeProjectName(input: string): string {
  return input.trim();
}

function normalizeApiVersion(input: string): string {
  const version = input.trim();
  return version || '7.1';
}

function getApiVersionCandidates(input: string): string[] {
  // Use only the configured API version, no fallback attempts
  // User should configure the correct version in workspace settings
  return [normalizeApiVersion(input)];
}

function buildWorkspaceCacheScope(settings: WorkspaceConnectionSettings): string {
  const organization = normalizeOrganization(settings.organization).toLowerCase();
  const project = normalizeProjectName(settings.projectName).toLowerCase();
  const apiVersion = normalizeApiVersion(settings.apiVersion).toLowerCase();
  return `${organization}::${project}::${apiVersion}`;
}

function canBuildCacheScope(settings: WorkspaceConnectionSettings): boolean {
  return Boolean(normalizeOrganization(settings.organization) && normalizeProjectName(settings.projectName));
}

function getPlansCacheKey(settings: WorkspaceConnectionSettings): string {
  return `${buildWorkspaceCacheScope(settings)}::plans`;
}

function getSuitesCacheKey(settings: WorkspaceConnectionSettings, planId: number): string {
  return `${buildWorkspaceCacheScope(settings)}::suites::${planId}`;
}

function getTestCasesCacheKey(
  settings: WorkspaceConnectionSettings,
  planId: number,
  suiteId: number,
): string {
  return `${buildWorkspaceCacheScope(settings)}::testcases::${planId}::${suiteId}`;
}

function getTestCaseDetailCacheKey(settings: WorkspaceConnectionSettings, caseId: number): string {
  return `${buildWorkspaceCacheScope(settings)}::testcase::${caseId}`;
}

function getStorageKey(cacheKey: string): string {
  return `${CACHE_STORAGE_PREFIX}:${cacheKey}`;
}

function parseCacheEnvelope<T>(raw: string | null): CacheEnvelope<T> | null {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as CacheEnvelope<T>;
    if (
      typeof parsed !== 'object'
      || parsed === null
      || !('data' in parsed)
      || typeof parsed.updatedAt !== 'number'
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function clearCacheEntry(cacheKey: string): void {
  inMemoryCache.delete(cacheKey);
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.removeItem(getStorageKey(cacheKey));
  } catch {
    // Ignore storage restrictions.
  }
}

function readCacheEntry<T>(cacheKey: string): CacheEnvelope<T> | null {
  const memoryEntry = inMemoryCache.get(cacheKey) as CacheEnvelope<T> | undefined;
  if (memoryEntry) {
    const age = Date.now() - memoryEntry.updatedAt;
    if (age <= CACHE_MAX_AGE_MS) return memoryEntry;
    clearCacheEntry(cacheKey);
    return null;
  }

  const storage = getStorage();
  if (!storage) return null;

  let storageRaw: string | null = null;
  try {
    storageRaw = storage.getItem(getStorageKey(cacheKey));
  } catch {
    return null;
  }
  const storageEntry = parseCacheEnvelope<T>(storageRaw);
  if (!storageEntry) return null;

  const age = Date.now() - storageEntry.updatedAt;
  if (age > CACHE_MAX_AGE_MS) {
    clearCacheEntry(cacheKey);
    return null;
  }

  inMemoryCache.set(cacheKey, storageEntry as CacheEnvelope<unknown>);
  return storageEntry;
}

function writeCacheEntry<T>(cacheKey: string, data: T): void {
  const entry: CacheEnvelope<T> = {
    data,
    updatedAt: Date.now(),
  };
  inMemoryCache.set(cacheKey, entry as CacheEnvelope<unknown>);

  const storage = getStorage();
  if (!storage) return;
  try {
    storage.setItem(getStorageKey(cacheKey), JSON.stringify(entry));
  } catch {
    // Ignore storage quota issues.
  }
}

function toCachedResource<T>(entry: CacheEnvelope<T>): CachedResource<T> {
  return {
    data: entry.data,
    updatedAt: entry.updatedAt,
    fresh: Date.now() - entry.updatedAt <= CACHE_FRESH_MS,
  };
}

function toBasicAuthToken(patToken: string): string {
  return btoa(`:${patToken}`);
}

function assertSettings(settings: WorkspaceConnectionSettings): void {
  if (!normalizeOrganization(settings.organization)) {
    throw new Error('Organization is required in Workspace settings.');
  }
  if (!normalizeProjectName(settings.projectName)) {
    throw new Error('Project is required in Workspace settings.');
  }
  if (!settings.patToken.trim()) {
    throw new Error('PAT token is required in Workspace settings.');
  }
}

function buildPrimaryBaseApiUrl(settings: WorkspaceConnectionSettings): string {
  const organization = normalizeOrganization(settings.organization);
  const project = encodeURIComponent(normalizeProjectName(settings.projectName));
  return `https://${organization}.visualstudio.com/${project}/_apis`;
}

function buildFallbackBaseApiUrl(settings: WorkspaceConnectionSettings): string {
  const organization = normalizeOrganization(settings.organization);
  const project = encodeURIComponent(normalizeProjectName(settings.projectName));
  return `https://dev.azure.com/${organization}/${project}/_apis`;
}

function buildBaseApiUrls(settings: WorkspaceConnectionSettings): string[] {
  return Array.from(new Set([
    buildPrimaryBaseApiUrl(settings),
    buildFallbackBaseApiUrl(settings),
  ]));
}

function buildBaseWebUrl(settings: WorkspaceConnectionSettings): string {
  const organization = normalizeOrganization(settings.organization);
  const project = encodeURIComponent(normalizeProjectName(settings.projectName));
  return `https://dev.azure.com/${organization}/${project}`;
}

function getUrlCandidates(settings: WorkspaceConnectionSettings): string[] {
  return buildBaseApiUrls(settings).map((url) => url.replace('/_apis', ''));
}

export function buildPlanAdoUrl(settings: WorkspaceConnectionSettings, planId: number): string {
  return `${buildBaseWebUrl(settings)}/_testPlans/define?planId=${encodeURIComponent(String(planId))}`;
}

export function buildSuiteAdoUrl(
  settings: WorkspaceConnectionSettings,
  planId: number,
  suiteId: number,
): string {
  return `${buildPlanAdoUrl(settings, planId)}&suiteId=${encodeURIComponent(String(suiteId))}`;
}

export function buildWorkItemAdoUrl(settings: WorkspaceConnectionSettings, workItemId: number): string {
  return `${buildBaseWebUrl(settings)}/_workitems/edit/${encodeURIComponent(String(workItemId))}`;
}

async function fetchJsonWithAction<T>(
  url: string,
  patToken: string,
  action: string,
  signal?: AbortSignal,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Basic ${toBasicAuthToken(patToken)}`,
      },
      signal,
    });
  } catch (error) {
    if (isAbortError(error)) {
      throw error;
    }
    throw new Error(`We couldn't ${action}. Check your connection and Azure DevOps settings, then try again.`);
  }

  if (!response.ok) {
    const body = await response.text();
    throw new ADORequestError(response.status, buildAdoErrorMessage(action, response.status, body));
  }

  return (await response.json()) as T;
}

async function patchJson<T>(
  url: string,
  patToken: string,
  operations: Array<{ op: string; path: string; value?: unknown }>,
  action = 'save your changes',
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json-patch+json',
        Accept: 'application/json',
        Authorization: `Basic ${toBasicAuthToken(patToken)}`,
      },
      body: JSON.stringify(operations),
    });
  } catch (error) {
    if (isAbortError(error)) {
      throw error;
    }
    throw new Error(`We couldn't ${action}. Check your connection and Azure DevOps settings, then try again.`);
  }

  if (!response.ok) {
    const body = await response.text();
    throw new ADORequestError(response.status, buildAdoErrorMessage(action, response.status, body));
  }

  return (await response.json()) as T;
}

async function deleteRequest(url: string, patToken: string, action = 'remove the item'): Promise<void> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: 'DELETE',
      headers: {
        Accept: 'application/json',
        Authorization: `Basic ${toBasicAuthToken(patToken)}`,
      },
    });
  } catch (error) {
    if (isAbortError(error)) {
      throw error;
    }
    throw new Error(`We couldn't ${action}. Check your connection and Azure DevOps settings, then try again.`);
  }

  if (!response.ok) {
    const body = await response.text();
    throw new ADORequestError(response.status, buildAdoErrorMessage(action, response.status, body));
  }
}

function getPlanSelfHref(plan: ADOTestPlan): string | null {
  return plan._links?._self?.href ?? plan._links?.self?.href ?? null;
}

function buildSuitesUrlFromSelf(selfHref: string, apiVersion: string): string {
  const baseSelf = selfHref.split('?')[0].replace(/\/+$/g, '');
  return `${baseSelf}/suites?asTreeView=True&api-version=${encodeURIComponent(apiVersion)}`;
}

function withApiVersion(url: string, apiVersion: string): string {
  if (url.includes('api-version=')) return url;
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}api-version=${encodeURIComponent(apiVersion)}`;
}

function normalizeSuiteSelfHref(selfHref: string): string {
  return selfHref.split('?')[0].replace(/\/+$/g, '');
}

function deriveTestCaseUrlFromSuiteSelf(selfHref: string, apiVersion: string, plural: boolean): string {
  const base = normalizeSuiteSelfHref(selfHref);
  const endpoint = plural ? 'TestCases' : 'TestCase';
  return `${base}/${endpoint}?api-version=${encodeURIComponent(apiVersion)}`;
}

function deriveTestPointsUrlFromSuiteSelf(selfHref: string, apiVersion: string): string {
  const base = normalizeSuiteSelfHref(selfHref);
  return `${base}/points?api-version=${encodeURIComponent(apiVersion)}`;
}

function normalizeWorkItemHref(href: string, workItemId: number): string | null {
  const trimmed = href.trim();
  if (!trimmed) return null;

  const withoutQuery = trimmed.split('?')[0];
  const witMatch = withoutQuery.match(/(.*\/_apis\/wit\/workitems\/)(\d+)$/i);
  if (witMatch?.[1]) {
    return `${witMatch[1]}${encodeURIComponent(String(workItemId))}`;
  }

  try {
    const parsed = new URL(trimmed);
    const apisIndex = parsed.pathname.toLowerCase().indexOf('/_apis/');
    if (apisIndex === -1) return null;

    const basePath = parsed.pathname.slice(0, apisIndex);
    return `${parsed.origin}${basePath}/_apis/wit/workitems/${encodeURIComponent(String(workItemId))}`;
  } catch {
    return null;
  }
}

function flattenWorkItemFields(workItemFields: Record<string, unknown>[] | undefined): Record<string, unknown> {
  const flattened: Record<string, unknown> = {};
  for (const fieldEntry of workItemFields ?? []) {
    for (const [key, value] of Object.entries(fieldEntry)) {
      flattened[key] = value;
    }
  }
  return flattened;
}

function toIdentity(value: unknown): {
  displayName: string;
  uniqueName: string;
  imageUrl?: string;
  avatarUrl?: string;
} | undefined {
  if (!value) return undefined;

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    const match = trimmed.match(/^(.*?)(?:\s*<([^>]+)>)?$/);
    if (!match) return { displayName: trimmed, uniqueName: trimmed };
    const displayName = (match[1] || trimmed).trim();
    const uniqueName = (match[2] || displayName).trim();
    return { displayName, uniqueName };
  }

  if (typeof value === 'object') {
    const maybeIdentity = value as {
      displayName?: unknown;
      uniqueName?: unknown;
      imageUrl?: unknown;
      _links?: unknown;
    };
    const displayName = typeof maybeIdentity.displayName === 'string'
      ? maybeIdentity.displayName.trim()
      : '';
    const uniqueName = typeof maybeIdentity.uniqueName === 'string'
      ? maybeIdentity.uniqueName.trim()
      : displayName;
    const imageUrl = typeof maybeIdentity.imageUrl === 'string'
      ? maybeIdentity.imageUrl.trim()
      : '';
    const links = typeof maybeIdentity._links === 'object' && maybeIdentity._links !== null
      ? maybeIdentity._links as { avatar?: { href?: unknown } }
      : undefined;
    const avatarUrl = typeof links?.avatar?.href === 'string'
      ? links.avatar.href.trim()
      : '';
    if (!displayName && !uniqueName) return undefined;
    return {
      displayName: displayName || uniqueName,
      uniqueName: uniqueName || displayName,
      imageUrl: imageUrl || undefined,
      avatarUrl: avatarUrl || undefined,
    };
  }

  return undefined;
}

function normalizePriority(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 2;
  const rounded = Math.round(parsed);
  if (rounded < 1) return 1;
  if (rounded > 4) return 4;
  return rounded;
}

function normalizeOptionalNumber(value: unknown): number | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function normalizeFieldText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  return '';
}

interface ADOTestPointListItem {
  outcome?: unknown;
  state?: unknown;
  lastResultState?: unknown;
  isActive?: unknown;
  configuration?: {
    name?: unknown;
  };
  testCase?: {
    id?: unknown;
  };
}

interface CasePointSummary {
  configurationName?: string;
  outcome?: string;
  pointBreakdown?: Array<{
    configurationName?: string;
    outcome?: string;
    state?: string;
    lastResultState?: string;
    isActive?: boolean;
  }>;
}

function buildJoinedDistinctValues(values: string[]): string | undefined {
  const uniqueValues = Array.from(
    new Set(values.map((value) => value.trim()).filter(Boolean)),
  );
  if (uniqueValues.length === 0) return undefined;
  return uniqueValues.join(', ');
}

function mapPointSummaryByCaseId(response: ADOListResponse<ADOTestPointListItem>): Map<number, CasePointSummary> {
  const grouped = new Map<number, {
    configurations: string[];
    outcomes: string[];
    pointRows: Array<{ configurationName?: string; outcome?: string; state?: string; lastResultState?: string; isActive?: boolean }>;
    seenPointRows: Set<string>;
  }>();

  for (const point of response.value ?? []) {
    const numericCaseId = Number(point?.testCase?.id);
    if (!Number.isInteger(numericCaseId) || numericCaseId <= 0) continue;

    const current = grouped.get(numericCaseId) ?? {
      configurations: [],
      outcomes: [],
      pointRows: [],
      seenPointRows: new Set<string>(),
    };
    const configurationName = normalizeFieldText(point?.configuration?.name).trim();
    if (configurationName) current.configurations.push(configurationName);

    const outcome = normalizeFieldText(point?.outcome).trim();
    if (outcome) current.outcomes.push(outcome);

    const state = normalizeFieldText(point?.state).trim() || undefined;
    const lastResultState = normalizeFieldText(point?.lastResultState).trim() || undefined;
    const isActive = typeof point?.isActive === 'boolean' ? point.isActive : undefined;

    const normalizedConfiguration = configurationName || undefined;
    const normalizedOutcome = outcome || undefined;
    // Include state info in the dedupe key so we don't collapse different point states
    // (e.g. one config completed, another in progress) into a single row.
    const pointRowKey = `${normalizedConfiguration ?? ''}::${normalizedOutcome ?? ''}::${state ?? ''}::${lastResultState ?? ''}::${isActive ?? ''}`;
    if (!current.seenPointRows.has(pointRowKey)) {
      current.seenPointRows.add(pointRowKey);
      current.pointRows.push({
        configurationName: normalizedConfiguration,
        outcome: normalizedOutcome,
        state,
        lastResultState,
        isActive,
      });
    }

    grouped.set(numericCaseId, current);
  }

  const mapped = new Map<number, CasePointSummary>();
  for (const [caseId, value] of grouped.entries()) {
    mapped.set(caseId, {
      configurationName: buildJoinedDistinctValues(value.configurations),
      outcome: buildJoinedDistinctValues(value.outcomes),
      pointBreakdown: value.pointRows.length > 0 ? value.pointRows : undefined,
    });
  }
  return mapped;
}

async function fetchPointSummaryByCaseId(
  settings: WorkspaceConnectionSettings,
  planId: number,
  suiteId: number,
  suiteSelfHref: string | undefined,
  signal?: AbortSignal,
): Promise<Map<number, CasePointSummary>> {
  const apiVersions = getApiVersionCandidates(settings.apiVersion);
  const encodedPlanId = encodeURIComponent(String(planId));
  const encodedSuiteId = encodeURIComponent(String(suiteId));
  const baseApis = buildBaseApiUrls(settings);
  const candidateUrls: string[] = [];

  for (const apiVersion of apiVersions) {
    const encodedApiVersion = encodeURIComponent(apiVersion);
    candidateUrls.push(
      ...baseApis.map(
        (baseApi) => `${baseApi}/test/Plans/${encodedPlanId}/Suites/${encodedSuiteId}/points?api-version=${encodedApiVersion}`,
      ),
    );

    if (suiteSelfHref) {
      candidateUrls.push(deriveTestPointsUrlFromSuiteSelf(suiteSelfHref, apiVersion));
    }
  }

  for (const url of Array.from(new Set(candidateUrls))) {
    try {
      const response = await fetchJsonWithAction<ADOListResponse<ADOTestPointListItem>>(
        url,
        settings.patToken.trim(),
        'load test points',
        signal,
      );
      return mapPointSummaryByCaseId(response);
    } catch (error) {
      if (isAbortError(error)) {
        throw error;
      }
      if (error instanceof ADORequestError && error.status === 404) {
        continue;
      }
      return new Map();
    }
  }

  return new Map();
}

function mapTestCaseListItemToCase(
  item: unknown,
  fallbackSelfHref: string,
): ADOTestCase | null {
  if (!item || typeof item !== 'object') return null;
  const normalizedItem = item as ADOTestCaseListItem & {
    id?: number;
    name?: string;
    state?: string;
  };

  const workItemId = typeof normalizedItem.workItem?.id === 'number'
    ? normalizedItem.workItem.id
    : typeof normalizedItem.id === 'number'
      ? normalizedItem.id
      : null;
  if (workItemId === null) return null;

  const fields = flattenWorkItemFields(normalizedItem.workItem?.workItemFields);
  const state = String(fields['System.State'] ?? normalizedItem.state ?? 'Design');
  const stateChangeDate = fields['Microsoft.VSTS.Common.StateChangeDate'];
  const activatedDate = fields['Microsoft.VSTS.Common.ActivatedDate'];
  const lastUpdatedDate = typeof stateChangeDate === 'string'
    ? stateChangeDate
    : typeof activatedDate === 'string'
      ? activatedDate
      : new Date().toISOString();

  const assignedTo = toIdentity(fields['System.AssignedTo']);
  const lastUpdatedBy = toIdentity(fields['System.ChangedBy'] ?? fields['Microsoft.VSTS.Common.ActivatedBy']);
  const pointAssignment = normalizedItem.pointAssignments?.[0];
  const tester = toIdentity(pointAssignment?.tester ?? undefined);
  const order = normalizeOptionalNumber(normalizedItem.order)
    ?? normalizeOptionalNumber(normalizedItem.sequenceNumber);

  const selfHref = normalizedItem.links?._self?.href ?? fallbackSelfHref;
  const workItemHref = normalizedItem.links?.workItem?.href;
  return {
    id: workItemId,
    name: normalizedItem.workItem?.name?.trim() || normalizeFieldText(normalizedItem.name).trim() || `Test Case ${workItemId}`,
    state,
    outcome: undefined,
    order,
    priority: normalizePriority(fields['Microsoft.VSTS.Common.Priority']),
    testPlanName: normalizedItem.testPlan?.name,
    testSuiteName: normalizedItem.testSuite?.name,
    configurationName: pointAssignment?.configurationName,
    automationStatus: typeof fields['Microsoft.VSTS.TCM.AutomationStatus'] === 'string'
      ? fields['Microsoft.VSTS.TCM.AutomationStatus']
      : undefined,
    assignedTo,
    tester,
    lastUpdatedDate,
    lastUpdatedBy,
    fields,
    _links: {
      self: { href: selfHref },
      workItem: workItemHref ? { href: workItemHref } : undefined,
    },
  };
}

function mergeCaseListItemWithDetailCache(listCase: ADOTestCase, cachedCase?: ADOTestCase | null): ADOTestCase {
  if (!cachedCase) {
    return listCase;
  }

  const resolvedState = listCase.state && listCase.state !== 'Design'
    ? listCase.state
    : cachedCase.state || listCase.state;

  return {
    ...cachedCase,
    ...listCase,
    name: listCase.name || cachedCase.name,
    state: resolvedState,
    outcome: listCase.outcome ?? cachedCase.outcome,
    order: listCase.order ?? cachedCase.order,
    priority: listCase.priority || cachedCase.priority,
    testPlanName: listCase.testPlanName ?? cachedCase.testPlanName,
    testSuiteName: listCase.testSuiteName ?? cachedCase.testSuiteName,
    configurationName: listCase.configurationName ?? cachedCase.configurationName,
    automationStatus: listCase.automationStatus ?? cachedCase.automationStatus,
    assignedTo: listCase.assignedTo ?? cachedCase.assignedTo,
    tester: listCase.tester ?? cachedCase.tester,
    lastUpdatedDate: listCase.lastUpdatedDate || cachedCase.lastUpdatedDate,
    lastUpdatedBy: listCase.lastUpdatedBy ?? cachedCase.lastUpdatedBy,
    fields: {
      ...(cachedCase.fields ?? {}),
      ...(listCase.fields ?? {}),
    },
    _links: {
      ...(cachedCase._links ?? {}),
      ...(listCase._links ?? {}),
    },
  };
}

function mapWorkItemToTestCase(workItem: ADOWorkItem, fallbackCase?: ADOTestCase): ADOTestCase {
  const fields = workItem.fields ?? {};
  const state = normalizeFieldText(fields['System.State']).trim() || fallbackCase?.state || 'Design';
  const stateChangeDate = fields['Microsoft.VSTS.Common.StateChangeDate'];
  const changedDate = fields['System.ChangedDate'];
  const activatedDate = fields['Microsoft.VSTS.Common.ActivatedDate'];
  const lastUpdatedDate = typeof stateChangeDate === 'string'
    ? stateChangeDate
    : typeof changedDate === 'string'
      ? changedDate
      : typeof activatedDate === 'string'
        ? activatedDate
        : fallbackCase?.lastUpdatedDate || new Date().toISOString();

  const resolvedSelfHref = workItem._links?.self?.href
    ?? (workItem as ADOWorkItem & { url?: string }).url
    ?? fallbackCase?._links?.workItem?.href
    ?? fallbackCase?._links?.self?.href
    ?? '';
  const normalizedWorkItemHref = normalizeWorkItemHref(resolvedSelfHref, workItem.id) ?? undefined;

  return {
    id: workItem.id,
    name: normalizeFieldText(fields['System.Title']).trim() || fallbackCase?.name || `Test Case ${workItem.id}`,
    state,
    outcome: fallbackCase?.outcome,
    priority: normalizePriority(fields['Microsoft.VSTS.Common.Priority'] ?? fallbackCase?.priority),
    testPlanName: fallbackCase?.testPlanName,
    testSuiteName: fallbackCase?.testSuiteName,
    configurationName: fallbackCase?.configurationName,
    automationStatus: normalizeFieldText(fields['Microsoft.VSTS.TCM.AutomationStatus']).trim() || fallbackCase?.automationStatus,
    assignedTo: toIdentity(fields['System.AssignedTo']) ?? fallbackCase?.assignedTo,
    tester: fallbackCase?.tester,
    lastUpdatedDate,
    lastUpdatedBy: toIdentity(fields['System.ChangedBy'] ?? fields['Microsoft.VSTS.Common.ActivatedBy']) ?? fallbackCase?.lastUpdatedBy,
    fields,
    _links: {
      self: resolvedSelfHref ? { href: resolvedSelfHref } : undefined,
      workItem: normalizedWorkItemHref ? { href: normalizedWorkItemHref } : undefined,
    },
  };
}

export function getCachedPlans(settings: WorkspaceConnectionSettings): CachedResource<ADOTestPlan[]> | null {
  if (!canBuildCacheScope(settings)) return null;
  const entry = readCacheEntry<ADOTestPlan[]>(getPlansCacheKey(settings));
  return entry ? toCachedResource(entry) : null;
}

export function getCachedSuitesForPlan(
  settings: WorkspaceConnectionSettings,
  planId: number,
): CachedResource<unknown> | null {
  if (!canBuildCacheScope(settings)) return null;
  const entry = readCacheEntry<unknown>(getSuitesCacheKey(settings, planId));
  return entry ? toCachedResource(entry) : null;
}

export function getCachedTestCasesForSuite(
  settings: WorkspaceConnectionSettings,
  planId: number,
  suiteId: number,
): CachedResource<ADOTestCase[]> | null {
  if (!canBuildCacheScope(settings)) return null;
  const entry = readCacheEntry<ADOTestCase[]>(getTestCasesCacheKey(settings, planId, suiteId));
  return entry ? toCachedResource(entry) : null;
}

/*export function getCachedTestCaseById(
  settings: WorkspaceConnectionSettings,
  caseId: number,
): CachedResource<ADOTestCase> | null {
  if (!canBuildCacheScope(settings)) return null;
  const entry = readCacheEntry<ADOTestCase>(getTestCaseDetailCacheKey(settings, caseId));
  return entry ? toCachedResource(entry) : null;
}

export function clearTestCaseDetailCache(
  settings: WorkspaceConnectionSettings,
  caseId: number,
): void {
  clearCacheEntry(getTestCaseDetailCacheKey(settings, caseId));
}*/

export async function fetchPlans(
  settings: WorkspaceConnectionSettings,
  signal?: AbortSignal,
): Promise<ADOTestPlan[]> {
  assertSettings(settings);

  const apiVersion = normalizeApiVersion(settings.apiVersion);
  const candidateUrls = buildBaseApiUrls(settings).map(
    (baseApi) => `${baseApi}/testplan/plans?api-version=${encodeURIComponent(apiVersion)}`,
  );
  let lastError: unknown = null;

  for (const url of candidateUrls) {
    try {
      const data = await fetchJsonWithAction<ADOListResponse<ADOTestPlan>>(url, settings.patToken.trim(), 'load test plans', signal);
      const plans = Array.isArray(data.value) ? data.value : [];
      writeCacheEntry(getPlansCacheKey(settings), plans);
      return plans;
    } catch (error) {
      lastError = error;
      if (error instanceof ADORequestError && error.status === 404) {
        continue;
      }
      throw error;
    }
  }

  if (lastError instanceof Error) {
    throw humanizeUnexpectedError('load test plans', lastError);
  }

  throw new Error("We couldn't load test plans. Please try again.");
}

export async function fetchSuitesForPlan(
  settings: WorkspaceConnectionSettings,
  plan: ADOTestPlan,
  signal?: AbortSignal,
): Promise<unknown> {
  assertSettings(settings);

  const apiVersion = normalizeApiVersion(settings.apiVersion);
  const selfHref = getPlanSelfHref(plan);

  const candidateUrls = selfHref
    ? [buildSuitesUrlFromSelf(selfHref, apiVersion)]
    : buildBaseApiUrls(settings).map(
      (baseApi) => `${baseApi}/testplan/Plans/${encodeURIComponent(String(plan.id))}/suites?asTreeView=True&api-version=${encodeURIComponent(apiVersion)}`,
    );
  let lastError: unknown = null;

  for (const url of candidateUrls) {
    try {
      const response = await fetchJsonWithAction<unknown>(url, settings.patToken.trim(), 'load test suites', signal);
      writeCacheEntry(getSuitesCacheKey(settings, plan.id), response);
      return response;
    } catch (error) {
      lastError = error;
      if (error instanceof ADORequestError && error.status === 404) {
        continue;
      }
      throw error;
    }
  }

  if (lastError instanceof Error) {
    throw humanizeUnexpectedError('load test suites', lastError);
  }

  throw new Error("We couldn't load test suites. Please try again.");
}

export async function fetchTestCasesForSuite(
  settings: WorkspaceConnectionSettings,
  planId: number,
  suiteId: number,
  suiteTestCasesHref?: string,
  suiteSelfHref?: string,
  signal?: AbortSignal,
  options?: {
    forceRefresh?: boolean;
  },
): Promise<ADOTestCase[]> {
  assertSettings(settings);

  const forceRefresh = Boolean(options?.forceRefresh);
  const cacheKey = getTestCasesCacheKey(settings, planId, suiteId);

  if (forceRefresh) {
    clearCacheEntry(cacheKey);
  }

  const apiVersions = getApiVersionCandidates(settings.apiVersion);
  const encodedPlanId = encodeURIComponent(String(planId));
  const encodedSuiteId = encodeURIComponent(String(suiteId));
  const baseApis = buildBaseApiUrls(settings);
  const candidateUrls: string[] = [];

  for (const apiVersion of apiVersions) {
    const encodedApiVersion = encodeURIComponent(apiVersion);
    const preferredUrls = baseApis.flatMap((baseApi) => [
      `${baseApi}/testplan/Plans/${encodedPlanId}/Suites/${encodedSuiteId}/TestCase?api-version=${encodedApiVersion}`,
      `${baseApi}/testplan/Plans/${encodedPlanId}/Suites/${encodedSuiteId}/TestCases?api-version=${encodedApiVersion}`,
      `${baseApi}/test/Plans/${encodedPlanId}/Suites/${encodedSuiteId}/testcases?api-version=${encodedApiVersion}`,
    ]);

    if (forceRefresh) {
      candidateUrls.push(...preferredUrls);
    }

    if (suiteTestCasesHref) {
      candidateUrls.push(withApiVersion(suiteTestCasesHref, apiVersion));
      candidateUrls.push(withApiVersion(suiteTestCasesHref.replace(/\/TestCase(\?|$)/i, '/TestCases$1'), apiVersion));
      candidateUrls.push(withApiVersion(suiteTestCasesHref.replace(/\/testcases(\?|$)/i, '/TestCase$1'), apiVersion));
    }

    if (suiteSelfHref) {
      candidateUrls.push(deriveTestCaseUrlFromSuiteSelf(suiteSelfHref, apiVersion, false));
      candidateUrls.push(deriveTestCaseUrlFromSuiteSelf(suiteSelfHref, apiVersion, true));
    }

    candidateUrls.push(...preferredUrls);
  }

  const uniqueCandidateUrls = Array.from(new Set(candidateUrls));
  const pointSummaryByCaseId = await fetchPointSummaryByCaseId(
    settings,
    planId,
    suiteId,
    suiteSelfHref,
    signal,
  );

  let lastError: unknown = null;

  for (const url of uniqueCandidateUrls) {
    try {
      const response = await fetchJsonWithAction<ADOListResponse<ADOTestCaseListItem | Record<string, unknown>>>(
        url,
        settings.patToken.trim(),
        'load test cases',
        signal,
      );
      const selfHref = url.split('?')[0];
      const mappedCases = (response.value ?? [])
        .map((item) => mapTestCaseListItemToCase(item, selfHref))
        .filter((item): item is ADOTestCase => item !== null)
        .map((item) => {
          const pointSummary = pointSummaryByCaseId.get(item.id);
          if (!pointSummary) return item;
          return {
            ...item,
            configurationName: pointSummary.configurationName ?? item.configurationName,
            outcome: pointSummary.outcome ?? item.outcome,
            pointBreakdown: pointSummary.pointBreakdown ?? item.pointBreakdown,
          };
        })
        .map((item) => {
          const cachedDetail = readCacheEntry<ADOTestCase>(getTestCaseDetailCacheKey(settings, item.id))?.data ?? null;
          return mergeCaseListItemWithDetailCache(item, cachedDetail);
        });

      writeCacheEntry(cacheKey, mappedCases);
      for (const mappedCase of mappedCases) {
        writeCacheEntry(getTestCaseDetailCacheKey(settings, mappedCase.id), mappedCase);
      }
      return mappedCases;
    } catch (error) {
      lastError = error;
      if (error instanceof ADORequestError && error.status === 404) {
        continue;
      }
      throw error;
    }
  }

  if (lastError instanceof Error) {
    throw humanizeUnexpectedError('load test cases', lastError);
  }

  throw new Error("We couldn't load test cases. Please try again.");
}

export async function fetchTestCaseDetail(
  settings: WorkspaceConnectionSettings,
  caseId: number,
  preferredHref?: string,
  fallbackCase?: ADOTestCase,
  signal?: AbortSignal,
): Promise<ADOTestCase> {
  assertSettings(settings);

  const apiVersions = getApiVersionCandidates(settings.apiVersion);
  const encodedCaseId = encodeURIComponent(String(caseId));
  const baseApis = buildBaseApiUrls(settings);
  const preferredLinks = [
    preferredHref,
    fallbackCase?._links?.workItem?.href,
    fallbackCase?._links?.self?.href,
    fallbackCase?._links?._self?.href,
  ].filter((value): value is string => Boolean(value && value.trim()));

  const candidateUrls: string[] = [];
  for (const apiVersion of apiVersions) {
    for (const link of preferredLinks) {
      const normalizedWorkItemHref = normalizeWorkItemHref(link, caseId);
      if (normalizedWorkItemHref) {
        candidateUrls.push(withApiVersion(normalizedWorkItemHref, apiVersion));
      }
    }

    const encodedApiVersion = encodeURIComponent(apiVersion);
    // Try both with and without expand parameter - custom fields should be included by default
    for (const baseApi of baseApis) {
      candidateUrls.push(`${baseApi}/wit/workitems/${encodedCaseId}?api-version=${encodedApiVersion}`);
      candidateUrls.push(`${baseApi}/wit/workItems/${encodedCaseId}?api-version=${encodedApiVersion}`);
    }
  }

  const uniqueCandidateUrls = Array.from(new Set(candidateUrls));
  let lastError: unknown = null;

  for (const url of uniqueCandidateUrls) {
    try {
      const workItem = await fetchJsonWithAction<ADOWorkItem>(url, settings.patToken.trim(), 'load test case details', signal);

      // Debug: Log what fields are actually in the response
      if (workItem.fields) {
        const customFields = Object.keys(workItem.fields).filter(k => k.startsWith('Custom.'));
        const requiredFields = {
          'Custom.TestingMethod': workItem.fields['Custom.TestingMethod'],
          'Custom.ApplicableRegions': workItem.fields['Custom.ApplicableRegions'],
          'Custom.ExecutiveProcess': workItem.fields['Custom.ExecutiveProcess'],
          'Custom.PLTPProcessArea': workItem.fields['Custom.PLTPProcessArea'],
          'Custom.InitialStep': workItem.fields['Custom.InitialStep'],
        };

    console.debug('[Azure DevOps API] ========== FULL FIELD DEBUG ==========');
    console.debug('[Azure DevOps API] ✅ Successfully fetched Work Item ID:', workItem.id);
    console.debug('[Azure DevOps API] API URL used:', url);
    console.debug('[Azure DevOps API] All custom fields found:', customFields);
    console.debug('[Azure DevOps API] ✅ CUSTOM FIELD VALUES:', requiredFields);
    console.debug('[Azure DevOps API] Total fields in response:', Object.keys(workItem.fields).length);

        // Show fields that might match our expected ones with different casing
        const possibleMatches = Object.keys(workItem.fields).filter(k =>
          k.toLowerCase().includes('testing') ||
          k.toLowerCase().includes('region') ||
          k.toLowerCase().includes('process') ||
          k.toLowerCase().includes('step')
        );
        if (possibleMatches.length > 0) {
      console.debug('[Azure DevOps API] Fields matching keywords:', possibleMatches);
        }
    console.debug('[Azure DevOps API] ====================================');

        if (customFields.length === 0) {
      console.warn('[Azure DevOps API] ⚠️ WARNING: No custom fields in this work item!');
      console.warn('[Azure DevOps API] Work Item ID:', workItem.id, '(may not have values set)');
        } else {
      console.log('[Azure DevOps API] ✅ SUCCESS: Custom fields found and will be displayed');
        }
      }

      const mappedCase = mapWorkItemToTestCase(workItem, fallbackCase);
      writeCacheEntry(getTestCaseDetailCacheKey(settings, caseId), mappedCase);
      return mappedCase;
    } catch (error) {
      lastError = error;
      if (error instanceof ADORequestError && error.status === 404) {
        continue;
      }
      throw error;
    }
  }

  if (lastError instanceof Error) {
    throw humanizeUnexpectedError('load test case details', lastError);
  }

  throw new Error("We couldn't load test case details. Please try again.");
}

export async function updateTestCase(
  settings: WorkspaceConnectionSettings,
  caseId: number,
  updateData: {
    title?: string;
    status?: string;
    method?: string;
    region?: string;
    execProcess?: string;
    pltpProcess?: string;
    initialSteps?: string;
    stepsXml?: string;
    automatedTestName?: string | null;
    automatedTestStorage?: string | null;
    automatedTestType?: string | null;
    automatedTestId?: string | null;
    automationStatus?: string | null;
    removeAutomationAssociation?: boolean;
  },
  preferredHref?: string,
): Promise<ADOTestCase> {
  assertSettings(settings);

  const apiVersions = getApiVersionCandidates(settings.apiVersion);
  const encodedCaseId = encodeURIComponent(String(caseId));
  const baseApis = buildBaseApiUrls(settings);

  const candidateUrls: string[] = [];
  for (const apiVersion of apiVersions) {
    const encodedApiVersion = encodeURIComponent(apiVersion);
    if (preferredHref) {
      const normalizedWorkItemHref = normalizeWorkItemHref(preferredHref, caseId);
      if (normalizedWorkItemHref) {
        candidateUrls.push(withApiVersion(normalizedWorkItemHref, apiVersion));
      }
    }
    for (const baseApi of baseApis) {
      candidateUrls.push(`${baseApi}/wit/workitems/${encodedCaseId}?api-version=${encodedApiVersion}`);
      candidateUrls.push(`${baseApi}/wit/workItems/${encodedCaseId}?api-version=${encodedApiVersion}`);
    }
  }

  // Build PATCH operations using "add" operation (more reliable than "replace")
  const operations: Array<{ op: string; path: string; value?: unknown }> = [];
  const setFieldValue = (path: string, value: unknown) => {
    const operation = { op: 'add', path, value };
    const existingIndex = operations.findIndex((item) => item.path === path);
    if (existingIndex >= 0) {
      operations[existingIndex] = operation;
      return;
    }
    operations.push(operation);
  };

  // Only add operations for fields that have values
  if (updateData.title && updateData.title.trim()) {
    setFieldValue('/fields/System.Title', updateData.title);
  }
  if (updateData.status) {
    setFieldValue('/fields/System.State', updateData.status);
  }
  if (updateData.method) {
    setFieldValue('/fields/Custom.TestingMethod', updateData.method);
  }
  if (updateData.region) {
    setFieldValue('/fields/Custom.ApplicableRegions', updateData.region);
  }
  if (updateData.execProcess) {
    setFieldValue('/fields/Custom.ExecutiveProcess', updateData.execProcess);
  }
  if (updateData.pltpProcess) {
    setFieldValue('/fields/Custom.PLTPProcessArea', updateData.pltpProcess);
  }
  if (updateData.initialSteps !== undefined && updateData.initialSteps.trim()) {
    setFieldValue('/fields/Custom.InitialStep', updateData.initialSteps);
  }
  const removeAutomationAssociation = updateData.removeAutomationAssociation === true;
  const hasAutomationAssociationPayload = Object.prototype.hasOwnProperty.call(updateData, 'automatedTestName')
    || Object.prototype.hasOwnProperty.call(updateData, 'automatedTestStorage')
    || Object.prototype.hasOwnProperty.call(updateData, 'automatedTestId');
  const automationStatus = typeof updateData.automationStatus === 'string'
    ? updateData.automationStatus.trim().toLowerCase()
    : '';
  const isAddingAutomationAssociation = !removeAutomationAssociation
    && (hasAutomationAssociationPayload || automationStatus === 'automated');

  if (isAddingAutomationAssociation) {
    setFieldValue('/fields/Custom.AutomationTestID', caseId);
    setFieldValue('/fields/Custom.TestingMethod', 'Selenium');
  } else if (removeAutomationAssociation) {
    operations.push({ op: 'remove', path: '/fields/Custom.AutomationTestID' });
    setFieldValue('/fields/Custom.TestingMethod', 'Manual');
  }

  if (Object.prototype.hasOwnProperty.call(updateData, 'automatedTestName')) {
    operations.push({
      op: removeAutomationAssociation ? 'remove' : 'add',
      path: '/fields/Microsoft.VSTS.TCM.AutomatedTestName',
      ...(removeAutomationAssociation ? {} : { value: typeof updateData.automatedTestName === 'string' ? updateData.automatedTestName : '' }),
    });
  }
  if (Object.prototype.hasOwnProperty.call(updateData, 'automatedTestStorage')) {
    operations.push({
      op: removeAutomationAssociation ? 'remove' : 'add',
      path: '/fields/Microsoft.VSTS.TCM.AutomatedTestStorage',
      ...(removeAutomationAssociation ? {} : { value: typeof updateData.automatedTestStorage === 'string' ? updateData.automatedTestStorage : '' }),
    });
  }
  // if (Object.prototype.hasOwnProperty.call(updateData, 'automatedTestType')) {
  //   operations.push({
  //     op: removeAutomationAssociation ? 'remove' : 'add',
  //     path: '/fields/Microsoft.VSTS.TCM.AutomatedTestType',
  //     ...(removeAutomationAssociation ? {} : { value: typeof updateData.automatedTestType === 'string' ? updateData.automatedTestType : '' }),
  //   });
  // }
  if (Object.prototype.hasOwnProperty.call(updateData, 'automatedTestId')) {
    operations.push({
      op: removeAutomationAssociation ? 'remove' : 'add',
      path: '/fields/Microsoft.VSTS.TCM.AutomatedTestId',
      ...(removeAutomationAssociation ? {} : { value: typeof updateData.automatedTestId === 'string' ? updateData.automatedTestId : '' })
    });
  }

  if (Object.prototype.hasOwnProperty.call(updateData, 'automationStatus')) {
    setFieldValue(
      '/fields/Microsoft.VSTS.TCM.AutomationStatus',
      typeof updateData.automationStatus === 'string' ? updateData.automationStatus : '',
    );
  }
  // Always update steps XML if provided (most important field)
  if (updateData.stepsXml) {
    setFieldValue('/fields/Microsoft.VSTS.TCM.Steps', updateData.stepsXml);
  }

  if (operations.length === 0) {
    throw new Error('There are no changes to save.');
  }

  let lastError: unknown = null;

  for (const url of candidateUrls) {
    try {
      const updatedWorkItem = await patchJson<ADOWorkItem>(url, settings.patToken.trim(), operations, 'save test case changes');
      const mappedCase = mapWorkItemToTestCase(updatedWorkItem);

      // Invalidate and update cache
      clearCacheEntry(getTestCaseDetailCacheKey(settings, caseId));
      writeCacheEntry(getTestCaseDetailCacheKey(settings, caseId), mappedCase);

      return mappedCase;
    } catch (error) {
      lastError = error;
      if (error instanceof ADORequestError && error.status === 404) {
        continue;
      }
      throw error;
    }
  }

  if (lastError instanceof Error) {
    throw humanizeUnexpectedError('save test case changes', lastError);
  }

  throw new Error("We couldn't save test case changes. Please try again.");
}

export async function deleteTestCase(
  settings: WorkspaceConnectionSettings,
  caseId: number,
  _preferredHref?: string,
  suiteCache?: { planId: number; suiteId: number },
): Promise<void> {
  assertSettings(settings);

  if (!suiteCache) {
    throw new Error('Plan and suite context are required to remove a test case from a suite.');
  }

  const apiVersions = getApiVersionCandidates(settings.apiVersion);
  const encodedPlanId = encodeURIComponent(String(suiteCache.planId));
  const encodedSuiteId = encodeURIComponent(String(suiteCache.suiteId));
  const encodedCaseId = encodeURIComponent(String(caseId));
  const baseApis = buildBaseApiUrls(settings);
  let lastError: unknown = null;

  for (const apiVersion of apiVersions) {
    const encodedApiVersion = encodeURIComponent(apiVersion);
    for (const baseApi of baseApis) {
      const url = `${baseApi}/test/Plans/${encodedPlanId}/suites/${encodedSuiteId}/testcases/${encodedCaseId}?api-version=${encodedApiVersion}`;

      try {
        await deleteRequest(url, settings.patToken.trim(), 'remove the test case from the suite');
        clearCacheEntry(getTestCasesCacheKey(settings, suiteCache.planId, suiteCache.suiteId));
        return;
      } catch (error) {
        lastError = error;
        if (error instanceof ADORequestError && error.status === 404) {
          continue;
        }
        throw error;
      }
    }
  }

  if (lastError instanceof Error) {
    throw humanizeUnexpectedError('remove the test case from the suite', lastError);
  }

  throw new Error("We couldn't remove the test case from the suite. Please try again.");
}

export async function createStaticSuite(
  settings: WorkspaceConnectionSettings,
  planId: number,
  suiteName: string,
  parentSuiteId?: number,
): Promise<ADOTestSuite> {
  assertSettings(settings);

  if (!suiteName.trim()) {
    throw new Error('Suite name is required.');
  }

  const apiVersions = getApiVersionCandidates(settings.apiVersion);
  const encodedPlanId = encodeURIComponent(String(planId));
  const baseApis = buildBaseApiUrls(settings);
  let lastError: unknown = null;

  for (const apiVersion of apiVersions) {
    const encodedApiVersion = encodeURIComponent(apiVersion);
    const body: {
      suiteType: 'staticTestSuite';
      name: string;
      inheritDefaultConfigurations: true;
      parentSuite?: { id: number };
    } = {
      suiteType: 'staticTestSuite',
      name: suiteName.trim(),
      inheritDefaultConfigurations: true,
    };

    if (typeof parentSuiteId === 'number') {
      body.parentSuite = { id: parentSuiteId };
    }

    for (const baseApi of baseApis) {
      const url = `${baseApi}/testplan/Plans/${encodedPlanId}/suites?api-version=${encodedApiVersion}`;

      try {
        const createdSuite = await postJson<ADOTestSuite>(
          url,
          settings.patToken.trim(),
          body,
          'application/json',
          'create the suite',
        );
        clearCacheEntry(getSuitesCacheKey(settings, planId));
        return createdSuite;
      } catch (error) {
        lastError = error;
        if (error instanceof ADORequestError && error.status === 404) {
          continue;
        }
        throw error;
      }
    }
  }

  if (lastError instanceof Error) {
    throw humanizeUnexpectedError('create the suite', lastError);
  }

  throw new Error("We couldn't create the suite. Please try again.");
}

/**
 * Helper function to POST JSON data to Azure DevOps API
 */
async function postJson<T>(
  url: string,
  patToken: string,
  body: unknown,
  contentType: string = 'application/json',
  action = 'save data',
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': contentType,
        Accept: 'application/json',
        Authorization: `Basic ${toBasicAuthToken(patToken)}`,
      },
      body: JSON.stringify(body),
    });
  } catch (error) {
    if (isAbortError(error)) {
      throw error;
    }
    throw new Error(`We couldn't ${action}. Check your connection and Azure DevOps settings, then try again.`);
  }

  if (!response.ok) {
    const body = await response.text();
    throw new ADORequestError(response.status, buildAdoErrorMessage(action, response.status, body));
  }

  return (await response.json()) as T;
}

async function putJson<T>(
  url: string,
  patToken: string,
  body: unknown,
  contentType: string = 'application/json',
  action = 'update data',
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': contentType,
        Accept: 'application/json',
        Authorization: `Basic ${toBasicAuthToken(patToken)}`,
      },
      body: JSON.stringify(body),
    });
  } catch (error) {
    if (isAbortError(error)) {
      throw error;
    }
    throw new Error(`We couldn't ${action}. Check your connection and Azure DevOps settings, then try again.`);
  }

  if (!response.ok) {
    const body_text = await response.text();
    throw new ADORequestError(response.status, buildAdoErrorMessage(action, response.status, body_text));
  }

  return (await response.json()) as T;
}

/**
 * Create a new test case in Azure DevOps
 */
/*
export async function createTestCase(
  settings: WorkspaceConnectionSettings,
  planId: number,
  suiteId: number,
  newCaseData: {
    title: string;
    description?: string;
    status?: string;
    method?: string;
    region?: string;
    execProcess?: string;
    pltpProcess?: string;
    initialSteps?: string;
    stepsXml?: string;
  },
): Promise<ADOTestCase> {
  assertSettings(settings);

  if (!newCaseData.title || !newCaseData.title.trim()) {
    throw new Error('Test case title is required');
  }

  const apiVersions = getApiVersionCandidates(settings.apiVersion);
  const baseApi = buildBaseApiUrl(settings);

  // Build test case work item for Test Plan API (uses standard JSON format, not JSON Patch)
  const workItem = {
    fields: {
      'System.Title': newCaseData.title,
      'System.Description': newCaseData.description || '',
    } as Record<string, unknown>,
  };

  // Add custom fields if provided
  if (newCaseData.status) {
    workItem.fields['System.State'] = newCaseData.status;
  }
  if (newCaseData.method) {
    workItem.fields['Custom.TestingMethod'] = newCaseData.method;
  }
  if (newCaseData.region) {
    workItem.fields['Custom.ApplicableRegions'] = newCaseData.region;
  }
  if (newCaseData.execProcess) {
    workItem.fields['Custom.ExecutiveProcess'] = newCaseData.execProcess;
  }
  if (newCaseData.pltpProcess) {
    workItem.fields['Custom.PLTPProcessArea'] = newCaseData.pltpProcess;
  }
  if (newCaseData.initialSteps) {
    workItem.fields['Custom.InitialStep'] = newCaseData.initialSteps;
  }
  if (newCaseData.stepsXml) {
    workItem.fields['Microsoft.VSTS.TCM.Steps'] = newCaseData.stepsXml;
  }

  let lastError: unknown = null;

  // Try different API versions using Test Plan API endpoint
  for (const apiVersion of apiVersions) {
    const encodedApiVersion = encodeURIComponent(apiVersion);
    const url = `${baseApi}/testplan/Plans/${planId}/Suites/${suiteId}/TestCase?api-version=${encodedApiVersion}`;

    try {
      // Test Plan API accepts standard application/json (not JSON Patch)
      const response = await postJson<ADOWorkItem>(url, settings.patToken.trim(), workItem);

      // Success! Use response directly - Test Plan API returns work item with id field
      const createdWorkItem = response;

      console.log('[createTestCase] Success:', { id: createdWorkItem.id, title: createdWorkItem.fields?.['System.Title'] });

      const mappedCase = mapWorkItemToTestCase(createdWorkItem);

      // Cache the newly created case
      writeCacheEntry(getTestCaseDetailCacheKey(settings, createdWorkItem.id), mappedCase);

      return mappedCase;
    } catch (error) {
      lastError = error;
      // Only retry on 404 Not Found
      if (error instanceof ADORequestError && error.status === 404) {
        continue;
      }
      // All other errors should be thrown immediately (don't retry)
      throw error;
    }
  }

  if (lastError instanceof Error) {
    throw new Error(`Failed to create test case in Azure DevOps: ${lastError.message}`);
  }

  throw new Error('Failed to create test case in Azure DevOps.');
}
*/
export async function createTestCase(
    settings: WorkspaceConnectionSettings,
    planId: number,
    suiteId: number,
    newCaseData: {
      title: string;
      description?: string;
      status?: string;
      method?: string;
      region?: string;
      execProcess?: string;
      pltpProcess?: string;
      initialSteps?: string;
      stepsXml?: string;
    },
): Promise<ADOTestCase> {
  assertSettings(settings);

  if (!newCaseData.title || !newCaseData.title.trim()) {
    throw new Error('Test case title is required');
  }

  const apiVersions = getApiVersionCandidates(settings.apiVersion);
  const baseApis = buildBaseApiUrls(settings);

  let lastError: unknown = null;

  for (const apiVersion of apiVersions) {
    const encodedApiVersion = encodeURIComponent(apiVersion);

    for (const baseApi of baseApis) {
      try {
        // STEP 1: Create work item using same style as updateTestCase
        const createUrl =
            `${baseApi}/wit/workitems/$Test%20Case?api-version=${encodedApiVersion}`;

        const operations: Array<{ op: string; path: string; value: unknown }> = [
          { op: 'add', path: '/fields/System.Title', value: newCaseData.title },
        ];

        if (newCaseData.description) {
          operations.push({
            op: 'add',
            path: '/fields/System.Description',
            value: newCaseData.description,
          });
        }

        if (newCaseData.status) {
          operations.push({
            op: 'add',
            path: '/fields/System.State',
            value: newCaseData.status,
          });
        }

        if (newCaseData.method) {
          operations.push({
            op: 'add',
            path: '/fields/Custom.TestingMethod',
            value: newCaseData.method,
          });
        }

        if (newCaseData.region) {
          operations.push({
            op: 'add',
            path: '/fields/Custom.ApplicableRegions',
            value: newCaseData.region,
          });
        }

        if (newCaseData.execProcess) {
          operations.push({
            op: 'add',
            path: '/fields/Custom.ExecutiveProcess',
            value: newCaseData.execProcess,
          });
        }

        if (newCaseData.pltpProcess) {
          operations.push({
            op: 'add',
            path: '/fields/Custom.PLTPProcessArea',
            value: newCaseData.pltpProcess,
          });
        }

        if (newCaseData.initialSteps?.trim()) {
          operations.push({
            op: 'add',
            path: '/fields/Custom.InitialStep',
            value: newCaseData.initialSteps,
          });
        }

        if (newCaseData.stepsXml) {
          operations.push({
            op: 'add',
            path: '/fields/Microsoft.VSTS.TCM.Steps',
            value: newCaseData.stepsXml,
          });
        }

        const createdWorkItem = await patchJson<ADOWorkItem>(
            createUrl,
            settings.patToken.trim(),
            operations,
            'create the test case',
        );

        // STEP 2: Add created work item to selected suite
        const addToSuiteUrl =
            `${baseApi}/testplan/Plans/${encodeURIComponent(String(planId))}` +
            `/Suites/${encodeURIComponent(String(suiteId))}` +
            `/TestCase?api-version=${encodedApiVersion}`;

        await postJson(
            addToSuiteUrl,
            settings.patToken.trim(),
            [
              {
                workItem: { id: createdWorkItem.id },
                pointAssignments: [],
              },
            ],
            'application/json',
            'add the test case to the suite',
        );

        const mappedCase = mapWorkItemToTestCase(createdWorkItem);
        writeCacheEntry(getTestCaseDetailCacheKey(settings, createdWorkItem.id), mappedCase);
        clearCacheEntry(getTestCasesCacheKey(settings, planId, suiteId));

        return mappedCase;
      } catch (error) {
        lastError = error;
        if (error instanceof ADORequestError && error.status === 404) {
          continue;
        }
        throw error;
      }
    }
  }

  if (lastError instanceof Error) {
    throw humanizeUnexpectedError('create the test case', lastError);
  }

  throw new Error("We couldn't create the test case. Please try again.");
}

export interface ADOBuildSummary {
  id: number;
  buildNumber: string;
  sourceBranch: string;
  sourceVersion: string;
  status: string;
  result: string;
  queueTime: string;
  repositoryId: string;
  repositoryType: string;
}

export interface ADOTestConfigurationSummary {
  id: number;
  name: string;
}

export interface ADOTestPointSummary {
  id: number;
  caseId: number | null;
  outcome: string;
  state: string;
  /** Last result state from ADO ("completed" | "pending" | …). */
  lastResultState?: string;
  /** Whether the test point is currently active (run pending/in-flight). */
  isActive?: boolean;
  configurationId: number | null;
  configurationName: string;
  automationStatus: string;
  isAutomated: boolean;
}

export interface ADOReleaseDefinitionAvailability {
  definitionId: number;
  definitionName: string;
  environmentStatus: string;
  latestReleaseId: number | null;
  isAvailable: boolean;
}

export interface ADOSuiteReleaseMapping {
  testSuiteId: number;
  testSuiteName: string;
  releaseDefinitionId: number | null;
  releaseDefinitionName: string;
  assignedPerson: string;
  tag: string;
  priority: number | null;
}

interface ADOBuildListItem {
  id?: unknown;
  buildNumber?: unknown;
  sourceBranch?: unknown;
  sourceVersion?: unknown;
  status?: unknown;
  result?: unknown;
  queueTime?: unknown;
  repository?: {
    id?: unknown;
    type?: unknown;
  };
}

interface ADOTestConfigurationListItem {
  id?: unknown;
  name?: unknown;
}

function buildReleaseBaseApiUrls(settings: WorkspaceConnectionSettings): string[] {
  const organization = normalizeOrganization(settings.organization);
  const project = encodeURIComponent(normalizeProjectName(settings.projectName));
  return Array.from(new Set([
    `https://vsrm.dev.azure.com/${organization}/${project}/_apis/release`,
    `https://${organization}.vsrm.visualstudio.com/${project}/_apis/release`,
  ]));
}

function isReleaseEnvironmentBusy(status: string): boolean {
  const normalized = status.trim().toLowerCase();
  return normalized === 'inprogress' || normalized === 'queued' || normalized === 'notstarted';
}

function normalizePointAutomationStatus(point: Record<string, unknown>): string {
  const workItemProperties = Array.isArray(point.workItemProperties)
    ? point.workItemProperties
    : [];
  for (const property of workItemProperties) {
    const candidate = property as {
      workItem?: {
        key?: unknown;
        value?: unknown;
      };
    };
    const key = String(candidate.workItem?.key ?? '').trim();
    if (key === 'Microsoft.VSTS.TCM.AutomationStatus') {
      return String(candidate.workItem?.value ?? '').trim();
    }
  }
  return '';
}

function parseSuiteReleaseMappingsXml(xml: string): ADOSuiteReleaseMapping[] {
  const source = xml.trim();
  if (!source) return [];
  if (typeof DOMParser === 'undefined') return [];

  const parser = new DOMParser();
  const documentNode = parser.parseFromString(source, 'application/xml');
  if (documentNode.querySelector('parsererror')) {
    return [];
  }

  const rows = Array.from(documentNode.getElementsByTagName('dataRow'));
  const mappings: ADOSuiteReleaseMapping[] = [];

  for (const row of rows) {
    // ADO stores rows as <kvp key="..." value="..."/> children of <dataRow>.
    // Accept legacy <dataItem> spelling too so test fixtures don't break.
    const items = [
      ...Array.from(row.getElementsByTagName('kvp')),
      ...Array.from(row.getElementsByTagName('dataItem')),
    ];
    const mapping: ADOSuiteReleaseMapping = {
      testSuiteId: 0,
      testSuiteName: '',
      releaseDefinitionId: null,
      releaseDefinitionName: '',
      assignedPerson: '',
      tag: '',
      priority: null,
    };

    for (const item of items) {
      const key = item.getAttribute('key')?.trim() ?? '';
      const value = item.getAttribute('value')?.trim() ?? '';
      if (!key) continue;
      switch (key.toLowerCase()) {
        case 'testsuiteid': {
          const parsed = Number(value);
          if (Number.isInteger(parsed) && parsed > 0) {
            mapping.testSuiteId = parsed;
          }
          break;
        }
        case 'testsuitename':
          mapping.testSuiteName = value;
          break;
        case 'releasedefinitionid': {
          const parsed = Number(value);
          mapping.releaseDefinitionId = Number.isInteger(parsed) && parsed > 0 ? parsed : null;
          break;
        }
        case 'releasedefinitionname':
          mapping.releaseDefinitionName = value;
          break;
        case 'assignedperson':
          mapping.assignedPerson = value;
          break;
        case 'tag':
          mapping.tag = value;
          break;
        case 'priority': {
          const parsed = Number(value);
          mapping.priority = Number.isInteger(parsed) ? parsed : null;
          break;
        }
        default:
          break;
      }
    }

    if (mapping.testSuiteId > 0) {
      mappings.push(mapping);
    }
  }

  return mappings;
}

async function fetchWorkItemFields(
  settings: WorkspaceConnectionSettings,
  workItemId: number,
  fields: string[],
  signal?: AbortSignal,
): Promise<Record<string, unknown>> {
  assertSettings(settings);
  const encodedWorkItemId = encodeURIComponent(String(workItemId));
  const apiVersion = normalizeApiVersion(settings.apiVersion);
  const candidateUrls = buildBaseApiUrls(settings).map((baseApi) => (
    `${baseApi}/wit/workitems/${encodedWorkItemId}?fields=${encodeURIComponent(fields.join(','))}&api-version=${encodeURIComponent(apiVersion)}`
  ));

  let lastError: unknown = null;
  for (const url of candidateUrls) {
    try {
      const workItem = await fetchJsonWithAction<ADOWorkItem>(
        url,
        settings.patToken.trim(),
        'load mapping work item',
        signal,
      );
      return workItem.fields ?? {};
    } catch (error) {
      lastError = error;
      if (error instanceof ADORequestError && error.status === 404) {
        continue;
      }
      throw humanizeUnexpectedError('load mapping work item', error);
    }
  }

  if (lastError instanceof Error) {
    throw humanizeUnexpectedError('load mapping work item', lastError);
  }

  throw new Error("We couldn't load mapping work item.");
}

export async function fetchSuiteReleaseMappings(
  settings: WorkspaceConnectionSettings,
  workItemIds: number[],
  signal?: AbortSignal,
): Promise<ADOSuiteReleaseMapping[]> {
  const ids = Array.from(
    new Set(
      workItemIds
        .map((item) => Number(item))
        .filter((item) => Number.isInteger(item) && item > 0),
    ),
  );
  if (ids.length === 0) {
    return [];
  }

  const mappingLists = await Promise.all(
    ids.map(async (workItemId) => {
      const fields = await fetchWorkItemFields(settings, workItemId, ['Microsoft.VSTS.TCM.Parameters'], signal);
      const xmlValue = String(fields['Microsoft.VSTS.TCM.Parameters'] ?? '').trim();
      if (!xmlValue) return [];
      return parseSuiteReleaseMappingsXml(xmlValue);
    }),
  );

  return mappingLists.flat();
}

export async function fetchBuilds(
  settings: WorkspaceConnectionSettings,
  buildDefinitionId = 260,
  top = 50,
  signal?: AbortSignal,
): Promise<ADOBuildSummary[]> {
  assertSettings(settings);
  const apiVersion = normalizeApiVersion(settings.apiVersion);
  const candidateUrls = buildBaseApiUrls(settings).map(
    (baseApi) => (
      `${baseApi}/build/builds`
      + `?definitions=${encodeURIComponent(String(buildDefinitionId))}`
      + `&$top=${encodeURIComponent(String(Math.max(1, Math.min(250, Math.round(top)))))}` 
      + `&api-version=${encodeURIComponent(apiVersion)}`
    ),
  );

  let lastError: unknown = null;
  for (const url of candidateUrls) {
    try {
      const response = await fetchJsonWithAction<ADOListResponse<ADOBuildListItem>>(url, settings.patToken.trim(), 'load builds', signal);
      return (response.value ?? [])
        .map((build) => {
          const repositoryId = normalizeFieldText(build.repository?.id).trim();
          const repositoryType = normalizeFieldText(build.repository?.type).trim();
          return {
            id: Number(build.id),
            buildNumber: normalizeFieldText(build.buildNumber).trim(),
            sourceBranch: normalizeFieldText(build.sourceBranch).trim(),
            sourceVersion: normalizeFieldText(build.sourceVersion).trim(),
            status: normalizeFieldText(build.status).trim(),
            result: normalizeFieldText(build.result).trim(),
            queueTime: normalizeFieldText(build.queueTime).trim(),
            repositoryId,
            repositoryType,
          } satisfies ADOBuildSummary;
        })
        .filter((build) => Number.isInteger(build.id) && build.id > 0);
    } catch (error) {
      lastError = error;
      if (error instanceof ADORequestError && error.status === 404) {
        continue;
      }
      throw humanizeUnexpectedError('load builds', error);
    }
  }

  if (lastError instanceof Error) {
    throw humanizeUnexpectedError('load builds', lastError);
  }
  throw new Error("We couldn't load builds. Please try again.");
}

export interface QueueBuildParams {
  /** Classic build definition (pipeline) id, e.g. 762. */
  definitionId: number;
  /** Full ref to build, e.g. "refs/heads/master". Omit for the definition default. */
  sourceBranch?: string;
  /** Agent pool override identifier, e.g. "windows-latest". Omit for the definition default. */
  agentSpecification?: string;
  /** Queue-time variables. Serialized to the `parameters` JSON string ADO expects. */
  parameters?: Record<string, string>;
  /** Optional agent demands (e.g. "Agent.OS -equals Windows_NT"). */
  demands?: string[];
}

export interface QueuedBuildResult {
  id: number;
  buildNumber: string;
  status: string;
  definitionName?: string;
  webUrl?: string;
}

/**
 * Queue a classic build for a build definition — the REST equivalent of clicking
 * "Run pipeline" in the Azure DevOps UI.
 *
 *   POST {base}/_apis/build/builds?api-version=...
 *   { definition:{id}, sourceBranch, agentSpecification:{identifier},
 *     parameters: "<json string of queue-time vars>", demands:[...] }
 *
 * `parameters` MUST be a JSON-encoded STRING (not an object) for classic builds.
 */
export async function queueBuild(
  settings: WorkspaceConnectionSettings,
  params: QueueBuildParams,
): Promise<QueuedBuildResult> {
  assertSettings(settings);
  if (!Number.isInteger(params.definitionId) || params.definitionId <= 0) {
    throw new Error('A valid pipeline (build definition) id is required to queue a build.');
  }

  const apiVersion = normalizeApiVersion(settings.apiVersion);
  const urlCandidates = getUrlCandidates(settings);
  let lastError: unknown;

  const body: Record<string, unknown> = {
    definition: { id: params.definitionId },
  };
  const sourceBranch = params.sourceBranch?.trim();
  if (sourceBranch) body.sourceBranch = sourceBranch;
  const agentSpecification = params.agentSpecification?.trim();
  if (agentSpecification) body.agentSpecification = { identifier: agentSpecification };
  if (params.parameters && Object.keys(params.parameters).length > 0) {
    body.parameters = JSON.stringify(params.parameters);
  }
  if (params.demands && params.demands.length > 0) {
    body.demands = params.demands;
  }

  for (const baseUrl of urlCandidates) {
    try {
      const url = `${baseUrl}/_apis/build/builds?api-version=${encodeURIComponent(apiVersion)}`;
      const response = await postJson<{
        id: number;
        buildNumber?: string;
        status?: string;
        definition?: { name?: string };
        _links?: { web?: { href?: string } };
      }>(url, settings.patToken.trim(), body, 'application/json', 'queue the build');

      return {
        id: Number(response.id),
        buildNumber: normalizeFieldText(response.buildNumber).trim() || String(response.id),
        status: normalizeFieldText(response.status).trim() || 'queued',
        definitionName: normalizeFieldText(response.definition?.name).trim() || undefined,
        webUrl: normalizeFieldText(response._links?.web?.href).trim() || undefined,
      };
    } catch (error) {
      lastError = error;
      if (error instanceof ADORequestError && error.status === 404) {
        continue;
      }
      throw humanizeUnexpectedError('queue the build', error);
    }
  }

  if (lastError instanceof Error) {
    throw humanizeUnexpectedError('queue the build', lastError);
  }
  throw new Error("We couldn't queue the build. Please try again.");
}

export interface BuildDefinitionSummary {
  id: number;
  name: string;
}

/**
 * List all build definitions (pipelines) so the UI can offer a picker showing
 * "Name (#id)" instead of asking the user to type a bare id.
 *
 *   GET {base}/_apis/build/definitions?api-version=...&queryOrder=definitionNameAscending
 */
export async function fetchBuildDefinitions(
  settings: WorkspaceConnectionSettings,
  signal?: AbortSignal,
): Promise<BuildDefinitionSummary[]> {
  assertSettings(settings);
  const apiVersion = normalizeApiVersion(settings.apiVersion);
  const urlCandidates = getUrlCandidates(settings);
  let lastError: unknown;

  for (const baseUrl of urlCandidates) {
    try {
      const url = `${baseUrl}/_apis/build/definitions`
        + `?queryOrder=definitionNameAscending`
        + `&$top=2000`
        + `&api-version=${encodeURIComponent(apiVersion)}`;
      const response = await fetchJsonWithAction<ADOListResponse<{ id: number; name?: string }>>(
        url,
        settings.patToken.trim(),
        'load pipelines',
        signal,
      );
      return (response.value ?? [])
        .map((def) => ({
          id: Number(def.id),
          name: normalizeFieldText(def.name).trim(),
        }))
        .filter((def) => Number.isInteger(def.id) && def.id > 0);
    } catch (error) {
      lastError = error;
      if (error instanceof ADORequestError && error.status === 404) {
        continue;
      }
      throw humanizeUnexpectedError('load pipelines', error);
    }
  }

  if (lastError instanceof Error) {
    throw humanizeUnexpectedError('load pipelines', lastError);
  }
  throw new Error("We couldn't load pipelines. Please try again.");
}

export async function fetchTestConfigurations(
  settings: WorkspaceConnectionSettings,
  signal?: AbortSignal,
): Promise<ADOTestConfigurationSummary[]> {
  assertSettings(settings);
  const apiVersion = normalizeApiVersion(settings.apiVersion);
  const candidateUrls = buildBaseApiUrls(settings).map(
    (baseApi) => `${baseApi}/testplan/configurations?api-version=${encodeURIComponent(apiVersion)}`,
  );

  let lastError: unknown = null;
  for (const url of candidateUrls) {
    try {
      const response = await fetchJsonWithAction<ADOListResponse<ADOTestConfigurationListItem>>(
        url,
        settings.patToken.trim(),
        'load test configurations',
        signal,
      );
      return (response.value ?? [])
        .map((configuration) => ({
          id: Number(configuration.id),
          name: normalizeFieldText(configuration.name).trim() || `Configuration ${configuration.id ?? ''}`.trim(),
        }))
        .filter((configuration) => Number.isInteger(configuration.id) && configuration.id > 0);
    } catch (error) {
      lastError = error;
      if (error instanceof ADORequestError && error.status === 404) {
        continue;
      }
      throw humanizeUnexpectedError('load test configurations', error);
    }
  }

  if (lastError instanceof Error) {
    throw humanizeUnexpectedError('load test configurations', lastError);
  }
  throw new Error("We couldn't load test configurations. Please try again.");
}

export async function fetchTestPointsForSuite(
  settings: WorkspaceConnectionSettings,
  planId: number,
  suiteId: number,
  signal?: AbortSignal,
): Promise<ADOTestPointSummary[]> {
  assertSettings(settings);
  const apiVersion = normalizeApiVersion(settings.apiVersion);
  const encodedPlanId = encodeURIComponent(String(planId));
  const encodedSuiteId = encodeURIComponent(String(suiteId));
  const candidateUrls: string[] = [];

  for (const baseApi of buildBaseApiUrls(settings)) {
    candidateUrls.push(
      `${baseApi}/test/Plans/${encodedPlanId}/Suites/${encodedSuiteId}/points?api-version=${encodeURIComponent(apiVersion)}`,
    );
    candidateUrls.push(
      `${baseApi}/testplan/Plans/${encodedPlanId}/Suites/${encodedSuiteId}/TestPoint?includePointDetails=true&returnIdentityRef=true&api-version=${encodeURIComponent(apiVersion)}`,
    );
  }

  let lastError: unknown = null;
  for (const url of Array.from(new Set(candidateUrls))) {
    try {
      const response = await fetchJsonWithAction<ADOListResponse<Record<string, unknown>>>(url, settings.patToken.trim(), 'load test points', signal);
      return (response.value ?? [])
        .map((item) => {
          const point = item as Record<string, unknown>;
          const configuration = (point.configuration ?? {}) as Record<string, unknown>;
          const results = (point.results ?? {}) as Record<string, unknown>;
          const automationStatus = normalizePointAutomationStatus(point);
          // Match C# behavior: only treat as automated when we have explicit evidence.
          //   - "Automated" / "Yes" (case-insensitive) → true
          //   - "Not Automated" / "Planned" / anything else → false
          //   - Missing status → false (do NOT default to automated)
          const isAutomatedByStatus = /^automated$|^yes$|^true$/i.test(automationStatus || '');
          const isAutomatedFlag = typeof point.isAutomated === 'boolean' ? point.isAutomated : isAutomatedByStatus;

          const outcome = normalizeFieldText(point.outcome ?? results.outcome).trim();
          const state = normalizeFieldText(point.state ?? results.state).trim();
          const lastResultState = normalizeFieldText(
            point.lastResultState ?? results.lastResultState ?? results.state,
          ).trim();
          const isActive = typeof point.isActive === 'boolean' ? point.isActive : undefined;
          const caseId = Number((point.testCase as { id?: unknown } | undefined)?.id);
          const configurationId = Number(configuration.id);

          return {
            id: Number(point.id),
            caseId: Number.isInteger(caseId) && caseId > 0 ? caseId : null,
            outcome,
            state,
            lastResultState,
            isActive,
            configurationId: Number.isInteger(configurationId) && configurationId > 0 ? configurationId : null,
            configurationName: normalizeFieldText(configuration.name).trim(),
            automationStatus,
            isAutomated: Boolean(isAutomatedFlag),
          };
        })
        .filter((point) => Number.isInteger(point.id) && point.id > 0);
    } catch (error) {
      lastError = error;
      if (error instanceof ADORequestError && error.status === 404) {
        continue;
      }
      throw humanizeUnexpectedError('load test points', error);
    }
  }

  if (lastError instanceof Error) {
    throw humanizeUnexpectedError('load test points', lastError);
  }
  throw new Error("We couldn't load test points. Please try again.");
}

/** IDs for one folder name (with vsrm host fallback). */
async function fetchReleaseDefinitionIdsForSingleFolder(
  settings: WorkspaceConnectionSettings,
  folder: string,
  apiVersion: string,
  signal?: AbortSignal,
): Promise<number[]> {
  let lastError: unknown = null;
  for (const releaseBase of buildReleaseBaseApiUrls(settings)) {
    try {
      const url = `${releaseBase}/definitions`
        + `?searchText=${encodeURIComponent(folder)}`
        + `&searchTextContainsFolderName=true`
        + `&api-version=${encodeURIComponent(apiVersion)}`;
      const response = await fetchJsonWithAction<ADOListResponse<Record<string, unknown>>>(
        url,
        settings.patToken.trim(),
        'load release definitions by folder',
        signal,
      );
      return (response.value ?? [])
        .map((definition) => Number(definition.id))
        .filter((id) => Number.isInteger(id) && id > 0);
    } catch (error) {
      lastError = error;
      if (error instanceof ADORequestError && error.status === 404) {
        continue;
      }
      throw humanizeUnexpectedError('load release definitions by folder', error);
    }
  }
  if (lastError instanceof Error) {
    throw humanizeUnexpectedError('load release definitions by folder', lastError);
  }
  throw new Error("We couldn't load release definitions for that folder. Please try again.");
}

/**
 * Resolve the CD pool from one OR MORE release-definition FOLDER names instead
 * of a hand-maintained id list. The input may be a comma- or newline-separated
 * list (e.g. "Overnight CDs A, Overnight CDs B"); each folder is queried
 * separately and the ids are unioned.
 *
 *   GET {vsrm}/release/definitions?searchText={folder}
 *       &searchTextContainsFolderName=true&api-version=...
 *
 * `searchTextContainsFolderName=true` makes ADO match the folder/path rather
 * than the definition name, so every CD inside the folder is returned.
 * Returns the definition ids (deduped, ascending).
 */
export async function fetchReleaseDefinitionIdsByFolder(
  settings: WorkspaceConnectionSettings,
  folderName: string,
  signal?: AbortSignal,
): Promise<number[]> {
  assertSettings(settings);

  // Split on commas / newlines, trim, drop blanks, de-dupe (case-insensitive).
  const seenFolders = new Set<string>();
  const folders = folderName
    .split(/[\n,]+/)
    .map((part) => part.trim())
    .filter((part) => {
      if (!part) return false;
      const key = part.toLowerCase();
      if (seenFolders.has(key)) return false;
      seenFolders.add(key);
      return true;
    });
  if (folders.length === 0) return [];

  const apiVersion = normalizeApiVersion(settings.apiVersion);
  const idSets = await Promise.all(
    folders.map((folder) =>
      fetchReleaseDefinitionIdsForSingleFolder(settings, folder, apiVersion, signal),
    ),
  );

  const unioned = new Set<number>();
  for (const ids of idSets) {
    for (const id of ids) unioned.add(id);
  }
  return Array.from(unioned).sort((a, b) => a - b);
}

export async function fetchReleaseDefinitionAvailability(
  settings: WorkspaceConnectionSettings,
  definitionIds: number[],
  signal?: AbortSignal,
): Promise<ADOReleaseDefinitionAvailability[]> {
  assertSettings(settings);
  const uniqueDefinitionIds = Array.from(
    new Set(definitionIds.filter((id) => Number.isInteger(id) && id > 0)),
  );
  if (uniqueDefinitionIds.length === 0) {
    return [];
  }

  const apiVersion = normalizeApiVersion(settings.apiVersion);
  const definitionIdsCsv = uniqueDefinitionIds.join(',');
  let lastError: unknown = null;

  for (const releaseBase of buildReleaseBaseApiUrls(settings)) {
    try {
      const definitionsUrl = `${releaseBase}/definitions?definitionIdFilter=${encodeURIComponent(definitionIdsCsv)}&$expand=LastRelease,Environments&api-version=${encodeURIComponent(apiVersion)}`;
      const definitionsResponse = await fetchJsonWithAction<ADOListResponse<Record<string, unknown>>>(
        definitionsUrl,
        settings.patToken.trim(),
        'load release definitions',
        signal,
      );

      const definitions = (definitionsResponse.value ?? [])
        .map((definition) => ({
          id: Number(definition.id),
          name: normalizeFieldText(definition.name).trim() || `CD ${definition.id ?? ''}`.trim(),
        }))
        .filter((definition) => Number.isInteger(definition.id) && definition.id > 0);

      const details = await Promise.all(
        definitions.map(async (definition) => {
          const releasesUrl = `${releaseBase}/releases?definitionId=${definition.id}&$top=1&$expand=environments&api-version=${encodeURIComponent(apiVersion)}`;
          const releasesResponse = await fetchJsonWithAction<ADOListResponse<Record<string, unknown>>>(
            releasesUrl,
            settings.patToken.trim(),
            'load release availability',
            signal,
          );
          const latestRelease = (releasesResponse.value ?? [])[0];
          const environments = Array.isArray(latestRelease?.environments)
            ? latestRelease.environments as Array<Record<string, unknown>>
            : [];
          const primaryEnvironment = environments[0] ?? {};
          const environmentStatus = normalizeFieldText(primaryEnvironment.status).trim();
          const releaseId = Number(latestRelease?.id);
          const latestReleaseId = Number.isInteger(releaseId) && releaseId > 0 ? releaseId : null;
          return {
            definitionId: definition.id,
            definitionName: definition.name,
            environmentStatus,
            latestReleaseId,
            isAvailable: !environmentStatus || !isReleaseEnvironmentBusy(environmentStatus),
          } satisfies ADOReleaseDefinitionAvailability;
        }),
      );

      const byId = new Map(details.map((item) => [item.definitionId, item]));
      return uniqueDefinitionIds.map((definitionId) => (
        byId.get(definitionId) ?? {
          definitionId,
          definitionName: `CD ${definitionId}`,
          environmentStatus: '',
          latestReleaseId: null,
          isAvailable: true,
        }
      ));
    } catch (error) {
      lastError = error;
      if (error instanceof ADORequestError && error.status === 404) {
        continue;
      }
      throw humanizeUnexpectedError('load release definitions', error);
    }
  }

  if (lastError instanceof Error) {
    throw humanizeUnexpectedError('load release definitions', lastError);
  }
  throw new Error("We couldn't load release definition availability. Please try again.");
}

/**
 * Fetch work items containing test suite mapping XML
 */
export async function fetchTestSuiteMappings(
  settings: WorkspaceConnectionSettings,
  workItemIds: number[],
  signal?: AbortSignal,
): Promise<Record<number, string>> {
  if (!workItemIds.length) {
    return {};
  }

  const urlCandidates = getUrlCandidates(settings);
  let lastError: unknown;

  for (const baseUrl of urlCandidates) {
    try {
      const mappings: Record<number, string> = {};

      await Promise.all(
        workItemIds.map(async (workItemId) => {
          const url = `${baseUrl}/_apis/wit/workitems/${workItemId}?api-version=${encodeURIComponent(settings.apiVersion)}`;
          const response = await fetchJsonWithAction<ADOWorkItem>(
            url,
            settings.patToken.trim(),
            'load work item mapping',
            signal,
          );

          const parametersField = response.fields?.['Microsoft.VSTS.TCM.Parameters'];
          if (typeof parametersField === 'string') {
            mappings[workItemId] = parametersField;
          }
        }),
      );

      return mappings;
    } catch (error) {
      lastError = error;
      if (error instanceof ADORequestError && error.status === 404) {
        continue;
      }
      throw humanizeUnexpectedError('load work item mappings', error);
    }
  }

  if (lastError instanceof Error) {
    throw humanizeUnexpectedError('load work item mappings', lastError);
  }
  throw new Error("We couldn't load work item mappings. Please try again.");
}

/**
 * Fetch detailed information about a test run (pass/fail counts)
 */
export async function fetchTestRunDetails(
  settings: WorkspaceConnectionSettings,
  runId: number,
  signal?: AbortSignal,
): Promise<Record<string, unknown>> {
  const urlCandidates = getUrlCandidates(settings);
  let lastError: unknown;

  for (const baseUrl of urlCandidates) {
    try {
      const testBase = `${baseUrl}/_apis/test`;
      const url = `${testBase}/Runs/${runId}?api-version=${encodeURIComponent(settings.apiVersion)}`;
      return await fetchJsonWithAction<Record<string, unknown>>(
        url,
        settings.patToken.trim(),
        'load test run details',
        signal,
      );
    } catch (error) {
      lastError = error;
      if (error instanceof ADORequestError && error.status === 404) {
        continue;
      }
      throw humanizeUnexpectedError('load test run details', error);
    }
  }

  if (lastError instanceof Error) {
    throw humanizeUnexpectedError('load test run details', lastError);
  }
  throw new Error("We couldn't load test run details. Please try again.");
}

/**
 * Fetch detailed information about a release
 */
export async function fetchReleaseDetails(
  settings: WorkspaceConnectionSettings,
  releaseId: number,
  signal?: AbortSignal,
): Promise<Record<string, unknown>> {
  // Release management APIs live on vsrm.dev.azure.com, not dev.azure.com.
  let lastError: unknown;

  for (const releaseBase of buildReleaseBaseApiUrls(settings)) {
    try {
      const url = `${releaseBase}/releases/${releaseId}?$expand=environments&api-version=${encodeURIComponent(settings.apiVersion)}`;
      return await fetchJsonWithAction<Record<string, unknown>>(
        url,
        settings.patToken.trim(),
        'load release details',
        signal,
      );
    } catch (error) {
      lastError = error;
      if (error instanceof ADORequestError && error.status === 404) {
        continue;
      }
      throw humanizeUnexpectedError('load release details', error);
    }
  }

  if (lastError instanceof Error) {
    throw humanizeUnexpectedError('load release details', lastError);
  }
  throw new Error("We couldn't load release details. Please try again.");
}

/**
 * Create a test run with selected test point IDs
 */
export async function createTestRun(
  settings: WorkspaceConnectionSettings,
  planId: number,
  suiteId: number,
  pointIds: number[],
  _configurationId: number,
  _signal?: AbortSignal,
): Promise<{ id: number }> {
  const urlCandidates = getUrlCandidates(settings);
  let lastError: unknown;

  for (const baseUrl of urlCandidates) {
    try {
      const testBase = `${baseUrl}/_apis/test`;
      const url = `${testBase}/runs?api-version=${encodeURIComponent(settings.apiVersion)}`;

      // Full payload mirroring C# `TestRunService.cs:17-35`:
      //   isAutomated: true            — distributed run, not manual
      //   state: "NotStarted"          — CRITICAL: prevents ADO from auto-transitioning
      //                                  to "InProgress" before the pipeline picks it up.
      //                                  Without this, VSTest fails with
      //                                  "Run cannot be started from state InProgress".
      //   dtlTestEnvironment           — DTL stub (required for automated runs)
      //   filter                       — vstest source filter
      //   plan: { id: <planId> }       — nested ShallowReference, not flat
      const payload = {
        name: `Run for suite ${suiteId}`,
        isAutomated: true,
        automated: true,
        plan: { id: String(planId) },
        pointIds,
        state: 'NotStarted',
        dtlTestEnvironment: { id: 'vstfs://dummy' },
        filter: {
          sourceFilter: '*.dll',
          testCaseFilter: '',
        },
      };

      const response = await postJson<{ id: number }>(
        url,
        settings.patToken.trim(),
        payload,
        'application/json',
        'create test run',
      );

      return { id: response.id };
    } catch (error) {
      lastError = error;
      if (error instanceof ADORequestError && error.status === 404) {
        continue;
      }
      throw humanizeUnexpectedError('create test run', error);
    }
  }

  if (lastError instanceof Error) {
    throw humanizeUnexpectedError('create test run', lastError);
  }
  throw new Error("We couldn't create the test run. Please try again.");
}

/**
 * Update a test run AFTER creating the release, attaching the release/environment
 * VSTFS URIs and the build reference so ADO knows this run is owned by the pipeline.
 *
 * Mirrors C# `TestRunService.cs:37-52` (UpdateTestRunAsync). Without this step,
 * ADO transitions automated runs to "InProgress" before the pipeline can claim them,
 * causing: "Run <id> cannot be started from state InProgress".
 */
export async function updateTestRunAfterRelease(
  settings: WorkspaceConnectionSettings,
  testRunId: number,
  releaseId: number,
  environmentId: number,
  buildId: number,
  _signal?: AbortSignal,
): Promise<void> {
  const urlCandidates = getUrlCandidates(settings);
  let lastError: unknown;

  for (const baseUrl of urlCandidates) {
    try {
      const url = `${baseUrl}/_apis/test/runs/${testRunId}?api-version=${encodeURIComponent(settings.apiVersion)}`;

      const payload = {
        releaseUri: `vstfs:///ReleaseManagement/Release/${releaseId}`,
        releaseEnvironmentUri: `vstfs:///ReleaseManagement/Environment/${environmentId}`,
        build: { id: String(buildId) },
      };

      const response = await fetch(url, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Basic ${toBasicAuthToken(settings.patToken.trim())}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const body = await response.text();
        const adoErr = new ADORequestError(
          response.status,
          buildAdoErrorMessage('update test run with release context', response.status, body),
        );
        if (response.status === 404) {
          lastError = adoErr;
          continue;
        }
        throw adoErr;
      }

      return; // success
    } catch (error) {
      lastError = error;
      if (error instanceof ADORequestError && error.status === 404) {
        continue;
      }
      throw humanizeUnexpectedError('update test run with release context', error);
    }
  }

  if (lastError instanceof Error) {
    throw humanizeUnexpectedError('update test run with release context', lastError);
  }
  throw new Error("We couldn't update the test run with release context. Please try again.");
}

/**
 * Create a release from a release definition
 */
export interface CreateReleaseOptions {
  /** Artifact alias the release definition expects (from workspace settings). */
  artifactAlias: string;
  /** Environment names to skip auto-deploying when the release is created. */
  manualEnvironments?: string[];
}

export interface CreateReleaseResult {
  id: number;
  /** Environments of the new release, in rank order. Use these IDs for startReleaseEnvironment. */
  environments: Array<{ id: number; name: string; status?: string; rank?: number }>;
}

/**
 * Create a release from a release definition. Mirrors C# `ReleasePipelineService.cs:23-54`:
 *  - vsrm.dev.azure.com endpoint
 *  - reason = "manual"
 *  - artifact alias must match the release definition's artifact alias exactly
 *  - instanceReference carries full build metadata (id, name, branch, version, repo)
 *  - manualEnvironments lists envs that should NOT auto-deploy
 */
export async function createRelease(
  settings: WorkspaceConnectionSettings,
  definitionId: number,
  build: ADOBuildSummary,
  options: CreateReleaseOptions,
  _signal?: AbortSignal,
): Promise<CreateReleaseResult> {
  // Release management APIs live on vsrm.dev.azure.com, not dev.azure.com.
  let lastError: unknown;

  for (const releaseBase of buildReleaseBaseApiUrls(settings)) {
    try {
      const url = `${releaseBase}/releases?api-version=${encodeURIComponent(settings.apiVersion)}`;

      const payload = {
        definitionId,
        description: `Release for build ${build.buildNumber}`,
        artifacts: [
          {
            alias: options.artifactAlias,
            instanceReference: {
              id: String(build.id),
              name: build.buildNumber,
              sourceBranch: build.sourceBranch || undefined,
              sourceVersion: build.sourceVersion || undefined,
              sourceRepositoryId: build.repositoryId || undefined,
              sourceRepositoryType: build.repositoryType || undefined,
            },
          },
        ],
        manualEnvironments: options.manualEnvironments?.length ? options.manualEnvironments : undefined,
        reason: 'manual',
      };

      const response = await postJson<{
        id: number;
        environments?: Array<{ id?: unknown; name?: unknown; status?: unknown; rank?: unknown }>;
      }>(
        url,
        settings.patToken.trim(),
        payload,
        'application/json',
        'create release',
      );

      const environments = (response.environments ?? [])
        .map((env) => ({
          id: Number(env?.id),
          name: String(env?.name ?? '').trim(),
          status: typeof env?.status === 'string' ? env.status : undefined,
          rank: typeof env?.rank === 'number' ? env.rank : undefined,
        }))
        .filter((env) => Number.isFinite(env.id) && env.id > 0)
        .sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0));

      return { id: response.id, environments };
    } catch (error) {
      lastError = error;
      if (error instanceof ADORequestError && error.status === 404) {
        continue;
      }
      throw humanizeUnexpectedError('create release', error);
    }
  }

  if (lastError instanceof Error) {
    throw humanizeUnexpectedError('create release', lastError);
  }
  throw new Error("We couldn't create the release. Please try again.");
}

/**
 * Attach a test run ID to a release environment by writing the run id as an
 * environment variable on the target environment.
 *
 * Mirrors C# ReleasePipelineService.cs:77 — variables go on
 * `release.environments[i].variables`, NOT on `release.variables`. The pipeline
 * task reads `$(test.RunId)` or the legacy typo `$(test.RundId)`; we set both
 * so either pipeline configuration works without further coordination.
 */
export async function attachTestRunToRelease(
  settings: WorkspaceConnectionSettings,
  releaseId: number,
  environmentId: number,
  testRunId: number,
  _signal?: AbortSignal,
): Promise<void> {
  // Release management APIs live on vsrm.dev.azure.com, not dev.azure.com.
  let lastError: unknown;

  for (const releaseBase of buildReleaseBaseApiUrls(settings)) {
    try {
      const url = `${releaseBase}/releases/${releaseId}?api-version=${encodeURIComponent(settings.apiVersion)}`;

      const currentRelease = await fetchJsonWithAction<Record<string, unknown>>(
        url,
        settings.patToken.trim(),
        'fetch release for attachment',
      );

      const envs = Array.isArray(currentRelease.environments)
        ? (currentRelease.environments as Array<Record<string, unknown>>)
        : [];

      const targetIdx = envs.findIndex((env) => Number(env.id) === environmentId);
      const idx = targetIdx >= 0 ? targetIdx : 0;

      if (envs.length === 0) {
        throw new Error(`Release ${releaseId} has no environments to attach the test run to.`);
      }

      const targetEnv = envs[idx];
      const targetVars = (targetEnv.variables as Record<string, unknown>) || {};
      const runIdStr = String(testRunId);

      const updatedEnvs = envs.map((env, envIndex) => {
        if (envIndex !== idx) return env;

        // Also patch the last workflow task's `tcmTestRun` input directly with the
        // numeric run id, mirroring C# `ReleasePipelineService.cs:81`. Belt-and-suspenders:
        // if the env-variable substitution fails for any reason, the task input is
        // already resolved to the literal id.
        const phases = Array.isArray(env.deployPhasesSnapshot)
          ? (env.deployPhasesSnapshot as Array<Record<string, unknown>>)
          : [];
        const patchedPhases = phases.map((phase, phaseIdx) => {
          if (phaseIdx !== 0) return phase;
          const tasks = Array.isArray(phase.workflowTasks)
            ? (phase.workflowTasks as Array<Record<string, unknown>>)
            : [];
          if (tasks.length === 0) return phase;
          // Find the LAST workflow task that has a `tcmTestRun` input — that's the VSTest task.
          let targetTaskIndex = -1;
          for (let i = tasks.length - 1; i >= 0; i -= 1) {
            const inputs = tasks[i]?.inputs as Record<string, unknown> | undefined;
            if (inputs && 'tcmTestRun' in inputs) {
              targetTaskIndex = i;
              break;
            }
          }
          // If no task explicitly defines tcmTestRun, fall back to last task (C# does this).
          if (targetTaskIndex < 0) targetTaskIndex = tasks.length - 1;
          const patchedTasks = tasks.map((task, taskIdx) => {
            if (taskIdx !== targetTaskIndex) return task;
            const inputs = (task.inputs as Record<string, unknown>) || {};
            return {
              ...task,
              inputs: {
                ...inputs,
                tcmTestRun: runIdStr,
              },
            };
          });
          return { ...phase, workflowTasks: patchedTasks };
        });

        return {
          ...env,
          variables: {
            ...targetVars,
            // Both keys: matches both pipeline configurations
            'test.RunId': { value: runIdStr, isSecret: false },
            'test.RundId': { value: runIdStr, isSecret: false },
          },
          deployPhasesSnapshot: patchedPhases,
        };
      });

      const payload = {
        ...currentRelease,
        environments: updatedEnvs,
      };

      await putJson<Record<string, unknown>>(
        url,
        settings.patToken.trim(),
        payload,
        'application/json',
        'attach test run to release',
      );
      return; // success — stop trying alternate hosts
    } catch (error) {
      lastError = error;
      if (error instanceof ADORequestError && error.status === 404) {
        continue;
      }
      throw humanizeUnexpectedError('attach test run to release', error);
    }
  }

  if (lastError instanceof Error) {
    throw humanizeUnexpectedError('attach test run to release', lastError);
  }
  throw new Error("We couldn't attach the test run to the release. Please try again.");
}

/**
 * Start a release environment deployment
 */
export async function startReleaseEnvironment(
  settings: WorkspaceConnectionSettings,
  releaseId: number,
  environmentId: number,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _signal?: AbortSignal,
): Promise<void> {
  // Release management APIs live on vsrm.dev.azure.com, not dev.azure.com.
  // ADO expects a plain JSON body `{ status: "inProgress" }`, NOT JSON Patch.
  let lastError: unknown;

  for (const releaseBase of buildReleaseBaseApiUrls(settings)) {
    try {
      const url = `${releaseBase}/releases/${releaseId}/environments/${environmentId}?api-version=${encodeURIComponent(settings.apiVersion)}`;

      const response = await fetch(url, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Basic ${toBasicAuthToken(settings.patToken.trim())}`,
        },
        body: JSON.stringify({
          status: 'inProgress',
          comment: 'Started by Bromcom Test Run Builder',
        }),
      });

      if (!response.ok) {
        const body = await response.text();
        const adoErr = new ADORequestError(
          response.status,
          buildAdoErrorMessage('start release environment', response.status, body),
        );
        if (response.status === 404) {
          lastError = adoErr;
          continue;
        }
        throw adoErr;
      }

      return; // success — stop trying alternate hosts
    } catch (error) {
      lastError = error;
      if (error instanceof ADORequestError && error.status === 404) {
        continue;
      }
      throw humanizeUnexpectedError('start release environment', error);
    }
  }

  if (lastError instanceof Error) {
    throw humanizeUnexpectedError('start release environment', lastError);
  }
  throw new Error("We couldn't start the release environment. Please try again.");
}
