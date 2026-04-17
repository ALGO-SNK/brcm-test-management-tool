import React, { useEffect, useMemo, useState } from 'react';
import { IconSave, IconX } from '../Common/Icons';
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

export interface WorkspaceSettingsValues {
  organization: string;
  projectName: string;
  patToken: string;
  apiVersion: string;
}

interface WorkspaceSettingsProps {
  values: WorkspaceSettingsValues;
  onSave: (values: WorkspaceSettingsValues) => void;
  onBack: () => void;
}

type SettingsSection = 'appearance' | 'workspace' | 'about';
type ValidationState = 'idle' | 'success' | 'error';

const API_VERSION_OPTIONS = ['7.2', '7.1', '7.0', '6.0'];

function isAppFontMode(value: string): value is AppFontMode {
  return APP_FONT_OPTIONS.some((item) => item.value === value);
}

export function WorkspaceSettings({ values, onSave, onBack }: WorkspaceSettingsProps) {
  const [form, setForm] = useState<WorkspaceSettingsValues>(values);
  const [section, setSection] = useState<SettingsSection>('appearance');
  const [validationState, setValidationState] = useState<ValidationState>('idle');
  const [validationMessage, setValidationMessage] = useState('Fill organization, project, and PAT before validating the connection.');
  const { mode, font, setTheme, setFont } = useThemeContext();
  const { addNotification } = useNotification();

  useEffect(() => {
    setForm(values);
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

  const selectedTheme = useMemo(
    () => THEME_MODE_OPTIONS.find((item) => item.value === mode) ?? THEME_MODE_OPTIONS[0],
    [mode],
  );
  const selectedFont = useMemo(
    () => APP_FONT_OPTIONS.find((item) => item.value === font) ?? APP_FONT_OPTIONS[0],
    [font],
  );
  const selectedFontValue = APP_FONT_OPTIONS.some((item) => item.value === font) ? font : '';
  const sectionLabel = section === 'appearance' ? 'Appearance' : section === 'workspace' ? 'Workspace' : 'About';
  const sectionSubtitle = section === 'appearance'
    ? 'Theme modes, accent palettes, and typography controls.'
    : section === 'workspace'
    ? 'Manage saved workspace connection and API defaults.'
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

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSave(form);
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
                      <span>Mode</span>
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
                  </div>

                  <form className="settings-form" onSubmit={handleSubmit}>
                    <div className="settings-panel">
                      <div className="settings-panel__head">
                        <h3 className="settings-panel__title">Connection</h3>
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
