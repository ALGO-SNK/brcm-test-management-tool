import type {
  ADOListResponse,
  ADOTestCase,
  ADOTestCaseListItem,
  ADOTestPlan,
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

async function fetchJson<T>(url: string, patToken: string): Promise<T> {
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: `Basic ${toBasicAuthToken(patToken)}`,
    },
  });

  if (!response.ok) {
    const body = await response.text();
    const details = body.trim().slice(0, 240);
    throw new ADORequestError(response.status, `ADO request failed (${response.status}): ${details || response.statusText}`);
  }

  return (await response.json()) as T;
}

async function patchJson<T>(
  url: string,
  patToken: string,
  operations: Array<{ op: string; path: string; value: unknown }>,
): Promise<T> {
  const response = await fetch(url, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json-patch+json',
      Accept: 'application/json',
      Authorization: `Basic ${toBasicAuthToken(patToken)}`,
    },
    body: JSON.stringify(operations),
  });

  if (!response.ok) {
    const body = await response.text();
    const details = body.trim().slice(0, 240);
    throw new ADORequestError(response.status, `ADO PATCH request failed (${response.status}): ${details || response.statusText}`);
  }

  return (await response.json()) as T;
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

  const selfHref = normalizedItem.links?._self?.href ?? fallbackSelfHref;
  const workItemHref = normalizedItem.links?.workItem?.href;
  return {
    id: workItemId,
    name: normalizedItem.workItem?.name?.trim() || normalizeFieldText(normalizedItem.name).trim() || `Test Case ${workItemId}`,
    state,
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

export async function fetchPlans(settings: WorkspaceConnectionSettings): Promise<ADOTestPlan[]> {
  assertSettings(settings);

  const apiVersion = normalizeApiVersion(settings.apiVersion);
  const url = `${buildBaseApiUrl(settings)}/testplan/plans?api-version=${encodeURIComponent(apiVersion)}`;
  const data = await fetchJson<ADOListResponse<ADOTestPlan>>(url, settings.patToken.trim());

  const plans = Array.isArray(data.value) ? data.value : [];
  writeCacheEntry(getPlansCacheKey(settings), plans);
  return plans;
}

export async function fetchSuitesForPlan(
  settings: WorkspaceConnectionSettings,
  plan: ADOTestPlan,
): Promise<unknown> {
  assertSettings(settings);

  const apiVersion = normalizeApiVersion(settings.apiVersion);
  const selfHref = getPlanSelfHref(plan);

  const url = selfHref
    ? buildSuitesUrlFromSelf(selfHref, apiVersion)
    : `${buildBaseApiUrl(settings)}/testplan/Plans/${encodeURIComponent(String(plan.id))}/suites?asTreeView=True&api-version=${encodeURIComponent(apiVersion)}`;

  const response = await fetchJson<unknown>(url, settings.patToken.trim());
  writeCacheEntry(getSuitesCacheKey(settings, plan.id), response);
  return response;
}

export async function fetchTestCasesForSuite(
  settings: WorkspaceConnectionSettings,
  planId: number,
  suiteId: number,
  suiteTestCasesHref?: string,
  suiteSelfHref?: string,
): Promise<ADOTestCase[]> {
  assertSettings(settings);

  const apiVersions = getApiVersionCandidates(settings.apiVersion);
  const encodedPlanId = encodeURIComponent(String(planId));
  const encodedSuiteId = encodeURIComponent(String(suiteId));
  const baseApi = buildBaseApiUrl(settings);
  const candidateUrls: string[] = [];

  for (const apiVersion of apiVersions) {
    if (suiteTestCasesHref) {
      candidateUrls.push(withApiVersion(suiteTestCasesHref, apiVersion));
      candidateUrls.push(withApiVersion(suiteTestCasesHref.replace(/\/TestCase(\?|$)/i, '/TestCases$1'), apiVersion));
      candidateUrls.push(withApiVersion(suiteTestCasesHref.replace(/\/testcases(\?|$)/i, '/TestCase$1'), apiVersion));
    }

    if (suiteSelfHref) {
      candidateUrls.push(deriveTestCaseUrlFromSuiteSelf(suiteSelfHref, apiVersion, false));
      candidateUrls.push(deriveTestCaseUrlFromSuiteSelf(suiteSelfHref, apiVersion, true));
    }

    const encodedApiVersion = encodeURIComponent(apiVersion);
    candidateUrls.push(`${baseApi}/testplan/Plans/${encodedPlanId}/Suites/${encodedSuiteId}/TestCase?api-version=${encodedApiVersion}`);
    candidateUrls.push(`${baseApi}/testplan/Plans/${encodedPlanId}/Suites/${encodedSuiteId}/TestCases?api-version=${encodedApiVersion}`);
    candidateUrls.push(`${baseApi}/test/Plans/${encodedPlanId}/Suites/${encodedSuiteId}/testcases?api-version=${encodedApiVersion}`);
  }

  const uniqueCandidateUrls = Array.from(new Set(candidateUrls));

  let lastError: unknown = null;

  for (const url of uniqueCandidateUrls) {
    try {
      const response = await fetchJson<ADOListResponse<ADOTestCaseListItem | Record<string, unknown>>>(url, settings.patToken.trim());
      const selfHref = url.split('?')[0];
      const mappedCases = (response.value ?? [])
        .map((item) => mapTestCaseListItemToCase(item, selfHref))
        .filter((item): item is ADOTestCase => item !== null);

      writeCacheEntry(getTestCasesCacheKey(settings, planId, suiteId), mappedCases);
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
    throw new Error(`Failed to load test cases from ADO suite endpoint variants: ${lastError.message}`);
  }

  throw new Error('Failed to load test cases from ADO suite endpoint variants.');
}

export async function fetchTestCaseDetail(
  settings: WorkspaceConnectionSettings,
  caseId: number,
  preferredHref?: string,
  fallbackCase?: ADOTestCase,
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
      const workItem = await fetchJson<ADOWorkItem>(url, settings.patToken.trim());

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

        console.debug('[ADO API] ========== FULL FIELD DEBUG ==========');
        console.debug('[ADO API] ✅ Successfully fetched Work Item ID:', workItem.id);
        console.debug('[ADO API] API URL used:', url);
        console.debug('[ADO API] All custom fields found:', customFields);
        console.debug('[ADO API] ✅ CUSTOM FIELD VALUES:', requiredFields);
        console.debug('[ADO API] Total fields in response:', Object.keys(workItem.fields).length);

        // Show fields that might match our expected ones with different casing
        const possibleMatches = Object.keys(workItem.fields).filter(k =>
          k.toLowerCase().includes('testing') ||
          k.toLowerCase().includes('region') ||
          k.toLowerCase().includes('process') ||
          k.toLowerCase().includes('step')
        );
        if (possibleMatches.length > 0) {
          console.debug('[ADO API] Fields matching keywords:', possibleMatches);
        }
        console.debug('[ADO API] ====================================');

        if (customFields.length === 0) {
          console.warn('[ADO API] ⚠️ WARNING: No custom fields in this work item!');
          console.warn('[ADO API] Work Item ID:', workItem.id, '(may not have values set)');
        } else {
          console.log('[ADO API] ✅ SUCCESS: Custom fields found and will be displayed');
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
    throw new Error(`Failed to load work item details from ADO: ${lastError.message}`);
  }

  throw new Error('Failed to load work item details from ADO.');
}

export async function updateTestCase(
  settings: WorkspaceConnectionSettings,
  caseId: number,
  updateData: {
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
    throw new Error('No fields to update');
  }

  let lastError: unknown = null;

  for (const url of candidateUrls) {
    try {
      const updatedWorkItem = await patchJson<ADOWorkItem>(url, settings.patToken.trim(), operations);
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
    throw new Error(`Failed to update work item in ADO: ${lastError.message}`);
  }

  throw new Error('Failed to update work item in ADO.');
}

/**
 * Helper function to POST JSON data to ADO API
 */
async function postJson<T>(
  url: string,
  patToken: string,
  body: unknown,
  contentType: string = 'application/json',
): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': contentType,
      Accept: 'application/json',
      Authorization: `Basic ${toBasicAuthToken(patToken)}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const body = await response.text();
    const details = body.trim().slice(0, 240);
    throw new ADORequestError(response.status, `ADO POST request failed (${response.status}): ${details || response.statusText}`);
  }

  return (await response.json()) as T;
}

/**
 * Create a new test case in Azure DevOps
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
    throw new Error(`Failed to create test case in ADO: ${lastError.message}`);
  }

  throw new Error('Failed to create test case in ADO.');
}
