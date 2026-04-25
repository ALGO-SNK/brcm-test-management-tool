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

  const withoutProtocol = trimmed
    .replace(/^https?:\/\//i, '')
    .replace(/^dev\.azure\.com\//i, '')
    .replace(/^\/+|\/+$/g, '');

  const firstSegment = withoutProtocol.split('/').filter(Boolean)[0];
  return firstSegment ?? '';
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

function buildBaseApiUrl(settings: WorkspaceConnectionSettings): string {
  const organization = normalizeOrganization(settings.organization);
  const project = encodeURIComponent(normalizeProjectName(settings.projectName));
  return `https://dev.azure.com/${organization}/${project}/_apis`;
}

function buildBaseWebUrl(settings: WorkspaceConnectionSettings): string {
  const organization = normalizeOrganization(settings.organization);
  const project = encodeURIComponent(normalizeProjectName(settings.projectName));
  return `https://dev.azure.com/${organization}/${project}`;
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
  operations: Array<{ op: string; path: string; value: unknown }>,
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

function normalizeFieldText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  return '';
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
  const order = typeof normalizedItem.sequenceNumber === 'number'
    ? normalizedItem.sequenceNumber
    : typeof normalizedItem.order === 'number'
      ? normalizedItem.order
      : undefined;

  const selfHref = normalizedItem.links?._self?.href ?? fallbackSelfHref;
  const workItemHref = normalizedItem.links?.workItem?.href;
  return {
    id: workItemId,
    name: normalizedItem.workItem?.name?.trim() || normalizeFieldText(normalizedItem.name).trim() || `Test Case ${workItemId}`,
    state,
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
  const url = `${buildBaseApiUrl(settings)}/testplan/plans?api-version=${encodeURIComponent(apiVersion)}`;
  const data = await fetchJsonWithAction<ADOListResponse<ADOTestPlan>>(url, settings.patToken.trim(), 'load test plans', signal);

  const plans = Array.isArray(data.value) ? data.value : [];
  writeCacheEntry(getPlansCacheKey(settings), plans);
  return plans;
}

export async function fetchSuitesForPlan(
  settings: WorkspaceConnectionSettings,
  plan: ADOTestPlan,
  signal?: AbortSignal,
): Promise<unknown> {
  assertSettings(settings);

  const apiVersion = normalizeApiVersion(settings.apiVersion);
  const selfHref = getPlanSelfHref(plan);

  const url = selfHref
    ? buildSuitesUrlFromSelf(selfHref, apiVersion)
    : `${buildBaseApiUrl(settings)}/testplan/Plans/${encodeURIComponent(String(plan.id))}/suites?asTreeView=True&api-version=${encodeURIComponent(apiVersion)}`;

  const response = await fetchJsonWithAction<unknown>(url, settings.patToken.trim(), 'load test suites', signal);
  writeCacheEntry(getSuitesCacheKey(settings, plan.id), response);
  return response;
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
  const baseApi = buildBaseApiUrl(settings);
  const candidateUrls: string[] = [];

  for (const apiVersion of apiVersions) {
    const encodedApiVersion = encodeURIComponent(apiVersion);
    const preferredUrls = [
      `${baseApi}/testplan/Plans/${encodedPlanId}/Suites/${encodedSuiteId}/TestCase?api-version=${encodedApiVersion}`,
      `${baseApi}/testplan/Plans/${encodedPlanId}/Suites/${encodedSuiteId}/TestCases?api-version=${encodedApiVersion}`,
      `${baseApi}/test/Plans/${encodedPlanId}/Suites/${encodedSuiteId}/testcases?api-version=${encodedApiVersion}`,
    ];

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
  const baseApi = buildBaseApiUrl(settings);
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
    candidateUrls.push(`${baseApi}/wit/workitems/${encodedCaseId}?api-version=${encodedApiVersion}`);
    candidateUrls.push(`${baseApi}/wit/workItems/${encodedCaseId}?api-version=${encodedApiVersion}`);
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
  },
  preferredHref?: string,
): Promise<ADOTestCase> {
  assertSettings(settings);

  const apiVersions = getApiVersionCandidates(settings.apiVersion);
  const encodedCaseId = encodeURIComponent(String(caseId));
  const baseApi = buildBaseApiUrl(settings);

  const candidateUrls: string[] = [];
  for (const apiVersion of apiVersions) {
    const encodedApiVersion = encodeURIComponent(apiVersion);
    if (preferredHref) {
      const normalizedWorkItemHref = normalizeWorkItemHref(preferredHref, caseId);
      if (normalizedWorkItemHref) {
        candidateUrls.push(withApiVersion(normalizedWorkItemHref, apiVersion));
      }
    }
    candidateUrls.push(`${baseApi}/wit/workitems/${encodedCaseId}?api-version=${encodedApiVersion}`);
    candidateUrls.push(`${baseApi}/wit/workItems/${encodedCaseId}?api-version=${encodedApiVersion}`);
  }

  // Build PATCH operations using "add" operation (more reliable than "replace")
  const operations: Array<{ op: string; path: string; value: unknown }> = [];

  // Only add operations for fields that have values
  if (updateData.title && updateData.title.trim()) {
    operations.push({ op: 'add', path: '/fields/System.Title', value: updateData.title });
  }
  if (updateData.status) {
    operations.push({ op: 'add', path: '/fields/System.State', value: updateData.status });
  }
  if (updateData.method) {
    operations.push({ op: 'add', path: '/fields/Custom.TestingMethod', value: updateData.method });
  }
  if (updateData.region) {
    operations.push({ op: 'add', path: '/fields/Custom.ApplicableRegions', value: updateData.region });
  }
  if (updateData.execProcess) {
    operations.push({ op: 'add', path: '/fields/Custom.ExecutiveProcess', value: updateData.execProcess });
  }
  if (updateData.pltpProcess) {
    operations.push({ op: 'add', path: '/fields/Custom.PLTPProcessArea', value: updateData.pltpProcess });
  }
  if (updateData.initialSteps !== undefined && updateData.initialSteps.trim()) {
    operations.push({ op: 'add', path: '/fields/Custom.InitialStep', value: updateData.initialSteps });
  }
  // Always update steps XML if provided (most important field)
  if (updateData.stepsXml) {
    operations.push({ op: 'add', path: '/fields/Microsoft.VSTS.TCM.Steps', value: updateData.stepsXml });
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
  const baseApi = buildBaseApiUrl(settings);
  let lastError: unknown = null;

  for (const apiVersion of apiVersions) {
    const encodedApiVersion = encodeURIComponent(apiVersion);
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
  const baseApi = buildBaseApiUrl(settings);
  let lastError: unknown = null;

  for (const apiVersion of apiVersions) {
    const encodedApiVersion = encodeURIComponent(apiVersion);
    const url = `${baseApi}/testplan/Plans/${encodedPlanId}/suites?api-version=${encodedApiVersion}`;
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
  const baseApi = buildBaseApiUrl(settings);

  let lastError: unknown = null;

  for (const apiVersion of apiVersions) {
    const encodedApiVersion = encodeURIComponent(apiVersion);

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

  if (lastError instanceof Error) {
    throw humanizeUnexpectedError('create the test case', lastError);
  }

  throw new Error("We couldn't create the test case. Please try again.");
}
