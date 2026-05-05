import React, { useEffect, useMemo, useState } from 'react';
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
}

type SettingsSection = 'appearance' | 'workspace' | 'db-mappings' | 'about';
type ValidationState = 'idle' | 'success' | 'error';

const API_VERSION_OPTIONS = ['7.2', '7.1', '7.0', '6.0'];
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

export function WorkspaceSettings({ values, onSave, onBack }: WorkspaceSettingsProps) {
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
  const { mode, font, setTheme, setFont } = useThemeContext();
  const { addNotification } = useNotification();

  useEffect(() => {
    setForm({
      ...values,
      dbMappings: normalizeWorkspaceDbMappings(values),
    });
  }, [values]);

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
      : section === 'db-mappings'
        ? 'DB Mappings'
        : 'About';
  const sectionSubtitle = section === 'appearance'
    ? 'Theme modes, accent palettes, and typography controls.'
    : section === 'workspace'
    ? 'Manage Azure connection settings and the Selenium repository location.'
    : section === 'db-mappings'
    ? 'Map Azure test plans to local SQLite DB files for targeted refreshes.'
    : 'About Bromcom Test Builder and system information.';

  const updateField = (field: keyof WorkspaceSettingsValues, value: string) => {
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

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const dbMappings = normalizeWorkspaceDbMappings(form);
    const validationError = validateDbMappings(dbMappings);
    if (validationError) {
      addNotification('error', validationError);
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

  const handleBrowseSeleniumRepo = async () => {
    try {
      if (!window.desktop?.selectDirectory) {
        throw new Error('Desktop folder picker is unavailable. Restart the app to load the latest Electron changes.');
      }

      const selectedPath = await window.desktop?.selectDirectory?.({
        title: 'Select Selenium workspace or repo',
        defaultPath: form.seleniumRepoPath,
      });

      if (!selectedPath) {
        return;
      }

      updateField('seleniumRepoPath', selectedPath);
      addNotification('success', 'Selenium repo path selected.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to select Selenium repo path.';
      addNotification('error', message);
    }
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
    <div className="settings-overlay" role="dialog" aria-modal="true" aria-label="Settings">
      <button
        type="button"
        className="settings-overlay__backdrop"
        onClick={onBack}
        aria-label="Close settings overlay"
      />
      <div className="settings-dock">
        <section className="settings-workbench">
          <header className="settings-workbench__header">
            <div>
              <p className="settings-workbench__crumb">Settings / {sectionLabel}</p>
              <h1 className="settings-workbench__title">{sectionLabel}</h1>
              <p className="settings-workbench__subtitle">{sectionSubtitle}</p>
            </div>
            <button
              type="button"
              className="settings-workbench__close"
              onClick={onBack}
              aria-label="Close settings"
              title="Close settings"
            >
              <IconX size={18} />
            </button>
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
                className={sectionItemClassName('db-mappings')}
                onClick={() => setSection('db-mappings')}
              >
                <span className="settings-nav-item__title">DB Mappings</span>
                <span className="settings-nav-item__sub">Plans and local DB files</span>
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
                      <strong>{form.seleniumRepoPath.trim() || 'Not set'}</strong>
                    </div>
                    <div className="settings-summary-chip">
                      <span>DB Folder</span>
                      <strong>{form.dbDirectory.trim() || 'Not set'}</strong>
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
                        <h3 className="settings-panel__title">Selenium Repo Settings</h3>
                        <p className="settings-panel__sub">
                          Set the local Selenium workspace or repository path used by the in-app script browser.
                        </p>
                      </div>

                      <div className="settings-field-grid">
                        <label className="settings-field settings-field--full" htmlFor="seleniumRepoPath">
                          <span className="settings-field__label">Selenium workspace or repo path</span>
                          <div className="settings-inline-row">
                            <input
                              id="seleniumRepoPath"
                              className="settings-input"
                              value={form.seleniumRepoPath}
                              onChange={(event) => updateField('seleniumRepoPath', event.target.value)}
                              placeholder="C:\\Repos\\selenium-tests"
                            />
                            <button
                              type="button"
                              className="btn btn--secondary btn--sm"
                              onClick={() => { void handleBrowseSeleniumRepo(); }}
                            >
                              Browse
                            </button>
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
                              <label className="settings-db-mapping__enabled">
                                <input
                                  type="checkbox"
                                  checked={mapping.enabled}
                                  onChange={(event) => updateDbMapping(mapping.id, 'enabled', event.target.checked)}
                                />
                                <span>Enabled</span>
                              </label>

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
