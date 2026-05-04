import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { IconCheckCircle, IconChevronDown, IconDatabase, IconError, IconRefresh, IconWarning, IconX } from '../Common/Icons';
import { useNotification } from '../../context/useNotification';
import type { WorkspaceSettingsValues } from '../pages/WorkspaceSettings';

interface DbUpdaterModalProps {
  workspaceSettings: WorkspaceSettingsValues;
  onClose: () => void;
}

type TargetKey = 'main' | 'worldPay';
type SectionKey = TargetKey | 'refresh';
type TargetStatus = 'idle' | 'running' | 'complete' | 'failed';
type LooseDbRow = DesktopDbUpdaterRow & Record<string, unknown>;

interface TargetState {
  status: TargetStatus;
  phase: string;
  message: string;
  fetched?: number;
  inserted?: number;
  total?: number;
  currentSuite?: number;
  totalSuites?: number;
  dbPath?: string;
}

const TARGET_META: Record<TargetKey, { navLabel: string; fallbackLabel: string; planId: number; dbName: string }> = {
  main: {
    navLabel: 'Main Plan',
    fallbackLabel: 'Main plan',
    planId: 78806,
    dbName: 'BromcomTestCases.db',
  },
  worldPay: {
    navLabel: 'WorldPay Plan',
    fallbackLabel: 'WorldPay plan',
    planId: 139145,
    dbName: 'BromcomWorldPayTestCases.db',
  },
};

const INITIAL_TARGET_STATE: TargetState = {
  status: 'idle',
  phase: 'idle',
  message: 'Ready to update',
};
const DB_UPDATER_PAGE_SIZE_OPTIONS = [10, 50, 100, 250, 500];
const DEFAULT_DB_UPDATER_PAGE_SIZE = 10;
const DB_UPDATER_BACKGROUND_REFRESH_MS = 60000;
const DEFAULT_IDLE_MESSAGE = 'Local DB updater is idle. Run refresh when you need to rebuild the local SQLite data.';

interface DbUpdaterMemoryCache {
  settingsKey: string;
  overview: DesktopDbUpdaterOverview | null;
  targetStates: Record<TargetKey, TargetState>;
  events: DesktopDbUpdaterProgress[];
  idleMessage: string;
  pagesByTarget: Record<TargetKey, number>;
  pageSize: number;
}

function createInitialTargetStates(): Record<TargetKey, TargetState> {
  return {
    main: { ...INITIAL_TARGET_STATE },
    worldPay: { ...INITIAL_TARGET_STATE },
  };
}

function createEmptyCache(settingsKey = ''): DbUpdaterMemoryCache {
  return {
    settingsKey,
    overview: null,
    targetStates: createInitialTargetStates(),
    events: [],
    idleMessage: DEFAULT_IDLE_MESSAGE,
    pagesByTarget: { main: 1, worldPay: 1 },
    pageSize: DEFAULT_DB_UPDATER_PAGE_SIZE,
  };
}

function getDbUpdaterCacheKey(settings: WorkspaceSettingsValues): string {
  return [
    settings.dbDirectory.trim(),
    settings.mainDbName.trim(),
    settings.worldPayDbName.trim(),
  ].join('|');
}

let dbUpdaterMemoryCache = createEmptyCache();

function getProgressValue(state: TargetState): number {
  if (state.status === 'complete' || state.status === 'failed') {
    return 100;
  }
  if (state.total && state.inserted) {
    return Math.round((state.inserted / state.total) * 100);
  }
  if (state.totalSuites && state.currentSuite) {
    return Math.round((state.currentSuite / state.totalSuites) * 100);
  }
  return state.status === 'running' ? 18 : 0;
}

function getStatusIcon(status: TargetStatus) {
  if (status === 'complete') {
    return <IconCheckCircle size={18} />;
  }
  if (status === 'failed') {
    return <IconError size={18} />;
  }
  if (status === 'running') {
    return <IconRefresh size={18} />;
  }
  return <IconDatabase size={18} />;
}

function getRunLogState(isRunning: boolean, events: DesktopDbUpdaterProgress[]) {
  if (isRunning) {
    return { key: 'running', label: 'Running' };
  }
  if (events.some((event) => event.level === 'error' || event.status === 'failed')) {
    return { key: 'error', label: 'Needs attention' };
  }
  if (events.some((event) => event.status === 'complete')) {
    return { key: 'complete', label: 'Completed' };
  }
  return { key: 'idle', label: 'Idle' };
}

function getProgressTargetStatus(progressStatus: DesktopDbUpdaterStatus): TargetStatus {
  if (progressStatus === 'failed') {
    return 'failed';
  }
  if (progressStatus === 'complete') {
    return 'complete';
  }
  return 'running';
}

function getPlanTitle(target: DesktopDbUpdaterOverviewTarget | undefined, targetKey: TargetKey): string {
  return target?.planName || TARGET_META[targetKey].fallbackLabel;
}

function getLooseValue(row: LooseDbRow, ...keys: string[]) {
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(row, key)) {
      return row[key];
    }
  }
  return undefined;
}

function normalizeLooseText(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return '';
}

function normalizeLooseNumber(value: unknown): number {
  const numberValue = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

function parseJsonArrayLength(value: unknown): number {
  if (typeof value === 'number') {
    return value;
  }
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

function getPrettyJson(value: string): string {
  if (!value.trim()) {
    return '-';
  }
  try {
    return JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    return value;
  }
}

function renderJsonTokens(line: string, lineIndex: number) {
  const tokenPattern = /("(?:\\u[\da-fA-F]{4}|\\[^u]|[^\\"])*"(?=\s*:)|"(?:\\u[\da-fA-F]{4}|\\[^u]|[^\\"])*"|[-]?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|\btrue\b|\bfalse\b|\bnull\b|[{}\[\],:])/g;
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = tokenPattern.exec(line)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(line.slice(lastIndex, match.index));
    }

    const token = match[0];
    let tokenType = 'punctuation';
    if (/^"/.test(token)) {
      tokenType = /"\s*$/.test(token) && line.slice(match.index + token.length).match(/^\s*:/)
        ? 'key'
        : 'string';
    } else if (/^-?\d/.test(token)) {
      tokenType = 'number';
    } else if (token === 'true' || token === 'false') {
      tokenType = 'boolean';
    } else if (token === 'null') {
      tokenType = 'null';
    }

    nodes.push(
      <span className={`json-token json-token--${tokenType}`} key={`${lineIndex}-${match.index}-${token}`}>
        {token}
      </span>,
    );
    lastIndex = match.index + token.length;
  }

  if (lastIndex < line.length) {
    nodes.push(line.slice(lastIndex));
  }

  return nodes;
}

function renderJsonCode(value: string) {
  const pretty = getPrettyJson(value);
  return pretty.split('\n').map((line, index) => {
    const indent = line.match(/^ */)?.[0].length ?? 0;
    const content = line.slice(indent);

    return (
      <span className="json-code-line" key={`${index}-${line}`}>
        <span className="json-code-gutter">{index + 1}</span>
        <span className="json-code-content" style={{ paddingLeft: `${indent}ch` }}>
          {content ? renderJsonTokens(content, index) : ' '}
        </span>
      </span>
    );
  });
}

function formatDbUpdaterLogTime(timestamp: string) {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return timestamp;
  }
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  let hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  const meridiem = hours >= 12 ? 'PM' : 'AM';
  hours %= 12;
  if (hours === 0) {
    hours = 12;
  }
  return `${day}-${month}-${year} ${String(hours).padStart(2, '0')}:${minutes}:${seconds} ${meridiem}`;
}

function normalizeOverviewRows(overview: DesktopDbUpdaterOverview): DesktopDbUpdaterOverview {
  const normalizeTarget = (target: DesktopDbUpdaterOverviewTarget): DesktopDbUpdaterOverviewTarget => ({
    ...target,
    rows: target.rows.map((rawRow) => {
      const row = rawRow as LooseDbRow;
      return {
        id: normalizeLooseNumber(getLooseValue(row, 'id', 'Id')),
        title: normalizeLooseText(getLooseValue(row, 'title', 'Title')),
        isAutomationMethod: Boolean(getLooseValue(row, 'isAutomationMethod', 'IsAutomationMethod')),
        automatedTestName: normalizeLooseText(getLooseValue(row, 'automatedTestName', 'AutomatedTestName')),
        browserName: normalizeLooseText(getLooseValue(row, 'browserName', 'BrowserName')),
        batchName: normalizeLooseText(getLooseValue(row, 'batchName', 'BatchName')),
        testSuitId: normalizeLooseText(getLooseValue(row, 'testSuitId', 'TestSuitId')),
        initialStepsJson: normalizeLooseText(getLooseValue(row, 'initialStepsJson', 'InitialStepsJson')),
        testStepsJson: normalizeLooseText(getLooseValue(row, 'testStepsJson', 'TestStepsJson')),
        initialStepCount: parseJsonArrayLength(getLooseValue(row, 'initialStepCount', 'InitialStepCount', 'initialStepsJson', 'InitialStepsJson')),
        testStepCount: parseJsonArrayLength(getLooseValue(row, 'testStepCount', 'TestStepCount', 'testStepsJson', 'TestStepsJson')),
      };
    }),
  });

  return {
    ...overview,
    targets: {
      main: normalizeTarget(overview.targets.main),
      worldPay: normalizeTarget(overview.targets.worldPay),
    },
  };
}

export function DbUpdaterModal({ workspaceSettings, onClose }: DbUpdaterModalProps) {
  const settingsCacheKey = getDbUpdaterCacheKey(workspaceSettings);
  const cachedState = dbUpdaterMemoryCache.settingsKey === settingsCacheKey
    ? dbUpdaterMemoryCache
    : createEmptyCache(settingsCacheKey);
  const [section, setSection] = useState<SectionKey>('main');
  const [isRunning, setIsRunning] = useState(false);
  const [isOverviewLoading, setIsOverviewLoading] = useState(false);
  const [overview, setOverview] = useState<DesktopDbUpdaterOverview | null>(cachedState.overview);
  const [pagesByTarget, setPagesByTarget] = useState<Record<TargetKey, number>>(cachedState.pagesByTarget);
  const [pageSize, setPageSize] = useState(cachedState.pageSize);
  const [targetStates, setTargetStates] = useState<Record<TargetKey, TargetState>>(cachedState.targetStates);
  const [events, setEvents] = useState<DesktopDbUpdaterProgress[]>(cachedState.events);
  const [idleMessage, setIdleMessage] = useState(cachedState.idleMessage);
  const [selectedRow, setSelectedRow] = useState<{ targetKey: TargetKey; row: DesktopDbUpdaterRow } | null>(null);
  const overviewLoadingRef = useRef(false);
  const { addNotification } = useNotification();

  const isConfigured = Boolean(
    workspaceSettings.organization.trim()
      && workspaceSettings.projectName.trim()
      && workspaceSettings.patToken.trim(),
  );

  useEffect(() => {
    if (dbUpdaterMemoryCache.settingsKey === settingsCacheKey) {
      return;
    }

    const nextCache = createEmptyCache(settingsCacheKey);
    dbUpdaterMemoryCache = nextCache;
    setOverview(nextCache.overview);
    setPagesByTarget(nextCache.pagesByTarget);
    setPageSize(nextCache.pageSize);
    setTargetStates(nextCache.targetStates);
    setEvents(nextCache.events);
    setIdleMessage(nextCache.idleMessage);
  }, [settingsCacheKey]);

  useEffect(() => {
    dbUpdaterMemoryCache = {
      settingsKey: settingsCacheKey,
      overview,
      targetStates,
      events,
      idleMessage,
      pagesByTarget,
      pageSize,
    };
  }, [events, idleMessage, overview, pageSize, pagesByTarget, settingsCacheKey, targetStates]);

  const loadOverview = useCallback(async (options: { silent?: boolean } = {}) => {
    if (!window.desktop?.getDbUpdaterOverview || overviewLoadingRef.current) {
      return;
    }

    overviewLoadingRef.current = true;
    setIsOverviewLoading(true);
    try {
      const nextOverview = await window.desktop.getDbUpdaterOverview(workspaceSettings);
      setOverview(normalizeOverviewRows(nextOverview));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not read Local DB information.';
      if (!options.silent) {
        addNotification('error', message);
      }
    } finally {
      overviewLoadingRef.current = false;
      setIsOverviewLoading(false);
    }
  }, [addNotification, workspaceSettings]);

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      if (!isRunning) {
        void loadOverview({ silent: true });
      }
    }, DB_UPDATER_BACKGROUND_REFRESH_MS);

    return () => window.clearInterval(intervalId);
  }, [isRunning, loadOverview]);

  useEffect(() => {
    if (!window.desktop?.onDbUpdaterProgress) {
      return undefined;
    }

    return window.desktop.onDbUpdaterProgress((progress) => {
      setEvents((current) => [...current, progress].slice(-160));

      if (progress.target !== 'main' && progress.target !== 'worldPay') {
        return;
      }

      const targetKey: TargetKey = progress.target;
      setTargetStates((current) => ({
        ...current,
        [targetKey]: {
          ...current[targetKey],
          status: (() => {
            const nextStatus = getProgressTargetStatus(progress.status);
            return nextStatus === 'running' && current[targetKey].status !== 'running'
              ? current[targetKey].status
              : nextStatus;
          })(),
          phase: progress.phase,
          message: progress.message,
          fetched: progress.fetched ?? current[targetKey].fetched,
          inserted: progress.inserted ?? current[targetKey].inserted,
          total: progress.total ?? current[targetKey].total,
          currentSuite: progress.currentSuite ?? current[targetKey].currentSuite,
          totalSuites: progress.totalSuites ?? current[targetKey].totalSuites,
          dbPath: progress.dbPath ?? current[targetKey].dbPath,
        },
      }));
    });
  }, []);

  const handleRun = async () => {
    if (isRunning) {
      return;
    }
    if (!window.desktop?.runDbUpdater) {
      const message = 'Local DB updater is unavailable. Restart the app to load the latest Electron changes.';
      addNotification('error', message);
      setIdleMessage(message);
      return;
    }
    if (!isConfigured) {
      const message = 'Workspace settings need organization, project, and PAT before refreshing Local DB files.';
      addNotification('error', message);
      setIdleMessage(message);
      return;
    }

    setSection('refresh');
    setIsRunning(true);
    setEvents([]);
    setTargetStates({
      main: { status: 'running', phase: 'queued', message: 'Queued for update' },
      worldPay: { status: 'running', phase: 'queued', message: 'Queued for update' },
    });

    try {
      const nextResult = await window.desktop.runDbUpdater(workspaceSettings);
      setTargetStates((current) => {
        const nextStates = { ...current };
        nextResult.results.forEach((result) => {
          nextStates[result.target] = {
            ...nextStates[result.target],
            status: result.status,
            phase: result.status === 'complete' ? 'done' : 'failed',
            message: result.error ?? `${result.label}: ${result.inserted} rows updated`,
            inserted: result.inserted,
            total: Math.max(nextStates[result.target].total ?? 0, result.inserted),
            dbPath: result.dbPath,
          };
        });
        return nextStates;
      });
      if (nextResult.status === 'complete') {
        addNotification('success', 'Local DB refresh completed.');
        setIdleMessage('Local DB updater is idle. Last refresh completed successfully.');
      } else if (nextResult.status === 'partial') {
        addNotification('warning', 'Local DB refresh completed with one failed DB file.');
        setIdleMessage('Local DB updater is idle. Last refresh completed with one failed DB file.');
      } else {
        addNotification('error', 'Local DB refresh failed.');
        setIdleMessage('Local DB updater is idle. Last refresh failed.');
      }
      await loadOverview();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Local DB refresh failed.';
      setIdleMessage(`Local DB updater is idle. ${message}`);
      addNotification('error', message);
      setTargetStates((current) => ({
        main: current.main.status === 'running' ? { ...current.main, status: 'failed', message } : current.main,
        worldPay: current.worldPay.status === 'running' ? { ...current.worldPay, status: 'failed', message } : current.worldPay,
      }));
    } finally {
      setIsRunning(false);
    }
  };

  const renderPlanSection = (targetKey: TargetKey) => {
    const meta = TARGET_META[targetKey];
    const target = overview?.targets[targetKey];
    const planTitle = getPlanTitle(target, targetKey);
    const pageCount = Math.max(1, Math.ceil((target?.rows.length ?? 0) / pageSize));
    const currentPage = Math.min(pagesByTarget[targetKey], pageCount);
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = Math.min(startIndex + pageSize, target?.rows.length ?? 0);
    const visibleRows = target?.rows.slice(startIndex, endIndex) ?? [];
    const updatePage = (nextPage: number) => {
      setPagesByTarget((current) => ({
        ...current,
        [targetKey]: Math.min(Math.max(nextPage, 1), pageCount),
      }));
    };

    return (
      <section className="settings-pane db-updater__pane">
        <div className="settings-panel db-updater__plan-card">
          <div className="settings-panel__head db-updater__plan-head">
            <div>
              <div className="settings-panel__title">{planTitle}</div>
              <div className="settings-panel__sub">Plan {meta.planId} / {target?.dbName ?? meta.dbName}</div>
            </div>
            <button
              type="button"
              className="btn btn--secondary btn--sm"
              onClick={() => void loadOverview()}
              disabled={isOverviewLoading}
            >
              <IconRefresh size={14} />
              <span>{isOverviewLoading ? 'Loading' : 'Reload'}</span>
            </button>
          </div>

          <div className="db-updater__plan-meta">
            <div>
              <span>Rows</span>
              <strong>{target?.rowCount ?? 0}</strong>
            </div>
            <div>
              <span>Automated</span>
              <strong>{target?.automatedCount ?? 0}</strong>
            </div>
            <div>
              <span>Local DB</span>
              <strong>{target?.exists ? 'Available' : 'Missing'}</strong>
            </div>
            <div>
              <span>Table</span>
              <strong>{target?.tableExists ? 'TestCaseDao' : 'Not found'}</strong>
            </div>
          </div>

          <div className="db-updater__path" title={target?.dbPath ?? ''}>
            {target?.dbPath ?? 'Local DB path is not available yet.'}
          </div>
        </div>

        <section className="settings-panel db-updater__data-panel">
          <div className="settings-panel__head db-updater__data-head">
            <div>
              <div className="settings-panel__title">Local DB rows</div>
              <div className="settings-panel__sub">
                Current data stored in the local TestCaseDao for this plan.
                {target?.rows.length ? ` Showing ${startIndex + 1}-${endIndex} of ${target.rows.length}.` : ''}
              </div>
            </div>
            {isOverviewLoading && overview && (
              <span className="db-updater__refresh-pill">
                <span className="db-updater__mini-spinner" />
                Refreshing
              </span>
            )}
            <label className="db-updater__page-size">
              <span className="db-updater__page-size-label">Rows</span>
              <span className="db-updater__page-size-control">
                <select
                  value={pageSize}
                  aria-label="Rows per page"
                  onChange={(event) => {
                    setPageSize(Number(event.target.value));
                    setPagesByTarget({ main: 1, worldPay: 1 });
                  }}
                >
                  {DB_UPDATER_PAGE_SIZE_OPTIONS.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
                <IconChevronDown size={16} />
              </span>
            </label>
          </div>

          {!overview && isOverviewLoading ? (
            <div className="empty-state">
              <div className="empty-state__title">Loading Local DB rows</div>
              <p className="empty-state__desc">Reading local SQLite data in the background.</p>
            </div>
          ) : !target?.exists ? (
            <div className="empty-state">
              <div className="empty-state__title">Local DB file not found</div>
              <p className="empty-state__desc">Run Local DB Refresh to create and populate this local DB.</p>
            </div>
          ) : target.error ? (
            <div className="empty-state">
              <div className="empty-state__title">Could not read Local DB</div>
              <p className="empty-state__desc">{target.error}</p>
            </div>
          ) : !target.tableExists || target.rows.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state__title">No rows available</div>
              <p className="empty-state__desc">Run Local DB Refresh to load test cases into this plan DB.</p>
            </div>
          ) : (
            <div className="db-updater__table-wrap">
              <table className="db-updater__table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Title</th>
                    <th>Automation</th>
                    <th>Method</th>
                    <th>Browser</th>
                    <th>Initial steps</th>
                    <th>Test steps</th>
                    <th>Batch</th>
                    <th>Suite</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.map((row) => (
                    <tr
                      key={`${targetKey}-${row.id}`}
                      className="db-updater__table-row"
                      tabIndex={0}
                      onClick={() => setSelectedRow({ targetKey, row })}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          setSelectedRow({ targetKey, row });
                        }
                      }}
                    >
                      <td>{row.id}</td>
                      <td>{row.title}</td>
                      <td>{row.isAutomationMethod ? 'Yes' : 'No'}</td>
                      <td>{row.automatedTestName || '-'}</td>
                      <td>{row.browserName || '-'}</td>
                      <td>{row.initialStepCount}</td>
                      <td>{row.testStepCount}</td>
                      <td>{row.batchName || '-'}</td>
                      <td>{row.testSuitId || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {target?.rows.length ? (
            <div className="db-updater__pagination">
              <span>Page {currentPage} of {pageCount} / {pageSize} rows per page</span>
              <div>
                <button
                  type="button"
                  className="btn btn--secondary btn--sm"
                  onClick={() => updatePage(currentPage - 1)}
                  disabled={currentPage <= 1}
                >
                  Previous
                </button>
                <button
                  type="button"
                  className="btn btn--secondary btn--sm"
                  onClick={() => updatePage(currentPage + 1)}
                  disabled={currentPage >= pageCount}
                >
                  Next
                </button>
              </div>
            </div>
          ) : null}
        </section>
      </section>
    );
  };

  const renderRefreshSection = () => {
    const hasLog = events.length > 0;
    const logState = getRunLogState(isRunning, events);

    return (
      <section className="settings-pane db-updater__pane">
        <section className="settings-panel">
          <div className="settings-panel__head db-updater__hero">
            <div>
              <div className="settings-panel__title">Local DB Refresh</div>
              <div className="settings-panel__sub">
                Refresh local main and WorldPay SQLite DB files from Azure DevOps test plans.
              </div>
            </div>
            <button
              type="button"
              className="btn btn--primary btn--sm"
              onClick={handleRun}
              disabled={isRunning || !isConfigured}
            >
              <IconRefresh size={15} />
              <span>{isRunning ? 'Refreshing' : 'Refresh Local DB'}</span>
            </button>
          </div>
        </section>

        {!isConfigured && (
          <div className="db-updater__config-warning">
            <IconWarning size={15} />
            Workspace settings need organization, project, and PAT.
          </div>
        )}

        {!isRunning && !hasLog ? (
          <section className="settings-panel">
            <div className="empty-state">
              <div className="empty-state__title">Idle</div>
              <p className="empty-state__desc">{idleMessage}</p>
            </div>
          </section>
        ) : (
          <>
            <div className="db-updater__target-grid">
              {(['main', 'worldPay'] as TargetKey[]).map((targetKey) => {
                const state = targetStates[targetKey];
                const progressValue = getProgressValue(state);
                const meta = TARGET_META[targetKey];
                const target = overview?.targets[targetKey];

                return (
                  <section className="settings-panel db-updater__target" key={targetKey}>
                    <div className="db-updater__target-head">
                      <div className={`db-updater__status db-updater__status--${state.status}`}>
                        {getStatusIcon(state.status)}
                      </div>
                      <div>
                        <h2>{getPlanTitle(target, targetKey)}</h2>
                        <p>Plan {meta.planId} / {target?.dbName ?? meta.dbName}</p>
                      </div>
                    </div>
                    <div className="db-updater__progress-track" aria-hidden="true">
                      <span style={{ width: `${progressValue}%` }} />
                    </div>
                    <div className="db-updater__target-message">{state.message}</div>
                    <div className="db-updater__target-meta">
                      <span>Phase: {state.phase}</span>
                      <span>Suites: {state.currentSuite ?? 0}/{state.totalSuites ?? 0}</span>
                      <span>Rows: {state.inserted ?? state.fetched ?? 0}</span>
                    </div>
                  </section>
                );
              })}
            </div>

            <section className="settings-panel db-updater__log-panel">
              <div className="settings-panel__head db-updater__log-head">
                <div>
                  <div className="settings-panel__title">Local DB update log</div>
                  <div className="settings-panel__sub">
                    {isRunning ? 'Live Local DB refresh activity.' : 'Last Local DB refresh log. It will stay here until the next refresh.'}
                  </div>
                </div>
                <div className={`db-updater__log-state db-updater__log-state--${logState.key}`}>
                  <span />
                  {logState.label}
                </div>
              </div>
              <div className="db-updater__log-shell">
                <div className="db-updater__log-toolbar">
                  <div className="db-updater__log-dots" aria-hidden="true">
                    <span />
                    <span />
                    <span />
                  </div>
                  <span>Activity stream</span>
                  <strong>{events.length} entries</strong>
                </div>
                <div className="db-updater__log">
                  {events.map((event, index) => (
                    <div className={`db-updater__log-row db-updater__log-row--${event.level}`} key={`${event.runId}-${event.timestamp}-${index}`}>
                      <span className="db-updater__log-index">{String(index + 1).padStart(2, '0')}</span>
                      <span className="db-updater__log-time">{formatDbUpdaterLogTime(event.timestamp)}</span>
                      <span className="db-updater__log-level">{event.level}</span>
                      <p>{event.message}</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </>
        )}
      </section>
    );
  };

  const sectionTitle = section === 'refresh'
    ? 'Local DB Refresh'
    : getPlanTitle(overview?.targets[section], section);
  const sectionSubtitle = section === 'refresh'
    ? 'Run the Local DB refresh and watch progress.'
    : 'Inspect the local TestCaseDao data for this plan DB.';

  return (
    <div className="settings-overlay" role="dialog" aria-modal="true" aria-label="Local DB updater">
      <button
        type="button"
        className="settings-overlay__backdrop"
        onClick={isRunning ? undefined : onClose}
        aria-label="Close Local DB updater"
      />
      <div className="settings-dock">
        <section className="settings-workbench db-updater">
          <header className="settings-workbench__header">
            <div>
              <p className="settings-workbench__crumb">Local DB Updater / {sectionTitle}</p>
              <h1 className="settings-workbench__title">{sectionTitle}</h1>
              <p className="settings-workbench__subtitle">{sectionSubtitle}</p>
            </div>
            <button
              type="button"
              className="settings-workbench__close"
              onClick={onClose}
              disabled={isRunning}
              aria-label="Close Local DB updater"
              title="Close Local DB updater"
            >
              <IconX size={18} />
            </button>
          </header>

          <div className="settings-workbench__body">
            <aside className="settings-nav" aria-label="Local DB updater sections">
              <p className="settings-nav-label">Plans</p>
              <button
                type="button"
                className={`settings-nav-item${section === 'main' ? ' is-active' : ''}`}
                onClick={() => setSection('main')}
              >
                <span className="settings-nav-item__title">{TARGET_META.main.navLabel}</span>
                <span className="settings-nav-item__sub">{getPlanTitle(overview?.targets.main, 'main')}</span>
              </button>
              <button
                type="button"
                className={`settings-nav-item${section === 'worldPay' ? ' is-active' : ''}`}
                onClick={() => setSection('worldPay')}
              >
                <span className="settings-nav-item__title">{TARGET_META.worldPay.navLabel}</span>
                <span className="settings-nav-item__sub">{getPlanTitle(overview?.targets.worldPay, 'worldPay')}</span>
              </button>

              <p className="settings-nav-label" style={{ marginTop: '20px' }}>Refresh</p>
              <button
                type="button"
                className={`settings-nav-item${section === 'refresh' ? ' is-active' : ''}`}
                onClick={() => setSection('refresh')}
              >
                <span className="settings-nav-item__title">Local DB Refresh</span>
                <span className="settings-nav-item__sub">{isRunning ? 'Refresh running' : events.length ? 'Last log available' : 'Idle'}</span>
              </button>
            </aside>

            <div className="settings-content db-updater__content">
              {section === 'main' && renderPlanSection('main')}
              {section === 'worldPay' && renderPlanSection('worldPay')}
              {section === 'refresh' && renderRefreshSection()}
            </div>
          </div>

          {selectedRow && (
            <div className="db-updater__row-dialog" role="dialog" aria-modal="true" aria-label="Local DB row details">
              <button
                type="button"
                className="db-updater__row-dialog-backdrop"
                onClick={() => setSelectedRow(null)}
                aria-label="Close row details"
              />
              <section className="db-updater__row-dialog-panel">
                <header className="db-updater__row-dialog-head">
                  <div>
                    <p>TestCaseDao / {TARGET_META[selectedRow.targetKey].navLabel}</p>
                    <div className="db-updater__row-title-line">
                      <h2>{selectedRow.row.title || `Test case ${selectedRow.row.id}`}</h2>
                      <div className="db-updater__row-dialog-sub">
                        <span>ID {selectedRow.row.id}</span>
                        <span>{selectedRow.row.browserName || 'No browser'}</span>
                        <span>{selectedRow.row.isAutomationMethod ? 'Automated' : 'Manual'}</span>
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="repo-browser__branch-conflict-close"
                    onClick={() => setSelectedRow(null)}
                    aria-label="Close row details"
                    title="Close"
                  >
                    <IconX size={18} />
                  </button>
                </header>

                <div className="db-updater__row-dialog-body">
                  <div className="db-updater__row-detail-grid">
                    {selectedRow.row.testSuitId && (
                      <div><span>Suite</span><strong>{selectedRow.row.testSuitId}</strong></div>
                    )}
                    {selectedRow.row.batchName && (
                      <div><span>Batch</span><strong>{selectedRow.row.batchName}</strong></div>
                    )}
                    <div><span>Method</span><strong>{selectedRow.row.automatedTestName || '-'}</strong></div>
                  </div>

                  <div className="db-updater__row-json-grid">
                    <section className="db-updater__code-panel db-updater__code-panel--initial">
                      <div className="db-updater__code-head">
                        <div>
                          <h3>Initial Steps Json</h3>
                        </div>
                        <span>{selectedRow.row.initialStepCount} steps</span>
                      </div>
                      <pre className="json-code" aria-label="Initial steps JSON">
                        <code>{renderJsonCode(selectedRow.row.initialStepsJson)}</code>
                      </pre>
                    </section>
                    <section className="db-updater__code-panel db-updater__code-panel--test">
                      <div className="db-updater__code-head">
                        <div>
                          <h3>Test Steps Json</h3>
                        </div>
                        <span>{selectedRow.row.testStepCount} steps</span>
                      </div>
                      <pre className="json-code" aria-label="Test steps JSON">
                        <code>{renderJsonCode(selectedRow.row.testStepsJson)}</code>
                      </pre>
                    </section>
                  </div>
                </div>
              </section>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
