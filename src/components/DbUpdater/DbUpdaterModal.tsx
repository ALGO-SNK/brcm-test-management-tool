import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { IconCheckCircle, IconChevronDown, IconDatabase, IconError, IconRefresh, IconWarning, IconX } from '../Common/Icons';
import { useNotification } from '../../context/useNotification';
import { normalizeWorkspaceDbMappings, type WorkspaceDbMapping, type WorkspaceSettingsValues } from '../pages/WorkspaceSettings';

interface DbUpdaterModalProps {
  workspaceSettings: WorkspaceSettingsValues;
  onClose: () => void;
}

type TargetKey = string;
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

const INITIAL_TARGET_STATE: TargetState = {
  status: 'idle',
  phase: 'idle',
  message: 'Ready to update',
};
const DB_UPDATER_PAGE_SIZE_OPTIONS = [10, 50, 100, 250, 500];
const DEFAULT_DB_UPDATER_PAGE_SIZE = 10;
const DEFAULT_IDLE_MESSAGE = 'Local DB updater is idle. Run update when you need to rebuild the local SQLite data.';

interface DbUpdaterMemoryCache {
  settingsKey: string;
  overview: DesktopDbUpdaterOverview | null;
  targetStates: Record<TargetKey, TargetState>;
  events: DesktopDbUpdaterProgress[];
  idleMessage: string;
  pagesByTarget: Record<TargetKey, number>;
  pageSize: number;
}

function createInitialTargetStates(mappings: WorkspaceDbMapping[]): Record<TargetKey, TargetState> {
  return mappings.reduce<Record<TargetKey, TargetState>>((states, mapping) => {
    states[mapping.id] = { ...INITIAL_TARGET_STATE };
    return states;
  }, {});
}

function createInitialPages(mappings: WorkspaceDbMapping[]): Record<TargetKey, number> {
  return mappings.reduce<Record<TargetKey, number>>((pages, mapping) => {
    pages[mapping.id] = 1;
    return pages;
  }, {});
}

function createEmptyCache(settingsKey = '', mappings: WorkspaceDbMapping[] = []): DbUpdaterMemoryCache {
  return {
    settingsKey,
    overview: null,
    targetStates: createInitialTargetStates(mappings),
    events: [],
    idleMessage: DEFAULT_IDLE_MESSAGE,
    pagesByTarget: createInitialPages(mappings),
    pageSize: DEFAULT_DB_UPDATER_PAGE_SIZE,
  };
}

function getDbUpdaterCacheKey(settings: WorkspaceSettingsValues): string {
  return [
    settings.dbDirectory.trim(),
    JSON.stringify(normalizeWorkspaceDbMappings(settings)),
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

function getPlanTitle(target: DesktopDbUpdaterOverviewTarget | undefined, mapping: WorkspaceDbMapping): string {
  return target?.planName || mapping.label;
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
  let hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  const meridiem = hours >= 12 ? 'PM' : 'AM';
  hours %= 12;
  if (hours === 0) {
    hours = 12;
  }
  return `${String(hours).padStart(2, '0')}:${minutes}:${seconds} ${meridiem}`;
}

function getLogEventTitle(event: DesktopDbUpdaterProgress): string {
  if (event.status === 'complete') {
    return 'Completed';
  }
  if (event.status === 'failed') {
    return 'Failed';
  }

  switch (event.phase) {
    case 'start':
      return 'Starting update';
    case 'reset':
      return 'Preparing database';
    case 'fetch':
      return 'Loading from Azure DevOps';
    case 'database':
      return 'Updating local database';
    case 'vacuum':
      return 'Optimizing database';
    case 'done':
      return 'Finished';
    default:
      return event.phase ? event.phase.replace(/[-_]/g, ' ') : 'Activity';
  }
}

function getLogEventMeta(event: DesktopDbUpdaterProgress, mappings: WorkspaceDbMapping[]): string {
  const pieces: string[] = [];
  const targetName = mappings.find((mapping) => mapping.id === event.target)?.label;
  if (targetName) {
    pieces.push(targetName);
  }
  if (event.currentSuite && event.totalSuites) {
    pieces.push(`suite ${event.currentSuite} of ${event.totalSuites}`);
  }
  const rowCount = event.inserted ?? event.fetched;
  if (rowCount !== undefined) {
    pieces.push(`${rowCount} rows`);
  }
  return pieces.join(' · ');
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
    targets: Object.fromEntries(
      Object.entries(overview.targets).map(([targetKey, target]) => [targetKey, normalizeTarget(target)]),
    ),
  };
}

export function DbUpdaterModal({ workspaceSettings, onClose }: DbUpdaterModalProps) {
  const dbMappings = useMemo(
    () => normalizeWorkspaceDbMappings(workspaceSettings),
    [workspaceSettings],
  );
  const enabledMappings = useMemo(
    () => dbMappings.filter((mapping) => mapping.enabled),
    [dbMappings],
  );
  const firstTargetKey = enabledMappings[0]?.id ?? dbMappings[0]?.id ?? 'refresh';
  const settingsCacheKey = getDbUpdaterCacheKey(workspaceSettings);
  const cachedState = dbUpdaterMemoryCache.settingsKey === settingsCacheKey
    ? dbUpdaterMemoryCache
    : createEmptyCache(settingsCacheKey, dbMappings);
  const [section, setSection] = useState<SectionKey>(firstTargetKey);
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
  const overviewAutoLoadKeyRef = useRef<string | null>(null);
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

    const nextCache = createEmptyCache(settingsCacheKey, dbMappings);
    dbUpdaterMemoryCache = nextCache;
    setOverview(nextCache.overview);
    setPagesByTarget(nextCache.pagesByTarget);
    setPageSize(nextCache.pageSize);
    setTargetStates(nextCache.targetStates);
    setEvents(nextCache.events);
    setIdleMessage(nextCache.idleMessage);
    setSection(firstTargetKey);
  }, [dbMappings, firstTargetKey, settingsCacheKey]);

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

  useEffect(() => {
    if (section === 'refresh' || dbMappings.some((mapping) => mapping.id === section)) {
      return;
    }
    setSection(firstTargetKey);
  }, [dbMappings, firstTargetKey, section]);

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
    if (overviewAutoLoadKeyRef.current === settingsCacheKey) {
      return;
    }
    overviewAutoLoadKeyRef.current = settingsCacheKey;
    void loadOverview();
  }, [loadOverview, settingsCacheKey]);

  useEffect(() => {
    if (!window.desktop?.onDbUpdaterProgress) {
      return undefined;
    }

    return window.desktop.onDbUpdaterProgress((progress) => {
      setEvents((current) => [...current, progress]);

      if (progress.target === 'all' || !dbMappings.some((mapping) => mapping.id === progress.target)) {
        return;
      }

      const targetKey: TargetKey = progress.target;
      setTargetStates((current) => ({
        ...current,
        [targetKey]: {
          ...(current[targetKey] ?? INITIAL_TARGET_STATE),
          status: (() => {
            const nextStatus = getProgressTargetStatus(progress.status);
            const currentStatus = current[targetKey]?.status ?? 'idle';
            return nextStatus === 'running' && currentStatus !== 'running'
              ? currentStatus
              : nextStatus;
          })(),
          phase: progress.phase,
          message: progress.message,
          fetched: progress.fetched ?? current[targetKey]?.fetched,
          inserted: progress.inserted ?? current[targetKey]?.inserted,
          total: progress.total ?? current[targetKey]?.total,
          currentSuite: progress.currentSuite ?? current[targetKey]?.currentSuite,
          totalSuites: progress.totalSuites ?? current[targetKey]?.totalSuites,
          dbPath: progress.dbPath ?? current[targetKey]?.dbPath,
        },
      }));
    });
  }, [dbMappings]);

  const handleRun = async (targetKey: TargetKey) => {
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
      const message = 'Workspace settings need organization, project, and PAT before updating Local DB files.';
      addNotification('error', message);
      setIdleMessage(message);
      return;
    }
    const targetMapping = enabledMappings.find((mapping) => mapping.id === targetKey);
    if (!targetMapping) {
      const message = 'Select an enabled DB mapping before updating.';
      addNotification('error', message);
      setIdleMessage(message);
      return;
    }

    setSection('refresh');
    setIsRunning(true);
    setEvents([]);
    setTargetStates((current) => ({
      ...createInitialTargetStates(dbMappings),
      ...current,
      [targetKey]: { status: 'running', phase: 'queued', message: 'Queued for update' },
    }));

    try {
      const nextResult = await window.desktop.runDbUpdater(workspaceSettings, { targetIds: [targetKey] });
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
        addNotification('success', `${targetMapping.label} update completed.`);
        setIdleMessage('Local DB updater is idle. Last update completed successfully.');
      } else if (nextResult.status === 'partial') {
        addNotification('warning', 'Local DB update completed with one failed DB file.');
        setIdleMessage('Local DB updater is idle. Last update completed with one failed DB file.');
      } else {
        addNotification('error', `${targetMapping.label} update failed.`);
        setIdleMessage('Local DB updater is idle. Last update failed.');
      }
      await loadOverview();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Local DB update failed.';
      setIdleMessage(`Local DB updater is idle. ${message}`);
      addNotification('error', message);
      setTargetStates((current) => ({
        ...current,
        [targetKey]: current[targetKey]?.status === 'running'
          ? { ...current[targetKey], status: 'failed', message }
          : current[targetKey] ?? { ...INITIAL_TARGET_STATE, status: 'failed', message },
      }));
    } finally {
      setIsRunning(false);
    }
  };

  const renderPlanSection = (mapping: WorkspaceDbMapping) => {
    const targetKey = mapping.id;
    const target = overview?.targets[targetKey];
    const planTitle = getPlanTitle(target, mapping);
    const pageCount = Math.max(1, Math.ceil((target?.rows.length ?? 0) / pageSize));
    const currentPage = Math.min(pagesByTarget[targetKey] ?? 1, pageCount);
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
              <div className="settings-panel__sub">Plan {mapping.planId} / {target?.dbName ?? mapping.dbName}</div>
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

          <div className="db-updater__plan-compact">
            <div className="db-updater__plan-meta">
              <span>Rows <strong>{target?.rowCount ?? 0}</strong></span>
              <span>Automated <strong>{target?.automatedCount ?? 0}</strong></span>
              <span>Local DB <strong>{target?.exists ? 'Available' : 'Missing'}</strong></span>
              <span>Table <strong>{target?.tableExists ? 'TestCaseDao' : 'Not found'}</strong></span>
            </div>
            <div className="db-updater__path" title={target?.dbPath ?? ''}>
              {target?.dbPath ?? 'Local DB path is not available yet.'}
            </div>
          </div>
        </div>

        <section className="settings-panel db-updater__data-panel">
          <div className="settings-panel__head db-updater__data-head">
            <div>
              <div className="settings-panel__title">Local DB rows</div>
            </div>
            {isOverviewLoading && overview && (
              <span className="db-updater__refresh-pill">
                <span className="db-updater__mini-spinner" />
                Updating
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
                    setPagesByTarget(createInitialPages(dbMappings));
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
              <p className="empty-state__desc">Run Local DB Update to create and populate this local DB.</p>
            </div>
          ) : target.error ? (
            <div className="empty-state">
              <div className="empty-state__title">Could not read Local DB</div>
              <p className="empty-state__desc">{target.error}</p>
            </div>
          ) : !target.tableExists || target.rows.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state__title">No rows available</div>
              <p className="empty-state__desc">Run Local DB Update to load test cases into this plan DB.</p>
            </div>
          ) : (
            <div className="db-updater__table-wrap">
              <table className="db-updater__table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Title</th>
                    <th>Automation</th>
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
    const hasLog = events.length > 0 || enabledMappings.length > 0;
    const logState = getRunLogState(isRunning, events);

    return (
      <section className="settings-pane db-updater__pane">
        <section className="settings-panel">
          <div className="settings-panel__head db-updater__hero">
            <div>
              <div className="settings-panel__title">Local DB Update</div>
              <div className="settings-panel__sub">
                Update one mapped SQLite DB file from its Azure DevOps test plan.
              </div>
            </div>
            <span className="db-updater__refresh-pill">{enabledMappings.length} enabled mappings</span>
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
              {enabledMappings.map((mapping) => {
                const targetKey = mapping.id;
                const state = targetStates[targetKey] ?? INITIAL_TARGET_STATE;
                const progressValue = getProgressValue(state);
                const target = overview?.targets[targetKey];

                return (
                  <section className="settings-panel db-updater__target" key={targetKey}>
                    <div className="db-updater__target-head">
                      <div className={`db-updater__status db-updater__status--${state.status}`}>
                        {getStatusIcon(state.status)}
                      </div>
                      <div>
                        <h2>{getPlanTitle(target, mapping)}</h2>
                        <p>Plan {mapping.planId} / {target?.dbName ?? mapping.dbName}</p>
                      </div>
                      <button
                        type="button"
                        className="btn btn--primary btn--sm"
                        onClick={() => void handleRun(targetKey)}
                        disabled={isRunning || !isConfigured}
                      >
                        <IconRefresh size={14} />
                        <span>{state.status === 'running' ? 'Updating' : 'Update'}</span>
                      </button>
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
                    {isRunning ? 'Live Local DB update activity.' : 'Last Local DB update log. It will stay here until the next update.'}
                  </div>
                </div>
                <div className={`db-updater__log-state db-updater__log-state--${logState.key}`}>
                  <span />
                  {logState.label}
                </div>
              </div>
              <div className="db-updater__log-shell">
                <div className="db-updater__log-toolbar">
                  <span>Activity timeline</span>
                  <strong>{events.length} entries</strong>
                </div>
                <div className="db-updater__log">
                  {events.length === 0 ? (
                    <div className="db-updater__log-empty">
                      <strong>No update activity yet</strong>
                      <span>Start an update to see each step here.</span>
                    </div>
                  ) : (
                    events.map((event, index) => {
                      const meta = getLogEventMeta(event, dbMappings);
                      return (
                        <div className={`db-updater__log-row db-updater__log-row--${event.level}`} key={`${event.runId}-${event.timestamp}-${index}`}>
                          <span className="db-updater__log-marker" aria-hidden="true" />
                          <div className="db-updater__log-main">
                            <div className="db-updater__log-row-head">
                              <strong>{getLogEventTitle(event)}</strong>
                              <span>{formatDbUpdaterLogTime(event.timestamp)}</span>
                              <span className="db-updater__log-level">{event.level}</span>
                            </div>
                            {meta && <div className="db-updater__log-meta">{meta}</div>}
                            <p>{event.message}</p>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </section>
          </>
        )}
      </section>
    );
  };

  const sectionMapping = dbMappings.find((mapping) => mapping.id === section);
  const selectedRowMapping = selectedRow
    ? dbMappings.find((mapping) => mapping.id === selectedRow.targetKey)
    : undefined;
  const sectionTitle = section === 'refresh'
    ? 'Local DB Update'
    : sectionMapping
      ? getPlanTitle(overview?.targets[section], sectionMapping)
      : 'Local DB';
  const sectionSubtitle = section === 'refresh'
    ? 'Run the Local DB update and watch progress.'
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
              {dbMappings.map((mapping) => (
                <button
                  key={mapping.id}
                  type="button"
                  className={`settings-nav-item${section === mapping.id ? ' is-active' : ''}`}
                  onClick={() => setSection(mapping.id)}
                >
                  <span className="settings-nav-item__title">{getPlanTitle(overview?.targets[mapping.id], mapping)}</span>
                  <span className="settings-nav-item__sub">
                    {overview?.targets[mapping.id]?.dbName ?? mapping.dbName}
                    {!mapping.enabled ? ' / Disabled' : ''}
                  </span>
                </button>
              ))}

              <p className="settings-nav-label" style={{ marginTop: '20px' }}>Update</p>
              <button
                type="button"
                className={`settings-nav-item${section === 'refresh' ? ' is-active' : ''}`}
                onClick={() => setSection('refresh')}
              >
                <span className="settings-nav-item__title">Local DB Update</span>
                <span className="settings-nav-item__sub">{isRunning ? 'Update running' : events.length ? 'Last log available' : 'Idle'}</span>
              </button>
            </aside>

            <div className="settings-content db-updater__content">
              {sectionMapping && renderPlanSection(sectionMapping)}
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
                    <p>TestCaseDao / {selectedRowMapping?.label ?? selectedRow.targetKey}</p>
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
