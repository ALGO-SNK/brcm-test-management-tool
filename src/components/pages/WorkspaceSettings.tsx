import React, { useEffect, useMemo, useRef, useState } from 'react';
import { IconDelete, IconPlus, IconSave, IconX } from '../Common/Icons';
import { useThemeContext } from '../../context/useThemeContext';
import { useNotification } from '../../context/useNotification';
import { getAppVersions } from '../../utils/appVersion';
import {
  APP_FONT_OPTIONS,
  THEME_MODE_OPTIONS,
  type AppFontMode,
  type ThemeMode,
} from '../../context/themeContext.shared';
import { NOT_SELECTED_LABEL } from '../../utils/selectLabels';
import { fetchPlans, getCachedPlans } from '../../services/adoApi';
import type { ADOTestPlan } from '../../types';
import {
  clearActionCatalogOverride,
  exportActionCatalogJson,
  getActionCatalogStatus,
  importActionCatalogOverrideFromJson,
  subscribeActionRegistryChanges,
  type ActionCatalogStatus,
} from '../../utils/actionRegistry';

export interface WorkspaceSettingsValues {
  organization: string;
  projectName: string;
  patToken: string;
  apiVersion: string;
  seleniumRepoPath: string;
  dbDirectory: string;
  mainDbName: string;
  worldPayDbName: string;
  dbMappings: WorkspaceDbMapping[];
  testRunWorkingDirectory: string;
  testRunProjectPath: string;
  testRunSettingsPath: string;
  testRunLogger: string;
  testRunUsePatAsEnv: boolean;
  schedulerEnabled: boolean;
  schedulerTimezone: string;
  schedulerPollSeconds: number;
  schedulerDefaultCron: string;
  schedulerDefaultMode: SchedulerRunMode;
  schedulerDefaultBatchSize: number;
  schedulerMaxHistoryRows: number;
  schedulerBuildDefinitionId: number;
  schedulerDefaultConfigurationId: number;
  schedulerDefaultPointConfigurationId: number;
  schedulerReleaseDefinitionIdsCsv: string;
  schedulerWorldPayRegressionBranch: string;
  schedulerWorldPayKanbanBranch: string;
  schedulerSagePayTestPlanId: number;
  schedulerWorldPayTestPlanId: number;
  schedulerMappingWorkItemIds: string;
  schedulerExcludedSuiteIdsCsv: string;
  schedulerExcludedSuiteNamePatterns: string;
}

export interface WorkspaceDbMapping {
  id: string;
  label: string;
  planId: number;
  dbName: string;
  enabled: boolean;
}

interface WorkspaceSettingsProps {
  values: WorkspaceSettingsValues;
  onSave: (values: WorkspaceSettingsValues) => void;
  onBack: () => void;
  embedded?: boolean;
}

type SettingsSection = 'appearance' | 'workspace' | 'scheduler' | 'db-mappings' | 'action-catalog' | 'about';
type ValidationState = 'idle' | 'success' | 'error';
type SchedulerRunMode = 'nightly_full' | 'selected_suite' | 'failed_only_rerun';

const API_VERSION_OPTIONS = ['7.2', '7.1', '7.0', '6.0'];
const TEST_LOGGER_OPTIONS = [
  'console;verbosity=detailed',
  'console;verbosity=normal',
  'console;verbosity=minimal',
];
const SCHEDULER_MODE_OPTIONS: Array<{ value: SchedulerRunMode; label: string }> = [
  { value: 'nightly_full', label: 'Nightly Full' },
  { value: 'selected_suite', label: 'Selected Suites' },
  { value: 'failed_only_rerun', label: 'Failed-Only Re-run' },
];
const AUTO_DETECT_MAX_DEPTH = 4;
export const DEFAULT_DB_MAPPINGS: WorkspaceDbMapping[] = [
  {
    id: 'main',
    label: 'Main Plan',
    planId: 78806,
    dbName: 'BromcomTestCases.db',
    enabled: true,
  },
  {
    id: 'worldPay',
    label: 'WorldPay Plan',
    planId: 139145,
    dbName: 'BromcomWorldPayTestCases.db',
    enabled: true,
  },
];

function normalizeMappingId(value: string, fallback: string): string {
  const normalized = value
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
  return normalized || fallback;
}

export function normalizeWorkspaceDbMappings(
  values: Partial<WorkspaceSettingsValues> & { dbMappings?: Partial<WorkspaceDbMapping>[] },
): WorkspaceDbMapping[] {
  const source = Array.isArray(values.dbMappings) && values.dbMappings.length
    ? values.dbMappings
    : DEFAULT_DB_MAPPINGS.map((mapping) => ({
        ...mapping,
        dbName: mapping.id === 'main'
          ? values.mainDbName || mapping.dbName
          : mapping.id === 'worldPay'
            ? values.worldPayDbName || mapping.dbName
            : mapping.dbName,
      }));

  const usedIds = new Set<string>();
  const mappings = source.map((mapping, index) => {
    const label = String(mapping.label || '').trim() || `DB mapping ${index + 1}`;
    const baseId = normalizeMappingId(String(mapping.id || label), `mapping-${index + 1}`);
    let id = baseId;
    let suffix = 2;
    while (usedIds.has(id)) {
      id = `${baseId}-${suffix}`;
      suffix += 1;
    }
    usedIds.add(id);

    return {
      id,
      label,
      planId: Number(mapping.planId) || 0,
      dbName: String(mapping.dbName || '').trim(),
      enabled: mapping.enabled !== false,
    };
  });

  return mappings.length ? mappings : DEFAULT_DB_MAPPINGS;
}

function isAppFontMode(value: string): value is AppFontMode {
  return APP_FONT_OPTIONS.some((item) => item.value === value);
}

function isValidSchedulerCron(value: string): boolean {
  const parts = value.trim().split(/\s+/);
  if (parts.length !== 6) return false;
  return parts.every((token) => token.length > 0);
}

function isValidTimezone(value: string): boolean {
  try {
    Intl.DateTimeFormat('en-US', { timeZone: value.trim() }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

function parseDefinitionIdsCsv(value: string): number[] {
  return Array.from(
    new Set(
      value
        .split(/[,\s]+/)
        .map((token) => Number(token.trim()))
        .filter((token) => Number.isInteger(token) && token > 0),
    ),
  );
}

async function scanDirectoryFiles(
  rootPath: string,
  fileSuffixes: string[],
  maxDepth = AUTO_DETECT_MAX_DEPTH,
): Promise<{ files: string[]; folders: string[] }> {
  if (!window.desktop?.listDirectory || !rootPath.trim()) {
    return { files: [], folders: [] };
  }

  const normalizedSuffixes = fileSuffixes.map((suffix) => suffix.toLowerCase());
  const ignoredFolderNames = new Set([
    '.vs',
    '.git',
    '.idea',
    '.vscode',
    'node_modules',
    'bin',
    'obj',
  ]);
  const queue: Array<{ path: string; depth: number }> = [{ path: rootPath, depth: 0 }];
  const files = new Set<string>();
  const folders = new Set<string>();

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) break;
    const entries = await window.desktop.listDirectory(current.path);
    for (const entry of entries) {
      if (entry.type === 'directory') {
        const folderName = entry.name.trim().toLowerCase();
        if (!folderName || folderName.startsWith('.') || ignoredFolderNames.has(folderName)) {
          continue;
        }
        folders.add(entry.path);
        if (current.depth < maxDepth) {
          queue.push({ path: entry.path, depth: current.depth + 1 });
        }
      } else if (entry.type === 'file') {
        const name = entry.name.toLowerCase();
        if (normalizedSuffixes.some((suffix) => name.endsWith(suffix))) {
          files.add(entry.path);
        }
      }
    }
  }

  return {
    files: Array.from(files).sort((a, b) => a.localeCompare(b)),
    folders: Array.from(folders).sort((a, b) => a.localeCompare(b)),
  };
}

function toRelativePath(rootPath: string, fullPath: string): string {
  const root = rootPath.trim().replace(/[\\/]+$/, '').toLowerCase();
  const full = fullPath.trim();
  if (!root || !full.toLowerCase().startsWith(root)) {
    return fullPath;
  }
  const relative = full.slice(root.length).replace(/^[\\/]+/, '');
  return relative || '.';
}

function toPathTail(fullPath: string): string {
  const parts = fullPath.split(/[\\/]+/).filter(Boolean);
  return parts[parts.length - 1] || fullPath;
}

function getActionCatalogSummary(status: ActionCatalogStatus): string {
  if (status.source === 'override') {
    return `Override active (${status.overrideActions} custom actions layered on built-in catalog).`;
  }
  return 'Using built-in action catalog.';
}

export function WorkspaceSettings({ values, onSave, onBack, embedded = false }: WorkspaceSettingsProps) {
  const [form, setForm] = useState<WorkspaceSettingsValues>({
    ...values,
    dbMappings: normalizeWorkspaceDbMappings(values),
  });
  const [section, setSection] = useState<SettingsSection>('appearance');
  const [validationState, setValidationState] = useState<ValidationState>('idle');
  const [validationMessage, setValidationMessage] = useState('Fill organization, project, and PAT before validating the connection.');
  const [planOptions, setPlanOptions] = useState<ADOTestPlan[]>([]);
  const [plansLoading, setPlansLoading] = useState(false);
  const [plansMessage, setPlansMessage] = useState('Plans load from the current Azure workspace.');
  const [dbFileOptions, setDbFileOptions] = useState<string[]>([]);
  const [dbFilesLoading, setDbFilesLoading] = useState(false);
  const [dbFilesMessage, setDbFilesMessage] = useState('DB files load from the selected local DB folder.');
  const [runProjectOptions, setRunProjectOptions] = useState<string[]>([]);
  const [runSettingsOptions, setRunSettingsOptions] = useState<string[]>([]);
  const [seleniumFolderOptions, setSeleniumFolderOptions] = useState<string[]>([]);
  const [runOptionsLoading, setRunOptionsLoading] = useState(false);
  const [actionCatalogStatus, setActionCatalogStatus] = useState<ActionCatalogStatus>(() => getActionCatalogStatus());
  const [actionCatalogMessage, setActionCatalogMessage] = useState(() => getActionCatalogSummary(getActionCatalogStatus()));
  const actionCatalogFileInputRef = useRef<HTMLInputElement | null>(null);
  const { mode, font, setTheme, setFont } = useThemeContext();
  const { addNotification } = useNotification();

  useEffect(() => {
    setForm({
      ...values,
      dbMappings: normalizeWorkspaceDbMappings(values),
    });
  }, [values]);

  useEffect(() => {
    return subscribeActionRegistryChanges(() => {
      const status = getActionCatalogStatus();
      setActionCatalogStatus(status);
      setActionCatalogMessage(getActionCatalogSummary(status));
    });
  }, []);

  const isConnectionConfigured = Boolean(
    form.organization.trim() && form.projectName.trim() && form.patToken.trim(),
  );

  useEffect(() => {
    setValidationState('idle');
    if (isConnectionConfigured) {
      setValidationMessage('Connection details are ready. Validate to confirm the workspace configuration.');
      return;
    }
    setValidationMessage('Fill organization, project, and PAT before validating the connection.');
  }, [isConnectionConfigured, form.organization, form.projectName, form.patToken]);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    const cached = getCachedPlans(form);
    if (cached) {
      setPlanOptions(cached.data);
      setPlansMessage(cached.fresh ? 'Using current cached plans.' : 'Using cached plans. Live refresh will update this list.');
    } else {
      setPlanOptions([]);
      setPlansMessage(isConnectionConfigured ? 'Loading plans from Azure DevOps.' : 'Configure Azure settings to load plan choices.');
    }

    if (!isConnectionConfigured || section !== 'db-mappings') {
      setPlansLoading(false);
      return () => {
        active = false;
        controller.abort();
      };
    }

    setPlansLoading(true);
    fetchPlans(form, controller.signal)
      .then((plans) => {
        if (!active) return;
        setPlanOptions(plans);
        setPlansMessage(plans.length ? 'Plans loaded from Azure DevOps.' : 'No Azure plans found for this workspace.');
      })
      .catch((error) => {
        if (!active || error instanceof Error && error.name === 'AbortError') return;
        setPlansMessage(cached ? 'Showing cached plans. Live plan refresh failed.' : 'Could not load plans from Azure DevOps.');
      })
      .finally(() => {
        if (active) {
          setPlansLoading(false);
        }
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [form.organization, form.projectName, form.patToken, form.apiVersion, isConnectionConfigured, section]);

  useEffect(() => {
    let active = true;
    const dbDirectory = form.dbDirectory.trim();
    if (!dbDirectory || !window.desktop?.listDirectory) {
      setDbFileOptions([]);
      setDbFilesLoading(false);
      setDbFilesMessage(dbDirectory ? 'Desktop DB folder listing is unavailable.' : 'Select a local DB folder to load DB file choices.');
      return () => {
        active = false;
      };
    }

    setDbFilesLoading(true);
    setDbFilesMessage('Loading DB files from the selected folder.');
    window.desktop.listDirectory(dbDirectory)
      .then((entries) => {
        if (!active) return;
        const dbFiles = entries
          .filter((entry) => entry.type === 'file' && entry.name.toLowerCase().endsWith('.db'))
          .map((entry) => entry.name)
          .sort((left, right) => left.localeCompare(right));
        setDbFileOptions(dbFiles);
        setDbFilesMessage(dbFiles.length ? 'DB files loaded from the selected folder.' : 'No .db files found. You can enter a new DB file name.');
      })
      .catch(() => {
        if (!active) return;
        setDbFileOptions([]);
        setDbFilesMessage('Could not read DB files from the selected folder.');
      })
      .finally(() => {
        if (active) {
          setDbFilesLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [form.dbDirectory]);

  useEffect(() => {
    let active = true;
    const workingDirectory = form.testRunWorkingDirectory.trim();
    if (!workingDirectory || !window.desktop?.listDirectory || section !== 'workspace') {
      setRunProjectOptions([]);
      setRunSettingsOptions([]);
      setSeleniumFolderOptions([]);
      setRunOptionsLoading(false);
      return () => {
        active = false;
      };
    }

    setRunOptionsLoading(true);
    void scanDirectoryFiles(workingDirectory, ['.csproj', '.runsettings'])
      .then(({ files, folders }) => {
        if (!active) return;
        const csproj = files.filter((filePath) => filePath.toLowerCase().endsWith('.csproj'));
        const runSettings = files.filter((filePath) => filePath.toLowerCase().endsWith('.runsettings'));
        setRunProjectOptions(csproj);
        setRunSettingsOptions(runSettings);
        const detectedFolders = [workingDirectory, ...folders];
        setSeleniumFolderOptions(detectedFolders);

        if (!form.testRunProjectPath.trim() && csproj.length > 0) {
          updateField('testRunProjectPath', csproj[0]);
        }
        if (!form.testRunSettingsPath.trim() && runSettings.length > 0) {
          updateField('testRunSettingsPath', runSettings[0]);
        }
        if (!form.seleniumRepoPath.trim() && detectedFolders.length > 0) {
          updateField('seleniumRepoPath', detectedFolders[0]);
        }
      })
      .catch(() => {
        if (!active) return;
        setRunProjectOptions([]);
        setRunSettingsOptions([]);
        setSeleniumFolderOptions([workingDirectory]);
      })
      .finally(() => {
        if (active) setRunOptionsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [form.testRunProjectPath, form.testRunSettingsPath, form.testRunWorkingDirectory, section]);

  const selectedTheme = useMemo(
    () => THEME_MODE_OPTIONS.find((item) => item.value === mode) ?? THEME_MODE_OPTIONS[0],
    [mode],
  );
  const selectedFont = useMemo(
    () => APP_FONT_OPTIONS.find((item) => item.value === font) ?? APP_FONT_OPTIONS[0],
    [font],
  );
  const selectedFontValue = APP_FONT_OPTIONS.some((item) => item.value === font) ? font : '';
  const sectionLabel = section === 'appearance'
    ? 'Appearance'
    : section === 'workspace'
      ? 'Workspace'
      : section === 'scheduler'
        ? 'Scheduler'
      : section === 'db-mappings'
        ? 'DB Mappings'
        : section === 'action-catalog'
          ? 'Action Catalog'
        : 'About';
  const sectionSubtitle = section === 'appearance'
    ? 'Theme modes, accent palettes, and typography controls.'
    : section === 'workspace'
    ? 'Manage Azure connection settings and the Selenium repository location.'
    : section === 'scheduler'
    ? 'Control scheduler runtime and orchestration defaults used by Schedule Run.'
    : section === 'db-mappings'
    ? 'Map Azure test plans to local SQLite DB files for targeted refreshes.'
    : section === 'action-catalog'
    ? 'Import, export, and reset dynamic action definitions without rebuilding the app.'
    : 'About Bromcom Test Builder and system information.';

  const updateField = (field: keyof WorkspaceSettingsValues, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const updateBooleanField = (field: keyof WorkspaceSettingsValues, value: boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const validateConnection = () => {
    if (!isConnectionConfigured) {
      setValidationState('error');
      setValidationMessage('Organization, project, and PAT token are required.');
      addNotification('error', 'Missing required connection fields.');
      return;
    }

    setValidationState('success');
    setValidationMessage('Connection details look complete. Save these settings to keep them for the next session.');
    addNotification('success', 'Connection settings look valid.');
  };

  const handleImportActionCatalog = () => {
    actionCatalogFileInputRef.current?.click();
  };

  const handleActionCatalogFileSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;

    try {
      const fileContent = await selectedFile.text();
      const nextStatus = importActionCatalogOverrideFromJson(fileContent);
      setActionCatalogStatus(nextStatus);
      setActionCatalogMessage(
        `Imported ${nextStatus.overrideActions} override actions. Total available actions: ${nextStatus.totalActions}.`,
      );
      addNotification('success', `Imported action catalog from ${selectedFile.name}.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not import action catalog.';
      setActionCatalogMessage(message);
      addNotification('error', message);
    } finally {
      event.target.value = '';
    }
  };

  const handleExportActionCatalog = () => {
    try {
      const exportJson = exportActionCatalogJson();
      const blob = new Blob([exportJson], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      link.href = url;
      link.download = `action-catalog-${stamp}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setActionCatalogMessage(`Exported ${actionCatalogStatus.totalActions} actions to JSON.`);
      addNotification('success', 'Action catalog exported.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not export action catalog.';
      setActionCatalogMessage(message);
      addNotification('error', message);
    }
  };

  const handleResetActionCatalog = () => {
    const nextStatus = clearActionCatalogOverride();
    setActionCatalogStatus(nextStatus);
    setActionCatalogMessage(getActionCatalogSummary(nextStatus));
    addNotification('success', 'Action catalog reset to built-in defaults.');
  };

  const validateDbMappings = (mappings: WorkspaceDbMapping[]): string | null => {
    const enabledMappings = mappings.filter((mapping) => mapping.enabled);
    if (!enabledMappings.length) {
      return 'At least one enabled DB mapping is required.';
    }

    for (const mapping of mappings) {
      if (!mapping.label.trim()) {
        return 'Each DB mapping needs a label.';
      }
    }

    const dbNames = new Set<string>();
    for (const mapping of enabledMappings) {
      if (!Number.isFinite(mapping.planId) || mapping.planId <= 0) {
        return `${mapping.label || 'DB mapping'} needs a numeric Azure plan ID.`;
      }
      if (!mapping.dbName.trim()) {
        return `${mapping.label} needs a DB file name.`;
      }
      if (/[\\/]/.test(mapping.dbName)) {
        return `${mapping.label} DB file must be a file name, not a path.`;
      }
      if (!mapping.dbName.toLowerCase().endsWith('.db')) {
        return `${mapping.label} DB file must end with .db.`;
      }
      const dbNameKey = mapping.dbName.trim().toLowerCase();
      if (dbNames.has(dbNameKey)) {
        return `Duplicate DB file name: ${mapping.dbName}.`;
      }
      dbNames.add(dbNameKey);
    }

    return null;
  };

  const validateSchedulerSettings = (): string | null => {
    if (!form.schedulerTimezone.trim() || !isValidTimezone(form.schedulerTimezone)) {
      return 'Scheduler timezone must be a valid IANA timezone (for example: Asia/Kolkata).';
    }
    if (!isValidSchedulerCron(form.schedulerDefaultCron)) {
      return 'Scheduler default cron must contain 6 fields (sec min hour day month weekday).';
    }
    if (!Number.isInteger(form.schedulerPollSeconds) || form.schedulerPollSeconds < 10 || form.schedulerPollSeconds > 3600) {
      return 'Scheduler poll interval must be between 10 and 3600 seconds.';
    }
    if (!Number.isInteger(form.schedulerDefaultBatchSize) || form.schedulerDefaultBatchSize < 1 || form.schedulerDefaultBatchSize > 200) {
      return 'Scheduler batch size must be between 1 and 200.';
    }
    if (!Number.isInteger(form.schedulerMaxHistoryRows) || form.schedulerMaxHistoryRows < 50 || form.schedulerMaxHistoryRows > 5000) {
      return 'Scheduler history retention must be between 50 and 5000 rows.';
    }
    if (!Number.isInteger(form.schedulerBuildDefinitionId) || form.schedulerBuildDefinitionId <= 0) {
      return 'Build definition ID must be a positive number.';
    }
    if (!Number.isInteger(form.schedulerDefaultConfigurationId) || form.schedulerDefaultConfigurationId <= 0) {
      return 'Run configuration ID must be a positive number.';
    }
    if (!Number.isInteger(form.schedulerDefaultPointConfigurationId) || form.schedulerDefaultPointConfigurationId <= 0) {
      return 'Default point configuration ID must be a positive number.';
    }
    if (parseDefinitionIdsCsv(form.schedulerReleaseDefinitionIdsCsv).length === 0) {
      return 'Release definition pool must contain at least one numeric definition ID.';
    }
    if (!form.schedulerWorldPayRegressionBranch.trim() || !form.schedulerWorldPayKanbanBranch.trim()) {
      return 'WorldPay branch mappings are required.';
    }
    return null;
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const dbMappings = normalizeWorkspaceDbMappings(form);
    const validationError = validateDbMappings(dbMappings);
    if (validationError) {
      addNotification('error', validationError);
      return;
    }
    const schedulerValidationError = validateSchedulerSettings();
    if (schedulerValidationError) {
      addNotification('error', schedulerValidationError);
      return;
    }

    const mainMapping = dbMappings.find((mapping) => mapping.id === 'main');
    const worldPayMapping = dbMappings.find((mapping) => mapping.id === 'worldPay');
    onSave({
      ...form,
      mainDbName: mainMapping?.dbName ?? form.mainDbName,
      worldPayDbName: worldPayMapping?.dbName ?? form.worldPayDbName,
      dbMappings,
    });
    addNotification('success', 'Settings saved.');
  };

  const handleThemeChange = (nextTheme: ThemeMode) => {
    if (nextTheme === mode) return;
    setTheme(nextTheme);
  };

  const handleFontChange = (value: string) => {
    if (!isAppFontMode(value) || value === font) return;
    setFont(value);
  };

  const handleBrowseDbDirectory = async () => {
    try {
      if (!window.desktop?.selectDirectory) {
        throw new Error('Desktop folder picker is unavailable. Restart the app to load the latest Electron changes.');
      }

      const selectedPath = await window.desktop.selectDirectory({
        title: 'Select Local DB storage folder',
        defaultPath: form.dbDirectory,
      });

      if (!selectedPath) {
        return;
      }

      updateField('dbDirectory', selectedPath);
      addNotification('success', 'Local DB storage folder selected.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to select Local DB storage folder.';
      addNotification('error', message);
    }
  };

  const handleBrowseWorkingDirectory = async () => {
    try {
      if (!window.desktop?.selectDirectory) {
        throw new Error('Desktop folder picker is unavailable. Restart the app to load the latest Electron changes.');
      }

      const selectedPath = await window.desktop.selectDirectory({
        title: 'Select test runner working directory',
        defaultPath: form.testRunWorkingDirectory || form.seleniumRepoPath || undefined,
      });

      if (!selectedPath) {
        return;
      }

      updateField('testRunWorkingDirectory', selectedPath);
      addNotification('success', 'Working directory selected.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to select working directory.';
      addNotification('error', message);
    }
  };

  const updateDbMapping = <Key extends keyof WorkspaceDbMapping>(
    mappingId: string,
    field: Key,
    value: WorkspaceDbMapping[Key],
  ) => {
    setForm((prev) => ({
      ...prev,
      dbMappings: prev.dbMappings.map((mapping) => (
        mapping.id === mappingId ? { ...mapping, [field]: value } : mapping
      )),
    }));
  };

  const updateDbMappingPlan = (mappingId: string, planIdValue: string) => {
    const planId = Number(planIdValue);
    const plan = planOptions.find((item) => item.id === planId);
    setForm((prev) => ({
      ...prev,
      dbMappings: prev.dbMappings.map((mapping) => (
        mapping.id === mappingId
          ? {
              ...mapping,
              planId,
              label: plan?.name || mapping.label,
            }
          : mapping
      )),
    }));
  };

  const addDbMapping = () => {
    setForm((prev) => {
      const nextIndex = prev.dbMappings.length + 1;
      const id = normalizeMappingId(`custom-${Date.now()}`, `mapping-${nextIndex}`);
      const firstUnusedDbFile = dbFileOptions.find((dbFile) => !prev.dbMappings.some((mapping) => mapping.dbName === dbFile));
      return {
        ...prev,
        dbMappings: [
          ...prev.dbMappings,
          {
            id,
            label: `Custom Plan ${nextIndex}`,
            planId: 0,
            dbName: firstUnusedDbFile ?? '',
            enabled: true,
          },
        ],
      };
    });
  };

  const removeDbMapping = (mappingId: string) => {
    setForm((prev) => ({
      ...prev,
      dbMappings: prev.dbMappings.length <= 1
        ? prev.dbMappings
        : prev.dbMappings.filter((mapping) => mapping.id !== mappingId),
    }));
  };

  const statusLabel = isConnectionConfigured ? 'Connected' : 'Incomplete';
  const statusClassName = isConnectionConfigured
    ? 'settings-status-pill settings-status-pill--success'
    : 'settings-status-pill settings-status-pill--warning';

  const validationClassName = validationState === 'success'
    ? 'settings-validation settings-validation--success'
    : validationState === 'error'
      ? 'settings-validation settings-validation--error'
      : 'settings-validation';

  const sectionItemClassName = (targetSection: SettingsSection) =>
    `settings-nav-item${section === targetSection ? ' is-active' : ''}`;

  return (
    <div
      className={embedded ? 'settings-page' : 'settings-overlay'}
      role={embedded ? undefined : 'dialog'}
      aria-modal={embedded ? undefined : true}
      aria-label="Settings"
    >
      {!embedded && (
        <button
          type="button"
          className="settings-overlay__backdrop"
          onClick={onBack}
          aria-label="Close settings overlay"
        />
      )}
      <div className={`settings-dock${embedded ? ' settings-dock--embedded-page' : ''}`}>
        <section className="settings-workbench">
          <header className="settings-workbench__header">
            <div>
              <p className="settings-workbench__crumb">Settings / {sectionLabel}</p>
              <h1 className="settings-workbench__title">{sectionLabel}</h1>
              <p className="settings-workbench__subtitle">{sectionSubtitle}</p>
            </div>
            {!embedded && (
              <button
                type="button"
                className="settings-workbench__close"
                onClick={onBack}
                aria-label="Close settings"
                title="Close settings"
              >
                <IconX size={18} />
              </button>
            )}
          </header>

          <div className="settings-workbench__body">
            <aside className="settings-nav" aria-label="Settings sections">
              <p className="settings-nav-label">Preferences</p>
              <button
                type="button"
                className={sectionItemClassName('appearance')}
                onClick={() => setSection('appearance')}
              >
                <span className="settings-nav-item__title">Appearance</span>
                <span className="settings-nav-item__sub">Themes, accents, app fonts</span>
              </button>
              <button
                type="button"
                className={sectionItemClassName('workspace')}
                onClick={() => setSection('workspace')}
              >
                <span className="settings-nav-item__title">Workspace</span>
                <span className="settings-nav-item__sub">Connection and API defaults</span>
              </button>
              <button
                type="button"
                className={sectionItemClassName('scheduler')}
                onClick={() => setSection('scheduler')}
              >
                <span className="settings-nav-item__title">Scheduler</span>
                <span className="settings-nav-item__sub">Polling, defaults, and retention</span>
              </button>
              <button
                type="button"
                className={sectionItemClassName('db-mappings')}
                onClick={() => setSection('db-mappings')}
              >
                <span className="settings-nav-item__title">DB Mappings</span>
                <span className="settings-nav-item__sub">Plans and local DB files</span>
              </button>
              <button
                type="button"
                className={sectionItemClassName('action-catalog')}
                onClick={() => setSection('action-catalog')}
              >
                <span className="settings-nav-item__title">Action Catalog</span>
                <span className="settings-nav-item__sub">Import/export action definitions</span>
              </button>
              <p className="settings-nav-label" style={{ marginTop: '20px' }}>Other</p>
              <button
                type="button"
                className={sectionItemClassName('about')}
                onClick={() => setSection('about')}
              >
                <span className="settings-nav-item__title">About</span>
                <span className="settings-nav-item__sub">App version and information</span>
              </button>
            </aside>

            <div className="settings-content">
              {section === 'appearance' && (
                <section className="settings-pane">
                  <div className="settings-chip-row">
                    <div className="settings-summary-chip">
                      <span>Theme</span>
                      <strong>{selectedTheme.label}</strong>
                    </div>
                    <div className="settings-summary-chip">
                      <span>Font</span>
                      <strong>{selectedFont.label}</strong>
                    </div>
                  </div>

                  <div className="settings-panel">
                    <div className="settings-panel__head">
                      <h3 className="settings-panel__title">Theme mode</h3>
                      <p className="settings-panel__sub">
                        Select a mode that fits your workspace lighting and contrast preference.
                      </p>
                    </div>
                    <div className="settings-mode-grid">
                      {THEME_MODE_OPTIONS.map((item) => (
                        <button
                          key={item.value}
                          type="button"
                          className={`settings-mode-card${mode === item.value ? ' is-active' : ''}`}
                          onClick={() => handleThemeChange(item.value)}
                        >
                          <span className={`settings-mode-preview settings-mode-preview--${item.value}`} />
                          <span className="settings-mode-copy">
                            <span className="settings-mode-name">{item.label}</span>
                            <span className="settings-mode-desc">{item.description}</span>
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="settings-panel">
                    <div className="settings-panel__head">
                      <h3 className="settings-panel__title">App font</h3>
                      <p className="settings-panel__sub">
                        Switch interface typography across the app. The selected font is persisted locally.
                      </p>
                    </div>
                    <div className="settings-font-row">
                      <label className="settings-field settings-field--full" htmlFor="appFont">
                        <span className="settings-field__label">Font family</span>
                        <select
                          id="appFont"
                          className="settings-input settings-font-select"
                          value={selectedFontValue}
                          onChange={(event) => handleFontChange(event.target.value)}
                        >
                          {!selectedFontValue && (
                            <option value="" disabled>
                              {NOT_SELECTED_LABEL}
                            </option>
                          )}
                          {APP_FONT_OPTIONS.map((item) => (
                            <option key={item.value} value={item.value}>
                              {item.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <p className="settings-font-preview">
                        The quick brown fox jumps over the lazy dog.
                      </p>
                    </div>
                  </div>
                </section>
              )}

              {section === 'workspace' && (
                <section className="settings-pane">
                  <div className="settings-chip-row">
                    <div className="settings-summary-chip">
                      <span>Azure</span>
                      <strong>{statusLabel}</strong>
                    </div>
                    <div className="settings-summary-chip">
                      <span>Organization</span>
                      <strong>{form.organization || 'None'}</strong>
                    </div>
                    <div className="settings-summary-chip">
                      <span>Project</span>
                      <strong>{form.projectName || 'None'}</strong>
                    </div>
                    <div className="settings-summary-chip">
                      <span>API</span>
                      <strong>{form.apiVersion || '7.2'}</strong>
                    </div>
                    <div className="settings-summary-chip">
                      <span>Selenium Repo</span>
                      <strong className="settings-summary-chip__value" title={form.seleniumRepoPath.trim() || 'Not set'}>
                        {form.seleniumRepoPath.trim() || 'Not set'}
                      </strong>
                    </div>
                    <div className="settings-summary-chip">
                      <span>DB Folder</span>
                      <strong className="settings-summary-chip__value" title={form.dbDirectory.trim() || 'Not set'}>
                        {form.dbDirectory.trim() || 'Not set'}
                      </strong>
                    </div>
                    <div className="settings-summary-chip">
                      <span>Test Run Workspace</span>
                      <strong className="settings-summary-chip__value" title={form.testRunWorkingDirectory.trim() || 'Not set'}>
                        {form.testRunWorkingDirectory.trim() ? toPathTail(form.testRunWorkingDirectory.trim()) : 'Not set'}
                      </strong>
                    </div>
                  </div>

                  <form className="settings-form" onSubmit={handleSubmit}>
                    <div className="settings-panel">
                      <div className="settings-panel__head">
                        <h3 className="settings-panel__title">Azure Settings</h3>
                        <p className="settings-panel__sub">
                          Use a PAT with access to Test Plans and work item data in your Azure DevOps project.
                        </p>
                      </div>

                      <div className="settings-field-grid">
                        <label className="settings-field" htmlFor="organization">
                          <span className="settings-field__label">Organization</span>
                          <input
                            id="organization"
                            className="settings-input"
                            value={form.organization}
                            onChange={(event) => updateField('organization', event.target.value)}
                            placeholder="your-org"
                          />
                        </label>

                        <label className="settings-field" htmlFor="projectName">
                          <span className="settings-field__label">Project</span>
                          <input
                            id="projectName"
                            className="settings-input"
                            value={form.projectName}
                            onChange={(event) => updateField('projectName', event.target.value)}
                            placeholder="Automated Testing Framework"
                          />
                        </label>

                        <label className="settings-field" htmlFor="patToken">
                          <span className="settings-field__label">PAT token</span>
                          <input
                            id="patToken"
                            className="settings-input"
                            type="password"
                            value={form.patToken}
                            onChange={(event) => updateField('patToken', event.target.value)}
                            placeholder="Personal Access Token"
                          />
                        </label>

                        <label className="settings-field" htmlFor="apiVersion">
                          <span className="settings-field__label">API version</span>
                          <input
                            id="apiVersion"
                            className="settings-input"
                            list="settings-api-versions"
                            value={form.apiVersion}
                            onChange={(event) => updateField('apiVersion', event.target.value)}
                            placeholder="7.2"
                          />
                          <datalist id="settings-api-versions">
                            {API_VERSION_OPTIONS.map((version) => (
                              <option key={version} value={version} />
                            ))}
                          </datalist>
                        </label>

                      </div>

                      <div className="settings-actions">
                        <button type="button" className="btn btn--secondary btn--sm" onClick={validateConnection}>
                          Validate connection
                        </button>
                        <button type="submit" className="btn btn--primary btn--sm">
                          <IconSave size={16} />
                          Save settings
                        </button>
                      </div>

                      <div className="settings-status-row">
                        <span className={statusClassName}>{statusLabel}</span>
                        <span className={validationClassName}>{validationMessage}</span>
                      </div>
                    </div>

                    <div className="settings-panel">
                      <div className="settings-panel__head">
                        <h3 className="settings-panel__title">Automation Workspace Settings</h3>
                        <p className="settings-panel__sub">
                          Configure Selenium repo and dotnet test execution from the Test Detail page.
                        </p>
                      </div>

                      <div className="settings-field-grid">
                        <label className="settings-field settings-field--full" htmlFor="testRunWorkingDirectory">
                          <span className="settings-field__label">Working directory</span>
                          <div className="settings-inline-row">
                            <input
                              id="testRunWorkingDirectory"
                              className="settings-input"
                              value={form.testRunWorkingDirectory}
                              onChange={(event) => updateField('testRunWorkingDirectory', event.target.value)}
                              placeholder="C:\\Users\\snkjh\\source\\repos\\Automated Testing Framework"
                            />
                            <button
                              type="button"
                              className="btn btn--secondary btn--sm"
                              onClick={() => { void handleBrowseWorkingDirectory(); }}
                            >
                              Browse
                            </button>
                          </div>
                        </label>
                        <label className="settings-field settings-field--full" htmlFor="seleniumRepoPath">
                          <span className="settings-field__label">Selenium repo folder</span>
                          <select
                            id="seleniumRepoPath"
                            className="settings-input"
                            value={form.seleniumRepoPath}
                            onChange={(event) => updateField('seleniumRepoPath', event.target.value)}
                          >
                            {!form.seleniumRepoPath && (
                              <option value="">{runOptionsLoading ? 'Detecting folders...' : NOT_SELECTED_LABEL}</option>
                            )}
                            {form.seleniumRepoPath && !seleniumFolderOptions.includes(form.seleniumRepoPath) && (
                              <option value={form.seleniumRepoPath}>
                                {toRelativePath(form.testRunWorkingDirectory, form.seleniumRepoPath)}
                              </option>
                            )}
                            {seleniumFolderOptions.map((folderPath) => (
                              <option key={folderPath} value={folderPath}>
                                {toRelativePath(form.testRunWorkingDirectory, folderPath) === '.'
                                  ? '(Working directory)'
                                  : toRelativePath(form.testRunWorkingDirectory, folderPath)}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="settings-field settings-field--full" htmlFor="testRunProjectPath">
                          <span className="settings-field__label">Project path (.csproj)</span>
                          <select
                            id="testRunProjectPath"
                            className="settings-input"
                            value={form.testRunProjectPath}
                            onChange={(event) => updateField('testRunProjectPath', event.target.value)}
                          >
                            {!form.testRunProjectPath && (
                              <option value="">{runOptionsLoading ? 'Detecting .csproj files...' : NOT_SELECTED_LABEL}</option>
                            )}
                            {form.testRunProjectPath && !runProjectOptions.includes(form.testRunProjectPath) && (
                              <option value={form.testRunProjectPath}>
                                {toRelativePath(form.testRunWorkingDirectory, form.testRunProjectPath)}
                              </option>
                            )}
                            {runProjectOptions.map((projectPath) => (
                              <option key={projectPath} value={projectPath}>
                                {toRelativePath(form.testRunWorkingDirectory, projectPath)}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="settings-field settings-field--full" htmlFor="testRunSettingsPath">
                          <span className="settings-field__label">Run settings path (optional)</span>
                          <select
                            id="testRunSettingsPath"
                            className="settings-input"
                            value={form.testRunSettingsPath}
                            onChange={(event) => updateField('testRunSettingsPath', event.target.value)}
                          >
                            <option value="">None</option>
                            {form.testRunSettingsPath && !runSettingsOptions.includes(form.testRunSettingsPath) && (
                              <option value={form.testRunSettingsPath}>
                                {toRelativePath(form.testRunWorkingDirectory, form.testRunSettingsPath)}
                              </option>
                            )}
                            {runSettingsOptions.map((runSettingsPath) => (
                              <option key={runSettingsPath} value={runSettingsPath}>
                                {toRelativePath(form.testRunWorkingDirectory, runSettingsPath)}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="settings-field settings-field--full" htmlFor="testRunLogger">
                          <span className="settings-field__label">Logger</span>
                          <select
                            id="testRunLogger"
                            className="settings-input"
                            value={form.testRunLogger}
                            onChange={(event) => updateField('testRunLogger', event.target.value)}
                          >
                            {TEST_LOGGER_OPTIONS.map((loggerValue) => (
                              <option key={loggerValue} value={loggerValue}>{loggerValue}</option>
                            ))}
                          </select>
                        </label>
                        <label className="settings-field settings-field--full" htmlFor="testRunUsePatAsEnv">
                          <span className="settings-field__label">Pass PAT as ADO_PAT env var</span>
                          <div className="settings-toggle-row">
                            <button
                              id="testRunUsePatAsEnv"
                              type="button"
                              className={`settings-toggle${form.testRunUsePatAsEnv ? ' is-active' : ''}`}
                              role="switch"
                              aria-checked={form.testRunUsePatAsEnv}
                              onClick={() => updateBooleanField('testRunUsePatAsEnv', !form.testRunUsePatAsEnv)}
                            >
                              <span className="settings-toggle__thumb" />
                            </button>
                            <span className="settings-field__hint">Uses saved PAT token from workspace settings.</span>
                          </div>
                        </label>
                      </div>

                      <div className="settings-actions">
                        <button type="submit" className="btn btn--primary btn--sm">
                          <IconSave size={16} />
                          Save settings
                        </button>
                      </div>
                    </div>

                  </form>
                </section>
              )}

              {section === 'scheduler' && (
                <section className="settings-pane">
                  <div className="settings-chip-row">
                    <div className="settings-summary-chip">
                      <span>Scheduler</span>
                      <strong>{form.schedulerEnabled ? 'Enabled' : 'Disabled'}</strong>
                    </div>
                    <div className="settings-summary-chip">
                      <span>Timezone</span>
                      <strong>{form.schedulerTimezone.trim() || 'Not set'}</strong>
                    </div>
                    <div className="settings-summary-chip">
                      <span>Poll Interval</span>
                      <strong>{form.schedulerPollSeconds}s</strong>
                    </div>
                    <div className="settings-summary-chip">
                      <span>History Limit</span>
                      <strong>{form.schedulerMaxHistoryRows}</strong>
                    </div>
                    <div className="settings-summary-chip">
                      <span>Build Def</span>
                      <strong>{form.schedulerBuildDefinitionId}</strong>
                    </div>
                  </div>

                  <form className="settings-form" onSubmit={handleSubmit}>
                    <div className="settings-panel">
                      <div className="settings-panel__head">
                        <h3 className="settings-panel__title">Scheduler Runtime</h3>
                        <p className="settings-panel__sub">
                          Controls how frequently the desktop scheduler evaluates due jobs and how much run history it keeps in SQLite.
                        </p>
                      </div>
                      <div className="settings-field-grid">
                        <label className="settings-field settings-field--full" htmlFor="schedulerEnabled">
                          <span className="settings-field__label">Enable scheduler engine</span>
                          <div className="settings-toggle-row">
                            <button
                              id="schedulerEnabled"
                              type="button"
                              className={`settings-toggle${form.schedulerEnabled ? ' is-active' : ''}`}
                              role="switch"
                              aria-checked={form.schedulerEnabled}
                              onClick={() => setForm((prev) => ({ ...prev, schedulerEnabled: !prev.schedulerEnabled }))}
                            >
                              <span className="settings-toggle__thumb" />
                            </button>
                            <span className="settings-field__hint">Runs from the Schedule Run workspace view.</span>
                          </div>
                        </label>
                        <label className="settings-field" htmlFor="schedulerTimezone">
                          <span className="settings-field__label">Default timezone</span>
                          <input
                            id="schedulerTimezone"
                            className="settings-input"
                            value={form.schedulerTimezone}
                            onChange={(event) => setForm((prev) => ({ ...prev, schedulerTimezone: event.target.value }))}
                            placeholder="Asia/Kolkata"
                          />
                        </label>
                        <label className="settings-field" htmlFor="schedulerPollSeconds">
                          <span className="settings-field__label">Poll interval (seconds)</span>
                          <input
                            id="schedulerPollSeconds"
                            className="settings-input"
                            type="number"
                            min={10}
                            max={3600}
                            step={1}
                            value={form.schedulerPollSeconds}
                            onChange={(event) => {
                              const value = Number(event.target.value);
                              setForm((prev) => ({
                                ...prev,
                                schedulerPollSeconds: Number.isFinite(value) ? Math.max(10, Math.min(3600, Math.round(value))) : 10,
                              }));
                            }}
                          />
                        </label>
                        <label className="settings-field" htmlFor="schedulerMaxHistoryRows">
                          <span className="settings-field__label">Run history retention</span>
                          <input
                            id="schedulerMaxHistoryRows"
                            className="settings-input"
                            type="number"
                            min={50}
                            max={5000}
                            step={10}
                            value={form.schedulerMaxHistoryRows}
                            onChange={(event) => {
                              const value = Number(event.target.value);
                              setForm((prev) => ({
                                ...prev,
                                schedulerMaxHistoryRows: Number.isFinite(value) ? Math.max(50, Math.min(5000, Math.round(value))) : 500,
                              }));
                            }}
                          />
                        </label>
                      </div>
                    </div>

                    <div className="settings-panel">
                      <div className="settings-panel__head">
                        <h3 className="settings-panel__title">Schedule Defaults</h3>
                        <p className="settings-panel__sub">
                          Pre-fills new schedule forms and drives run batching defaults.
                        </p>
                      </div>
                      <div className="settings-field-grid">
                        <label className="settings-field settings-field--full" htmlFor="schedulerDefaultCron">
                          <span className="settings-field__label">Default cron expression (6 fields)</span>
                          <input
                            id="schedulerDefaultCron"
                            className="settings-input"
                            value={form.schedulerDefaultCron}
                            onChange={(event) => setForm((prev) => ({ ...prev, schedulerDefaultCron: event.target.value }))}
                            placeholder="0 0 1 * * *"
                          />
                        </label>
                        <label className="settings-field" htmlFor="schedulerDefaultMode">
                          <span className="settings-field__label">Default run mode</span>
                          <select
                            id="schedulerDefaultMode"
                            className="settings-input"
                            value={form.schedulerDefaultMode}
                            onChange={(event) => setForm((prev) => ({ ...prev, schedulerDefaultMode: event.target.value as SchedulerRunMode }))}
                          >
                            {SCHEDULER_MODE_OPTIONS.map((modeOption) => (
                              <option key={modeOption.value} value={modeOption.value}>
                                {modeOption.label}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="settings-field" htmlFor="schedulerDefaultBatchSize">
                          <span className="settings-field__label">Default batch size</span>
                          <input
                            id="schedulerDefaultBatchSize"
                            className="settings-input"
                            type="number"
                            min={1}
                            max={200}
                            step={1}
                            value={form.schedulerDefaultBatchSize}
                            onChange={(event) => {
                              const value = Number(event.target.value);
                              setForm((prev) => ({
                                ...prev,
                                schedulerDefaultBatchSize: Number.isFinite(value) ? Math.max(1, Math.min(200, Math.round(value))) : 10,
                              }));
                            }}
                          />
                        </label>
                      </div>

                      <div className="settings-actions">
                        <button type="submit" className="btn btn--primary btn--sm">
                          <IconSave size={16} />
                          Save scheduler settings
                        </button>
                      </div>
                    </div>

                    <div className="settings-panel">
                      <div className="settings-panel__head">
                        <h3 className="settings-panel__title">Run Orchestration Defaults</h3>
                        <p className="settings-panel__sub">
                          Build lookup, point filtering, CD pool, and WorldPay branch mapping used for Schedule Run preflight.
                        </p>
                      </div>
                      <div className="settings-field-grid">
                        <label className="settings-field" htmlFor="schedulerBuildDefinitionId">
                          <span className="settings-field__label">Build definition ID</span>
                          <input
                            id="schedulerBuildDefinitionId"
                            className="settings-input"
                            type="number"
                            min={1}
                            step={1}
                            value={form.schedulerBuildDefinitionId}
                            onChange={(event) => {
                              const value = Number(event.target.value);
                              setForm((prev) => ({
                                ...prev,
                                schedulerBuildDefinitionId: Number.isFinite(value) ? Math.max(1, Math.round(value)) : 260,
                              }));
                            }}
                          />
                        </label>
                        <label className="settings-field" htmlFor="schedulerDefaultConfigurationId">
                          <span className="settings-field__label">Run configuration ID</span>
                          <input
                            id="schedulerDefaultConfigurationId"
                            className="settings-input"
                            type="number"
                            min={1}
                            step={1}
                            value={form.schedulerDefaultConfigurationId}
                            onChange={(event) => {
                              const value = Number(event.target.value);
                              setForm((prev) => ({
                                ...prev,
                                schedulerDefaultConfigurationId: Number.isFinite(value) ? Math.max(1, Math.round(value)) : 34,
                              }));
                            }}
                          />
                        </label>
                        <label className="settings-field" htmlFor="schedulerDefaultPointConfigurationId">
                          <span className="settings-field__label">Base point configuration ID</span>
                          <input
                            id="schedulerDefaultPointConfigurationId"
                            className="settings-input"
                            type="number"
                            min={1}
                            step={1}
                            value={form.schedulerDefaultPointConfigurationId}
                            onChange={(event) => {
                              const value = Number(event.target.value);
                              setForm((prev) => ({
                                ...prev,
                                schedulerDefaultPointConfigurationId: Number.isFinite(value) ? Math.max(1, Math.round(value)) : 33,
                              }));
                            }}
                          />
                        </label>
                        <label className="settings-field settings-field--full" htmlFor="schedulerReleaseDefinitionIdsCsv">
                          <span className="settings-field__label">Release definition pool (CSV)</span>
                          <input
                            id="schedulerReleaseDefinitionIdsCsv"
                            className="settings-input"
                            value={form.schedulerReleaseDefinitionIdsCsv}
                            onChange={(event) => setForm((prev) => ({ ...prev, schedulerReleaseDefinitionIdsCsv: event.target.value }))}
                            placeholder="24,25,26,27,..."
                          />
                        </label>
                        <label className="settings-field settings-field--full" htmlFor="schedulerWorldPayRegressionBranch">
                          <span className="settings-field__label">WorldPay Regression branch</span>
                          <input
                            id="schedulerWorldPayRegressionBranch"
                            className="settings-input"
                            value={form.schedulerWorldPayRegressionBranch}
                            onChange={(event) => setForm((prev) => ({ ...prev, schedulerWorldPayRegressionBranch: event.target.value }))}
                            placeholder="refs/heads/regression_worldpay"
                          />
                        </label>
                        <label className="settings-field settings-field--full" htmlFor="schedulerWorldPayKanbanBranch">
                          <span className="settings-field__label">WorldPay Kanban branch</span>
                          <input
                            id="schedulerWorldPayKanbanBranch"
                            className="settings-input"
                            value={form.schedulerWorldPayKanbanBranch}
                            onChange={(event) => setForm((prev) => ({ ...prev, schedulerWorldPayKanbanBranch: event.target.value }))}
                            placeholder="refs/heads/kanban_worldpay"
                          />
                        </label>
                      </div>
                    </div>

                    <div className="settings-panel">
                      <div className="settings-panel__head">
                        <h3 className="settings-panel__title">Test Plan & Mapping Configuration</h3>
                        <p className="settings-panel__sub">
                          Map test plans and work items used for suite selection and release mapping.
                        </p>
                      </div>
                      <div className="settings-field-grid">
                        <label className="settings-field" htmlFor="schedulerSagePayTestPlanId">
                          <span className="settings-field__label">Sage Pay test plan ID</span>
                          <input
                            id="schedulerSagePayTestPlanId"
                            className="settings-input"
                            type="number"
                            min={1}
                            step={1}
                            value={form.schedulerSagePayTestPlanId}
                            onChange={(event) => {
                              const value = Number(event.target.value);
                              setForm((prev) => ({
                                ...prev,
                                schedulerSagePayTestPlanId: Number.isFinite(value) ? Math.max(1, Math.round(value)) : 78806,
                              }));
                            }}
                          />
                        </label>
                        <label className="settings-field" htmlFor="schedulerWorldPayTestPlanId">
                          <span className="settings-field__label">WorldPay test plan ID</span>
                          <input
                            id="schedulerWorldPayTestPlanId"
                            className="settings-input"
                            type="number"
                            min={1}
                            step={1}
                            value={form.schedulerWorldPayTestPlanId}
                            onChange={(event) => {
                              const value = Number(event.target.value);
                              setForm((prev) => ({
                                ...prev,
                                schedulerWorldPayTestPlanId: Number.isFinite(value) ? Math.max(1, Math.round(value)) : 139145,
                              }));
                            }}
                          />
                        </label>
                        <label className="settings-field settings-field--full" htmlFor="schedulerMappingWorkItemIds">
                          <span className="settings-field__label">Mapping work item IDs (CSV)</span>
                          <input
                            id="schedulerMappingWorkItemIds"
                            className="settings-input"
                            value={form.schedulerMappingWorkItemIds}
                            onChange={(event) => setForm((prev) => ({ ...prev, schedulerMappingWorkItemIds: event.target.value }))}
                            placeholder="136838,147829"
                          />
                        </label>
                      </div>
                    </div>

                    <div className="settings-panel">
                      <div className="settings-panel__head">
                        <h3 className="settings-panel__title">Failed Suite Rerun Exclusions</h3>
                        <p className="settings-panel__sub">
                          Exclude specific suites and suite name patterns from the 5 AM failed-suite rerun.
                        </p>
                      </div>
                      <div className="settings-field-grid">
                        <label className="settings-field settings-field--full" htmlFor="schedulerExcludedSuiteIdsCsv">
                          <span className="settings-field__label">Excluded suite IDs (CSV)</span>
                          <input
                            id="schedulerExcludedSuiteIdsCsv"
                            className="settings-input"
                            value={form.schedulerExcludedSuiteIdsCsv}
                            onChange={(event) => setForm((prev) => ({ ...prev, schedulerExcludedSuiteIdsCsv: event.target.value }))}
                            placeholder="123,456,789"
                          />
                        </label>
                        <label className="settings-field settings-field--full" htmlFor="schedulerExcludedSuiteNamePatterns">
                          <span className="settings-field__label">Excluded suite name patterns</span>
                          <input
                            id="schedulerExcludedSuiteNamePatterns"
                            className="settings-input"
                            value={form.schedulerExcludedSuiteNamePatterns}
                            onChange={(event) => setForm((prev) => ({ ...prev, schedulerExcludedSuiteNamePatterns: event.target.value }))}
                            placeholder="initial,intial"
                          />
                        </label>
                      </div>
                    </div>
                  </form>
                </section>
              )}

              {section === 'db-mappings' && (
                <section className="settings-pane">
                  <div className="settings-chip-row">
                    <div className="settings-summary-chip">
                      <span>Enabled Mappings</span>
                      <strong>{form.dbMappings.filter((mapping) => mapping.enabled).length}</strong>
                    </div>
                    <div className="settings-summary-chip">
                      <span>DB Folder</span>
                      <strong>{form.dbDirectory.trim() || 'Not set'}</strong>
                    </div>
                  </div>

                  <form className="settings-form" onSubmit={handleSubmit}>
                    <div className="settings-panel">
                      <div className="settings-panel__head">
                        <div>
                          <h3 className="settings-panel__title">Local DB Folder</h3>
                          <p className="settings-panel__sub">
                            All mapped SQLite files are created and refreshed inside this folder.
                          </p>
                        </div>
                      </div>

                      <div className="settings-field-grid">
                        <label className="settings-field settings-field--full" htmlFor="dbDirectory">
                          <span className="settings-field__label">Local DB storage folder</span>
                          <div className="settings-inline-row">
                            <input
                              id="dbDirectory"
                              className="settings-input"
                              value={form.dbDirectory}
                              onChange={(event) => updateField('dbDirectory', event.target.value)}
                              placeholder="C:\\Automation Tests\\Database"
                            />
                            <button
                              type="button"
                              className="btn btn--secondary btn--sm"
                              onClick={() => { void handleBrowseDbDirectory(); }}
                            >
                              Browse
                            </button>
                          </div>
                        </label>
                      </div>
                    </div>

                    <div className="settings-panel">
                      <div className="settings-panel__head settings-db-mappings__head">
                        <div>
                          <h3 className="settings-panel__title">Plan to DB Mappings</h3>
                          <p className="settings-panel__sub">
                            Each enabled row refreshes one Azure test plan into one local SQLite DB file. {plansLoading ? 'Loading plans...' : plansMessage} {dbFilesLoading ? 'Loading DB files...' : dbFilesMessage}
                          </p>
                        </div>
                        <button type="button" className="btn btn--secondary btn--sm" onClick={addDbMapping}>
                          <IconPlus size={15} />
                          Add mapping
                        </button>
                      </div>

                      <div className="settings-db-mappings">
                        {form.dbMappings.map((mapping) => {
                          const selectedPlanExists = planOptions.some((plan) => plan.id === mapping.planId);
                          const dbFileChoices = mapping.dbName && !dbFileOptions.includes(mapping.dbName)
                            ? [mapping.dbName, ...dbFileOptions]
                            : dbFileOptions;
                          return (
                            <div className="settings-db-mapping" key={mapping.id}>
                              <label className="settings-field settings-field--mapping-plan" htmlFor={`dbMappingPlan-${mapping.id}`}>
                                <span className="settings-field__label">Plan</span>
                                <select
                                  id={`dbMappingPlan-${mapping.id}`}
                                  className="settings-input"
                                  value={mapping.planId || ''}
                                  onChange={(event) => updateDbMappingPlan(mapping.id, event.target.value)}
                                  disabled={!planOptions.length && !mapping.planId}
                                >
                                  {!mapping.planId && <option value="">Select a plan</option>}
                                  {mapping.planId > 0 && !selectedPlanExists && (
                                    <option value={mapping.planId}>
                                      {mapping.label} ({mapping.planId})
                                    </option>
                                  )}
                                  {planOptions.map((plan) => (
                                    <option key={plan.id} value={plan.id}>
                                      {plan.name} ({plan.id})
                                    </option>
                                  ))}
                                </select>
                              </label>

                              <label className="settings-field" htmlFor={`dbMappingDb-${mapping.id}`}>
                                <span className="settings-field__label">DB file</span>
                                <select
                                  id={`dbMappingDb-${mapping.id}`}
                                  className="settings-input"
                                  value={mapping.dbName}
                                  onChange={(event) => updateDbMapping(mapping.id, 'dbName', event.target.value)}
                                  disabled={dbFilesLoading || dbFileChoices.length === 0}
                                >
                                  {!mapping.dbName && (
                                    <option value="">
                                      {dbFilesLoading ? 'Loading DB files' : 'Select a DB file'}
                                    </option>
                                  )}
                                  {dbFileChoices.map((dbFile) => (
                                    <option key={dbFile} value={dbFile}>
                                      {dbFile}
                                    </option>
                                  ))}
                                </select>
                              </label>

                              <label className="settings-db-mapping__switch" title={mapping.enabled ? 'Enabled' : 'Disabled'}>
                                <input
                                  type="checkbox"
                                  checked={mapping.enabled}
                                  onChange={(event) => updateDbMapping(mapping.id, 'enabled', event.target.checked)}
                                />
                                <span aria-hidden="true" />
                              </label>

                              <button
                                type="button"
                                className="btn btn--secondary btn--sm settings-db-mapping__remove"
                                onClick={() => removeDbMapping(mapping.id)}
                                disabled={form.dbMappings.length <= 1}
                                title="Remove mapping"
                              >
                                <IconDelete size={15} />
                              </button>
                            </div>
                          );
                        })}
                      </div>

                      <div className="settings-actions">
                        <button type="submit" className="btn btn--primary btn--sm">
                          <IconSave size={16} />
                          Save mappings
                        </button>
                      </div>
                    </div>
                  </form>
                </section>
              )}

              {section === 'action-catalog' && (
                <section className="settings-pane">
                  <div className="settings-chip-row">
                    <div className="settings-summary-chip">
                      <span>Source</span>
                      <strong>{actionCatalogStatus.source === 'override' ? 'Override' : 'Built-in'}</strong>
                    </div>
                    <div className="settings-summary-chip">
                      <span>Total Actions</span>
                      <strong>{actionCatalogStatus.totalActions}</strong>
                    </div>
                    <div className="settings-summary-chip">
                      <span>Override Actions</span>
                      <strong>{actionCatalogStatus.overrideActions}</strong>
                    </div>
                    <div className="settings-summary-chip">
                      <span>Last Updated</span>
                      <strong>{actionCatalogStatus.updatedAt ? new Date(actionCatalogStatus.updatedAt).toLocaleString() : 'Built-in'}</strong>
                    </div>
                  </div>

                  <div className="settings-panel">
                    <div className="settings-panel__head">
                      <h3 className="settings-panel__title">Action Catalog JSON</h3>
                      <p className="settings-panel__sub">
                        Export the current catalog to JSON, edit externally, then import it back. Invalid imports are rejected and the current catalog stays active.
                      </p>
                    </div>

                    <div className="settings-field-grid">
                      <label className="settings-field settings-field--full">
                        <span className="settings-field__label">Catalog Status</span>
                        <span className="settings-field__hint">{actionCatalogMessage}</span>
                      </label>
                    </div>

                    <div className="settings-actions">
                      <input
                        ref={actionCatalogFileInputRef}
                        type="file"
                        accept=".json,application/json"
                        style={{ display: 'none' }}
                        onChange={handleActionCatalogFileSelected}
                      />
                      <button type="button" className="btn btn--secondary btn--sm" onClick={handleImportActionCatalog}>
                        Import JSON
                      </button>
                      <button type="button" className="btn btn--secondary btn--sm" onClick={handleExportActionCatalog}>
                        Export JSON
                      </button>
                      <button
                        type="button"
                        className="btn btn--danger btn--sm"
                        onClick={handleResetActionCatalog}
                        disabled={actionCatalogStatus.source !== 'override'}
                        title={actionCatalogStatus.source === 'override' ? 'Reset to built-in action catalog' : 'Built-in catalog is already active'}
                      >
                        Reset to Built-in
                      </button>
                    </div>
                  </div>
                </section>
              )}

              {section === 'about' && (
                <section className="settings-pane">
                  <div className="settings-panel">
                    <div className="settings-panel__head">
                      <h3 className="settings-panel__title">Information</h3>
                    </div>

                    <div style={{ display: 'grid', gap: '32px', padding: '20px 16px' }}>
                      <div className="about-item">
                        <label className="about-label">Version</label>
                        <p className="about-value about-value--mono">v{getAppVersions().app}</p>
                      </div>

                      <div className="about-item">
                        <label className="about-label">Developer</label>
                        <p className="about-value">Bromcom</p>
                      </div>

                      <div className="about-item">
                        <label className="about-label">Application ID</label>
                        <p className="about-value about-value--mono">com.bromcom.testbuilder</p>
                      </div>

                      <div className="about-item">
                        <label className="about-label">Description</label>
                        <p className="about-value about-value--description">
                          Test case and plan management for Azure DevOps. Create, edit, and organize test cases with full XML step support.
                        </p>
                      </div>
                    </div>
                  </div>
                </section>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
