const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync, spawn } = require('node:child_process');
const { EventEmitter } = require('node:events');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const { app, BrowserWindow, shell, ipcMain, dialog } = require('electron');
const { autoUpdater } = require('electron-updater');
const { getOrCreateDb, closeDb, getLiveDb, createSeedDb, getLiveDbPath } = require('./db/manager.cjs');
const { getConfig, setConfig, getMeta, setMeta } = require('./db/config-dao.cjs');
const { performLegacyImport } = require('./db/legacy-import.cjs');

const APP_ID = 'com.bromcom.testbuilder';
const PRODUCT_NAME = 'Bromcom Test Builder';
const SPLASH_MIN_MS = 2000;
const DB_UPDATER_CONFIG = {
  rootDirectory: 'C:\\Automation Tests\\Database',
  browserName: 'Chrome',
  defaultTargets: [
    {
      key: 'main',
      label: 'Main plan',
      planId: 78806,
      dbName: 'BromcomTestCases.db',
      enabled: true,
    },
    {
      key: 'worldPay',
      label: 'WorldPay plan',
      planId: 139145,
      dbName: 'BromcomWorldPayTestCases.db',
      enabled: true,
    },
  ],
};
const DB_UPDATER_WORK_ITEM_FIELDS = [
  'System.Title',
  'Microsoft.VSTS.TCM.AutomationStatus',
  'Microsoft.VSTS.TCM.AutomatedTestName',
  'Microsoft.VSTS.TCM.Steps',
  'Custom.InitialStep',
];
const DB_UPDATER_FETCH_CONCURRENCY = 5;
const DB_UPDATER_FETCH_DELAY_MS = 250;
const SCHEDULER_DEFAULT_CONFIG = {
  enabled: true,
  timezone: 'Asia/Kolkata',
  pollSeconds: 30,
  defaultCron: '0 0 1 * * *',
  defaultMode: 'nightly_full',
  defaultBatchSize: 10,
  maxHistoryRows: 500,
};
const SCHEDULER_ALLOWED_MODES = new Set([
  'nightly_full',
  'selected_suite',
  'failed_only_rerun',
]);
const isDev = Boolean(process.env.ELECTRON_RENDERER_URL);
const version = app.getVersion();

let mainWindow = null;
let splashWindow = null;
let splashStartTime = 0;
const dirtySourcesByContentsId = new Map();
const pendingCloseRequestContentsIds = new Set();
const confirmedCloseContentsIds = new Set();
let cachedGitExecutable = undefined;
const activeTestRuns = new Map();
const activeDebugSessions = new Map();
let schedulerTickTimer = null;
let schedulerLastTickAt = 0;
const schedulerExecutionMarkers = new Map();

function resolveAssetFile(fileNames) {
  const names = Array.isArray(fileNames) ? fileNames : [fileNames];
  const assetDirs = [
    path.join(__dirname, '..', 'src', 'assets'),
    path.join(process.resourcesPath || '', 'src', 'assets'),
    path.join(process.cwd(), 'src', 'assets'),
  ];

  for (const dir of assetDirs) {
    for (const name of names) {
      const fullPath = path.join(dir, name);
      if (fs.existsSync(fullPath)) {
        return fullPath;
      }
    }
  }

  return null;
}

const iconCandidates = process.platform === 'win32'
  ? ['app-icon.ico', 'app-icon.png', 'brand-logo.png']
  : ['app-icon.png', 'brand-logo.png', 'app-icon.ico'];

const appIconPath = resolveAssetFile(iconCandidates);
const brandLogoPath = resolveAssetFile(['brand-logo.png', 'Bromcom_logo.svg', 'app-icon.png', 'app-icon.ico']);
const splashHtmlPath = resolveAssetFile('splash.html');

function createSplashWindow() {
  splashWindow = new BrowserWindow({
    width: 560,
    height: 380,
    frame: false,
    resizable: false,
    movable: true,
    minimizable: false,
    maximizable: false,
    show: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    icon: appIconPath || undefined,
    backgroundColor: '#0b1220',
    webPreferences: {
      devTools: false,
    },
  });

  splashWindow.once('ready-to-show', () => {
    splashWindow.show();
  });

  if (splashHtmlPath) {
    splashWindow.loadFile(splashHtmlPath, { query: { version } }).catch(() => {});
  } else {
    splashWindow.loadURL('data:text/html,<body style="background:#0b1220;color:#fff;font-family:Segoe UI,sans-serif;display:flex;align-items:center;justify-content:center;">Loading...</body>').catch(() => {});
  }

  splashStartTime = Date.now();
}

function closeSplashAndShowMain() {
  const elapsed = Date.now() - splashStartTime;
  const remaining = Math.max(0, SPLASH_MIN_MS - elapsed);

  setTimeout(() => {
    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.close();
    }

    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show();
    }
  }, remaining);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    show: false,
    autoHideMenuBar: true,
    icon: appIconPath || undefined,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });
  const mainWindowContentsId = mainWindow.webContents.id;

  mainWindow.once('ready-to-show', () => {
    closeSplashAndShowMain();
  });

  if (isDev) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL).catch(() => {});
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html')).catch(() => {});
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url).catch(() => {});
    return { action: 'deny' };
  });

  mainWindow.webContents.on('did-fail-load', () => {
    closeSplashAndShowMain();
  });

  mainWindow.on('close', (event) => {
    const { webContents } = mainWindow;

    if (!webContents || webContents.isDestroyed()) {
      return;
    }

    if (confirmedCloseContentsIds.has(mainWindowContentsId)) {
      confirmedCloseContentsIds.delete(mainWindowContentsId);
      return;
    }

    const dirtySources = dirtySourcesByContentsId.get(mainWindowContentsId);
    if (!dirtySources || dirtySources.size === 0) {
      return;
    }

    event.preventDefault();

    if (!pendingCloseRequestContentsIds.has(mainWindowContentsId)) {
      pendingCloseRequestContentsIds.add(mainWindowContentsId);
      webContents.send('app:window-close-requested');
    }
  });

  mainWindow.on('closed', () => {
    dirtySourcesByContentsId.delete(mainWindowContentsId);
    pendingCloseRequestContentsIds.delete(mainWindowContentsId);
    confirmedCloseContentsIds.delete(mainWindowContentsId);
    try { stopRepoWatcher(); } catch { /* ignore */ }
    mainWindow = null;
  });
}

function setupAutoUpdate() {
  autoUpdater.logger = console;
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('checking-for-update', () => {
    console.log('Checking for update...');
  });

  autoUpdater.on('update-available', (info) => {
    console.log('Update available:', info.version);
  });

  autoUpdater.on('update-not-available', (info) => {
    console.log('No update available:', info.version);
  });

  autoUpdater.on('error', (err) => {
    console.error('Auto-update error:', err);
  });

  autoUpdater.on('download-progress', (progress) => {
    console.log(`Download: ${Math.round(progress.percent)}%`);
  });

  autoUpdater.on('update-downloaded', async (info) => {
    const result = await dialog.showMessageBox({
      type: 'info',
      buttons: ['Restart now', 'Later'],
      defaultId: 0,
      cancelId: 1,
      title: 'Update ready',
      message: `Version ${info.version} has been downloaded.`,
      detail: 'Restart the app to install the update.',
    });

    if (result.response === 0) {
      autoUpdater.quitAndInstall();
    }
  });
}

function normalizeDirectoryPath(input) {
  if (typeof input !== 'string') {
    throw new Error('A folder path is required.');
  }

  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error('A folder path is required.');
  }

  const resolved = path.resolve(trimmed);
  if (!fs.existsSync(resolved)) {
    throw new Error('The selected folder does not exist.');
  }

  const stats = fs.statSync(resolved);
  if (!stats.isDirectory()) {
    throw new Error('The selected path is not a folder.');
  }

  return resolved;
}

function readDirectoryEntries(targetPath) {
  const normalizedPath = normalizeDirectoryPath(targetPath);
  const entries = fs.readdirSync(normalizedPath, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() || entry.isFile())
    .map((entry) => ({
      name: entry.name,
      path: path.join(normalizedPath, entry.name),
      type: entry.isDirectory() ? 'directory' : 'file',
    }))
    .sort((left, right) => {
      if (left.type !== right.type) {
        return left.type === 'directory' ? -1 : 1;
      }
      return left.name.localeCompare(right.name, undefined, { numeric: true, sensitivity: 'base' });
    });

  return entries;
}

function normalizeAdoOrganization(input) {
  const trimmed = typeof input === 'string' ? input.trim() : '';
  if (!trimmed) {
    return '';
  }

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
    // Fall back to string cleanup.
  }

  const withoutProtocol = trimmed.replace(/^https?:\/\//i, '').replace(/^\/+|\/+$/g, '');
  const withoutKnownHosts = withoutProtocol
    .replace(/^dev\.azure\.com\//i, '')
    .replace(/^([^.]+)\.visualstudio\.com(?:\/|$)/i, '$1/');
  return withoutKnownHosts.split('/').filter(Boolean)[0]?.replace(/\.visualstudio\.com$/i, '') ?? '';
}

function assertDbUpdaterSettings(settings) {
  const organization = normalizeAdoOrganization(settings?.organization);
  const projectName = typeof settings?.projectName === 'string' ? settings.projectName.trim() : '';
  const patToken = typeof settings?.patToken === 'string' ? settings.patToken.trim() : '';
  const apiVersion = typeof settings?.apiVersion === 'string' && settings.apiVersion.trim()
    ? settings.apiVersion.trim()
    : '7.1';

  if (!organization) {
    throw new Error('Organization is required in Workspace Settings.');
  }
  if (!projectName) {
    throw new Error('Project is required in Workspace Settings.');
  }
  if (!patToken) {
    throw new Error('PAT token is required in Workspace Settings.');
  }

  return {
    organization,
    projectName,
    patToken,
    apiVersion,
  };
}

function normalizeDbUpdaterDirectory(settings) {
  const configuredDirectory = typeof settings?.dbDirectory === 'string' ? settings.dbDirectory.trim() : '';
  return configuredDirectory || DB_UPDATER_CONFIG.rootDirectory;
}

function normalizeDbUpdaterFileName(value, fallback) {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  if (!trimmed) {
    return fallback;
  }
  return path.basename(trimmed);
}

function normalizeDbUpdaterTargetKey(value, fallback) {
  const normalized = String(value || '')
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
  return normalized || fallback;
}

function getDbUpdaterConfiguredTargets(settings, rootDirectory) {
  const legacyTargets = DB_UPDATER_CONFIG.defaultTargets.map((target) => ({
    ...target,
    dbName: target.key === 'main'
      ? normalizeDbUpdaterFileName(settings?.mainDbName, target.dbName)
      : target.key === 'worldPay'
        ? normalizeDbUpdaterFileName(settings?.worldPayDbName, target.dbName)
        : normalizeDbUpdaterFileName(target.dbName, target.dbName),
  }));
  const sourceTargets = Array.isArray(settings?.dbMappings) && settings.dbMappings.length
    ? settings.dbMappings
    : legacyTargets;
  const usedKeys = new Set();
  const targets = sourceTargets.map((mapping, index) => {
    const fallbackTarget = legacyTargets[index] || {};
    const label = String(mapping?.label || fallbackTarget.label || `DB mapping ${index + 1}`).trim();
    const baseKey = normalizeDbUpdaterTargetKey(mapping?.id || mapping?.key || label, `mapping-${index + 1}`);
    let key = baseKey;
    let suffix = 2;
    while (usedKeys.has(key)) {
      key = `${baseKey}-${suffix}`;
      suffix += 1;
    }
    usedKeys.add(key);

    const dbName = normalizeDbUpdaterFileName(mapping?.dbName, fallbackTarget.dbName || `Mapping${index + 1}.db`);
    return {
      key,
      label,
      planId: Number(mapping?.planId || fallbackTarget.planId || 0),
      dbName,
      enabled: mapping?.enabled !== false,
      browserName: DB_UPDATER_CONFIG.browserName,
      dbPath: path.join(rootDirectory, dbName),
    };
  }).filter((target) => target.planId > 0 && target.dbName);

  return targets.length ? targets : legacyTargets.map((target) => ({
    ...target,
    browserName: DB_UPDATER_CONFIG.browserName,
    dbPath: path.join(rootDirectory, target.dbName),
  }));
}

function getDbUpdaterRuntimeConfig(settings) {
  const rootDirectory = normalizeDbUpdaterDirectory(settings);
  const targets = getDbUpdaterConfiguredTargets(settings, rootDirectory);

  return {
    rootDirectory,
    browserName: DB_UPDATER_CONFIG.browserName,
    targets,
  };
}

function getDbUpdaterTargetPath(target) {
  return target.dbPath || path.join(DB_UPDATER_CONFIG.rootDirectory, target.dbName);
}

function toBasicAuthTokenNode(patToken) {
  return Buffer.from(`:${patToken}`, 'utf8').toString('base64');
}

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function shouldRetryDbUpdaterRequest(error) {
  const status = Number(error?.status);
  return status === 401
    || status === 403
    || status === 408
    || status === 429
    || status === 500
    || status === 502
    || status === 503
    || status === 504;
}

function withQueryParams(url, params) {
  const [baseUrl, queryString = ''] = url.split('?');
  const searchParams = new URLSearchParams(queryString);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value) !== '') {
      searchParams.set(key, String(value));
    }
  });
  const nextQueryString = searchParams.toString();
  return nextQueryString ? `${baseUrl}?${nextQueryString}` : baseUrl;
}

async function mapWithConcurrency(items, limit, mapper) {
  const results = new Array(items.length);
  let nextIndex = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await mapper(items[currentIndex], currentIndex);
    }
  });
  await Promise.all(workers);
  return results;
}

function buildDbUpdaterBaseApiUrls(settings) {
  const project = encodeURIComponent(settings.projectName);
  return [
    `https://${settings.organization}.visualstudio.com/${project}/_apis`,
    `https://dev.azure.com/${settings.organization}/${project}/_apis`,
  ];
}

async function fetchDbUpdaterRaw(url, patSource, action) {
  let response;
  let lastError = null;
  const patToken = typeof patSource === 'string' ? patSource.trim() : '';
  if (!patToken) {
    throw new Error('PAT token is required in Workspace Settings.');
  }

  for (let attempt = 0; attempt < 7; attempt += 1) {
    try {
      response = await fetch(url, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          Authorization: `Basic ${toBasicAuthTokenNode(patToken)}`,
        },
      });
    } catch {
      lastError = new Error(`Could not ${action}. Check network and Azure DevOps settings.`);
      await delay(150 * (attempt + 1));
      continue;
    }

    if (response.ok) {
      return {
        json: await response.json(),
        continuationToken: response.headers.get('x-ms-continuationtoken')
          ?? response.headers.get('X-MS-ContinuationToken')
          ?? '',
      };
    }

    let detail = '';
    try {
      const body = await response.text();
      detail = body ? ` ${body.slice(0, 240)}` : '';
    } catch {
      // Ignore response text failures.
    }
    const error = new Error(`Could not ${action}. Azure DevOps returned ${response.status}.${detail}`);
    error.status = response.status;
    lastError = error;
    if (!shouldRetryDbUpdaterRequest(error)) {
      throw error;
    }
    await delay(250 * (attempt + 1));
  }

  throw lastError ?? new Error(`Could not ${action}.`);
}

async function fetchDbUpdaterJson(url, patSource, action) {
  const response = await fetchDbUpdaterRaw(url, patSource, action);
  return response.json;
}

async function fetchDbUpdaterRawFromCandidates(urls, patSource, action) {
  let lastError = null;
  for (const url of Array.from(new Set(urls))) {
    try {
      return await fetchDbUpdaterRaw(url, patSource, action);
    } catch (error) {
      lastError = error;
      if (error?.status === 404) {
        continue;
      }
      throw error;
    }
  }

  throw lastError ?? new Error(`Could not ${action}.`);
}

async function fetchDbUpdaterJsonFromCandidates(urls, patSource, action) {
  const response = await fetchDbUpdaterRawFromCandidates(urls, patSource, action);
  return response.json;
}

function collectSuiteNodes(suitesResponse) {
  const roots = Array.isArray(suitesResponse?.value)
    ? suitesResponse.value
    : Array.isArray(suitesResponse)
      ? suitesResponse
      : [];
  const suites = [];

  function visit(suite) {
    if (!suite || typeof suite !== 'object') {
      return;
    }
    const id = Number(suite.id);
    if (Number.isFinite(id)) {
      suites.push({
        id,
        name: typeof suite.name === 'string' ? suite.name : `Suite ${id}`,
        suiteType: normalizeDbText(suite.suiteType ?? suite.SuiteType ?? suite.type),
        selfHref: suite._links?._self?.href ?? suite._links?.self?.href ?? '',
        testCasesHref: suite._links?.testCases?.href ?? '',
      });
    }
    const children = Array.isArray(suite.children) ? suite.children : [];
    children.forEach(visit);
  }

  roots.forEach(visit);
  return suites;
}

function flattenWorkItemFieldList(workItemFields) {
  const fields = {};
  for (const fieldEntry of workItemFields ?? []) {
    if (fieldEntry && typeof fieldEntry === 'object') {
      Object.entries(fieldEntry).forEach(([key, value]) => {
        fields[key] = value;
      });
    }
  }
  return fields;
}

function normalizeDbText(value) {
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return '';
}

function unescapeDbHtml(text) {
  if (!text) {
    return text;
  }
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#(\d+);/g, (_match, code) => String.fromCharCode(Number.parseInt(code, 10)))
    .replace(/&#x([0-9A-Fa-f]+);/g, (_match, code) => String.fromCharCode(Number.parseInt(code, 16)));
}

function getDbUpdaterTokenValue(content, token, delimiter = '|') {
  const startIndex = content.indexOf(token);
  if (startIndex < 0) {
    return '';
  }
  const valueStart = startIndex + token.length;
  const valueEnd = content.indexOf(delimiter, valueStart);
  return (valueEnd >= 0 ? content.slice(valueStart, valueEnd) : content.slice(valueStart)).trim();
}

function toDbUpdaterPlainText(value) {
  return unescapeDbHtml(normalizeDbText(value)).replace(/<[^>]+>/g, '').trim();
}

function parseStepContentToTemplate(content, index) {
  const cleanContent = toDbUpdaterPlainText(content);
  if (!cleanContent) {
    return null;
  }

  const action = toDbUpdaterPlainText(getDbUpdaterTokenValue(content, 'Action='));
  if (!action) {
    return null;
  }

  return {
    testID: 0,
    stepNumber: index + 1,
    actionType: action,
    element: toDbUpdaterPlainText(getDbUpdaterTokenValue(content, 'Element=')),
    elementCategory: toDbUpdaterPlainText(getDbUpdaterTokenValue(content, 'ElementCategory=')),
    elementReplaceTextDataKey: toDbUpdaterPlainText(getDbUpdaterTokenValue(content, 'ElementPathReplaceKey=')),
    isElementPathDynamic: /^true$/i.test(toDbUpdaterPlainText(getDbUpdaterTokenValue(content, 'IsElementPathDynamic='))),
    value: toDbUpdaterPlainText(getDbUpdaterTokenValue(content, 'Value=')),
    description: toDbUpdaterPlainText(getDbUpdaterTokenValue(content, 'Description=')),
    expectedValue: toDbUpdaterPlainText(getDbUpdaterTokenValue(content, 'ExpectedVl=')),
    key: toDbUpdaterPlainText(getDbUpdaterTokenValue(content, 'DataKey=')),
    type: toDbUpdaterPlainText(getDbUpdaterTokenValue(content, 'Type=')),
    headers: toDbUpdaterPlainText(getDbUpdaterTokenValue(content, 'Headers=')),
    isConcatenated: /^true$/i.test(toDbUpdaterPlainText(getDbUpdaterTokenValue(content, 'IsConcatenated='))),
    stepDescription: cleanContent,
  };
}

function parseStepsForDb(xmlString, testId) {
  const input = normalizeDbText(xmlString).trim();
  if (!input) {
    return [];
  }

  const steps = [];
  const parameterizedPattern = /<parameterizedString[^>]*>([\s\S]*?)<\/parameterizedString>/gi;
  let parameterizedMatch;

  while ((parameterizedMatch = parameterizedPattern.exec(input)) !== null) {
    const parsed = parseStepContentToTemplate(parameterizedMatch[1], steps.length);
    if (parsed) {
      parsed.testID = testId;
      steps.push(parsed);
    }
  }

  if (steps.length > 0) {
    return steps;
  }

  input.split(/\r?\n/).forEach((line) => {
    if (!line.includes('Action=')) {
      return;
    }
    const parsed = parseStepContentToTemplate(line, steps.length);
    if (parsed) {
      parsed.testID = testId;
      steps.push(parsed);
    }
  });

  return steps;
}

function parseInitialSteps(value) {
  const text = normalizeDbText(value).trim();
  if (!text) {
    return [];
  }
  return text
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function getDbUpdaterWorkItemId(item) {
  const workItem = item?.workItem ?? item ?? {};
  const id = Number(workItem.id ?? item?.id);
  return Number.isFinite(id) ? id : null;
}

function mapDbUpdaterCase(item, suite, browserName, options = {}) {
  const workItem = item?.workItem ?? item ?? {};
  const testId = getDbUpdaterWorkItemId(item);
  if (!Number.isFinite(testId)) {
    return null;
  }

  const fields = {
    ...flattenWorkItemFieldList(workItem.workItemFields),
    ...(workItem.fields && typeof workItem.fields === 'object' ? workItem.fields : {}),
  };

  const title = normalizeDbText(fields['System.Title'] ?? workItem.name ?? item.name ?? `Test Case ${testId}`);
  const automationStatus = normalizeDbText(fields['Microsoft.VSTS.TCM.AutomationStatus']);
  const automatedTestName = normalizeDbText(fields['Microsoft.VSTS.TCM.AutomatedTestName']);
  const stepsXml = normalizeDbText(fields['Microsoft.VSTS.TCM.Steps']);
  const isAutomationMethod = automationStatus.toLowerCase() === 'automated'
    || automatedTestName.trim().length > 0;
  if ((!isAutomationMethod || !stepsXml.trim()) && !options.includeNonAutomated) {
    return null;
  }

  const steps = parseStepsForDb(stepsXml, testId);
  const initialSteps = parseInitialSteps(fields['Custom.InitialStep']);

  return {
    id: testId,
    title,
    isAutomationMethod,
    automatedTestName,
    browserName,
    initialStepsJson: JSON.stringify(initialSteps),
    testStepsJson: JSON.stringify(steps),
    batchName: suite.name,
    testSuitId: String(suite.id),
  };
}

async function fetchDbUpdaterRowForCase(settings, target, suite, testCaseId) {
  const workItemsById = await fetchDbUpdaterWorkItemsByIds(settings, [testCaseId]);
  const workItem = workItemsById.get(testCaseId);
  if (!workItem) {
    throw new Error(`Test case ${testCaseId} was saved in Azure, but its details could not be loaded for local DB sync.`);
  }

  const row = mapDbUpdaterCase(
    { id: testCaseId, workItem },
    suite,
    target.browserName || DB_UPDATER_CONFIG.browserName,
    { includeNonAutomated: true },
  );

  if (!row) {
    throw new Error(`Test case ${testCaseId} could not be converted into a local DB row.`);
  }

  return row;
}

async function fetchDbUpdaterSuites(settings, planId) {
  const encodedPlanId = encodeURIComponent(String(planId));
  const encodedApiVersion = encodeURIComponent(settings.apiVersion);
  const candidateUrls = buildDbUpdaterBaseApiUrls(settings).map(
    (baseApi) => `${baseApi}/testplan/Plans/${encodedPlanId}/suites?asTreeView=True&api-version=${encodedApiVersion}`,
  );
  const response = await fetchDbUpdaterJsonFromCandidates(candidateUrls, settings.patToken, 'load test suites');
  return collectSuiteNodes(response).filter((suite) => !/dynamic/i.test(suite.suiteType));
}

async function fetchDbUpdaterPlanName(settings, planId) {
  const encodedPlanId = encodeURIComponent(String(planId));
  const encodedApiVersion = encodeURIComponent(settings.apiVersion);
  const candidateUrls = [];

  buildDbUpdaterBaseApiUrls(settings).forEach((baseApi) => {
    candidateUrls.push(`${baseApi}/testplan/Plans/${encodedPlanId}?api-version=${encodedApiVersion}`);
    candidateUrls.push(`${baseApi}/test/Plans/${encodedPlanId}?api-version=${encodedApiVersion}`);
  });

  const response = await fetchDbUpdaterJsonFromCandidates(candidateUrls, settings.patToken, `load plan ${planId}`);
  return typeof response?.name === 'string' && response.name.trim() ? response.name.trim() : null;
}

async function fetchDbUpdaterCasesForSuite(settings, planId, suite) {
  const encodedPlanId = encodeURIComponent(String(planId));
  const encodedSuiteId = encodeURIComponent(String(suite.id));
  const encodedApiVersion = encodeURIComponent(settings.apiVersion);
  const fieldList = DB_UPDATER_WORK_ITEM_FIELDS.join(',');
  const buildCandidateUrls = (continuationToken) => {
    const params = {
      'api-version': settings.apiVersion,
      witFields: fieldList,
      continuationToken,
    };
    const candidateUrls = [];

    if (suite.testCasesHref) {
      candidateUrls.push(withQueryParams(suite.testCasesHref, params));
    }

    if (suite.selfHref) {
      const baseSelf = suite.selfHref.split('?')[0].replace(/\/+$/g, '');
      candidateUrls.push(withQueryParams(`${baseSelf}/TestCase`, params));
      candidateUrls.push(withQueryParams(`${baseSelf}/TestCases`, params));
    }

    buildDbUpdaterBaseApiUrls(settings).forEach((baseApi) => {
      candidateUrls.push(`${baseApi}/testplan/Plans/${encodedPlanId}/Suites/${encodedSuiteId}/TestCase?api-version=${encodedApiVersion}&witFields=${encodeURIComponent(fieldList)}${continuationToken ? `&continuationToken=${encodeURIComponent(continuationToken)}` : ''}`);
      candidateUrls.push(`${baseApi}/testplan/Plans/${encodedPlanId}/Suites/${encodedSuiteId}/TestCases?api-version=${encodedApiVersion}&witFields=${encodeURIComponent(fieldList)}${continuationToken ? `&continuationToken=${encodeURIComponent(continuationToken)}` : ''}`);
      candidateUrls.push(`${baseApi}/test/Plans/${encodedPlanId}/Suites/${encodedSuiteId}/testcases?api-version=${encodedApiVersion}&witFields=${encodeURIComponent(fieldList)}${continuationToken ? `&continuationToken=${encodeURIComponent(continuationToken)}` : ''}`);
    });
    return candidateUrls;
  };

  const testCases = [];
  let continuationToken = '';
  do {
    await delay(DB_UPDATER_FETCH_DELAY_MS);
    const response = await fetchDbUpdaterRawFromCandidates(
      buildCandidateUrls(continuationToken),
      settings.patToken,
      `load test cases for suite ${suite.id}`,
    );
    if (Array.isArray(response.json?.value)) {
      testCases.push(...response.json.value);
    }
    continuationToken = response.continuationToken
      || normalizeDbText(response.json?.continuationToken ?? response.json?.ContinuationToken);
  } while (continuationToken);

  return testCases;
}

async function fetchDbUpdaterWorkItemsByIds(settings, ids) {
  const uniqueIds = Array.from(new Set(ids.filter((id) => Number.isFinite(id))));
  if (uniqueIds.length === 0) {
    return new Map();
  }

  const encodedApiVersion = encodeURIComponent(settings.apiVersion);
  const fields = DB_UPDATER_WORK_ITEM_FIELDS.join(',');
  const result = new Map();

  for (let offset = 0; offset < uniqueIds.length; offset += 200) {
    const batchIds = uniqueIds.slice(offset, offset + 200);
    const encodedIds = encodeURIComponent(batchIds.join(','));
    const encodedFields = encodeURIComponent(fields);
    const candidateUrls = buildDbUpdaterBaseApiUrls(settings).map(
      (baseApi) => `${baseApi}/wit/workitems?ids=${encodedIds}&fields=${encodedFields}&api-version=${encodedApiVersion}`,
    );
    const response = await fetchDbUpdaterJsonFromCandidates(
      candidateUrls,
      settings.patToken,
      `load ${batchIds.length} work item detail${batchIds.length === 1 ? '' : 's'}`,
    );
    const workItems = Array.isArray(response?.value) ? response.value : [];
    workItems.forEach((workItem) => {
      const id = Number(workItem?.id);
      if (Number.isFinite(id)) {
        result.set(id, workItem);
      }
    });
  }

  return result;
}

function parseDbUpdaterJsonArrayLength(value) {
  if (typeof value !== 'string' || !value.trim()) {
    return 0;
  }
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.length : 0;
  } catch {
    return 0;
  }
}

function getDbRowValue(row, ...keys) {
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(row, key)) {
      return row[key];
    }
  }
  return undefined;
}

const DB_UPDATER_TABLE_COLUMNS = [
  'Id',
  'Title',
  'IsAutomationMethod',
  'AutomatedTestName',
  'BrowserName',
  'InitialStepsJson',
  'TestStepsJson',
  'BatchName',
  'TestSuitId',
];

async function ensureDbUpdaterTable(db) {
  const existingColumns = await db.all('PRAGMA table_info(TestCaseDao);');
  const columnNames = existingColumns.map((column) => column.name);
  const hasExpectedSchema = DB_UPDATER_TABLE_COLUMNS.every((columnName, index) => (
    columnNames[index] === columnName
  )) && (!existingColumns.length || Number(existingColumns[0]?.pk ?? 0) === 1);

  if (existingColumns.length > 0 && !hasExpectedSchema) {
    await db.exec('DROP TABLE TestCaseDao;');
  }

  await db.exec(`
    CREATE TABLE IF NOT EXISTS TestCaseDao (
      Id integer NOT NULL PRIMARY KEY,
      Title varchar,
      IsAutomationMethod integer,
      AutomatedTestName varchar,
      BrowserName varchar,
      InitialStepsJson varchar,
      TestStepsJson varchar,
      BatchName varchar,
      TestSuitId varchar
    );
  `);
}

async function readDbUpdaterTarget(target) {
  const dbPath = getDbUpdaterTargetPath(target);
  const baseResult = {
    target: target.key,
    label: target.label,
    planId: target.planId,
    planName: null,
    dbName: target.dbName,
    dbPath,
    exists: fs.existsSync(dbPath),
    tableExists: false,
    rowCount: 0,
    automatedCount: 0,
    rows: [],
    error: null,
  };

  if (!baseResult.exists) {
    return baseResult;
  }

  let db = null;
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
      mode: sqlite3.OPEN_READONLY,
    });

    const table = await db.get(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'TestCaseDao';",
    );
    if (!table) {
      return baseResult;
    }

    const countRow = await db.get('SELECT COUNT(*) AS rowCount FROM TestCaseDao;');
    const automatedRow = await db.get('SELECT COUNT(*) AS automatedCount FROM TestCaseDao WHERE "IsAutomationMethod" = 1;');
    const rows = await db.all(`
      SELECT
        "Id" AS "id",
        "Title" AS "title",
        "IsAutomationMethod" AS "isAutomationMethod",
        "AutomatedTestName" AS "automatedTestName",
        "BrowserName" AS "browserName",
        "InitialStepsJson" AS "initialStepsJson",
        "TestStepsJson" AS "testStepsJson",
        "BatchName" AS "batchName",
        "TestSuitId" AS "testSuitId"
      FROM TestCaseDao
      ORDER BY "Id";
    `);

    return {
      ...baseResult,
      tableExists: true,
      rowCount: Number(countRow?.rowCount ?? rows.length),
      automatedCount: Number(automatedRow?.automatedCount ?? 0),
      rows: rows.map((row) => ({
        id: Number(getDbRowValue(row, 'id', 'Id')),
        title: normalizeDbText(getDbRowValue(row, 'title', 'Title')),
        isAutomationMethod: Boolean(getDbRowValue(row, 'isAutomationMethod', 'IsAutomationMethod')),
        automatedTestName: normalizeDbText(getDbRowValue(row, 'automatedTestName', 'AutomatedTestName')),
        browserName: normalizeDbText(getDbRowValue(row, 'browserName', 'BrowserName')),
        batchName: normalizeDbText(getDbRowValue(row, 'batchName', 'BatchName')),
        testSuitId: normalizeDbText(getDbRowValue(row, 'testSuitId', 'TestSuitId')),
        initialStepsJson: normalizeDbText(getDbRowValue(row, 'initialStepsJson', 'InitialStepsJson')),
        testStepsJson: normalizeDbText(getDbRowValue(row, 'testStepsJson', 'TestStepsJson')),
        initialStepCount: parseDbUpdaterJsonArrayLength(getDbRowValue(row, 'initialStepsJson', 'InitialStepsJson')),
        testStepCount: parseDbUpdaterJsonArrayLength(getDbRowValue(row, 'testStepsJson', 'TestStepsJson')),
      })),
    };
  } catch (error) {
    return {
      ...baseResult,
      error: error instanceof Error ? error.message : 'Could not read database.',
    };
  } finally {
    if (db) {
      await db.close();
    }
  }
}

function parseInitialStepSearchNames(input) {
  const raw = Array.isArray(input) ? input.join(',') : String(input ?? '');
  const seen = new Set();
  return raw
    .split(',')
    .map((part) => part.trim())
    .filter((part) => {
      if (!part) return false;
      const key = part.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function safeParseJsonArray(value) {
  const text = normalizeDbText(value).trim();
  if (!text) return [];
  try {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function searchInitialStepsInDb(settingsInput, payload) {
  const names = parseInitialStepSearchNames(payload?.names);
  const planId = Number(payload?.planId) || 0;
  const result = {
    query: names,
    results: [],
    searchedDbs: [],
    missingDbs: [],
    error: null,
  };
  if (names.length === 0) {
    return result;
  }

  const dbConfig = getDbUpdaterRuntimeConfig(settingsInput);
  const allTargets = dbConfig.targets;

  // Plan-active resolution: if the active plan maps to a target, search only it.
  // Otherwise fall back to the primary + WorldPay default DBs.
  let chosenTargets = [];
  if (planId > 0) {
    chosenTargets = allTargets.filter((target) => Number(target.planId) === planId);
  }
  if (chosenTargets.length === 0) {
    const fallbackPlanIds = new Set(
      DB_UPDATER_CONFIG.defaultTargets.map((target) => Number(target.planId)),
    );
    chosenTargets = allTargets.filter(
      (target) => target.key === 'main'
        || target.key === 'worldPay'
        || fallbackPlanIds.has(Number(target.planId)),
    );
  }
  if (chosenTargets.length === 0) {
    chosenTargets = allTargets;
  }

  const MAX_RESULTS = 200;
  const seenIds = new Set();

  for (const target of chosenTargets) {
    const dbPath = getDbUpdaterTargetPath(target);
    if (!fs.existsSync(dbPath)) {
      result.missingDbs.push(target.dbName);
      continue;
    }
    result.searchedDbs.push(target.dbName);

    let db = null;
    try {
      db = await open({
        filename: dbPath,
        driver: sqlite3.Database,
        mode: sqlite3.OPEN_READONLY,
      });
      const table = await db.get(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'TestCaseDao';",
      );
      if (!table) continue;

      for (const name of names) {
        if (result.results.length >= MAX_RESULTS) break;
        const rows = await db.all(
          `SELECT "Id" AS id, "Title" AS title, "InitialStepsJson" AS initialStepsJson,
                  "TestStepsJson" AS testStepsJson, "BatchName" AS batchName,
                  "TestSuitId" AS testSuitId
             FROM TestCaseDao
            WHERE "Title" LIKE ? COLLATE NOCASE
            ORDER BY "Title"`,
          `%${name}%`,
        );
        for (const row of rows) {
          const id = Number(getDbRowValue(row, 'id', 'Id'));
          const dedupeKey = `${id}`;
          if (!Number.isFinite(id) || seenIds.has(dedupeKey)) continue;
          seenIds.add(dedupeKey);
          result.results.push({
            id,
            title: normalizeDbText(getDbRowValue(row, 'title', 'Title')),
            dbName: target.dbName,
            label: target.label,
            planId: Number(target.planId) || null,
            matchedName: name,
            batchName: normalizeDbText(getDbRowValue(row, 'batchName', 'BatchName')),
            testSuitId: normalizeDbText(getDbRowValue(row, 'testSuitId', 'TestSuitId')),
            initialSteps: safeParseJsonArray(getDbRowValue(row, 'initialStepsJson', 'InitialStepsJson')),
            steps: safeParseJsonArray(getDbRowValue(row, 'testStepsJson', 'TestStepsJson')),
          });
          if (result.results.length >= MAX_RESULTS) break;
        }
      }
    } catch (error) {
      result.error = error instanceof Error ? error.message : 'Could not search the database.';
    } finally {
      if (db) await db.close();
    }
  }

  result.results.sort((a, b) => a.title.localeCompare(b.title));
  return result;
}

async function getDbUpdaterOverview(settingsInput) {
  const dbConfig = getDbUpdaterRuntimeConfig(settingsInput);
  const targets = dbConfig.targets;
  const readTargets = await Promise.all(targets.map(readDbUpdaterTarget));
  const overview = {
    rootDirectory: dbConfig.rootDirectory,
    targetOrder: targets.map((target) => target.key),
    targets: readTargets.reduce((nextTargets, target) => {
      nextTargets[target.target] = target;
      return nextTargets;
    }, {}),
  };

  let settings = null;
  try {
    settings = assertDbUpdaterSettings(settingsInput);
  } catch {
    return overview;
  }

  const planNames = await Promise.allSettled(
    targets.map((target) => fetchDbUpdaterPlanName(settings, target.planId)),
  );

  targets.forEach((target, index) => {
    const result = planNames[index];
    if (result.status === 'fulfilled' && result.value) {
      overview.targets[target.key].planName = result.value;
    }
  });

  return overview;
}

function sendDbUpdaterProgress(sender, runId, update) {
  if (!sender || sender.isDestroyed()) {
    return;
  }
  sender.send('desktop:db-updater-progress', {
    runId,
    target: 'all',
    level: 'info',
    status: 'running',
    timestamp: new Date().toISOString(),
    ...update,
  });
}

async function resetDbUpdaterDatabase(dbPath, sender, runId, target) {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  sendDbUpdaterProgress(sender, runId, {
    target: target.key,
    level: 'info',
    phase: 'database',
    message: `${target.label}: opening ${dbPath}`,
  });

  const db = await open({
    filename: dbPath,
    driver: sqlite3.Database,
  });

  try {
    await db.exec('PRAGMA journal_mode = WAL;');
    await ensureDbUpdaterTable(db);
    sendDbUpdaterProgress(sender, runId, {
      target: target.key,
      level: 'info',
      phase: 'database',
      message: `${target.label}: clearing existing rows`,
    });
    await db.run('DELETE FROM TestCaseDao;');
  } finally {
    await db.close();
  }
}

async function vacuumDbUpdaterDatabase(dbPath, sender, runId, target) {
  const db = await open({
    filename: dbPath,
    driver: sqlite3.Database,
  });

  try {
    sendDbUpdaterProgress(sender, runId, {
      target: target.key,
      level: 'info',
      phase: 'database',
      message: `${target.label}: vacuuming database`,
    });
    await db.exec('VACUUM;');
  } finally {
    await db.close();
  }
}

async function writeDbUpdaterDatabase(dbPath, rows, sender, runId, target) {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  sendDbUpdaterProgress(sender, runId, {
    target: target.key,
    level: 'info',
    phase: 'database',
    message: `${target.label}: inserting ${rows.length} rows`,
  });

  const db = await open({
    filename: dbPath,
    driver: sqlite3.Database,
  });

  try {
    await db.exec('PRAGMA journal_mode = WAL;');
    await ensureDbUpdaterTable(db);
    await db.exec('BEGIN IMMEDIATE TRANSACTION;');
    try {
      const statement = await db.prepare(`
        INSERT INTO TestCaseDao (
          Id,
          Title,
          IsAutomationMethod,
          AutomatedTestName,
          BrowserName,
          InitialStepsJson,
          TestStepsJson,
          BatchName,
          TestSuitId
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);
      `);

      try {
        for (let index = 0; index < rows.length; index += 1) {
          const row = rows[index];
          await statement.run(
            row.id,
            row.title,
            row.isAutomationMethod ? 1 : 0,
            row.automatedTestName,
            row.browserName,
            row.initialStepsJson,
            row.testStepsJson,
            row.batchName,
            row.testSuitId,
          );

          if ((index + 1) % 100 === 0 || index + 1 === rows.length) {
            sendDbUpdaterProgress(sender, runId, {
              target: target.key,
              level: 'info',
              phase: 'database',
              inserted: index + 1,
              total: rows.length,
              message: `${target.label}: inserted ${index + 1} of ${rows.length} rows`,
            });
          }
        }
      } finally {
        await statement.finalize();
      }

      await db.exec('COMMIT;');
    } catch (error) {
      await db.exec('ROLLBACK;');
      throw error;
    }
  } finally {
    await db.close();
  }
}

async function upsertDbUpdaterRow(dbPath, row) {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = await open({
    filename: dbPath,
    driver: sqlite3.Database,
  });

  try {
    await db.exec('PRAGMA journal_mode = WAL;');
    await ensureDbUpdaterTable(db);
    const existing = await db.get('SELECT "Id" FROM TestCaseDao WHERE "Id" = ?;', row.id);
    await db.run(
      `
        INSERT INTO TestCaseDao (
          Id,
          Title,
          IsAutomationMethod,
          AutomatedTestName,
          BrowserName,
          InitialStepsJson,
          TestStepsJson,
          BatchName,
          TestSuitId
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(Id) DO UPDATE SET
          Title = excluded.Title,
          IsAutomationMethod = excluded.IsAutomationMethod,
          AutomatedTestName = excluded.AutomatedTestName,
          BrowserName = excluded.BrowserName,
          InitialStepsJson = excluded.InitialStepsJson,
          TestStepsJson = excluded.TestStepsJson,
          BatchName = excluded.BatchName,
          TestSuitId = excluded.TestSuitId;
      `,
      row.id,
      row.title,
      row.isAutomationMethod ? 1 : 0,
      row.automatedTestName,
      row.browserName,
      row.initialStepsJson,
      row.testStepsJson,
      row.batchName,
      row.testSuitId,
    );

    return {
      action: existing ? 'updated' : 'created',
      row,
      hasAutomation: Boolean(row.isAutomationMethod && row.automatedTestName.trim()),
    };
  } finally {
    await db.close();
  }
}

async function syncDbUpdaterTestCase(settingsInput, payload) {
  const settings = assertDbUpdaterSettings(settingsInput);
  const planId = Number(payload?.planId);
  const suiteId = Number(payload?.suiteId);
  const testCaseId = Number(payload?.testCaseId);
  const suiteName = normalizeDbText(payload?.suiteName) || `Suite ${suiteId}`;

  if (!Number.isFinite(planId) || planId <= 0) {
    throw new Error('Plan id is required for local DB sync.');
  }
  if (!Number.isFinite(suiteId) || suiteId <= 0) {
    throw new Error('Suite id is required for local DB sync.');
  }
  if (!Number.isFinite(testCaseId) || testCaseId <= 0) {
    throw new Error('Test case id is required for local DB sync.');
  }

  const dbConfig = getDbUpdaterRuntimeConfig(settingsInput);
  const target = dbConfig.targets.find((item) => item.enabled && Number(item.planId) === planId);
  if (!target) {
    return {
      status: 'skipped',
      reason: `No enabled DB mapping exists for plan ${planId}.`,
      testCaseId,
      planId,
      suiteId,
    };
  }

  const dbPath = getDbUpdaterTargetPath(target);
  const row = await fetchDbUpdaterRowForCase(settings, target, { id: suiteId, name: suiteName }, testCaseId);
  const result = await upsertDbUpdaterRow(dbPath, row);

  return {
    status: 'complete',
    testCaseId,
    planId,
    suiteId,
    target: target.key,
    label: target.label,
    dbName: target.dbName,
    dbPath,
    action: result.action,
    hasAutomation: result.hasAutomation,
    row: result.row,
  };
}

async function deleteDbUpdaterTestCase(settingsInput, payload) {
  const planId = Number(payload?.planId);
  const testCaseId = Number(payload?.testCaseId);
  if (!Number.isFinite(planId) || planId <= 0) {
    throw new Error('Plan id is required for local DB delete.');
  }
  if (!Number.isFinite(testCaseId) || testCaseId <= 0) {
    throw new Error('Test case id is required for local DB delete.');
  }

  const dbConfig = getDbUpdaterRuntimeConfig(settingsInput);
  const target = dbConfig.targets.find((item) => item.enabled && Number(item.planId) === planId);
  if (!target) {
    return {
      status: 'skipped',
      reason: `No enabled DB mapping exists for plan ${planId}.`,
      planId,
      testCaseId,
    };
  }

  const dbPath = getDbUpdaterTargetPath(target);
  if (!fs.existsSync(dbPath)) {
    return {
      status: 'skipped',
      reason: `Local DB file not found at ${dbPath}.`,
      planId,
      testCaseId,
      target: target.key,
      dbPath,
    };
  }

  const db = await open({
    filename: dbPath,
    driver: sqlite3.Database,
  });
  try {
    await ensureDbUpdaterTable(db);
    const result = await db.run('DELETE FROM TestCaseDao WHERE "Id" = ?;', testCaseId);
    return {
      status: 'complete',
      planId,
      testCaseId,
      target: target.key,
      dbPath,
      deleted: Number(result?.changes ?? 0),
    };
  } finally {
    await db.close();
  }
}

async function fetchDbUpdaterRowsForTarget(settings, target, sender, runId) {
  sendDbUpdaterProgress(sender, runId, {
    target: target.key,
    level: 'info',
    phase: 'fetch',
    status: 'running',
    message: `${target.label}: loading suites for plan ${target.planId}`,
  });

  const suites = await fetchDbUpdaterSuites(settings, target.planId);
  sendDbUpdaterProgress(sender, runId, {
    target: target.key,
    level: 'info',
    phase: 'fetch',
    totalSuites: suites.length,
    message: `${target.label}: found ${suites.length} suites`,
  });

  const suiteRows = await mapWithConcurrency(suites, DB_UPDATER_FETCH_CONCURRENCY, async (suite, index) => {
    sendDbUpdaterProgress(sender, runId, {
      target: target.key,
      level: 'info',
      phase: 'fetch',
      currentSuite: index + 1,
      totalSuites: suites.length,
      fetched: 0,
      message: `${target.label}: fetching ${suite.name}`,
    });

    const suiteCases = await fetchDbUpdaterCasesForSuite(settings, target.planId, suite);
    const suiteCaseIds = suiteCases.map(getDbUpdaterWorkItemId).filter((id) => id !== null);
    if (suiteCaseIds.length > 0) {
      sendDbUpdaterProgress(sender, runId, {
        target: target.key,
        level: 'info',
        phase: 'fetch',
        currentSuite: index + 1,
        totalSuites: suites.length,
        fetched: 0,
        message: `${target.label}: loading ${new Set(suiteCaseIds).size} work item details for ${suite.name}`,
      });
    }
    const workItemsById = await fetchDbUpdaterWorkItemsByIds(settings, suiteCaseIds);
    const uniqueSuiteCaseIdCount = new Set(suiteCaseIds).size;
    if (workItemsById.size !== uniqueSuiteCaseIdCount) {
      throw new Error(
        `${target.label}: loaded ${workItemsById.size} of ${uniqueSuiteCaseIdCount} work item details for suite ${suite.name}`,
      );
    }
    return suiteCases.map((item) => {
      const itemId = getDbUpdaterWorkItemId(item);
      const detailedWorkItem = itemId === null ? null : workItemsById.get(itemId);
      return mapDbUpdaterCase(
        detailedWorkItem ? { ...item, workItem: detailedWorkItem } : item,
        suite,
        target.browserName || DB_UPDATER_CONFIG.browserName,
      );
    }).filter(Boolean);
  });

  const rowsById = new Map();
  suiteRows.flat().forEach((row) => {
    rowsById.set(row.id, row);
  });

  const rows = Array.from(rowsById.values()).sort((left, right) => left.id - right.id);
  sendDbUpdaterProgress(sender, runId, {
    target: target.key,
    level: 'info',
    phase: 'database',
    fetched: rows.length,
    message: `${target.label}: writing ${rows.length} rows`,
  });

  return rows;
}

function getDbUpdaterRunTargets(dbConfig, options) {
  const enabledTargets = dbConfig.targets.filter((target) => target.enabled);
  const requestedIds = Array.isArray(options?.targetIds)
    ? options.targetIds.map((id) => String(id)).filter(Boolean)
    : [];
  if (!requestedIds.length) {
    return enabledTargets;
  }

  const requested = new Set(requestedIds);
  return enabledTargets.filter((target) => requested.has(target.key));
}

async function runDbUpdater(settingsInput, sender, options = {}) {
  const settings = assertDbUpdaterSettings(settingsInput);
  const runtimeSettings = settings;
  const dbConfig = getDbUpdaterRuntimeConfig(settingsInput);
  const runId = `db-update-${Date.now()}`;
  const startedAt = Date.now();
  const targets = getDbUpdaterRunTargets(dbConfig, options);

  if (!targets.length) {
    throw new Error('No enabled DB mappings were selected for refresh.');
  }

  sendDbUpdaterProgress(sender, runId, {
    level: 'info',
    phase: 'start',
    status: 'running',
    message: 'Starting Automated Testing Framework Database Updater...',
  });
  sendDbUpdaterProgress(sender, runId, {
    level: 'info',
    phase: 'start',
    status: 'running',
    message: 'Initializing Personal Access Tokens...',
  });
  sendDbUpdaterProgress(sender, runId, {
    level: 'info',
    phase: 'start',
    status: 'running',
    message: '1 Personal Access Tokens found.',
  });
  sendDbUpdaterProgress(sender, runId, {
    level: 'info',
    phase: 'start',
    status: 'running',
    message: 'Fetching PAT.....',
  });
  sendDbUpdaterProgress(sender, runId, {
    level: 'info',
    phase: 'start',
    status: 'running',
    message: 'Creating Connection.....',
  });
  sendDbUpdaterProgress(sender, runId, {
    level: 'info',
    phase: 'start',
    status: 'running',
    message: 'Using PAT : Workspace Settings',
  });

  const results = [];

  for (const target of targets) {
    const dbPath = getDbUpdaterTargetPath(target);
    try {
      // === Phase 1: FETCH ===
      // Fetch FIRST so we know we have the data before we clear the existing DB.
      // If fetch fails, the existing local DB stays intact (no data loss).
      sendDbUpdaterProgress(sender, runId, {
        target: target.key,
        level: 'info',
        phase: 'fetch',
        status: 'running',
        message: `${target.label}: fetching test cases from Azure DevOps...`,
      });
      const rows = await fetchDbUpdaterRowsForTarget(runtimeSettings, target, sender, runId);
      sendDbUpdaterProgress(sender, runId, {
        target: target.key,
        level: 'info',
        phase: 'fetch',
        status: 'running',
        fetched: rows.length,
        message: `Fetched ${rows.length} test cases from ${target.label}.`,
      });

      // === Phase 2: CLEAR ===
      // Only after a successful fetch do we wipe the existing DB.
      await resetDbUpdaterDatabase(dbPath, sender, runId, target);

      // === Phase 3: UPDATE ===
      sendDbUpdaterProgress(sender, runId, {
        target: target.key,
        level: 'info',
        phase: 'database',
        status: 'running',
        message: `${target.label}: updating test cases into database`,
      });
      await writeDbUpdaterDatabase(dbPath, rows, sender, runId, target);
      await vacuumDbUpdaterDatabase(dbPath, sender, runId, target);
      results.push({
        target: target.key,
        label: target.label,
        dbPath,
        inserted: rows.length,
        status: 'complete',
      });
      sendDbUpdaterProgress(sender, runId, {
        target: target.key,
        level: 'success',
        phase: 'database',
        status: 'complete',
        inserted: rows.length,
        dbPath,
        message: `${target.label}: updated ${rows.length} test cases into database`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : `${target.label}: Local DB update failed.`;
      results.push({
        target: target.key,
        label: target.label,
        dbPath,
        inserted: 0,
        status: 'failed',
        error: message,
      });
      sendDbUpdaterProgress(sender, runId, {
        target: target.key,
        level: 'error',
        phase: 'failed',
        status: 'failed',
        dbPath,
        message,
      });
    }
  }

  const failed = results.filter((result) => result.status === 'failed');
  const status = failed.length === 0 ? 'complete' : failed.length === results.length ? 'failed' : 'partial';
  const durationMs = Date.now() - startedAt;
  sendDbUpdaterProgress(sender, runId, {
    level: failed.length ? 'error' : 'success',
    phase: 'done',
    status,
    durationMs,
    message: failed.length
      ? `Local DB updater finished with ${failed.length} failed target${failed.length > 1 ? 's' : ''}`
      : `Database update completed in ${(durationMs / 1000).toFixed(6)} seconds.`,
  });

  return {
    runId,
    status,
    durationMs,
    results,
  };
}

function normalizeFilePath(input) {
  if (typeof input !== 'string') {
    throw new Error('A file path is required.');
  }

  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error('A file path is required.');
  }

  const resolved = path.resolve(trimmed);
  if (!fs.existsSync(resolved)) {
    throw new Error('The selected file does not exist.');
  }

  const stats = fs.statSync(resolved);
  if (!stats.isFile()) {
    throw new Error('The selected path is not a file.');
  }

  return resolved;
}

function escapeRegExp(input) {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function shouldSkipSearchDirectory(directoryName) {
  return new Set([
    '.git',
    '.vs',
    '.idea',
    'bin',
    'obj',
    'node_modules',
    'packages',
    '.nuget',
  ]).has(directoryName.toLowerCase());
}

function findTestMethodInDirectory(rootPath, methodName) {
  const normalizedRootPath = normalizeDirectoryPath(rootPath);
  const normalizedMethodName = typeof methodName === 'string' ? methodName.trim() : '';
  if (!normalizedMethodName) {
    throw new Error('A method name is required.');
  }

  const methodPattern = new RegExp(`\\bpublic\\s+void\\s+${escapeRegExp(normalizedMethodName)}\\s*\\(`);
  const pendingDirectories = [normalizedRootPath];
  const visitedDirectories = new Set();
  let scannedFiles = 0;

  while (pendingDirectories.length > 0) {
    const currentDirectory = pendingDirectories.shift();
    if (!currentDirectory || visitedDirectories.has(currentDirectory)) {
      continue;
    }
    visitedDirectories.add(currentDirectory);

    let entries = [];
    try {
      entries = fs.readdirSync(currentDirectory, { withFileTypes: true });
    } catch {
      continue;
    }

    const sortedEntries = entries.sort((left, right) => {
      if (left.isDirectory() !== right.isDirectory()) {
        return left.isDirectory() ? -1 : 1;
      }
      return left.name.localeCompare(right.name, undefined, { numeric: true, sensitivity: 'base' });
    });

    for (const entry of sortedEntries) {
      if (!entry.isDirectory()) {
        continue;
      }
      if (!shouldSkipSearchDirectory(entry.name)) {
        pendingDirectories.push(path.join(currentDirectory, entry.name));
      }
    }

    for (const entry of sortedEntries) {
      if (!entry.isFile() || !entry.name.toLowerCase().endsWith('.cs')) {
        continue;
      }

      const filePath = path.join(currentDirectory, entry.name);
      scannedFiles += 1;
      try {
        const content = fs.readFileSync(filePath, 'utf8');
        if (content.includes(normalizedMethodName) && methodPattern.test(content)) {
          return {
            found: true,
            filePath,
            methodName: normalizedMethodName,
            scannedFiles,
          };
        }
      } catch {
        // Continue scanning readable files.
      }
    }
  }

  return {
    found: false,
    filePath: null,
    methodName: normalizedMethodName,
    scannedFiles,
  };
}

function getGitExecutable() {
  if (cachedGitExecutable !== undefined) {
    return cachedGitExecutable;
  }

  const candidates = [
    process.env.GIT_EXECUTABLE,
    'git',
    path.join(process.env.ProgramFiles || '', 'Git', 'cmd', 'git.exe'),
    path.join(process.env.ProgramFiles || '', 'Git', 'bin', 'git.exe'),
    path.join(process.env['ProgramFiles(x86)'] || '', 'Git', 'cmd', 'git.exe'),
    path.join(process.env['ProgramFiles(x86)'] || '', 'Git', 'bin', 'git.exe'),
    path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Git', 'cmd', 'git.exe'),
    path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Git', 'bin', 'git.exe'),
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (candidate !== 'git' && !fs.existsSync(candidate)) {
      continue;
    }

    try {
      execFileSync(candidate, ['--version'], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
        timeout: 5000,
        windowsHide: true,
      });
      cachedGitExecutable = candidate;
      return cachedGitExecutable;
    } catch {
      // Keep trying the remaining candidates.
    }
  }

  cachedGitExecutable = null;
  return cachedGitExecutable;
}

function runGitCommand(workingDirectory, args) {
  const gitExecutable = getGitExecutable();
  if (!gitExecutable) {
    throw new Error('Git executable was not found.');
  }

  try {
    return execFileSync(gitExecutable, ['-C', workingDirectory, ...args], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 15000,
      windowsHide: true,
    }).trim();
  } catch (error) {
    const stderr = error?.stderr?.toString?.().trim();
    const stdout = error?.stdout?.toString?.().trim();
    throw new Error(stderr || stdout || error.message || 'Git command failed.');
  }
}

function findGitRepositoryMetadata(startPath) {
  let currentPath = normalizeDirectoryPath(startPath);

  while (true) {
    const dotGitPath = path.join(currentPath, '.git');
    if (fs.existsSync(dotGitPath)) {
      const stats = fs.statSync(dotGitPath);
      let gitDir = dotGitPath;

      if (stats.isFile()) {
        const dotGitContent = fs.readFileSync(dotGitPath, 'utf8');
        const gitDirMatch = dotGitContent.match(/^gitdir:\s*(.+)$/im);
        if (!gitDirMatch) {
          return null;
        }
        gitDir = path.resolve(currentPath, gitDirMatch[1].trim());
      }

      let commonDir = gitDir;
      const commonDirPath = path.join(gitDir, 'commondir');
      if (fs.existsSync(commonDirPath)) {
        const commonDirValue = fs.readFileSync(commonDirPath, 'utf8').trim();
        if (commonDirValue) {
          commonDir = path.resolve(gitDir, commonDirValue);
        }
      }

      return {
        repositoryRoot: currentPath,
        gitDir,
        commonDir,
      };
    }

    const parentPath = path.dirname(currentPath);
    if (parentPath === currentPath) {
      return null;
    }
    currentPath = parentPath;
  }
}

function readBranchFromGitMetadata(metadata) {
  const headPath = path.join(metadata.gitDir, 'HEAD');
  if (!fs.existsSync(headPath)) {
    return null;
  }

  const headContent = fs.readFileSync(headPath, 'utf8').trim();
  const refMatch = headContent.match(/^ref:\s*refs\/heads\/(.+)$/);
  if (refMatch) {
    return refMatch[1];
  }

  return headContent ? `Detached HEAD ${headContent.slice(0, 7)}` : 'Detached HEAD';
}

function readBranchesFromGitMetadata(metadata, currentBranch) {
  const branchNames = new Set();
  const headsPath = path.join(metadata.commonDir, 'refs', 'heads');

  function walkRefs(basePath, relativePath = '') {
    if (!fs.existsSync(basePath)) {
      return;
    }

    fs.readdirSync(basePath, { withFileTypes: true }).forEach((entry) => {
      const nextRelativePath = relativePath ? `${relativePath}/${entry.name}` : entry.name;
      const nextPath = path.join(basePath, entry.name);
      if (entry.isDirectory()) {
        walkRefs(nextPath, nextRelativePath);
        return;
      }
      if (entry.isFile()) {
        branchNames.add(nextRelativePath);
      }
    });
  }

  walkRefs(headsPath);

  const packedRefsPath = path.join(metadata.commonDir, 'packed-refs');
  if (fs.existsSync(packedRefsPath)) {
    fs.readFileSync(packedRefsPath, 'utf8')
      .split(/\r?\n/)
      .forEach((line) => {
        if (!line || line.startsWith('#') || line.startsWith('^')) {
          return;
        }
        const [, refName] = line.split(/\s+/);
        if (refName?.startsWith('refs/heads/')) {
          branchNames.add(refName.replace(/^refs\/heads\//, ''));
        }
      });
  }

  return Array.from(branchNames)
    .sort((left, right) => left.localeCompare(right, undefined, { sensitivity: 'base' }))
    .map((name) => ({
      name,
      type: 'local',
      current: name === currentBranch,
    }));
}

function readGitBranchesWithCommand(normalizedPath, currentBranch) {
  const output = runGitCommand(normalizedPath, [
    'for-each-ref',
    '--format=%(refname)|%(refname:short)',
    'refs/heads',
    'refs/remotes',
  ]);

  if (!output) {
    return [];
  }

  return output
    .split(/\r?\n/)
    .map((line) => {
      const [refName, shortName] = line.split('|');
      if (!refName || !shortName || /\/HEAD$/.test(refName)) {
        return null;
      }

      const type = refName.startsWith('refs/remotes/') ? 'remote' : 'local';
      return {
        name: shortName,
        type,
        current: type === 'local' && shortName === currentBranch,
      };
    })
    .filter(Boolean)
    .sort((left, right) => {
      if (left.type !== right.type) {
        return left.type === 'local' ? -1 : 1;
      }
      return left.name.localeCompare(right.name, undefined, { sensitivity: 'base' });
    });
}

function readGitBranch(targetPath) {
  const normalizedPath = normalizeDirectoryPath(targetPath);

  try {
    const repositoryRoot = runGitCommand(normalizedPath, ['rev-parse', '--show-toplevel']);
    const branchName = runGitCommand(normalizedPath, ['rev-parse', '--abbrev-ref', 'HEAD']);
    const branch = branchName && branchName !== 'HEAD'
      ? branchName
      : (() => {
        const shortHead = runGitCommand(normalizedPath, ['rev-parse', '--short', 'HEAD']);
        return shortHead ? `Detached HEAD ${shortHead}` : 'Detached HEAD';
      })();

    return {
      branch,
      repositoryRoot,
      isGitRepository: true,
      gitAvailable: true,
      branches: readGitBranchesWithCommand(normalizedPath, branch),
      message: null,
    };
  } catch (error) {
    const metadata = findGitRepositoryMetadata(normalizedPath);
    if (!metadata) {
      return {
        branch: null,
        repositoryRoot: null,
        isGitRepository: false,
        gitAvailable: Boolean(getGitExecutable()),
        branches: [],
        message: null,
      };
    }

    const branch = readBranchFromGitMetadata(metadata);
    return {
      branch,
      repositoryRoot: metadata.repositoryRoot,
      isGitRepository: true,
      gitAvailable: false,
      branches: branch ? readBranchesFromGitMetadata(metadata, branch) : [],
      message: error instanceof Error ? error.message : 'Git executable was not available.',
    };
  }
}

function isLocalChangesBranchSwitchError(error) {
  const message = error instanceof Error ? error.message : String(error || '');
  return /Your local changes to the following files would be overwritten by checkout/i.test(message)
    || /Please commit your changes or stash them before you switch branches/i.test(message);
}

function readGitChangedFiles(normalizedPath) {
  // Use case-insensitive normalized key for dedup. Map.set() with same key
  // overwrites, so duplicates from numstat + status (or rename-related noise)
  // collapse to one entry.
  const changesByKey = new Map();
  const normalizePath = (p) => p.trim().replace(/\\/g, '/');
  const dedupKey = (p) => p.toLowerCase();

  const numstatOutput = runGitCommand(normalizedPath, ['diff', '--numstat', 'HEAD', '--']);
  if (numstatOutput) {
    numstatOutput.split(/\r?\n/).forEach((line) => {
      const [additionsValue, deletionsValue, rawPath] = line.split('\t');
      if (!rawPath) return;
      // Skip rename markers like "old => new" — keep only proper file paths
      if (rawPath.includes(' => ') || rawPath.includes('{')) return;
      const filePath = normalizePath(rawPath);
      changesByKey.set(dedupKey(filePath), {
        path: filePath,
        additions: Number.parseInt(additionsValue, 10) || 0,
        deletions: Number.parseInt(deletionsValue, 10) || 0,
        status: 'modified',
      });
    });
  }

  const statusOutput = runGitCommand(normalizedPath, ['status', '--porcelain=v1', '-z']);
  if (!statusOutput) {
    return Array.from(changesByKey.values());
  }

  const records = statusOutput.split('\0').filter(Boolean);
  for (let index = 0; index < records.length; index += 1) {
    const record = records[index];
    const statusCode = record.slice(0, 2);
    const filePath = normalizePath(record.slice(3));
    if (!filePath) continue;

    if (statusCode[0] === 'R' || statusCode[0] === 'C') {
      index += 1;
    }

    const key = dedupKey(filePath);
    const existing = changesByKey.get(key);
    changesByKey.set(key, {
      path: filePath,
      additions: existing?.additions ?? 0,
      deletions: existing?.deletions ?? 0,
      status: statusCode.trim() || 'modified',
    });
  }

  return Array.from(changesByKey.values())
    .sort((left, right) => left.path.localeCompare(right.path, undefined, { sensitivity: 'base' }));
}

function commitGitChanges(normalizedPath, branchName) {
  runGitCommand(normalizedPath, ['add', '-A']);
  runGitCommand(normalizedPath, [
    'commit',
    '-m',
    `Bromcom Test Builder: save changes before switching to ${branchName}`,
  ]);
}

// ============================================================================
// Git Manager: status, stage/unstage, commit, push/pull/fetch/sync, stash, discard
// ============================================================================

function readGitStatus(targetPath) {
  const normalizedPath = normalizeDirectoryPath(targetPath);
  const branchInfo = readGitBranch(normalizedPath);
  if (!branchInfo.isGitRepository || !branchInfo.gitAvailable) {
    return {
      branch: branchInfo.branch,
      isGitRepository: branchInfo.isGitRepository,
      staged: [],
      unstaged: [],
      untracked: [],
      aheadCount: 0,
      behindCount: 0,
    };
  }

  const staged = [];
  const unstaged = [];
  const untracked = [];

  // Get porcelain status (X = index/staged status, Y = working tree/unstaged status)
  let statusOutput;
  try {
    // Important: do NOT trim — null-byte separator can be eaten by .trim() in some cases.
    // Call the raw exec instead.
    const gitExecutable = getGitExecutable();
    if (gitExecutable) {
      statusOutput = execFileSync(
        gitExecutable,
        ['-C', normalizedPath, 'status', '--porcelain=v1', '-z'],
        { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 15000, windowsHide: true },
      );
    } else {
      statusOutput = '';
    }
  } catch {
    statusOutput = '';
  }

  // Build a numstat lookup for additions/deletions counts
  const stagedNumstat = new Map();
  const unstagedNumstat = new Map();
  try {
    const stagedDiff = runGitCommand(normalizedPath, ['diff', '--numstat', '--cached', '--']);
    stagedDiff.split(/\r?\n/).forEach((line) => {
      const [add, del, file] = line.split('\t');
      if (file) stagedNumstat.set(file, { additions: Number(add) || 0, deletions: Number(del) || 0 });
    });
  } catch { /* empty index ok */ }
  try {
    const unstagedDiff = runGitCommand(normalizedPath, ['diff', '--numstat', '--']);
    unstagedDiff.split(/\r?\n/).forEach((line) => {
      const [add, del, file] = line.split('\t');
      if (file) unstagedNumstat.set(file, { additions: Number(add) || 0, deletions: Number(del) || 0 });
    });
  } catch { /* clean working tree ok */ }

  if (statusOutput) {
    // Debug: log raw porcelain output (visible in Electron main process terminal)
    if (process.env.GIT_STATUS_DEBUG === '1') {
      console.log('[gitStatus] raw output:', JSON.stringify(statusOutput));
    }
    // Track seen paths (case-insensitive) per category to dedupe Windows
    // case-folding artifacts and any double-reporting from git.
    const seenStaged = new Set();
    const seenUnstaged = new Set();
    const seenUntracked = new Set();
    const records = statusOutput.split('\0').filter(Boolean);
    for (let i = 0; i < records.length; i += 1) {
      const record = records[i];
      const xy = record.slice(0, 2);
      const X = xy[0];
      const Y = xy[1];
      // Normalize path: forward slashes, trim trailing/leading whitespace
      const filePath = record.slice(3).trim().replace(/\\/g, '/');
      if (!filePath) continue;
      // Dedup key: case-insensitive normalized path
      const dedupKey = filePath.toLowerCase();
      if (process.env.GIT_STATUS_DEBUG === '1') {
        console.log(`[gitStatus] record="${record}" X="${X}" Y="${Y}" path="${filePath}"`);
      }

      // Renames: next record is the source file (skip)
      if (X === 'R' || X === 'C') {
        i += 1;
      }

      // Untracked
      if (X === '?' && Y === '?') {
        if (!seenUntracked.has(dedupKey)) {
          seenUntracked.add(dedupKey);
          untracked.push({ path: filePath, additions: 0, deletions: 0, status: '?' });
        }
        continue;
      }

      // Conflict (unmerged)
      if (X === 'U' || Y === 'U' || (X === 'A' && Y === 'A') || (X === 'D' && Y === 'D')) {
        if (!seenUnstaged.has(dedupKey)) {
          seenUnstaged.add(dedupKey);
          unstaged.push({ path: filePath, additions: 0, deletions: 0, status: 'U' });
        }
        continue;
      }

      // Staged (X column non-empty, non-?)
      if (X && X !== ' ' && X !== '?') {
        if (!seenStaged.has(dedupKey)) {
          seenStaged.add(dedupKey);
          const meta = stagedNumstat.get(filePath) || { additions: 0, deletions: 0 };
          staged.push({
            path: filePath,
            additions: meta.additions,
            deletions: meta.deletions,
            status: X,
          });
        }
      }

      // Unstaged (Y column non-empty)
      if (Y && Y !== ' ' && Y !== '?') {
        if (!seenUnstaged.has(dedupKey)) {
          seenUnstaged.add(dedupKey);
          const meta = unstagedNumstat.get(filePath) || { additions: 0, deletions: 0 };
          unstaged.push({
            path: filePath,
            additions: meta.additions,
            deletions: meta.deletions,
            status: Y,
          });
        }
      }
    }
  }

  // Ahead/behind counts (compared to upstream)
  let aheadCount = 0;
  let behindCount = 0;
  try {
    const counts = runGitCommand(normalizedPath, ['rev-list', '--left-right', '--count', '@{upstream}...HEAD']);
    const [behindStr, aheadStr] = counts.split(/\s+/);
    behindCount = Number(behindStr) || 0;
    aheadCount = Number(aheadStr) || 0;
  } catch { /* no upstream is fine */ }

  // Sort each group by path
  const sortByPath = (a, b) => a.path.localeCompare(b.path, undefined, { sensitivity: 'base' });
  staged.sort(sortByPath);
  unstaged.sort(sortByPath);
  untracked.sort(sortByPath);

  return {
    branch: branchInfo.branch,
    isGitRepository: true,
    staged,
    unstaged,
    untracked,
    aheadCount,
    behindCount,
  };
}

function gitAddFiles(targetPath, filePaths) {
  const normalizedPath = normalizeDirectoryPath(targetPath);
  const files = Array.isArray(filePaths) ? filePaths.filter(Boolean) : [];
  if (files.length === 0) {
    return { success: false, error: 'No files provided to stage.' };
  }
  try {
    runGitCommand(normalizedPath, ['add', '--', ...files]);
    return { success: true, message: `Staged ${files.length} file(s).` };
  } catch (error) {
    return { success: false, error: error?.message || 'git add failed' };
  }
}

function gitUnstageFiles(targetPath, filePaths) {
  const normalizedPath = normalizeDirectoryPath(targetPath);
  const files = Array.isArray(filePaths) ? filePaths.filter(Boolean) : [];
  if (files.length === 0) {
    return { success: false, error: 'No files provided to unstage.' };
  }
  try {
    // git restore --staged is the modern command; fall back to reset HEAD if it fails
    try {
      runGitCommand(normalizedPath, ['restore', '--staged', '--', ...files]);
    } catch {
      runGitCommand(normalizedPath, ['reset', 'HEAD', '--', ...files]);
    }
    return { success: true, message: `Unstaged ${files.length} file(s).` };
  } catch (error) {
    return { success: false, error: error?.message || 'git unstage failed' };
  }
}

function gitCommitChanges(targetPath, message) {
  const normalizedPath = normalizeDirectoryPath(targetPath);
  const trimmed = typeof message === 'string' ? message.trim() : '';
  if (!trimmed) {
    return { success: false, error: 'Commit message cannot be empty.' };
  }
  try {
    runGitCommand(normalizedPath, ['commit', '-m', trimmed]);
    let commitHash;
    try {
      commitHash = runGitCommand(normalizedPath, ['rev-parse', 'HEAD']);
    } catch { /* ignore */ }
    return { success: true, message: 'Commit created.', commitHash };
  } catch (error) {
    return { success: false, error: error?.message || 'git commit failed' };
  }
}

function gitPush(targetPath) {
  const normalizedPath = normalizeDirectoryPath(targetPath);
  try {
    const output = runGitCommand(normalizedPath, ['push']);
    return { success: true, message: output || 'Pushed to remote.' };
  } catch (error) {
    return { success: false, error: error?.message || 'git push failed' };
  }
}

function gitPull(targetPath) {
  const normalizedPath = normalizeDirectoryPath(targetPath);
  try {
    const output = runGitCommand(normalizedPath, ['pull', '--ff-only']);
    return { success: true, message: output || 'Pulled latest changes.' };
  } catch (error) {
    return { success: false, error: error?.message || 'git pull failed' };
  }
}

function gitFetch(targetPath) {
  const normalizedPath = normalizeDirectoryPath(targetPath);
  try {
    const output = runGitCommand(normalizedPath, ['fetch', '--all', '--prune']);
    return { success: true, message: output || 'Fetched remote refs.' };
  } catch (error) {
    return { success: false, error: error?.message || 'git fetch failed' };
  }
}

function gitSync(targetPath) {
  const normalizedPath = normalizeDirectoryPath(targetPath);
  try {
    runGitCommand(normalizedPath, ['pull', '--ff-only']);
    runGitCommand(normalizedPath, ['push']);
    return { success: true, message: 'Synchronized with remote.' };
  } catch (error) {
    return { success: false, error: error?.message || 'git sync failed' };
  }
}

function gitDiscardFiles(targetPath, filePaths) {
  const normalizedPath = normalizeDirectoryPath(targetPath);
  const files = Array.isArray(filePaths) ? filePaths.filter(Boolean) : [];
  if (files.length === 0) {
    return { success: false, error: 'No files provided to discard.' };
  }
  try {
    // For tracked files: restore (modern) or checkout -- (legacy)
    // For untracked files: clean -f
    const trackedFiles = [];
    const untrackedFiles = [];
    for (const file of files) {
      try {
        runGitCommand(normalizedPath, ['ls-files', '--error-unmatch', '--', file]);
        trackedFiles.push(file);
      } catch {
        untrackedFiles.push(file);
      }
    }
    if (trackedFiles.length > 0) {
      try {
        runGitCommand(normalizedPath, ['restore', '--', ...trackedFiles]);
      } catch {
        runGitCommand(normalizedPath, ['checkout', '--', ...trackedFiles]);
      }
    }
    if (untrackedFiles.length > 0) {
      runGitCommand(normalizedPath, ['clean', '-f', '--', ...untrackedFiles]);
    }
    return { success: true, message: `Discarded ${files.length} file(s).` };
  } catch (error) {
    return { success: false, error: error?.message || 'git discard failed' };
  }
}

function gitStash(targetPath, payload) {
  const normalizedPath = normalizeDirectoryPath(targetPath);
  const message = payload?.message ? String(payload.message) : '';
  const files = Array.isArray(payload?.files) ? payload.files.filter(Boolean) : [];
  try {
    const args = ['stash', 'push', '--include-untracked'];
    if (message) {
      args.push('-m', message);
    }
    if (files.length > 0) {
      args.push('--', ...files);
    }
    const output = runGitCommand(normalizedPath, args);
    return { success: true, message: output || 'Changes stashed.' };
  } catch (error) {
    return { success: false, error: error?.message || 'git stash failed' };
  }
}

function gitStashPop(targetPath, payload) {
  const normalizedPath = normalizeDirectoryPath(targetPath);
  const stashRef = payload?.stashRef ? String(payload.stashRef) : '';
  try {
    const args = ['stash', 'pop'];
    if (stashRef) args.push(stashRef);
    const output = runGitCommand(normalizedPath, args);
    return { success: true, message: output || 'Stash applied.' };
  } catch (error) {
    return { success: false, error: error?.message || 'git stash pop failed' };
  }
}

function gitListStashes(targetPath) {
  const normalizedPath = normalizeDirectoryPath(targetPath);
  try {
    const output = runGitCommand(normalizedPath, ['stash', 'list', '--format=%gd|%s|%cr']);
    if (!output) return [];
    return output.split(/\r?\n/).filter(Boolean).map((line) => {
      const [ref, message, age] = line.split('|');
      return { ref, message: message || '', age: age || '' };
    });
  } catch {
    return [];
  }
}

function switchToKnownBranch(normalizedPath, branchName, branchType, currentInfo) {
  if (branchType === 'remote') {
    const localBranchName = branchName.split('/').slice(1).join('/');
    const existingLocalBranch = currentInfo.branches.find((branch) => (
      branch.type === 'local' && branch.name === localBranchName
    ));
    if (existingLocalBranch) {
      runGitCommand(normalizedPath, ['switch', localBranchName]);
      return;
    }
    runGitCommand(normalizedPath, ['switch', '--track', branchName]);
    return;
  }

  runGitCommand(normalizedPath, ['switch', branchName]);
}

function switchGitBranch(targetPath, targetBranch) {
  const normalizedPath = normalizeDirectoryPath(targetPath);
  const branchName = typeof targetBranch?.name === 'string' ? targetBranch.name.trim() : '';
  const branchType = targetBranch?.type === 'remote' ? 'remote' : 'local';
  const allowCommit = Boolean(targetBranch?.allowCommit);

  if (!branchName) {
    throw new Error('A branch is required.');
  }

  const currentInfo = readGitBranch(normalizedPath);
  if (!currentInfo.isGitRepository) {
    throw new Error('The selected folder is not a Git repository.');
  }
  if (!currentInfo.gitAvailable) {
    throw new Error(currentInfo.message || 'Git executable was not found, so branches cannot be switched.');
  }

  const knownBranch = currentInfo.branches.find((branch) => (
    branch.name === branchName && branch.type === branchType
  ));
  if (!knownBranch) {
    throw new Error('The selected branch was not found in this repository.');
  }

  if (knownBranch.current) {
    return currentInfo;
  }

  try {
    switchToKnownBranch(normalizedPath, branchName, branchType, currentInfo);
  } catch (error) {
    if (!isLocalChangesBranchSwitchError(error)) {
      throw error;
    }

    if (!allowCommit) {
      return {
        ...currentInfo,
        requiresCommit: true,
        changedFiles: readGitChangedFiles(normalizedPath),
        message: 'Local changes would be overwritten by switching branches.',
      };
    }

    commitGitChanges(normalizedPath, branchName);
    switchToKnownBranch(normalizedPath, branchName, branchType, currentInfo);
  }

  return readGitBranch(normalizedPath);
}

function emitTestRunProgress(sender, payload) {
  sender.send('desktop:test-run-progress', {
    ...payload,
    timestamp: new Date().toISOString(),
  });
}

function splitLines(buffer, chunk) {
  const text = `${buffer}${chunk ?? ''}`;
  const lines = text.split(/\r?\n/);
  const rest = lines.pop() ?? '';
  return { lines, rest };
}

function resolveExecutableFromInput(inputPath, workingDirectory, executableNames) {
  const trimmedInput = String(inputPath || '').trim();
  if (!trimmedInput) {
    return '';
  }

  const absolutePath = path.isAbsolute(trimmedInput) ? trimmedInput : path.join(workingDirectory, trimmedInput);
  const resolved = path.resolve(absolutePath);
  if (!fs.existsSync(resolved)) {
    return '';
  }

  const stats = fs.statSync(resolved);
  if (stats.isFile()) {
    return resolved;
  }

  if (!stats.isDirectory()) {
    return '';
  }

  for (const name of executableNames) {
    const candidate = path.join(resolved, name);
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return candidate;
    }
    const nestedCandidate = path.join(resolved, 'netcoredbg', name);
    if (fs.existsSync(nestedCandidate) && fs.statSync(nestedCandidate).isFile()) {
      return nestedCandidate;
    }
  }

  return '';
}

function resolveNetcoreDbgExecutablePath(request, workingDirectory) {
  const isWindows = process.platform === 'win32';
  const executableName = isWindows ? 'netcoredbg.exe' : 'netcoredbg';
  const executableNames = [executableName, 'netcoredbg'];

  const requestedPath = resolveExecutableFromInput(request?.debuggerPath, workingDirectory, executableNames);
  if (requestedPath) {
    return { path: requestedPath, source: 'request.debuggerPath' };
  }

  const envPath = resolveExecutableFromInput(process.env.BCM_NETCOREDBG_PATH, workingDirectory, executableNames);
  if (envPath) {
    return { path: envPath, source: 'BCM_NETCOREDBG_PATH' };
  }

  const searchedCandidates = [];
  const candidateRoots = [
    process.resourcesPath || '',
    path.resolve(__dirname, '..'),
    process.cwd(),
  ].filter(Boolean);

  const platformFolder = isWindows ? 'win-x64' : process.platform === 'darwin' ? 'osx-amd64' : 'linux-amd64';
  const candidateRelativePaths = [
    path.join('tools', 'netcoredbg', platformFolder, 'netcoredbg', executableName),
    path.join('tools', 'netcoredbg', platformFolder, executableName),
    path.join('tools', 'netcoredbg', 'netcoredbg', executableName),
    path.join('tools', 'netcoredbg', executableName),
  ];

  for (const root of candidateRoots) {
    for (const relativeCandidate of candidateRelativePaths) {
      const absoluteCandidate = path.resolve(root, relativeCandidate);
      searchedCandidates.push(absoluteCandidate);
      if (fs.existsSync(absoluteCandidate) && fs.statSync(absoluteCandidate).isFile()) {
        return { path: absoluteCandidate, source: 'bundled-resource' };
      }
    }
  }

  try {
    const locatorCommand = isWindows ? 'where.exe' : 'which';
    const locatorOutput = execFileSync(locatorCommand, ['netcoredbg'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    const located = String(locatorOutput || '')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .find((line) => fs.existsSync(line));
    if (located) {
      return { path: located, source: 'PATH' };
    }
  } catch {
    // Ignore PATH lookup failures and return a clear error below.
  }

  return {
    path: '',
    source: '',
    error: [
      'netcoredbg executable was not found.',
      'Expected bundled path under app resources/tools/netcoredbg.',
      `Searched: ${searchedCandidates.join('; ') || 'none'}`,
    ].join(' '),
  };
}

class NetcoreDbgClient extends EventEmitter {
  constructor(netcoredbgPath = 'netcoredbg') {
    super();
    this.netcoredbgPath = netcoredbgPath;
    this.process = null;
    this.sequence = 1;
    this.buffer = '';
    this.pendingRequests = new Map();
    this.lastStderr = '';
    this.attachedThreadId = null;
  }

  async start() {
    return new Promise((resolve, reject) => {
      let startSettled = false;
      const settleStart = (callback, value) => {
        if (startSettled) return;
        startSettled = true;
        callback(value);
      };

      this.process = spawn(this.netcoredbgPath, ['--interpreter=vscode'], {
        shell: false,
        windowsHide: true,
      });

      this.process.stdout.on('data', (data) => {
        this.handleRawData(data.toString());
      });

      this.process.stderr.on('data', (data) => {
        this.lastStderr = String(data.toString() || '').trim();
      });

      this.process.once('error', (error) => {
        const wrappedError = new Error(`Failed to start debugger (${this.netcoredbgPath}): ${error.message}`);
        settleStart(reject, wrappedError);
        this.failPendingRequests(wrappedError);
      });

      this.process.once('close', (code) => {
        const detail = this.lastStderr ? ` ${this.lastStderr}` : '';
        const closeError = new Error(`Debugger process closed (exit ${code ?? -1}).${detail}`);
        settleStart(reject, closeError);
        this.failPendingRequests(closeError);
      });

      // Allow process to initialize before first DAP request.
      setTimeout(() => {
        settleStart(resolve);
      }, 150);
    });
  }

  async initialize() {
    await this.sendRequest('initialize', {
      clientID: 'bromcom-electron-test-runner',
      clientName: 'Bromcom Electron Test Runner',
      adapterID: 'coreclr',
      pathFormat: 'path',
      linesStartAt1: true,
      columnsStartAt1: true,
      supportsVariableType: true,
      supportsVariablePaging: true,
      supportsRunInTerminalRequest: false,
    });
  }

  async attach(processId) {
    await this.sendRequest('attach', { processId });
  }

  async configurationDone() {
    await this.sendRequest('configurationDone', {});
  }

  async setBreakpoints(sourceFilePath, lines) {
    if (!sourceFilePath || !Array.isArray(lines) || lines.length === 0) {
      return;
    }

    await this.sendRequest('setBreakpoints', {
      source: {
        path: sourceFilePath,
      },
      breakpoints: lines.map((line) => ({ line })),
      sourceModified: false,
    });
  }

  async setExceptionBreakpoints(filters = ['all']) {
    await this.sendRequest('setExceptionBreakpoints', {
      filters,
    });
  }

  async threads() {
    return this.sendRequest('threads', {});
  }

  async stackTrace(threadId, startFrame = 0, levels = 20) {
    return this.sendRequest('stackTrace', {
      threadId,
      startFrame,
      levels,
    });
  }

  async scopes(frameId) {
    return this.sendRequest('scopes', {
      frameId,
    });
  }

  async variables(variablesReference, options = {}) {
    const args = {
      variablesReference,
    };

    if (typeof options.filter === 'string' && options.filter.trim()) {
      args.filter = options.filter.trim();
    }
    if (Number.isInteger(options.start) && options.start >= 0) {
      args.start = options.start;
    }
    if (Number.isInteger(options.count) && options.count >= 0) {
      args.count = options.count;
    }

    return this.sendRequest('variables', args);
  }

  async exceptionInfo(threadId) {
    return this.sendRequest('exceptionInfo', {
      threadId,
    });
  }

  async continue(threadId) {
    const effectiveThreadId = threadId || this.attachedThreadId || 1;
    await this.sendRequest('continue', {
      threadId: effectiveThreadId,
    });
  }

  async next(threadId) {
    const effectiveThreadId = threadId || this.attachedThreadId || 1;
    await this.sendRequest('next', {
      threadId: effectiveThreadId,
    });
  }

  async stepIn(threadId) {
    const effectiveThreadId = threadId || this.attachedThreadId || 1;
    await this.sendRequest('stepIn', {
      threadId: effectiveThreadId,
    });
  }

  async stepOut(threadId) {
    const effectiveThreadId = threadId || this.attachedThreadId || 1;
    await this.sendRequest('stepOut', {
      threadId: effectiveThreadId,
    });
  }

  async pause(threadId) {
    const effectiveThreadId = threadId || this.attachedThreadId || 1;
    await this.sendRequest('pause', {
      threadId: effectiveThreadId,
    });
  }

  async disconnect() {
    try {
      await this.sendRequest('disconnect', {
        restart: false,
        terminateDebuggee: true,
      });
    } catch {
      // Ignore disconnect failures while closing.
    }

    if (this.process && !this.process.killed) {
      this.process.kill();
    }
    this.process = null;
  }

  failPendingRequests(error) {
    for (const pending of this.pendingRequests.values()) {
      pending.reject(error);
    }
    this.pendingRequests.clear();
  }

  sendRequest(command, args) {
    return new Promise((resolve, reject) => {
      if (!this.process || !this.process.stdin.writable) {
        reject(new Error('Debugger process is not running.'));
        return;
      }

      const seq = this.sequence++;
      const message = {
        seq,
        type: 'request',
        command,
        arguments: args,
      };
      this.pendingRequests.set(seq, { resolve, reject });

      const json = JSON.stringify(message);
      const payload = `Content-Length: ${Buffer.byteLength(json, 'utf8')}\r\n\r\n${json}`;
      this.process.stdin.write(payload);
    });
  }

  handleRawData(data) {
    this.buffer += data;

    while (true) {
      const headerEndIndex = this.buffer.indexOf('\r\n\r\n');
      if (headerEndIndex === -1) return;

      const header = this.buffer.slice(0, headerEndIndex);
      const contentLengthMatch = header.match(/Content-Length:\s*(\d+)/i);
      if (!contentLengthMatch) {
        this.buffer = '';
        return;
      }

      const contentLength = Number(contentLengthMatch[1]);
      const messageStartIndex = headerEndIndex + 4;
      const messageEndIndex = messageStartIndex + contentLength;
      if (this.buffer.length < messageEndIndex) return;

      const json = this.buffer.slice(messageStartIndex, messageEndIndex);
      this.buffer = this.buffer.slice(messageEndIndex);

      let message;
      try {
        message = JSON.parse(json);
      } catch {
        continue;
      }
      this.handleMessage(message);
    }
  }

  handleMessage(message) {
    if (message?.type === 'event') {
      this.handleEvent(message);
      this.emit('event', message);
      return;
    }

    if (message?.type !== 'response') {
      return;
    }

    const pending = this.pendingRequests.get(message.request_seq);
    if (!pending) return;
    this.pendingRequests.delete(message.request_seq);

    if (message.success) {
      pending.resolve(message.body ?? message);
      return;
    }

    pending.reject(new Error(message.message || 'Debugger request failed.'));
  }

  handleEvent(message) {
    const eventName = message?.event;
    const body = message?.body || {};

    if (eventName === 'stopped' && Number.isInteger(body.threadId)) {
      this.attachedThreadId = body.threadId;
      return;
    }

    if (eventName === 'thread' && Number.isInteger(body.threadId)) {
      this.attachedThreadId = body.threadId;
    }
  }
}

async function collectDebuggerStopDetails(debuggerClient, requestedThreadId, reason) {
  const MAX_STACK_FRAMES = 20;
  const MAX_SCOPES = 6;
  const MAX_SCOPE_VARIABLES = 120;
  let threadId = Number.isInteger(requestedThreadId) ? requestedThreadId : null;

  if (!threadId) {
    const threadResponse = await debuggerClient.threads();
    const fallbackThread = Array.isArray(threadResponse?.threads)
      ? threadResponse.threads.find((thread) => Number.isInteger(thread?.id))
      : null;
    if (fallbackThread && Number.isInteger(fallbackThread.id)) {
      threadId = fallbackThread.id;
    }
  }

  const details = {
    reason: String(reason || ''),
    threadId,
    sourcePath: '',
    sourceName: '',
    line: 0,
    column: 0,
    description: '',
    callStack: [],
    scopes: [],
  };

  if (!threadId) {
    return details;
  }

  const stackResponse = await debuggerClient.stackTrace(threadId, 0, MAX_STACK_FRAMES);
  const frames = Array.isArray(stackResponse?.stackFrames) ? stackResponse.stackFrames : [];
  details.callStack = frames.map((frame) => ({
    id: Number(frame?.id || 0),
    name: String(frame?.name || ''),
    line: Number(frame?.line || 0),
    column: Number(frame?.column || 0),
    sourcePath: String(frame?.source?.path || ''),
    sourceName: String(frame?.source?.name || ''),
  }));

  const topFrame = details.callStack[0];
  if (topFrame) {
    details.sourcePath = topFrame.sourcePath;
    details.sourceName = topFrame.sourceName;
    details.line = topFrame.line;
    details.column = topFrame.column;
  }

  if (topFrame?.id) {
    const scopesResponse = await debuggerClient.scopes(topFrame.id);
    const scopes = Array.isArray(scopesResponse?.scopes) ? scopesResponse.scopes.slice(0, MAX_SCOPES) : [];

    for (const scope of scopes) {
      const variablesReference = Number(scope?.variablesReference || 0);
      const scopeEntry = {
        name: String(scope?.name || ''),
        expensive: Boolean(scope?.expensive),
        variables: [],
      };

      if (variablesReference > 0) {
        const variablesResponse = await debuggerClient.variables(variablesReference, { start: 0, count: MAX_SCOPE_VARIABLES });
        const variables = Array.isArray(variablesResponse?.variables) ? variablesResponse.variables : [];
        scopeEntry.variables = variables.map((variable) => ({
          name: String(variable?.name || ''),
          value: String(variable?.value || ''),
          type: String(variable?.type || ''),
          variablesReference: Number(variable?.variablesReference || 0),
        }));
      }

      details.scopes.push(scopeEntry);
    }
  }

  if (details.reason === 'exception') {
    try {
      const exception = await debuggerClient.exceptionInfo(threadId);
      const breakMode = String(exception?.breakMode || '').trim();
      const exceptionDescription = String(exception?.description || '').trim();
      const exceptionId = String(exception?.exceptionId || '').trim();
      details.description = [exceptionId, exceptionDescription, breakMode].filter(Boolean).join(' | ');
    } catch {
      // Some adapter versions do not support exceptionInfo.
    }
  }

  return details;
}

function extractTestHostPidFromOutput(output) {
  const line = String(output || '');
  const match = line.match(/Process Id:\s*(\d+)/i)
    || line.match(/process with id:\s*(\d+)/i)
    || line.match(/attach.*(?:pid|process(?:\s+id)?)\s*[:=]?\s*(\d+)/i);

  if (!match) {
    return null;
  }

  const value = Number.parseInt(match[1], 10);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function isRunAttachmentFile(filePath) {
  return /\.(png|jpe?g|gif|bmp|webp|avif|pdf|html?|txt|log|zip)$/i.test(filePath);
}

function collectRecentRunAttachments(directories, runStartedAtMs, expectedBaseNames = []) {
  const attachments = [];
  const seen = new Set();
  const cutoff = Math.max(0, runStartedAtMs - 5000);
  const expectedNames = expectedBaseNames
    .map((name) => String(name || '').trim().toLowerCase())
    .filter(Boolean);

  for (const directory of directories) {
    if (!directory || !fs.existsSync(directory)) continue;
    let entries = [];
    try {
      entries = fs.readdirSync(directory, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      if (!entry.isFile()) continue;
      const filePath = path.join(directory, entry.name);
      if (!isRunAttachmentFile(filePath)) continue;
      let stats;
      try {
        stats = fs.statSync(filePath);
      } catch {
        continue;
      }
      const entryName = entry.name.toLowerCase();
      const isExpectedName = expectedNames.includes(entryName);
      if (!isExpectedName && stats.mtimeMs < cutoff) continue;
      if (seen.has(filePath)) continue;
      seen.add(filePath);
      attachments.push(filePath);
    }
  }

  return attachments.sort((left, right) => {
    try {
      return fs.statSync(right).mtimeMs - fs.statSync(left).mtimeMs;
    } catch {
      return 0;
    }
  });
}

function parseTestNameFromFilter(testFilter) {
  const raw = String(testFilter || '').trim();
  const match = raw.match(/^(?:name=)?(.+)$/i);
  return match ? match[1].trim().replace(/^"|"$/g, '') : '';
}

function findMethodDeclarationLine(filePath, methodName) {
  if (!filePath || !methodName || !fs.existsSync(filePath)) {
    return 0;
  }

  let content = '';
  try {
    content = fs.readFileSync(filePath, 'utf8');
  } catch {
    return 0;
  }

  const methodPattern = new RegExp(`\\b(?:public|private|protected|internal)\\s+(?:async\\s+)?(?:void|Task(?:<[^>]+>)?|ValueTask(?:<[^>]+>)?)\\s+${escapeRegExp(methodName)}\\s*\\(`);
  const lines = content.split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    if (methodPattern.test(lines[index])) {
      return index + 1;
    }
  }

  return 0;
}

function normalizeDebugBreakpoints(inputBreakpoints, workingDirectory) {
  if (!Array.isArray(inputBreakpoints)) {
    return [];
  }

  const normalized = [];
  const seen = new Set();
  for (const entry of inputBreakpoints) {
    const sourcePath = String(entry?.sourcePath || '').trim();
    const line = Number(entry?.line || 0);
    if (!sourcePath || !Number.isInteger(line) || line <= 0) {
      continue;
    }

    const absolutePath = path.isAbsolute(sourcePath) ? sourcePath : path.join(workingDirectory, sourcePath);
    const resolvedPath = path.resolve(absolutePath);
    if (!fs.existsSync(resolvedPath) || !fs.statSync(resolvedPath).isFile()) {
      continue;
    }
    const key = `${resolvedPath.toLowerCase()}::${line}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    normalized.push({
      sourcePath: resolvedPath,
      line,
    });
  }

  return normalized;
}

function inferDebugBreakpoints(workingDirectory, methodName) {
  if (!methodName) {
    return [];
  }

  try {
    const foundMethod = findTestMethodInDirectory(workingDirectory, methodName);
    if (!foundMethod?.found || !foundMethod.filePath) {
      return [];
    }
    const line = findMethodDeclarationLine(foundMethod.filePath, methodName);
    if (!line) {
      return [];
    }
    return [{
      sourcePath: path.resolve(foundMethod.filePath),
      line,
    }];
  } catch {
    return [];
  }
}

function resolveRunFileFromInput(inputPath, workingDirectory, allowedExtensions, requiredLabel) {
  const absolutePath = path.isAbsolute(inputPath) ? inputPath : path.join(workingDirectory, inputPath);
  const resolved = path.resolve(absolutePath);
  if (!fs.existsSync(resolved)) {
    throw new Error(`${requiredLabel} does not exist.`);
  }

  const stats = fs.statSync(resolved);
  if (stats.isFile()) {
    return resolved;
  }

  if (!stats.isDirectory()) {
    throw new Error(`${requiredLabel} is not a file or folder.`);
  }

  const files = fs.readdirSync(resolved, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => path.join(resolved, entry.name))
    .filter((filePath) => allowedExtensions.some((extension) => filePath.toLowerCase().endsWith(extension)))
    .sort((left, right) => left.localeCompare(right));

  if (files.length === 0) {
    throw new Error(`${requiredLabel} folder does not contain a supported file.`);
  }
  return files[0];
}

function findFileByName(rootDirectory, fileName, allowedExtensions, maxDepth = 4) {
  const normalizedName = String(fileName || '').trim().toLowerCase();
  if (!normalizedName || !fs.existsSync(rootDirectory)) {
    return '';
  }

  const ignoredFolderNames = new Set(['.vs', '.git', '.idea', '.vscode', 'node_modules', 'bin', 'obj']);
  const queue = [{ directory: rootDirectory, depth: 0 }];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) continue;

    let entries = [];
    try {
      entries = fs.readdirSync(current.directory, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      const entryPath = path.join(current.directory, entry.name);
      const entryName = entry.name.toLowerCase();
      if (entry.isFile()) {
        if (entryName === normalizedName) {
          return entryPath;
        }
        continue;
      }

      if (!entry.isDirectory()) {
        continue;
      }

      if (entryName.startsWith('.') || ignoredFolderNames.has(entryName)) {
        continue;
      }

      if (current.depth < maxDepth) {
        queue.push({ directory: entryPath, depth: current.depth + 1 });
      }
    }
  }

  return '';
}

function escapeXml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function buildTempRunSettingsXml(patToken) {
  const escapedPat = escapeXml(patToken);
  const parameterNames = ['PAT', 'HG_PAT', 'AP_PAT', 'PR_PAT', 'AR_PAT', 'AB_PAT', 'BB_PAT', 'SM_PAT'];
  const parametersXml = parameterNames
    .map((name) => `    <Parameter name="${name}" value="${escapedPat}" />`)
    .join('\n');

  return `<?xml version="1.0" encoding="utf-8"?>
<RunSettings>
  <TestRunParameters>
${parametersXml}
  </TestRunParameters>
</RunSettings>
`;
}

function createTempRunSettingsFile(runId, patToken) {
  const tempDir = path.join(os.tmpdir(), 'bcm-testbuilder');
  fs.mkdirSync(tempDir, { recursive: true });
  const tempPath = path.join(tempDir, `runsettings-${runId}.runsettings`);
  fs.writeFileSync(tempPath, buildTempRunSettingsXml(patToken), 'utf8');
  return tempPath;
}

function resolveOptionalRunSettingsPath(inputPath, workingDirectory) {
  const trimmedInput = String(inputPath || '').trim();
  if (!trimmedInput) {
    return '';
  }

  const directPath = path.isAbsolute(trimmedInput) ? trimmedInput : path.join(workingDirectory, trimmedInput);
  const resolvedDirectPath = path.resolve(directPath);
  if (fs.existsSync(resolvedDirectPath)) {
    const stats = fs.statSync(resolvedDirectPath);
    if (stats.isFile()) {
      return resolvedDirectPath;
    }
  }

  const fallbackPath = findFileByName(
    workingDirectory,
    path.basename(trimmedInput),
    ['.runsettings'],
  );
  return fallbackPath || '';
}

function startDotnetTestRun(request, sender) {
  const workingDirectory = normalizeDirectoryPath(request?.workingDirectory || '');
  const projectPathInput = String(request?.projectPath || '').trim();
  if (!projectPathInput) {
    throw new Error('Project path is required.');
  }
  const projectPath = resolveRunFileFromInput(projectPathInput, workingDirectory, ['.csproj'], 'Project path');
  const testFilter = String(request?.testFilter || '').trim();
  if (!testFilter) {
    throw new Error('Test filter is required.');
  }

  const logger = String(request?.logger || 'console;verbosity=detailed').trim() || 'console;verbosity=detailed';
  const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const runStartedAtMs = Date.now();
  const projectOutputDirectory = path.join(path.dirname(projectPath), 'bin', 'Debug', 'net8.0');
  const patToken = typeof request?.patToken === 'string' ? request.patToken.trim() : '';
  const requestedRunSettingsPath = String(request?.runSettingsPath || '').trim();
  const resolvedRunSettingsPath = requestedRunSettingsPath
    ? resolveOptionalRunSettingsPath(requestedRunSettingsPath, workingDirectory)
    : '';
  const tempRunSettingsPath = !resolvedRunSettingsPath && patToken ? createTempRunSettingsFile(runId, patToken) : '';
  const runSettingsPath = resolvedRunSettingsPath || tempRunSettingsPath;

  const args = ['test', projectPath, '--filter', testFilter, '--logger', logger];
  if (runSettingsPath) {
    args.push('--settings', runSettingsPath);
  }
  const env = { ...process.env };
  if (patToken) {
    env.ADO_PAT = patToken;
  }

  emitTestRunProgress(sender, {
    runId,
    status: 'running',
    level: 'info',
    message: `Starting: dotnet ${args.map((item) => `"${item}"`).join(' ')}`,
    stream: 'system',
  });

  const child = spawn('dotnet', args, {
    cwd: workingDirectory,
    env,
    windowsHide: true,
  });

  activeTestRuns.set(runId, child);

  let isFinalized = false;
  let stdoutBuffer = '';
  let stderrBuffer = '';
  let runOutputText = '';
  const testOutputDirectories = new Set();
  const testName = parseTestNameFromFilter(testFilter);
  const expectedAttachmentNames = testName ? [`${testName}.jpg`, `${testName}.png`] : [];
  testOutputDirectories.add(projectOutputDirectory);

  const rememberOutputDirectory = (line) => {
    const text = String(line || '').trim();
    const assemblyPath = text.match(/(?:Running all tests in|->)\s+(.+\.(?:dll|exe))$/i)?.[1]?.trim();
    if (!assemblyPath) return;
    const resolvedAssemblyPath = path.resolve(assemblyPath);
    testOutputDirectories.add(path.dirname(resolvedAssemblyPath));
  };

  child.stdout.on('data', (chunk) => {
    if (isFinalized) return;
    const parsed = splitLines(stdoutBuffer, chunk.toString('utf8'));
    stdoutBuffer = parsed.rest;
    for (const line of parsed.lines) {
      if (!line.trim()) continue;
      runOutputText += `${line}\n`;
      rememberOutputDirectory(line);
      emitTestRunProgress(sender, { runId, status: 'running', level: 'info', message: line, stream: 'stdout' });
    }
  });

  child.stderr.on('data', (chunk) => {
    if (isFinalized) return;
    const parsed = splitLines(stderrBuffer, chunk.toString('utf8'));
    stderrBuffer = parsed.rest;
    for (const line of parsed.lines) {
      if (!line.trim()) continue;
      runOutputText += `${line}\n`;
      emitTestRunProgress(sender, { runId, status: 'running', level: 'error', message: line, stream: 'stderr' });
    }
  });

  return new Promise((resolve, reject) => {
    const cleanupTempRunSettings = () => {
      if (!tempRunSettingsPath) return;
      try {
        if (fs.existsSync(tempRunSettingsPath)) {
          fs.unlinkSync(tempRunSettingsPath);
        }
      } catch {
        // Ignore cleanup failures.
      }
    };

    const finalizeRun = (code, signal) => {
      if (isFinalized) return;
      isFinalized = true;

      activeTestRuns.delete(runId);
      cleanupTempRunSettings();

      if (stdoutBuffer.trim()) {
        runOutputText += `${stdoutBuffer.trim()}\n`;
        rememberOutputDirectory(stdoutBuffer.trim());
        emitTestRunProgress(sender, { runId, status: 'running', level: 'info', message: stdoutBuffer.trim(), stream: 'stdout' });
      }
      if (stderrBuffer.trim()) {
        runOutputText += `${stderrBuffer.trim()}\n`;
        emitTestRunProgress(sender, { runId, status: 'running', level: 'error', message: stderrBuffer.trim(), stream: 'stderr' });
      }

      const noMatchingTests = /No test matches the given testcase filter|no matching test cases found|Skipping assembly - no matching test cases found/i.test(runOutputText);
      
      let finalCode = code;
      if (finalCode === null || finalCode === undefined) {
        if (/Test Run Successful\./i.test(runOutputText)) finalCode = 0;
        else if (/Test Run Failed\./i.test(runOutputText)) finalCode = 1;
        else finalCode = 0;
      }

      const status = signal ? 'cancelled' : finalCode === 0 && !noMatchingTests ? 'complete' : 'failed';
      const finalMessage = noMatchingTests
        ? 'No tests matched the selected filter.'
        : status === 'complete'
          ? 'Test run completed.'
          : status === 'cancelled'
            ? 'Test run cancelled.'
            : `Test run failed (exit ${finalCode ?? -1}).`;

      emitTestRunProgress(sender, {
        runId,
        status,
        level: status === 'complete' ? 'info' : 'error',
        message: finalMessage,
        stream: 'system',
        exitCode: finalCode,
      });

      // Delay resolve to ensure all progress events (sent via sender.send)
      // arrive at the renderer before the invoke response (promise resolution).
      // Without this, the renderer can process the resolve before the final
      // progress event, and a late-arriving 'running' event from buffer flush
      // overwrites the terminal status.
      setTimeout(async () => {
        // Retry attachment collection to handle filesystem flush delays
        let recentOutputAttachments = collectRecentRunAttachments(
          testOutputDirectories,
          runStartedAtMs,
          expectedAttachmentNames,
        );
        if (recentOutputAttachments.length === 0 && expectedAttachmentNames.length > 0) {
          await delay(1500);
          recentOutputAttachments = collectRecentRunAttachments(
            testOutputDirectories,
            runStartedAtMs,
            expectedAttachmentNames,
          );
        }

        resolve({
          runId,
          status,
          exitCode: finalCode,
          attachments: recentOutputAttachments,
        });

        try {
          child.kill('SIGKILL');
        } catch (e) {
          // ignore kill errors
        }
      }, 150);
    };

    child.once('error', (error) => {
      if (isFinalized) return;
      isFinalized = true;
      activeTestRuns.delete(runId);
      cleanupTempRunSettings();
      emitTestRunProgress(sender, {
        runId,
        status: 'failed',
        level: 'error',
        message: error.message || 'Failed to start dotnet test.',
        stream: 'system',
      });
      reject(error);
    });

    child.once('exit', (code, signal) => finalizeRun(code, signal));

    // Monitor stdout for explicit completion markers if the process hangs
    child.stdout.on('data', () => {
      if (isFinalized) return;
      if (/Test Run (?:Failed|Successful)\./i.test(runOutputText) && /Total time:/i.test(runOutputText)) {
        setTimeout(() => finalizeRun(null, null), 500); // Give it a tiny delay to ensure everything is flushed
      }
    });
  });
}

function startDotnetDebugRun(request, sender) {
  const workingDirectory = normalizeDirectoryPath(request?.workingDirectory || '');
  const debuggerResolution = resolveNetcoreDbgExecutablePath(request, workingDirectory);
  if (!debuggerResolution.path) {
    throw new Error(debuggerResolution.error || 'netcoredbg executable was not found.');
  }
  const projectPathInput = String(request?.projectPath || '').trim();
  if (!projectPathInput) {
    throw new Error('Project path is required.');
  }
  const projectPath = resolveRunFileFromInput(projectPathInput, workingDirectory, ['.csproj'], 'Project path');
  const testFilter = String(request?.testFilter || '').trim();
  if (!testFilter) {
    throw new Error('Test filter is required.');
  }

  const logger = String(request?.logger || 'console;verbosity=detailed').trim() || 'console;verbosity=detailed';
  const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const runStartedAtMs = Date.now();
  const projectOutputDirectory = path.join(path.dirname(projectPath), 'bin', 'Debug', 'net8.0');
  const patToken = typeof request?.patToken === 'string' ? request.patToken.trim() : '';
  const requestedRunSettingsPath = String(request?.runSettingsPath || '').trim();
  const resolvedRunSettingsPath = requestedRunSettingsPath
    ? resolveOptionalRunSettingsPath(requestedRunSettingsPath, workingDirectory)
    : '';
  const tempRunSettingsPath = !resolvedRunSettingsPath && patToken ? createTempRunSettingsFile(runId, patToken) : '';
  const runSettingsPath = resolvedRunSettingsPath || tempRunSettingsPath;

  const args = ['test', projectPath, '--filter', testFilter, '--logger', logger];
  if (runSettingsPath) {
    args.push('--settings', runSettingsPath);
  }
  const env = {
    ...process.env,
    VSTEST_HOST_DEBUG: '1',
  };
  if (patToken) {
    env.ADO_PAT = patToken;
  }

  emitTestRunProgress(sender, {
    runId,
    mode: 'debug',
    status: 'running',
    level: 'info',
    message: `Starting (debug): dotnet ${args.map((item) => `"${item}"`).join(' ')}`,
    stream: 'system',
  });
  emitTestRunProgress(sender, {
    runId,
    mode: 'debug',
    status: 'running',
    level: 'info',
    message: `Using debugger (${debuggerResolution.source}): ${debuggerResolution.path}`,
    stream: 'system',
  });
  emitTestRunProgress(sender, {
    runId,
    mode: 'debug',
    status: 'running',
    level: 'info',
    message: 'Waiting for testhost PID and debugger attach...',
    stream: 'system',
  });

  const child = spawn('dotnet', args, {
    cwd: workingDirectory,
    env,
    windowsHide: true,
  });

  activeTestRuns.set(runId, child);

  let isFinalized = false;
  let stdoutBuffer = '';
  let stderrBuffer = '';
  let runOutputText = '';
  const testOutputDirectories = new Set();
  const testName = parseTestNameFromFilter(testFilter);
  const expectedAttachmentNames = testName ? [`${testName}.jpg`, `${testName}.png`] : [];
  testOutputDirectories.add(projectOutputDirectory);
  const requestedBreakpoints = normalizeDebugBreakpoints(request?.debugBreakpoints, workingDirectory);
  const inferredBreakpoints = requestedBreakpoints.length === 0 ? inferDebugBreakpoints(workingDirectory, testName) : [];
  const debugBreakpoints = [];
  const seenDebugBreakpoints = new Set();
  for (const entry of [...requestedBreakpoints, ...inferredBreakpoints]) {
    const key = `${entry.sourcePath.toLowerCase()}::${entry.line}`;
    if (seenDebugBreakpoints.has(key)) {
      continue;
    }
    seenDebugBreakpoints.add(key);
    debugBreakpoints.push(entry);
  }
  const breakOnAllExceptions = request?.breakOnExceptions !== false;

  const debugState = {
    testHostPid: null,
    debuggerStarted: false,
    debuggerAttached: false,
    debuggerPaused: false,
    debuggerThreadId: null,
    attachAttempted: false,
  };

  const rememberOutputDirectory = (line) => {
    const text = String(line || '').trim();
    const assemblyPath = text.match(/(?:Running all tests in|->)\s+(.+\.(?:dll|exe))$/i)?.[1]?.trim();
    if (!assemblyPath) return;
    const resolvedAssemblyPath = path.resolve(assemblyPath);
    testOutputDirectories.add(path.dirname(resolvedAssemblyPath));
  };

  const tryAttachDebugger = (pid) => {
    if (!pid || debugState.attachAttempted) return;
    debugState.attachAttempted = true;
    debugState.testHostPid = pid;

    const attachPromise = (async () => {
      const debuggerClient = new NetcoreDbgClient(debuggerResolution.path);

      debuggerClient.on('event', (eventMessage) => {
        const eventName = eventMessage?.event;
        const body = eventMessage?.body || {};
        const threadId = Number.isInteger(body.threadId) ? body.threadId : null;

        if (eventName === 'stopped') {
          debugState.debuggerPaused = true;
          debugState.debuggerThreadId = threadId;

          void (async () => {
            let stopDetails = null;
            try {
              stopDetails = await collectDebuggerStopDetails(debuggerClient, threadId, body.reason);
            } catch (error) {
              const message = error instanceof Error ? error.message : 'Unable to load debug details.';
              emitTestRunProgress(sender, {
                runId,
                mode: 'debug',
                status: 'running',
                level: 'error',
                message: `Failed to inspect paused state: ${message}`,
                stream: 'system',
              });
            }

            const sourcePath = String(stopDetails?.sourcePath || '').trim();
            const line = Number(stopDetails?.line || 0);
            const locationText = sourcePath && line > 0 ? ` at ${sourcePath}:${line}` : '';
            const scopeCount = Array.isArray(stopDetails?.scopes) ? stopDetails.scopes.length : 0;
            const frameCount = Array.isArray(stopDetails?.callStack) ? stopDetails.callStack.length : 0;

            emitTestRunProgress(sender, {
              runId,
              mode: 'debug',
              status: 'running',
              level: 'info',
              message: `Debugger stopped (${body.reason || 'breakpoint'})${threadId ? ` on thread ${threadId}` : ''}${locationText}. Frames: ${frameCount}. Scopes: ${scopeCount}.`,
              stream: 'system',
              debuggerEvent: {
                event: 'stopped',
                reason: body.reason || '',
                threadId,
                details: stopDetails,
              },
            });
          })();
          return;
        }

        if (eventName === 'continued') {
          debugState.debuggerPaused = false;
          emitTestRunProgress(sender, {
            runId,
            mode: 'debug',
            status: 'running',
            level: 'info',
            message: 'Debugger continued.',
            stream: 'system',
            debuggerEvent: {
              event: 'continued',
              threadId,
            },
          });
          return;
        }

        if (eventName === 'terminated' || eventName === 'exited') {
          debugState.debuggerPaused = false;
          emitTestRunProgress(sender, {
            runId,
            mode: 'debug',
            status: 'running',
            level: 'info',
            message: `Debugger ${eventName}.`,
            stream: 'system',
            debuggerEvent: {
              event: eventName,
              threadId,
            },
          });
        }
      });

      activeDebugSessions.set(runId, {
        pendingAttach: Promise.resolve(),
        client: debuggerClient,
        lastThreadId: null,
      });

      await debuggerClient.start();
      debugState.debuggerStarted = true;
      await debuggerClient.initialize();
      await debuggerClient.attach(pid);
      debugState.debuggerAttached = true;

      emitTestRunProgress(sender, {
        runId,
        mode: 'debug',
        status: 'running',
        level: 'info',
        message: `Debugger attached to testhost PID ${pid}.`,
        stream: 'system',
      });

      if (breakOnAllExceptions) {
        await debuggerClient.setExceptionBreakpoints(['all']);
        emitTestRunProgress(sender, {
          runId,
          mode: 'debug',
          status: 'running',
          level: 'info',
          message: 'Exception breakpoints enabled (all).',
          stream: 'system',
        });
      }

      if (debugBreakpoints.length > 0) {
        const breakpointsByFile = new Map();
        for (const item of debugBreakpoints) {
          const key = item.sourcePath;
          const lines = breakpointsByFile.get(key) || [];
          lines.push(item.line);
          breakpointsByFile.set(key, lines);
        }

        for (const [sourcePath, lines] of breakpointsByFile.entries()) {
          const uniqueLines = Array.from(new Set(lines)).sort((left, right) => left - right);
          await debuggerClient.setBreakpoints(sourcePath, uniqueLines);
          emitTestRunProgress(sender, {
            runId,
            mode: 'debug',
            status: 'running',
            level: 'info',
            message: `Breakpoints set: ${path.basename(sourcePath)}:${uniqueLines.join(', ')}`,
            stream: 'system',
          });
        }
      } else {
        emitTestRunProgress(sender, {
          runId,
          mode: 'debug',
          status: 'running',
          level: 'info',
          message: `No explicit breakpoint found for "${testName}". Debug session will run until a breakpoint or exception is hit.`,
          stream: 'system',
        });
      }

      await debuggerClient.configurationDone();
      emitTestRunProgress(sender, {
        runId,
        mode: 'debug',
        status: 'running',
        level: 'info',
        message: 'Debugger configuration done. Breakpoints and exception handling are active; waiting for the first stop.',
        stream: 'system',
      });
    })().catch((error) => {
      emitTestRunProgress(sender, {
        runId,
        mode: 'debug',
        status: 'running',
        level: 'error',
        message: `Debugger attach failed: ${error?.message || 'Unknown error.'}`,
        stream: 'system',
      });
    });

    activeDebugSessions.set(runId, {
      ...(activeDebugSessions.get(runId) || {}),
      pendingAttach: attachPromise,
    });
  };

  child.stdout.on('data', (chunk) => {
    if (isFinalized) return;
    const parsed = splitLines(stdoutBuffer, chunk.toString('utf8'));
    stdoutBuffer = parsed.rest;
    for (const line of parsed.lines) {
      if (!line.trim()) continue;
      runOutputText += `${line}\n`;
      rememberOutputDirectory(line);
      const detectedPid = extractTestHostPidFromOutput(line);
      if (detectedPid) {
        emitTestRunProgress(sender, {
          runId,
          mode: 'debug',
          status: 'running',
          level: 'info',
          message: `Detected testhost PID ${detectedPid}.`,
          stream: 'system',
        });
        tryAttachDebugger(detectedPid);
      }
      emitTestRunProgress(sender, {
        runId,
        mode: 'debug',
        status: 'running',
        level: 'info',
        message: line,
        stream: 'stdout',
      });
    }
  });

  child.stderr.on('data', (chunk) => {
    if (isFinalized) return;
    const parsed = splitLines(stderrBuffer, chunk.toString('utf8'));
    stderrBuffer = parsed.rest;
    for (const line of parsed.lines) {
      if (!line.trim()) continue;
      runOutputText += `${line}\n`;
      emitTestRunProgress(sender, {
        runId,
        mode: 'debug',
        status: 'running',
        level: 'error',
        message: line,
        stream: 'stderr',
      });
    }
  });

  return new Promise((resolve, reject) => {
    const cleanupTempRunSettings = () => {
      if (!tempRunSettingsPath) return;
      try {
        if (fs.existsSync(tempRunSettingsPath)) {
          fs.unlinkSync(tempRunSettingsPath);
        }
      } catch {
        // Ignore cleanup failures.
      }
    };

    const finalizeRun = async (code, signal) => {
      if (isFinalized) return;
      isFinalized = true;

      activeTestRuns.delete(runId);
      cleanupTempRunSettings();

      if (stdoutBuffer.trim()) {
        runOutputText += `${stdoutBuffer.trim()}\n`;
        rememberOutputDirectory(stdoutBuffer.trim());
        const trailingPid = extractTestHostPidFromOutput(stdoutBuffer.trim());
        if (trailingPid) {
          tryAttachDebugger(trailingPid);
        }
        emitTestRunProgress(sender, {
          runId,
          mode: 'debug',
          status: 'running',
          level: 'info',
          message: stdoutBuffer.trim(),
          stream: 'stdout',
        });
      }
      if (stderrBuffer.trim()) {
        runOutputText += `${stderrBuffer.trim()}\n`;
        emitTestRunProgress(sender, {
          runId,
          mode: 'debug',
          status: 'running',
          level: 'error',
          message: stderrBuffer.trim(),
          stream: 'stderr',
        });
      }

      const debugSession = activeDebugSessions.get(runId);
      if (debugSession?.pendingAttach) {
        try {
          await debugSession.pendingAttach;
        } catch {
          // Attach failures are already reported in the run output.
        }
      }

      const activeDebugger = activeDebugSessions.get(runId)?.client;
      if (activeDebugger?.disconnect) {
        await activeDebugger.disconnect();
      }
      activeDebugSessions.delete(runId);

      const noMatchingTests = /No test matches the given testcase filter|no matching test cases found|Skipping assembly - no matching test cases found/i.test(runOutputText);
      
      let finalCode = code;
      if (finalCode === null || finalCode === undefined) {
        if (/Test Run Successful\./i.test(runOutputText)) finalCode = 0;
        else if (/Test Run Failed\./i.test(runOutputText)) finalCode = 1;
        else finalCode = 0;
      }

      const status = signal ? 'cancelled' : finalCode === 0 && !noMatchingTests ? 'complete' : 'failed';
      const finalMessage = noMatchingTests
        ? 'No tests matched the selected filter.'
        : status === 'complete'
          ? 'Debug test run completed.'
          : status === 'cancelled'
            ? 'Debug test run cancelled.'
            : `Debug test run failed (exit ${finalCode ?? -1}).`;

      emitTestRunProgress(sender, {
        runId,
        mode: 'debug',
        status,
        level: status === 'complete' ? 'info' : 'error',
        message: finalMessage,
        stream: 'system',
        exitCode: finalCode,
      });

      // Delay resolve to ensure all progress events (sent via sender.send)
      // arrive at the renderer before the invoke response (promise resolution).
      setTimeout(async () => {
        let recentOutputAttachments = collectRecentRunAttachments(
          testOutputDirectories,
          runStartedAtMs,
          expectedAttachmentNames,
        );
        if (recentOutputAttachments.length === 0 && expectedAttachmentNames.length > 0) {
          await delay(1500);
          recentOutputAttachments = collectRecentRunAttachments(
            testOutputDirectories,
            runStartedAtMs,
            expectedAttachmentNames,
          );
        }

        resolve({
          runId,
          status,
          exitCode: finalCode,
          attachments: recentOutputAttachments,
          testHostPid: debugState.testHostPid,
          debuggerStarted: debugState.debuggerStarted,
          debuggerAttached: debugState.debuggerAttached,
        });

        try {
          child.kill('SIGKILL');
        } catch (e) {
          // ignore
        }
      }, 150);
    };

    child.once('error', (error) => {
      if (isFinalized) return;
      isFinalized = true;
      activeTestRuns.delete(runId);
      cleanupTempRunSettings();
      emitTestRunProgress(sender, {
        runId,
        mode: 'debug',
        status: 'failed',
        level: 'error',
        message: error.message || 'Failed to start dotnet test.',
        stream: 'system',
      });
      reject(error);
    });

    child.once('exit', (code, signal) => {
      void finalizeRun(code, signal);
    });

    child.stdout.on('data', () => {
      if (isFinalized) return;
      if (/Test Run (?:Failed|Successful)\./i.test(runOutputText) && /Total time:/i.test(runOutputText)) {
        setTimeout(() => { void finalizeRun(null, null); }, 500);
      }
    });
  });
}

async function stopDotnetTestRun(runId) {
  const child = activeTestRuns.get(String(runId || ''));
  const debugSession = activeDebugSessions.get(String(runId || ''));
  if (debugSession?.pendingAttach) {
    try {
      await debugSession.pendingAttach;
    } catch {
      // Ignore attach failures while stopping.
    }
  }
  const activeDebugger = activeDebugSessions.get(String(runId || ''))?.client;
  if (activeDebugger?.disconnect) {
    await activeDebugger.disconnect();
  }
  activeDebugSessions.delete(String(runId || ''));

  if (!child) {
    return { ok: false };
  }
  child.kill('SIGTERM');
  return { ok: true };
}

function getDebugSessionOrThrow(runId) {
  const normalizedRunId = String(runId || '').trim();
  if (!normalizedRunId) {
    throw new Error('Run id is required.');
  }

  const session = activeDebugSessions.get(normalizedRunId);
  if (!session?.client) {
    throw new Error('No active debugger session was found for this run.');
  }

  return { normalizedRunId, session };
}

async function runDebuggerCommand(runId, command) {
  const { session } = getDebugSessionOrThrow(runId);
  if (session.pendingAttach) {
    await session.pendingAttach;
  }

  const client = session.client;
  if (!client || typeof client[command] !== 'function') {
    throw new Error(`Debugger command "${command}" is not available.`);
  }

  await client[command]();
  return { ok: true };
}

function getSchedulerDatabasePath() {
  return getLiveDbPath(app.getPath('userData'));
}

async function openSchedulerDatabase() {
  const dbPath = getSchedulerDatabasePath();
  const db = await open({
    filename: dbPath,
    driver: sqlite3.Database,
  });
  await db.exec('PRAGMA journal_mode = WAL;');
  await db.exec(`
    CREATE TABLE IF NOT EXISTS scheduler_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
  await db.exec(`
    CREATE TABLE IF NOT EXISTS scheduler_schedules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      cron TEXT NOT NULL,
      timezone TEXT NOT NULL,
      mode TEXT NOT NULL,
      selected_configuration_id INTEGER NOT NULL,
      plan_id INTEGER,
      suite_ids_json TEXT NOT NULL,
      batch_size INTEGER NOT NULL,
      enabled INTEGER NOT NULL,
      metadata_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
  await db.exec(`
    CREATE TABLE IF NOT EXISTS scheduler_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      schedule_id INTEGER,
      schedule_name TEXT NOT NULL,
      trigger_type TEXT NOT NULL,
      status TEXT NOT NULL,
      triggered_at TEXT NOT NULL,
      finished_at TEXT,
      message TEXT,
      payload_json TEXT NOT NULL
    );
  `);
  await db.exec('CREATE INDEX IF NOT EXISTS idx_scheduler_runs_triggered_at ON scheduler_runs(triggered_at DESC);');
  await db.exec('CREATE INDEX IF NOT EXISTS idx_scheduler_runs_schedule_id ON scheduler_runs(schedule_id);');
  await db.exec(`
    CREATE TABLE IF NOT EXISTS release_logs (
      release_id INTEGER PRIMARY KEY,
      release_name TEXT,
      release_definition_id INTEGER NOT NULL,
      release_definition_name TEXT,
      test_suite_id INTEGER NOT NULL,
      test_run_id INTEGER,
      is_failed_rerun INTEGER NOT NULL DEFAULT 0,
      total_tests INTEGER,
      passed_tests INTEGER,
      failed_tests INTEGER,
      release_start_time TEXT,
      release_run_time TEXT,
      release_log_modified_time TEXT,
      batch_index INTEGER,
      batch_count INTEGER
    );
  `);
  // Migrations: add columns to pre-existing databases (no-op if already present)
  const existingCols = await db.all('PRAGMA table_info(release_logs);');
  const colNames = new Set(existingCols.map((row) => row.name));
  if (!colNames.has('batch_index')) {
    await db.exec('ALTER TABLE release_logs ADD COLUMN batch_index INTEGER;');
  }
  if (!colNames.has('batch_count')) {
    await db.exec('ALTER TABLE release_logs ADD COLUMN batch_count INTEGER;');
  }
  if (!colNames.has('test_run_id')) {
    await db.exec('ALTER TABLE release_logs ADD COLUMN test_run_id INTEGER;');
  }
  await db.exec('CREATE INDEX IF NOT EXISTS idx_release_logs_modified_time ON release_logs(release_log_modified_time DESC);');
  await db.exec('CREATE INDEX IF NOT EXISTS idx_release_logs_test_suite_id ON release_logs(test_suite_id);');
  return db;
}

function parseSchedulerInteger(value, fallback, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  const rounded = Math.round(parsed);
  if (rounded < min) return min;
  if (rounded > max) return max;
  return rounded;
}

function normalizeSchedulerMode(value, fallback = SCHEDULER_DEFAULT_CONFIG.defaultMode) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!SCHEDULER_ALLOWED_MODES.has(normalized)) {
    return fallback;
  }
  return normalized;
}

function normalizeSchedulerConfig(input) {
  const next = input && typeof input === 'object' ? input : {};
  return {
    enabled: next.enabled !== false,
    timezone: typeof next.timezone === 'string' && next.timezone.trim()
      ? next.timezone.trim()
      : SCHEDULER_DEFAULT_CONFIG.timezone,
    pollSeconds: parseSchedulerInteger(next.pollSeconds, SCHEDULER_DEFAULT_CONFIG.pollSeconds, 10, 3600),
    defaultCron: typeof next.defaultCron === 'string' && next.defaultCron.trim()
      ? next.defaultCron.trim()
      : SCHEDULER_DEFAULT_CONFIG.defaultCron,
    defaultMode: normalizeSchedulerMode(next.defaultMode),
    defaultBatchSize: parseSchedulerInteger(next.defaultBatchSize, SCHEDULER_DEFAULT_CONFIG.defaultBatchSize, 1, 200),
    maxHistoryRows: parseSchedulerInteger(next.maxHistoryRows, SCHEDULER_DEFAULT_CONFIG.maxHistoryRows, 50, 5000),
  };
}

function getCronFieldBounds(index) {
  if (index === 0) return { min: 0, max: 59 };
  if (index === 1) return { min: 0, max: 59 };
  if (index === 2) return { min: 0, max: 23 };
  if (index === 3) return { min: 1, max: 31 };
  if (index === 4) return { min: 1, max: 12 };
  return { min: 0, max: 6 };
}

function isCronNumericInRange(value, min, max) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= min && parsed <= max;
}

function isValidCronField(field, min, max) {
  const token = String(field || '').trim();
  if (!token) return false;
  if (token === '*') return true;
  if (token.includes(',')) {
    return token.split(',').every((part) => isValidCronField(part, min, max));
  }
  if (token.includes('/')) {
    const [base, stepText] = token.split('/');
    const step = Number(stepText);
    if (!Number.isInteger(step) || step <= 0) return false;
    if (base === '*') return true;
    if (base.includes('-')) {
      const [startText, endText] = base.split('-');
      return isCronNumericInRange(startText, min, max) && isCronNumericInRange(endText, min, max);
    }
    return isCronNumericInRange(base, min, max);
  }
  if (token.includes('-')) {
    const [startText, endText] = token.split('-');
    const start = Number(startText);
    const end = Number(endText);
    return Number.isInteger(start) && Number.isInteger(end) && start >= min && end <= max && start <= end;
  }
  return isCronNumericInRange(token, min, max);
}

function isValidCronExpression(cron) {
  const parts = String(cron || '').trim().split(/\s+/);
  if (parts.length !== 6) {
    return false;
  }
  return parts.every((field, index) => {
    const bounds = getCronFieldBounds(index);
    return isValidCronField(field, bounds.min, bounds.max);
  });
}

function validateTimeZone(timezone) {
  try {
    Intl.DateTimeFormat('en-US', { timeZone: timezone }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

function normalizeSchedulePayload(input) {
  const payload = input && typeof input === 'object' ? input : {};
  const name = typeof payload.name === 'string' ? payload.name.trim() : '';
  if (!name) {
    throw new Error('Schedule name is required.');
  }
  const cron = typeof payload.cron === 'string' ? payload.cron.trim() : '';
  if (!isValidCronExpression(cron)) {
    throw new Error('Cron expression must have 6 valid fields: sec min hour day month weekday.');
  }
  const timezone = typeof payload.timezone === 'string' ? payload.timezone.trim() : '';
  if (!timezone || !validateTimeZone(timezone)) {
    throw new Error('A valid IANA timezone is required (for example: Asia/Kolkata).');
  }
  const mode = normalizeSchedulerMode(payload.mode, '');
  if (!mode) {
    throw new Error('Scheduler mode is invalid.');
  }
  const selectedConfigurationId = Number(payload.selectedConfigurationId);
  if (!Number.isInteger(selectedConfigurationId) || selectedConfigurationId <= 0) {
    throw new Error('Configuration id must be a positive number.');
  }
  const batchSize = parseSchedulerInteger(payload.batchSize, SCHEDULER_DEFAULT_CONFIG.defaultBatchSize, 1, 200);
  const enabled = payload.enabled !== false;
  const planId = Number(payload.planId);
  const normalizedPlanId = Number.isInteger(planId) && planId > 0 ? planId : null;
  const suiteIds = Array.isArray(payload.suiteIds)
    ? Array.from(new Set(payload.suiteIds
      .map((suiteId) => Number(suiteId))
      .filter((suiteId) => Number.isInteger(suiteId) && suiteId > 0)))
    : [];
  if (mode === 'selected_suite' && suiteIds.length === 0) {
    throw new Error('Suite mode requires at least one suite id.');
  }
  const metadata = payload.metadata && typeof payload.metadata === 'object' && !Array.isArray(payload.metadata)
    ? payload.metadata
    : {};

  return {
    name,
    cron,
    timezone,
    mode,
    selectedConfigurationId,
    planId: normalizedPlanId,
    suiteIds,
    batchSize,
    enabled,
    metadata,
  };
}

function parseSchedulerJson(value, fallback) {
  if (typeof value !== 'string' || !value.trim()) {
    return fallback;
  }
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

async function readSchedulerConfig() {
  let db = null;
  try {
    db = await openSchedulerDatabase();
    const rows = await db.all('SELECT key, value FROM scheduler_settings;');
    const fromDb = {};
    for (const row of rows) {
      fromDb[row.key] = parseSchedulerJson(row.value, row.value);
    }
    return normalizeSchedulerConfig(fromDb);
  } finally {
    if (db) {
      await db.close();
    }
  }
}

async function saveSchedulerConfig(input) {
  const normalized = normalizeSchedulerConfig(input);
  const now = new Date().toISOString();
  let db = null;
  try {
    db = await openSchedulerDatabase();
    await db.exec('BEGIN IMMEDIATE TRANSACTION;');
    try {
      for (const [key, value] of Object.entries(normalized)) {
        await db.run(
          `
            INSERT INTO scheduler_settings (key, value, updated_at)
            VALUES (?, ?, ?)
            ON CONFLICT(key) DO UPDATE SET
              value = excluded.value,
              updated_at = excluded.updated_at;
          `,
          key,
          JSON.stringify(value),
          now,
        );
      }
      await db.exec('COMMIT;');
    } catch (error) {
      await db.exec('ROLLBACK;');
      throw error;
    }
    return normalized;
  } finally {
    if (db) {
      await db.close();
    }
  }
}

async function ensureSchedulerDatabase() {
  let db = null;
  try {
    db = await openSchedulerDatabase();
  } finally {
    if (db) {
      await db.close();
    }
  }
  await saveSchedulerConfig(await readSchedulerConfig());
}

async function insertSchedulerRunLog(input) {
  const now = new Date().toISOString();
  let db = null;
  try {
    db = await openSchedulerDatabase();
    await db.run(
      `
        INSERT INTO scheduler_runs (
          schedule_id,
          schedule_name,
          trigger_type,
          status,
          triggered_at,
          finished_at,
          message,
          payload_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?);
      `,
      input.scheduleId ?? null,
      input.scheduleName || 'Scheduler',
      input.triggerType || 'manual',
      input.status || 'queued',
      now,
      input.finishedAt ?? null,
      input.message || '',
      JSON.stringify(input.payload || {}),
    );
  } finally {
    if (db) {
      await db.close();
    }
  }
}

async function listSchedulerRunLogs(limit = 120) {
  const normalizedLimit = parseSchedulerInteger(limit, 120, 10, 2000);
  let db = null;
  try {
    db = await openSchedulerDatabase();
    const rows = await db.all(
      `
        SELECT
          id,
          schedule_id AS scheduleId,
          schedule_name AS scheduleName,
          trigger_type AS triggerType,
          status,
          triggered_at AS triggeredAt,
          finished_at AS finishedAt,
          message,
          payload_json AS payloadJson
        FROM scheduler_runs
        ORDER BY id DESC
        LIMIT ?;
      `,
      normalizedLimit,
    );
    return rows.map((row) => ({
      ...row,
      payload: parseSchedulerJson(row.payloadJson, {}),
    }));
  } finally {
    if (db) {
      await db.close();
    }
  }
}

const RELEASE_LOG_SELECT = `
  SELECT
    release_id AS releaseId,
    release_name AS releaseName,
    release_definition_id AS releaseDefinitionId,
    release_definition_name AS releaseDefinitionName,
    test_suite_id AS testSuiteId,
    test_run_id AS testRunId,
    is_failed_rerun AS isFailedRerunInt,
    total_tests AS totalTests,
    passed_tests AS passedTests,
    failed_tests AS failedTests,
    release_start_time AS releaseStartTime,
    release_run_time AS releaseRunTime,
    release_log_modified_time AS releaseLogModifiedTime,
    batch_index AS batchIndex,
    batch_count AS batchCount
  FROM release_logs
`;

function mapReleaseLogRow(row) {
  if (!row) return null;
  return {
    releaseId: row.releaseId,
    releaseName: row.releaseName || '',
    releaseDefinitionId: row.releaseDefinitionId,
    releaseDefinitionName: row.releaseDefinitionName || '',
    testSuiteId: row.testSuiteId,
    testRunId: row.testRunId ?? null,
    isFailedRerun: row.isFailedRerunInt === 1,
    totalTests: row.totalTests,
    passedTests: row.passedTests,
    failedTests: row.failedTests,
    releaseStartTime: row.releaseStartTime || '',
    releaseRunTime: row.releaseRunTime || '',
    releaseLogModifiedTime: row.releaseLogModifiedTime || '',
    batchIndex: row.batchIndex ?? null,
    batchCount: row.batchCount ?? null,
  };
}

async function insertOrReplaceReleaseLog(input) {
  if (!input || typeof input !== 'object') {
    throw new Error('Release log payload is required');
  }
  const releaseId = Number(input.releaseId);
  if (!Number.isFinite(releaseId) || releaseId <= 0) {
    throw new Error('releaseId must be a positive number');
  }
  let db = null;
  try {
    db = await openSchedulerDatabase();
    const existing = await db.get(
      'SELECT release_definition_id, test_suite_id FROM release_logs WHERE release_id = ?;',
      releaseId,
    );

    const releaseDefinitionIdInput = Number(input.releaseDefinitionId);
    const releaseDefinitionId = Number.isFinite(releaseDefinitionIdInput) && releaseDefinitionIdInput > 0
      ? releaseDefinitionIdInput
      : existing?.release_definition_id;
    if (!Number.isFinite(releaseDefinitionId) || releaseDefinitionId <= 0) {
      throw new Error('releaseDefinitionId must be a positive number for new release logs');
    }

    const testSuiteIdInput = Number(input.testSuiteId);
    const testSuiteId = Number.isFinite(testSuiteIdInput) && testSuiteIdInput > 0
      ? testSuiteIdInput
      : existing?.test_suite_id;
    if (!Number.isFinite(testSuiteId) || testSuiteId <= 0) {
      throw new Error('testSuiteId must be a positive number for new release logs');
    }

    const testRunIdInt = Number(input.testRunId);
    await db.run(
      `
        INSERT INTO release_logs (
          release_id, release_name, release_definition_id, release_definition_name,
          test_suite_id, test_run_id, is_failed_rerun, total_tests, passed_tests, failed_tests,
          release_start_time, release_run_time, release_log_modified_time,
          batch_index, batch_count
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(release_id) DO UPDATE SET
          release_name = COALESCE(excluded.release_name, release_logs.release_name),
          release_definition_id = excluded.release_definition_id,
          release_definition_name = COALESCE(excluded.release_definition_name, release_logs.release_definition_name),
          test_suite_id = excluded.test_suite_id,
          test_run_id = COALESCE(excluded.test_run_id, release_logs.test_run_id),
          is_failed_rerun = excluded.is_failed_rerun,
          total_tests = COALESCE(excluded.total_tests, release_logs.total_tests),
          passed_tests = COALESCE(excluded.passed_tests, release_logs.passed_tests),
          failed_tests = COALESCE(excluded.failed_tests, release_logs.failed_tests),
          release_start_time = COALESCE(excluded.release_start_time, release_logs.release_start_time),
          release_run_time = COALESCE(excluded.release_run_time, release_logs.release_run_time),
          release_log_modified_time = COALESCE(excluded.release_log_modified_time, release_logs.release_log_modified_time),
          batch_index = COALESCE(excluded.batch_index, release_logs.batch_index),
          batch_count = COALESCE(excluded.batch_count, release_logs.batch_count);
      `,
      releaseId,
      input.releaseName ?? null,
      releaseDefinitionId,
      input.releaseDefinitionName ?? null,
      testSuiteId,
      Number.isFinite(testRunIdInt) && testRunIdInt > 0 ? testRunIdInt : null,
      input.isFailedRerun ? 1 : 0,
      input.totalTests ?? null,
      input.passedTests ?? null,
      input.failedTests ?? null,
      input.releaseStartTime ?? null,
      input.releaseRunTime ?? null,
      input.releaseLogModifiedTime ?? null,
      Number.isInteger(input.batchIndex) ? input.batchIndex : null,
      Number.isInteger(input.batchCount) ? input.batchCount : null,
    );
    const row = await db.get(`${RELEASE_LOG_SELECT} WHERE release_id = ?;`, releaseId);
    return mapReleaseLogRow(row);
  } finally {
    if (db) {
      await db.close();
    }
  }
}

async function listReleaseLogs(limit = 200) {
  const normalizedLimit = parseSchedulerInteger(limit, 200, 10, 5000);
  let db = null;
  try {
    db = await openSchedulerDatabase();
    const rows = await db.all(
      `${RELEASE_LOG_SELECT} ORDER BY release_id DESC LIMIT ?;`,
      normalizedLimit,
    );
    return rows.map(mapReleaseLogRow);
  } finally {
    if (db) {
      await db.close();
    }
  }
}

async function getPendingReleaseLogs() {
  // Rows are "pending" if runtime OR test counts are missing — otherwise Update Logs
  // can't recover from a first pass that grabbed runtime but missed pass/fail
  // (which happens for historical rows that lack test_run_id).
  let db = null;
  try {
    db = await openSchedulerDatabase();
    const rows = await db.all(
      `${RELEASE_LOG_SELECT}
       WHERE release_run_time IS NULL
          OR release_run_time = ''
          OR total_tests IS NULL
          OR (passed_tests IS NULL AND failed_tests IS NULL);`,
    );
    return rows.map(mapReleaseLogRow);
  } finally {
    if (db) {
      await db.close();
    }
  }
}

function getTimePartsByZone(date, timezone) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    weekday: 'short',
    hour12: false,
  });
  const parts = formatter.formatToParts(date).reduce((acc, part) => {
    if (part.type !== 'literal') {
      acc[part.type] = part.value;
    }
    return acc;
  }, {});
  const weekdayMap = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return {
    second: Number(parts.second || '0'),
    minute: Number(parts.minute || '0'),
    hour: Number(parts.hour || '0'),
    dayOfMonth: Number(parts.day || '1'),
    month: Number(parts.month || '1'),
    dayOfWeek: weekdayMap[parts.weekday] ?? 0,
    marker: `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`,
  };
}

function isCronValueMatch(field, value) {
  if (field === '*') return true;
  if (field.includes(',')) {
    return field.split(',').some((part) => isCronValueMatch(part.trim(), value));
  }
  if (field.includes('/')) {
    const [base, stepText] = field.split('/');
    const step = Number(stepText);
    if (!Number.isInteger(step) || step <= 0) return false;
    if (base === '*') {
      return value % step === 0;
    }
    if (base.includes('-')) {
      const [startText, endText] = base.split('-');
      const start = Number(startText);
      const end = Number(endText);
      if (!Number.isInteger(start) || !Number.isInteger(end) || value < start || value > end) {
        return false;
      }
      return (value - start) % step === 0;
    }
    const start = Number(base);
    if (!Number.isInteger(start) || value < start) return false;
    return (value - start) % step === 0;
  }
  if (field.includes('-')) {
    const [startText, endText] = field.split('-');
    const start = Number(startText);
    const end = Number(endText);
    return Number.isInteger(start) && Number.isInteger(end) && value >= start && value <= end;
  }
  return Number(field) === value;
}

function isCronDueNow(cron, timezone, date) {
  const parts = String(cron || '').trim().split(/\s+/);
  if (parts.length !== 6) {
    return { due: false, marker: '' };
  }
  const local = getTimePartsByZone(date, timezone);
  const due = (
    isCronValueMatch(parts[0], local.second)
    && isCronValueMatch(parts[1], local.minute)
    && isCronValueMatch(parts[2], local.hour)
    && isCronValueMatch(parts[3], local.dayOfMonth)
    && isCronValueMatch(parts[4], local.month)
    && isCronValueMatch(parts[5], local.dayOfWeek)
  );
  return { due, marker: local.marker };
}

async function listSchedulerSchedules() {
  let db = null;
  try {
    db = await openSchedulerDatabase();
    const rows = await db.all(`
      SELECT
        s.id,
        s.name,
        s.cron,
        s.timezone,
        s.mode,
        s.selected_configuration_id AS selectedConfigurationId,
        s.plan_id AS planId,
        s.suite_ids_json AS suiteIdsJson,
        s.batch_size AS batchSize,
        s.enabled,
        s.metadata_json AS metadataJson,
        s.created_at AS createdAt,
        s.updated_at AS updatedAt,
        (
          SELECT MAX(r.triggered_at)
          FROM scheduler_runs r
          WHERE r.schedule_id = s.id
        ) AS lastTriggeredAt
      FROM scheduler_schedules s
      ORDER BY s.name ASC;
    `);
    return rows.map((row) => ({
      ...row,
      enabled: Number(row.enabled) === 1,
      suiteIds: parseSchedulerJson(row.suiteIdsJson, []),
      metadata: parseSchedulerJson(row.metadataJson, {}),
    }));
  } finally {
    if (db) {
      await db.close();
    }
  }
}

async function createSchedulerSchedule(input) {
  const payload = normalizeSchedulePayload(input);
  const now = new Date().toISOString();
  let db = null;
  try {
    db = await openSchedulerDatabase();
    const result = await db.run(
      `
        INSERT INTO scheduler_schedules (
          name,
          cron,
          timezone,
          mode,
          selected_configuration_id,
          plan_id,
          suite_ids_json,
          batch_size,
          enabled,
          metadata_json,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
      `,
      payload.name,
      payload.cron,
      payload.timezone,
      payload.mode,
      payload.selectedConfigurationId,
      payload.planId,
      JSON.stringify(payload.suiteIds),
      payload.batchSize,
      payload.enabled ? 1 : 0,
      JSON.stringify(payload.metadata),
      now,
      now,
    );
    return { id: Number(result.lastID) };
  } finally {
    if (db) {
      await db.close();
    }
  }
}

async function updateSchedulerSchedule(scheduleId, input) {
  const id = Number(scheduleId);
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error('Schedule id is invalid.');
  }
  const payload = normalizeSchedulePayload(input);
  const now = new Date().toISOString();
  let db = null;
  try {
    db = await openSchedulerDatabase();
    const existing = await db.get('SELECT id FROM scheduler_schedules WHERE id = ?;', id);
    if (!existing) {
      throw new Error('Schedule was not found.');
    }
    await db.run(
      `
        UPDATE scheduler_schedules
        SET
          name = ?,
          cron = ?,
          timezone = ?,
          mode = ?,
          selected_configuration_id = ?,
          plan_id = ?,
          suite_ids_json = ?,
          batch_size = ?,
          enabled = ?,
          metadata_json = ?,
          updated_at = ?
        WHERE id = ?;
      `,
      payload.name,
      payload.cron,
      payload.timezone,
      payload.mode,
      payload.selectedConfigurationId,
      payload.planId,
      JSON.stringify(payload.suiteIds),
      payload.batchSize,
      payload.enabled ? 1 : 0,
      JSON.stringify(payload.metadata),
      now,
      id,
    );
    schedulerExecutionMarkers.delete(String(id));
    return { ok: true };
  } finally {
    if (db) {
      await db.close();
    }
  }
}

async function deleteSchedulerSchedule(scheduleId) {
  const id = Number(scheduleId);
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error('Schedule id is invalid.');
  }
  let db = null;
  try {
    db = await openSchedulerDatabase();
    await db.run('DELETE FROM scheduler_schedules WHERE id = ?;', id);
    schedulerExecutionMarkers.delete(String(id));
    return { ok: true };
  } finally {
    if (db) {
      await db.close();
    }
  }
}

async function runSchedulerScheduleNow(scheduleId) {
  const id = Number(scheduleId);
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error('Schedule id is invalid.');
  }
  let db = null;
  try {
    db = await openSchedulerDatabase();
    const schedule = await db.get(
      `
        SELECT
          id,
          name,
          mode,
          selected_configuration_id AS selectedConfigurationId,
          plan_id AS planId,
          suite_ids_json AS suiteIdsJson,
          batch_size AS batchSize
        FROM scheduler_schedules
        WHERE id = ?;
      `,
      id,
    );
    if (!schedule) {
      throw new Error('Schedule was not found.');
    }
    await db.close();
    db = null;
    await queueSchedulerRunRequest(
      {
        mode: schedule.mode,
        selectedConfigurationId: schedule.selectedConfigurationId,
        planId: schedule.planId,
        suiteIds: parseSchedulerJson(schedule.suiteIdsJson, []),
        batchSize: schedule.batchSize,
      },
      {
        triggerType: 'manual',
        scheduleId: id,
        scheduleName: schedule.name,
      },
    );
    return { ok: true };
  } finally {
    if (db) {
      await db.close();
    }
  }
}

function splitIntoBalancedBatches(items, maxItemsPerBatch = 10) {
  if (!Array.isArray(items)) {
    throw new Error('items must be an array');
  }
  const normalizedMax = parseSchedulerInteger(maxItemsPerBatch, 10, 1, 500);
  if (items.length === 0) {
    return [];
  }
  const numberOfBatches = Math.ceil(items.length / normalizedMax);
  const baseSize = Math.floor(items.length / numberOfBatches);
  const extraItems = items.length % numberOfBatches;
  const result = [];
  let start = 0;
  for (let index = 0; index < numberOfBatches; index += 1) {
    const currentSize = baseSize + (index < extraItems ? 1 : 0);
    result.push(items.slice(start, start + currentSize));
    start += currentSize;
  }
  return result;
}

function normalizeSchedulerRunRequest(input) {
  const payload = input && typeof input === 'object' ? input : {};
  const mode = normalizeSchedulerMode(payload.mode, '');
  if (!mode) {
    throw new Error('Run mode is invalid.');
  }
  const selectedConfigurationId = Number(payload.selectedConfigurationId);
  if (!Number.isInteger(selectedConfigurationId) || selectedConfigurationId <= 0) {
    throw new Error('Configuration id must be a positive number.');
  }
  const suiteIds = Array.isArray(payload.suiteIds)
    ? Array.from(new Set(payload.suiteIds
      .map((suiteId) => Number(suiteId))
      .filter((suiteId) => Number.isInteger(suiteId) && suiteId > 0)))
    : [];
  if (mode === 'selected_suite' && suiteIds.length === 0) {
    throw new Error('Selected Suites mode requires at least one suite.');
  }
  const batchSize = parseSchedulerInteger(payload.batchSize, SCHEDULER_DEFAULT_CONFIG.defaultBatchSize, 1, 200);
  const planId = Number(payload.planId);
  const normalizedPlanId = Number.isInteger(planId) && planId > 0 ? planId : null;
  const selectedBuildId = Number(payload.selectedBuildId);
  const selectedWorldPayBuildId = Number(payload.selectedWorldPayBuildId);
  const selectedReleaseDefinitionId = Number(payload.selectedReleaseDefinitionId);
  return {
    mode,
    selectedConfigurationId,
    suiteIds,
    batchSize,
    planId: normalizedPlanId,
    selectedWorldPayServer: typeof payload.selectedWorldPayServer === 'string'
      ? payload.selectedWorldPayServer.trim()
      : '',
    selectedBuildRef: typeof payload.selectedBuildRef === 'string'
      ? payload.selectedBuildRef.trim()
      : '',
    selectedBuildId: Number.isInteger(selectedBuildId) && selectedBuildId > 0 ? selectedBuildId : null,
    selectedWorldPayBuildId: Number.isInteger(selectedWorldPayBuildId) && selectedWorldPayBuildId > 0 ? selectedWorldPayBuildId : null,
    selectedReleaseDefinitionId: Number.isInteger(selectedReleaseDefinitionId) && selectedReleaseDefinitionId > 0
      ? selectedReleaseDefinitionId
      : null,
    notes: typeof payload.notes === 'string'
      ? payload.notes.trim()
      : '',
  };
}

async function queueSchedulerRunRequest(
  input,
  options = { triggerType: 'manual', scheduleId: null, scheduleName: '' },
) {
  const payload = normalizeSchedulerRunRequest(input);
  const suiteBatches = splitIntoBalancedBatches(payload.suiteIds, payload.batchSize);
  const now = new Date().toISOString();
  const triggerType = options?.triggerType === 'scheduled' ? 'scheduled' : 'manual';
  const scheduleId = Number.isInteger(Number(options?.scheduleId)) ? Number(options.scheduleId) : null;
  const scheduleName = typeof options?.scheduleName === 'string' && options.scheduleName.trim()
    ? options.scheduleName.trim()
    : `${triggerType === 'scheduled' ? 'Scheduled' : 'Manual'} ${payload.mode}`;
  await insertSchedulerRunLog({
    scheduleId,
    scheduleName,
    triggerType,
    status: 'queued',
    message: payload.mode === 'selected_suite'
      ? `Queued ${payload.suiteIds.length} suites across ${suiteBatches.length} balanced batches.`
      : `Queued ${triggerType} run for mode ${payload.mode}.`,
    payload: {
      ...payload,
      createdAt: now,
      batches: suiteBatches,
      batchCount: suiteBatches.length,
    },
  });
  return {
    ok: true,
    suiteCount: payload.suiteIds.length,
    batchCount: suiteBatches.length,
    batches: suiteBatches,
  };
}

async function trimSchedulerHistory(maxRows) {
  const keepRows = parseSchedulerInteger(maxRows, SCHEDULER_DEFAULT_CONFIG.maxHistoryRows, 50, 5000);
  let db = null;
  try {
    db = await openSchedulerDatabase();
    await db.run(
      `
        DELETE FROM scheduler_runs
        WHERE id NOT IN (
          SELECT id
          FROM scheduler_runs
          ORDER BY id DESC
          LIMIT ?
        );
      `,
      keepRows,
    );
  } finally {
    if (db) {
      await db.close();
    }
  }
}

async function processDueSchedulerSchedules() {
  const config = await readSchedulerConfig();
  if (!config.enabled) {
    return;
  }
  const nowMs = Date.now();
  if (nowMs - schedulerLastTickAt < config.pollSeconds * 1000) {
    return;
  }
  schedulerLastTickAt = nowMs;

  const schedules = await listSchedulerSchedules();
  const now = new Date();
  for (const schedule of schedules) {
    if (!schedule.enabled) {
      continue;
    }
    const dueState = isCronDueNow(schedule.cron, schedule.timezone, now);
    if (!dueState.due) {
      continue;
    }
    const marker = `${schedule.id}:${dueState.marker}`;
    if (schedulerExecutionMarkers.get(String(schedule.id)) === marker) {
      continue;
    }
    schedulerExecutionMarkers.set(String(schedule.id), marker);
    const suiteIds = Array.isArray(schedule.suiteIds) ? schedule.suiteIds : [];
    await queueSchedulerRunRequest(
      {
        mode: schedule.mode,
        selectedConfigurationId: schedule.selectedConfigurationId,
        planId: schedule.planId,
        suiteIds,
        batchSize: schedule.batchSize,
      },
      {
        triggerType: 'scheduled',
        scheduleId: Number(schedule.id),
        scheduleName: schedule.name,
      },
    );
  }

  await trimSchedulerHistory(config.maxHistoryRows);
}

function startSchedulerTickLoop() {
  if (schedulerTickTimer) {
    clearInterval(schedulerTickTimer);
  }
  schedulerTickTimer = setInterval(() => {
    void processDueSchedulerSchedules().catch((error) => {
      console.error('Scheduler tick failed:', error);
    });
  }, 1000);
  void processDueSchedulerSchedules().catch((error) => {
    console.error('Scheduler warmup tick failed:', error);
  });
}

function stopSchedulerTickLoop() {
  if (!schedulerTickTimer) {
    return;
  }
  clearInterval(schedulerTickTimer);
  schedulerTickTimer = null;
}

app.setAppUserModelId(APP_ID);

app.whenReady().then(async () => {
  app.setName(PRODUCT_NAME);

  if (process.platform === 'darwin' && app.dock && brandLogoPath) {
    app.dock.setIcon(brandLogoPath);
  }

  createSplashWindow();
  createWindow();

  try {
    // Initialize the main app database (handles seed copy, migrations, legacy import)
    const liveDb = await getOrCreateDb(app, process.resourcesPath);
    console.log('[DB] App database initialized');

    // Perform one-time legacy import from old scheduler.sqlite
    await performLegacyImport(liveDb, app.getPath('userData'));
    console.log('[DB] Legacy import complete');
  } catch (error) {
    console.error('[DB] Database initialization failed:', error);
    await dialog.showErrorBox(
      'Database Error',
      'Failed to initialize the application database. The app will now exit.\n\n' + error.message
    );
    app.quit();
    return;
  }

  void ensureSchedulerDatabase()
    .then(() => {
      startSchedulerTickLoop();
    })
    .catch((error) => {
      console.error('Scheduler initialization failed:', error);
    });

  setupAutoUpdate();
  autoUpdater.checkForUpdatesAndNotify().catch((error) => {
    console.error('Initial auto-update check failed:', error);
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', async () => {
  stopSchedulerTickLoop();
  await closeDb();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

ipcMain.handle('app:get-version', () => app.getVersion());
ipcMain.handle('desktop:select-directory', async (_event, options) => {
  const result = await dialog.showOpenDialog({
    title: typeof options?.title === 'string' && options.title.trim() ? options.title.trim() : 'Select folder',
    defaultPath: typeof options?.defaultPath === 'string' && options.defaultPath.trim() ? options.defaultPath.trim() : undefined,
    properties: ['openDirectory'],
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  return result.filePaths[0];
});

ipcMain.handle('desktop:list-directory', (_event, targetPath) => {
  return readDirectoryEntries(targetPath);
});

ipcMain.handle('desktop:find-test-method', (_event, rootPath, methodName) => {
  return findTestMethodInDirectory(rootPath, methodName);
});

// ----------------------------------------------------------------------------
// Find in Files (project-wide content search)
// Recursive scan with safety limits. Skips system/build folders and binary
// file extensions. Cancellable via requestId — only the latest request's
// results are returned; earlier ones short-circuit and resolve empty.
// ----------------------------------------------------------------------------
const SEARCH_SKIP_DIRS = new Set([
  'bin', 'obj', 'node_modules', 'packages',
  'dist', 'build', 'out', '.cache',
  'testresults', '.testresults',
  '.git', '.vs', '.vscode', '.idea', '.svn', '.hg', '.next',
]);

// Allowlist of "searchable" extensions. Anything outside this list is skipped.
const SEARCH_TEXT_EXTENSIONS = new Set([
  '.cs', '.csproj', '.sln', '.config', '.runsettings', '.json', '.xml',
  '.md', '.txt', '.yml', '.yaml', '.ts', '.tsx', '.js', '.jsx',
  '.html', '.css', '.scss', '.sql', '.bat', '.ps1', '.sh', '.py',
  '.env', '.gitignore', '.gitattributes', '.editorconfig',
]);

const MAX_SEARCH_FILE_BYTES = 2 * 1024 * 1024; // 2 MB
const MAX_SEARCH_TOTAL_MATCHES = 500;
const MAX_SEARCH_MATCHES_PER_FILE = 50;
const MAX_SEARCH_DEPTH = 20;

let currentSearchRequestId = 0;

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function searchInFiles(targetPath, options) {
  const normalizedPath = normalizeDirectoryPath(targetPath);
  const query = String(options?.query ?? '');
  if (!query.trim()) return { matches: [], totalMatches: 0, truncated: false };

  // Bump the request id; if it changes before we finish, bail out.
  currentSearchRequestId += 1;
  const myRequestId = currentSearchRequestId;

  const caseSensitive = Boolean(options?.caseSensitive);
  const isRegex = Boolean(options?.isRegex);
  const wholeWord = Boolean(options?.wholeWord);

  let regex;
  try {
    const pattern = isRegex ? query : escapeRegex(query);
    const wrapped = wholeWord ? `(?<![A-Za-z0-9_])(?:${pattern})(?![A-Za-z0-9_])` : pattern;
    regex = new RegExp(wrapped, caseSensitive ? 'g' : 'gi');
  } catch (error) {
    return { matches: [], totalMatches: 0, truncated: false, error: error.message };
  }

  const fsp = require('node:fs/promises');
  const path = require('node:path');
  const matches = [];
  let totalMatches = 0;
  let truncated = false;

  async function visit(dir, depth) {
    if (myRequestId !== currentSearchRequestId) return; // canceled
    if (depth > MAX_SEARCH_DEPTH) return;
    if (totalMatches >= MAX_SEARCH_TOTAL_MATCHES) {
      truncated = true;
      return;
    }
    let entries;
    try {
      entries = await fsp.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (myRequestId !== currentSearchRequestId) return;
      if (totalMatches >= MAX_SEARCH_TOTAL_MATCHES) {
        truncated = true;
        return;
      }
      const name = entry.name;
      const lowerName = name.toLowerCase();
      if (SEARCH_SKIP_DIRS.has(lowerName) || name.startsWith('.')) {
        // .git, .vscode, etc. — but also user-dotfiles. We allow named .env etc by extension allowlist below.
        if (entry.isDirectory()) continue;
        // For files starting with '.', skip unless extension is in allowlist
        const dotExt = '.' + lowerName.split('.').pop();
        if (!SEARCH_TEXT_EXTENSIONS.has(dotExt)) continue;
      }
      const fullPath = path.join(dir, name);
      if (entry.isDirectory()) {
        await visit(fullPath, depth + 1);
      } else if (entry.isFile()) {
        const ext = path.extname(lowerName);
        if (!SEARCH_TEXT_EXTENSIONS.has(ext) && !lowerName.startsWith('.')) continue;
        let stat;
        try { stat = await fsp.stat(fullPath); } catch { continue; }
        if (stat.size > MAX_SEARCH_FILE_BYTES) continue;
        let content;
        try { content = await fsp.readFile(fullPath, 'utf8'); } catch { continue; }
        // Heuristic: skip likely-binary content (lots of null bytes)
        if (content.indexOf(String.fromCharCode(0)) !== -1) continue;
        const fileMatches = [];
        const lines = content.split(/\r?\n/);
        for (let lineIdx = 0; lineIdx < lines.length; lineIdx += 1) {
          if (fileMatches.length >= MAX_SEARCH_MATCHES_PER_FILE) {
            truncated = true;
            break;
          }
          const line = lines[lineIdx];
          regex.lastIndex = 0;
          let m;
          while ((m = regex.exec(line)) !== null) {
            fileMatches.push({
              line: lineIdx + 1,
              column: m.index + 1,
              matchLength: m[0].length,
              lineText: line.length > 400 ? line.slice(0, 400) + '…' : line,
            });
            totalMatches += 1;
            if (totalMatches >= MAX_SEARCH_TOTAL_MATCHES) {
              truncated = true;
              break;
            }
            if (fileMatches.length >= MAX_SEARCH_MATCHES_PER_FILE) break;
            // Prevent infinite loops on zero-length matches
            if (m.index === regex.lastIndex) regex.lastIndex += 1;
          }
        }
        if (fileMatches.length > 0) {
          matches.push({ path: fullPath, matches: fileMatches });
        }
      }
    }
  }

  try {
    await visit(normalizedPath, 0);
  } catch {
    // swallow — partial results are still useful
  }
  if (myRequestId !== currentSearchRequestId) {
    return { matches: [], totalMatches: 0, truncated: false, canceled: true };
  }
  return { matches, totalMatches, truncated };
}

ipcMain.handle('desktop:search-in-files', (_event, rootPath, options) => {
  return searchInFiles(rootPath, options);
});

ipcMain.handle('desktop:get-git-branch', (_event, targetPath) => {
  return readGitBranch(targetPath);
});

ipcMain.handle('desktop:switch-git-branch', (_event, targetPath, targetBranch) => {
  return switchGitBranch(targetPath, targetBranch);
});

ipcMain.handle('desktop:get-git-status', (_event, targetPath) => {
  return readGitStatus(targetPath);
});

ipcMain.handle('desktop:git-add', (_event, targetPath, filePaths) => {
  return gitAddFiles(targetPath, filePaths);
});

ipcMain.handle('desktop:git-unstage', (_event, targetPath, filePaths) => {
  return gitUnstageFiles(targetPath, filePaths);
});

ipcMain.handle('desktop:git-commit', (_event, targetPath, message) => {
  return gitCommitChanges(targetPath, message);
});

ipcMain.handle('desktop:git-push', (_event, targetPath) => {
  return gitPush(targetPath);
});

ipcMain.handle('desktop:git-pull', (_event, targetPath) => {
  return gitPull(targetPath);
});

ipcMain.handle('desktop:git-fetch', (_event, targetPath) => {
  return gitFetch(targetPath);
});

ipcMain.handle('desktop:git-sync', (_event, targetPath) => {
  return gitSync(targetPath);
});

ipcMain.handle('desktop:git-discard', (_event, targetPath, filePaths) => {
  return gitDiscardFiles(targetPath, filePaths);
});

ipcMain.handle('desktop:git-stash', (_event, targetPath, payload) => {
  return gitStash(targetPath, payload);
});

ipcMain.handle('desktop:git-stash-pop', (_event, targetPath, payload) => {
  return gitStashPop(targetPath, payload);
});

ipcMain.handle('desktop:git-list-stashes', (_event, targetPath) => {
  return gitListStashes(targetPath);
});

ipcMain.handle('desktop:run-db-updater', (event, settings, options) => {
  return runDbUpdater(settings, event.sender, options);
});

ipcMain.handle('desktop:sync-db-updater-test-case', (_event, settings, payload) => {
  return syncDbUpdaterTestCase(settings, payload);
});

ipcMain.handle('desktop:delete-db-updater-test-case', (_event, settings, payload) => {
  return deleteDbUpdaterTestCase(settings, payload);
});

ipcMain.handle('desktop:get-db-updater-overview', (_event, settings) => {
  return getDbUpdaterOverview(settings);
});

ipcMain.handle('desktop:search-initial-steps', (_event, settings, payload) => {
  return searchInitialStepsInDb(settings, payload);
});

ipcMain.handle('desktop:get-scheduler-config', () => {
  return readSchedulerConfig();
});

ipcMain.handle('desktop:sync-scheduler-config', (_event, config) => {
  return saveSchedulerConfig(config);
});

ipcMain.handle('desktop:list-scheduler-schedules', () => {
  return listSchedulerSchedules();
});

ipcMain.handle('desktop:create-scheduler-schedule', (_event, payload) => {
  return createSchedulerSchedule(payload);
});

ipcMain.handle('desktop:update-scheduler-schedule', (_event, scheduleId, payload) => {
  return updateSchedulerSchedule(scheduleId, payload);
});

ipcMain.handle('desktop:delete-scheduler-schedule', (_event, scheduleId) => {
  return deleteSchedulerSchedule(scheduleId);
});

ipcMain.handle('desktop:run-scheduler-schedule-now', (_event, scheduleId) => {
  return runSchedulerScheduleNow(scheduleId);
});

ipcMain.handle('desktop:list-scheduler-run-logs', (_event, limit) => {
  return listSchedulerRunLogs(limit);
});

ipcMain.handle('desktop:queue-scheduler-run-request', (_event, payload) => {
  return queueSchedulerRunRequest(payload);
});

ipcMain.handle('desktop:upsert-release-log', (_event, payload) => {
  return insertOrReplaceReleaseLog(payload);
});

ipcMain.handle('desktop:list-release-logs', (_event, limit) => {
  return listReleaseLogs(limit);
});

ipcMain.handle('desktop:list-pending-release-logs', () => {
  return getPendingReleaseLogs();
});

ipcMain.handle('desktop:config-get', async () => {
  try {
    const db = getLiveDb();
    return await getConfig(db);
  } catch (error) {
    console.error('[IPC] config-get failed:', error);
    throw error;
  }
});

ipcMain.handle('desktop:config-set', async (_event, key, value) => {
  try {
    const db = getLiveDb();
    return await setConfig(db, key, value);
  } catch (error) {
    console.error('[IPC] config-set failed:', error);
    throw error;
  }
});

ipcMain.handle('desktop:read-text-file', (_event, targetPath) => {
  const normalizedPath = normalizeFilePath(targetPath);
  return fs.readFileSync(normalizedPath, 'utf8');
});

ipcMain.handle('desktop:read-image-base64', (_event, targetPath) => {
  const normalizedPath = normalizeFilePath(targetPath);
  if (!fs.existsSync(normalizedPath)) {
    return null;
  }
  const ext = path.extname(normalizedPath).toLowerCase();
  let mime = 'image/png';
  if (ext === '.jpg' || ext === '.jpeg') mime = 'image/jpeg';
  if (ext === '.gif') mime = 'image/gif';
  if (ext === '.webp') mime = 'image/webp';
  
  const buffer = fs.readFileSync(normalizedPath);
  return `data:${mime};base64,${buffer.toString('base64')}`;
});

ipcMain.handle('desktop:write-text-file', (_event, targetPath, content) => {
  const normalizedPath = normalizeFilePath(targetPath);
  if (typeof content !== 'string') {
    throw new Error('File content must be text.');
  }
  fs.writeFileSync(normalizedPath, content, 'utf8');
});

// ---------------------------------------------------------------------------
// Repo filesystem watcher — emits debounced change events to the renderer so
// the tree + git status auto-refresh when files change on disk (git pull,
// external editor, etc). Uses Node's built-in recursive fs.watch (supported
// natively on Windows and macOS, our target Electron desktop platforms).
// ---------------------------------------------------------------------------
const WATCH_IGNORED_DIRS = new Set([
  'bin', 'obj', 'node_modules', 'packages',
  'dist', 'build', 'out', '.cache',
  'testresults', '.testresults',
  '.git', '.vs', '.vscode', '.idea', '.svn', '.hg', '.next',
]);
let activeRepoWatcher = null; // { path, watcher, debouncePerDir: Map, gitDebounceTimer }

function stopRepoWatcher() {
  if (!activeRepoWatcher) return;
  try { activeRepoWatcher.watcher.close(); } catch { /* ignore */ }
  for (const t of activeRepoWatcher.debouncePerDir.values()) clearTimeout(t);
  if (activeRepoWatcher.gitDebounceTimer) clearTimeout(activeRepoWatcher.gitDebounceTimer);
  activeRepoWatcher = null;
}

function startRepoWatcher(rootPath) {
  stopRepoWatcher();
  const normalizedRoot = normalizeDirectoryPath(rootPath);
  const debouncePerDir = new Map();
  const state = { path: normalizedRoot, debouncePerDir, gitDebounceTimer: null, watcher: null };

  const send = (channel, payload) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(channel, payload);
    }
  };

  const shouldIgnore = (relPath) => {
    if (!relPath) return false;
    const parts = relPath.split(/[\\/]/);
    return parts.some((seg) => WATCH_IGNORED_DIRS.has(seg.toLowerCase()));
  };

  let watcher;
  try {
    watcher = fs.watch(normalizedRoot, { recursive: true }, (_eventType, filename) => {
      if (!filename) return;
      if (shouldIgnore(filename)) return;
      const absChanged = path.join(normalizedRoot, filename);
      // Affected directory: parent of changed entry (or self if it's a dir change).
      let affectedDir;
      try {
        const st = fs.statSync(absChanged);
        affectedDir = st.isDirectory() ? absChanged : path.dirname(absChanged);
      } catch {
        // Path was deleted — use the parent dir.
        affectedDir = path.dirname(absChanged);
      }
      // Debounce per affected directory (200ms) to coalesce bursts.
      const existing = debouncePerDir.get(affectedDir);
      if (existing) clearTimeout(existing);
      debouncePerDir.set(
        affectedDir,
        setTimeout(() => {
          debouncePerDir.delete(affectedDir);
          send('desktop:fs-changed', { rootPath: normalizedRoot, dirPath: affectedDir });
        }, 200),
      );
      // Coalesced git-status nudge (500ms).
      if (state.gitDebounceTimer) clearTimeout(state.gitDebounceTimer);
      state.gitDebounceTimer = setTimeout(() => {
        state.gitDebounceTimer = null;
        send('desktop:git-changed', { rootPath: normalizedRoot });
      }, 500);
    });
  } catch (err) {
    return { ok: false, error: err.message || String(err) };
  }
  state.watcher = watcher;
  activeRepoWatcher = state;
  return { ok: true, path: normalizedRoot };
}

ipcMain.handle('desktop:watch-repo', (_event, rootPath) => {
  return startRepoWatcher(rootPath);
});

ipcMain.handle('desktop:unwatch-repo', () => {
  stopRepoWatcher();
  return { ok: true };
});

// ---------------------------------------------------------------------------
// File operations for the repo browser tree (create / rename / delete).
// All paths are validated to live under the supplied repo root so a stray
// IPC call can't touch arbitrary disk locations.
// ---------------------------------------------------------------------------
function assertPathInsideRoot(targetPath, rootPath) {
  const normalizedTarget = path.resolve(targetPath);
  const normalizedRoot = path.resolve(rootPath);
  const rel = path.relative(normalizedRoot, normalizedTarget);
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new Error('Target path is outside the repository root.');
  }
  return { target: normalizedTarget, root: normalizedRoot };
}

ipcMain.handle('desktop:create-file', (_event, rootPath, targetPath, initialContent) => {
  const { target } = assertPathInsideRoot(targetPath, rootPath);
  if (fs.existsSync(target)) {
    return { ok: false, error: 'A file already exists at that path.' };
  }
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, typeof initialContent === 'string' ? initialContent : '', 'utf8');
  return { ok: true, path: target };
});

ipcMain.handle('desktop:create-folder', (_event, rootPath, targetPath) => {
  const { target } = assertPathInsideRoot(targetPath, rootPath);
  if (fs.existsSync(target)) {
    return { ok: false, error: 'A file or folder already exists at that path.' };
  }
  fs.mkdirSync(target, { recursive: true });
  return { ok: true, path: target };
});

ipcMain.handle('desktop:rename-path', (_event, rootPath, fromPath, toPath) => {
  const { target: from } = assertPathInsideRoot(fromPath, rootPath);
  const { target: to } = assertPathInsideRoot(toPath, rootPath);
  if (!fs.existsSync(from)) {
    return { ok: false, error: 'Source path no longer exists.' };
  }
  if (fs.existsSync(to) && from.toLowerCase() !== to.toLowerCase()) {
    // Allow case-only rename on case-insensitive filesystems
    return { ok: false, error: 'Destination already exists.' };
  }
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.renameSync(from, to);
  return { ok: true, path: to };
});

ipcMain.handle('desktop:delete-path', async (_event, rootPath, targetPath) => {
  const { target } = assertPathInsideRoot(targetPath, rootPath);
  if (!fs.existsSync(target)) {
    return { ok: false, error: 'Path no longer exists.' };
  }
  // Send to OS trash so users can recover; falls back to permanent delete.
  try {
    await shell.trashItem(target);
    return { ok: true, trashed: true };
  } catch (err) {
    try {
      fs.rmSync(target, { recursive: true, force: true });
      return { ok: true, trashed: false };
    } catch (err2) {
      return { ok: false, error: err2.message || String(err2) };
    }
  }
});

ipcMain.handle('desktop:open-path', (_event, targetPath) => {
  const normalizedPath = normalizeFilePath(targetPath);
  const result = shell.openPath(normalizedPath);
  if (result) {
    return { ok: false, error: result };
  }
  return { ok: true };
});

ipcMain.handle('desktop:run-dotnet-test', (event, request) => {
  return startDotnetTestRun(request, event.sender);
});

ipcMain.handle('desktop:debug-dotnet-test', (event, request) => {
  return startDotnetDebugRun(request, event.sender);
});

ipcMain.handle('desktop:debugger-continue', (_event, runId) => {
  return runDebuggerCommand(runId, 'continue');
});

ipcMain.handle('desktop:debugger-next', (_event, runId) => {
  return runDebuggerCommand(runId, 'next');
});

ipcMain.handle('desktop:debugger-step-in', (_event, runId) => {
  return runDebuggerCommand(runId, 'stepIn');
});

ipcMain.handle('desktop:debugger-step-out', (_event, runId) => {
  return runDebuggerCommand(runId, 'stepOut');
});

ipcMain.handle('desktop:debugger-pause', (_event, runId) => {
  return runDebuggerCommand(runId, 'pause');
});

// Fetch children of a structured variable (DAP variablesReference > 0).
// Returns a flat list of { name, value, type, variablesReference } so the UI
// can lazily expand objects/arrays/locals in the Variables tree.
ipcMain.handle('desktop:debugger-variables', async (_event, runId, variablesReference) => {
  const ref = Number(variablesReference);
  if (!Number.isFinite(ref) || ref <= 0) {
    return { ok: false, variables: [], error: 'A positive variablesReference is required.' };
  }
  try {
    const { session } = getDebugSessionOrThrow(runId);
    if (session.pendingAttach) await session.pendingAttach;
    const client = session.client;
    if (!client || typeof client.variables !== 'function') {
      return { ok: false, variables: [], error: 'Debugger does not expose variables.' };
    }
    const response = await client.variables(ref, { start: 0, count: 200 });
    const raw = Array.isArray(response?.body?.variables) ? response.body.variables : [];
    const variables = raw.map((v) => ({
      name: String(v.name ?? ''),
      value: String(v.value ?? ''),
      type: typeof v.type === 'string' ? v.type : undefined,
      variablesReference: typeof v.variablesReference === 'number' ? v.variablesReference : 0,
    }));
    return { ok: true, variables };
  } catch (err) {
    return { ok: false, variables: [], error: err.message || String(err) };
  }
});

ipcMain.handle('desktop:stop-dotnet-test', (_event, runId) => {
  return stopDotnetTestRun(runId);
});

ipcMain.on('app:set-unsaved-changes', (event, payload) => {
  const source = typeof payload?.source === 'string' ? payload.source : '';
  if (!source) {
    return;
  }

  const contentsId = event.sender.id;
  const isDirty = Boolean(payload?.isDirty);
  const dirtySources = dirtySourcesByContentsId.get(contentsId) ?? new Set();

  if (isDirty) {
    dirtySources.add(source);
    dirtySourcesByContentsId.set(contentsId, dirtySources);
    return;
  }

  dirtySources.delete(source);
  if (dirtySources.size === 0) {
    dirtySourcesByContentsId.delete(contentsId);
    return;
  }

  dirtySourcesByContentsId.set(contentsId, dirtySources);
});

ipcMain.on('app:window-close-response', (event, payload) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win || win.isDestroyed()) {
    return;
  }

  const contentsId = event.sender.id;
  pendingCloseRequestContentsIds.delete(contentsId);

  if (!payload?.shouldClose) {
    return;
  }

  dirtySourcesByContentsId.delete(contentsId);
  confirmedCloseContentsIds.add(contentsId);
  win.close();
});
