const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync, spawn } = require('node:child_process');
const { EventEmitter } = require('node:events');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const { app, BrowserWindow, shell, ipcMain, dialog } = require('electron');
const { autoUpdater } = require('electron-updater');

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
      await resetDbUpdaterDatabase(dbPath, sender, runId, target);

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
  const changesByPath = new Map();

  const numstatOutput = runGitCommand(normalizedPath, ['diff', '--numstat', 'HEAD', '--']);
  if (numstatOutput) {
    numstatOutput.split(/\r?\n/).forEach((line) => {
      const [additionsValue, deletionsValue, filePath] = line.split('\t');
      if (!filePath) {
        return;
      }

      changesByPath.set(filePath, {
        path: filePath,
        additions: Number.parseInt(additionsValue, 10) || 0,
        deletions: Number.parseInt(deletionsValue, 10) || 0,
        status: 'modified',
      });
    });
  }

  const statusOutput = runGitCommand(normalizedPath, ['status', '--porcelain=v1', '-z']);
  if (!statusOutput) {
    return Array.from(changesByPath.values());
  }

  const records = statusOutput.split('\0').filter(Boolean);
  for (let index = 0; index < records.length; index += 1) {
    const record = records[index];
    const statusCode = record.slice(0, 2);
    const filePath = record.slice(3);
    if (!filePath) {
      continue;
    }

    if (statusCode[0] === 'R' || statusCode[0] === 'C') {
      index += 1;
    }

    const existing = changesByPath.get(filePath);
    changesByPath.set(filePath, {
      path: filePath,
      additions: existing?.additions ?? 0,
      deletions: existing?.deletions ?? 0,
      status: statusCode.trim() || 'modified',
    });
  }

  return Array.from(changesByPath.values())
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

app.setAppUserModelId(APP_ID);

app.whenReady().then(() => {
  app.setName(PRODUCT_NAME);

  if (process.platform === 'darwin' && app.dock && brandLogoPath) {
    app.dock.setIcon(brandLogoPath);
  }

  createSplashWindow();
  createWindow();

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

app.on('window-all-closed', () => {
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

ipcMain.handle('desktop:get-git-branch', (_event, targetPath) => {
  return readGitBranch(targetPath);
});

ipcMain.handle('desktop:switch-git-branch', (_event, targetPath, targetBranch) => {
  return switchGitBranch(targetPath, targetBranch);
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
