import React, {useEffect, useMemo, useState} from 'react';
import {MainLayout} from '../layouts/MainLayout';
import {PageDetailLayout} from '../layouts/PageDetailLayout';
import {IconEdit, IconX} from '../Common/Icons';
import type {ADOTestCase, ADOTestPlan, ADOTestSuite} from '../../types';
import type {WorkspaceSettingsValues} from './WorkspaceSettings';
import {fetchTestCaseDetail, updateTestCase} from '../../services/adoApi';
import {parseXMLSteps, serializeStepsToXML} from '../../utils/xmlParser';
import type {ParsedStep} from '../TestCases/StepsEditor';
import {StepsEditor} from '../TestCases/StepsEditor';
import {ACTION_REGISTRY} from '../../utils/actionRegistry';

interface TestCaseDetailProps {
  plan: ADOTestPlan;
  suite: ADOTestSuite;
  caseId: number;
  caseData?: ADOTestCase;
  workspaceSettings: WorkspaceSettingsValues;
  onBackToCases: () => void;
  onSettingsClick: () => void;
  embedded?: boolean;
}

interface StepViewModel {
  index: number;
  name: string;
  fullText: string;
}

interface DetailRow {
  label: string;
  value: string;
}


function mergeTestCaseData(primary: ADOTestCase, fallback?: ADOTestCase | null): ADOTestCase {
  if (!fallback) return primary;

  return {
    ...fallback,
    ...primary,
    testPlanName: primary.testPlanName ?? fallback.testPlanName,
    testSuiteName: primary.testSuiteName ?? fallback.testSuiteName,
    configurationName: primary.configurationName ?? fallback.configurationName,
    automationStatus: primary.automationStatus ?? fallback.automationStatus,
    assignedTo: primary.assignedTo ?? fallback.assignedTo,
    tester: primary.tester ?? fallback.tester,
    lastUpdatedBy: primary.lastUpdatedBy ?? fallback.lastUpdatedBy,
    fields: {
      ...fallback.fields,
      ...primary.fields,
    },
    _links: {
      ...(fallback._links ?? {}),
      ...(primary._links ?? {}),
    },
  };
}

function normalizeFieldText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
}

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, '\'')
    .replace(/&nbsp;/g, ' ');
}

function parseStepLines(rawSteps: unknown): string[] {
  const input = normalizeFieldText(rawSteps).trim();
  if (!input) return [];

  const decoded = decodeHtmlEntities(input);
  const withLineBreaks = decoded
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|step|parameterizedstring|formattedtext|description|expected|action)>/gi, '\n');
  const withoutTags = withLineBreaks.replace(/<[^>]+>/g, ' ');
  return withoutTags
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

function formatActionName(action: string): string {
  return action
    .toLowerCase()
    .split('_')
    .filter(Boolean)
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(' ');
}

function extractActionFromLine(line: string): string | null {
  const match = line.match(/(?:^|\|)\s*Action=([^|]+)/i);
  if (!match || !match[1]) return null;
  const action = match[1].trim();
  return action.length > 0 ? action : null;
}

function formatStepTextWithBoldLabels(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const segments = text.split(/(\|)/);

  segments.forEach((segment, index) => {
    if (segment === '|') {
      parts.push('|');
    } else if (segment.trim()) {
      const match = segment.match(/^(\s*)([^=]+)(=.*)$/);
      if (match) {
        const [, leading, label, rest] = match;
        if (leading) parts.push(leading);
        parts.push(<strong key={`label-${index}`}>{label.trim()}</strong>);
        parts.push(rest);
      } else {
        parts.push(segment);
      }
    }
  });

  return parts;
}

function extractDescriptionFromLine(line: string): string | null {
  const match = line.match(/(?:^|\|)\s*Description=([^|]+)/i);
  if (!match || !match[1]) return null;
  const description = match[1].trim();
  return description.length > 0 ? description : null;
}

function buildFullTextFromParsedStep(step: {
  action: string;
  element?: string;
  elementCategory?: string;
  value?: string;
  expectedValue?: string;
  key?: string;
  headers?: string;
  description?: string;
}): string {
  const parts = [
    ['Action', step.action],
    ['Element', step.element],
    ['ElementCategory', step.elementCategory],
    ['Description', step.description],
    ['Value', step.value],
    ['ExpectedValue', step.expectedValue],
    ['DataKey', step.key],
    ['Headers', step.headers],
  ]
    .filter(([, value]) => Boolean(value && value.trim().length > 0))
    .map(([label, value]) => `${label}=${value}`);

  return parts.join('|');
}

function parseStepsForDisplay(rawSteps: unknown): StepViewModel[] {
  const input = normalizeFieldText(rawSteps).trim();
  if (!input) return [];

  const lines = parseStepLines(rawSteps);
  const actionLines = lines.filter((line) => /(?:^|\|)\s*Action=/i.test(line));
  const parsed = parseXMLSteps(input).steps;

  if (parsed.length > 0) {
    return parsed.map((step, index) => {
      const fallbackLine = actionLines[index] || lines[index] || buildFullTextFromParsedStep(step);
      const description = step.description?.trim() || extractDescriptionFromLine(fallbackLine);
      const actionName = formatActionName(step.action || extractActionFromLine(fallbackLine) || 'Step');
      return {
        index: index + 1,
        name: description || actionName || `Step ${index + 1}`,
        fullText: fallbackLine || buildFullTextFromParsedStep(step),
      };
    });
  }

  const sourceLines = actionLines.length > 0 ? actionLines : lines;
  return sourceLines.map((line, index) => {
    const description = extractDescriptionFromLine(line);
    const action = extractActionFromLine(line);
    return {
      index: index + 1,
      name: description || formatActionName(action || 'Step'),
      fullText: line,
    };
  });
}

function formatDateTime(value: unknown): string {
  const raw = normalizeFieldText(value).trim();
  if (!raw) return '';
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return raw;
  const day = String(parsed.getDate()).padStart(2, '0');
  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  const year = String(parsed.getFullYear());
  const hours = String(parsed.getHours()).padStart(2, '0');
  const minutes = String(parsed.getMinutes()).padStart(2, '0');
  return `${day}/${month}/${year} ${hours}:${minutes}`;
}

function toIdentityDisplay(value: unknown): string {
  if (!value) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'object') {
    const identity = value as { displayName?: unknown; uniqueName?: unknown };
    const displayName = normalizeFieldText(identity.displayName).trim();
    const uniqueName = normalizeFieldText(identity.uniqueName).trim();
    if (displayName && uniqueName && displayName !== uniqueName) return `${displayName} (${uniqueName})`;
    return displayName || uniqueName;
  }
  return '';
}

function toDisplayValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (typeof value === 'object') {
    const identity = toIdentityDisplay(value);
    if (identity) return identity;
    try {
      return JSON.stringify(value);
    } catch {
      return '';
    }
  }
  return '';
}


function buildMainDetailRows(testCase: ADOTestCase): DetailRow[] {
  const fields = testCase.fields ?? {};
  const testingMethod = toDisplayValue(fields['Custom.TestingMethod']) || 'Not set';
  const region = toDisplayValue(fields['Custom.ApplicableRegions']) || 'Not set';
  const execProcess = toDisplayValue(fields['Custom.ExecutiveProcess']) || 'Not set';
  const pltpProcess = toDisplayValue(fields['Custom.PLTPProcessArea']) || 'Not set';
  const assignedLabel = testCase.assignedTo?.displayName || toIdentityDisplay(fields['System.AssignedTo']) || 'Unassigned';

  return [
    {label: 'Status', value: testCase.state},
    {label: 'Testing Method', value: testingMethod},
    {label: 'Region', value: region},
    {label: 'Executive Process', value: execProcess},
    {label: 'PLTP Process', value: pltpProcess},
    {label: 'Assigned To', value: assignedLabel},
  ];
}

function buildAdditionalDetailRows(testCase: ADOTestCase, plan: ADOTestPlan): DetailRow[] {
  const fields = testCase.fields ?? {};
  const automationStatus = testCase.automationStatus || toDisplayValue(fields['Microsoft.VSTS.TCM.AutomationStatus']) || 'Unknown';
  const configuration = testCase.configurationName || 'Default configuration';

  return [
    {label: 'Configuration', value: configuration},
    {label: 'Automation', value: automationStatus},
    {label: 'Priority', value: String(testCase.priority)},
    {label: 'Iteration Path', value: toDisplayValue(fields['System.IterationPath']) || plan.iteration},
    {label: 'Area Path', value: toDisplayValue(fields['System.AreaPath']) || plan.areaPath},
    {label: 'Tester', value: testCase.tester?.displayName || ''},
    {label: 'Automated Test Name', value: toDisplayValue(fields['Microsoft.VSTS.TCM.AutomatedTestName'])},
    {label: 'Created Date', value: formatDateTime(fields['System.CreatedDate'])},
    {label: 'Created By', value: toIdentityDisplay(fields['System.CreatedBy'])},
    {label: 'Changed Date', value: formatDateTime(fields['System.ChangedDate'])},
    {label: 'Changed By', value: toIdentityDisplay(fields['System.ChangedBy'])},
    {label: 'Activated Date', value: formatDateTime(fields['Microsoft.VSTS.Common.ActivatedDate'])},
    {label: 'Activated By', value: toIdentityDisplay(fields['Microsoft.VSTS.Common.ActivatedBy'])},
    {label: 'Last Updated', value: formatDateTime(testCase.lastUpdatedDate)},
    {label: 'Last Updated By', value: testCase.lastUpdatedBy?.displayName || ''},
  ];
}

export function TestCaseDetail({
  plan,
  suite,
  caseId,
  caseData,
  workspaceSettings,
  onBackToCases,
  onSettingsClick,
  embedded = false,
}: TestCaseDetailProps) {
  const [testCase, setTestCase] = useState<ADOTestCase | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadWarning, setLoadWarning] = useState<string | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isAdditionalModalOpen, setIsAdditionalModalOpen] = useState(false);
  const [editFormData, setEditFormData] = useState({
    status: '',
    method: '',
    region: '',
    execProcess: '',
    pltpProcess: '',
    initialSteps: '',
  });
  const [editValidationErrors, setEditValidationErrors] = useState<string[]>([]);
  const [editSteps, setEditSteps] = useState<ParsedStep[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const workspaceReady = Boolean(
    workspaceSettings.organization.trim()
      && workspaceSettings.projectName.trim()
      && workspaceSettings.patToken.trim(),
  );

  useEffect(() => {
    let active = true;

    const selectedCase = caseData && caseData.id === caseId ? caseData : null;
    setTestCase(selectedCase);
    setLoadWarning(null);

    if (!workspaceReady) {
      setLoading(false);
      if (selectedCase) {
        setLoadWarning('Showing test case data from suite list. Configure workspace connection to sync full work item details.');
      } else {
        setLoadWarning('Configure Organization, Project, and PAT in Settings to load work item details.');
      }
      return () => {
        active = false;
      };
    }

    const loadCase = async () => {
      try {
        setLoading(true);
        const preferredHref = selectedCase?._links?.workItem?.href
          ?? selectedCase?._links?.self?.href
          ?? selectedCase?._links?._self?.href;
        const data = await fetchTestCaseDetail(workspaceSettings, caseId, preferredHref, selectedCase ?? undefined);
        if (!active) return;
        setTestCase((prev) => mergeTestCaseData(data, prev ?? selectedCase));
        setLoadWarning(null);
      } catch (error) {
        if (!active) return;
        const message = error instanceof Error ? error.message : 'Failed to load work item details.';
        if (selectedCase) {
          setLoadWarning(`Showing suite data. Live sync failed: ${message}`);
          return;
        }
        setLoadWarning(message);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    loadCase().then(() => console.log('[TestCaseDetail] Initial load completed', { caseId, caseDataLoaded: !!caseData, workspaceReady }));
    return () => {
      active = false;
    };
  }, [caseData, caseId, workspaceReady, workspaceSettings]);

  useEffect(() => {
    if (!isAdditionalModalOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsAdditionalModalOpen(false);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isAdditionalModalOpen]);

  useEffect(() => {
    if (isEditMode && testCase) {
      const fields = testCase.fields ?? {};
      const newFormData = {
        status: testCase.state || '',
        method: toDisplayValue(fields['Custom.TestingMethod']) || '',
        region: toDisplayValue(fields['Custom.ApplicableRegions']) || '',
        execProcess: toDisplayValue(fields['Custom.ExecutiveProcess']) || '',
        pltpProcess: toDisplayValue(fields['Custom.PLTPProcessArea']) || '',
        initialSteps: normalizeFieldText(fields['Custom.InitialStep']) || '',
      };

      setEditFormData(newFormData);

      // Initialize edit steps from current test case
      const rawSteps = fields['Microsoft.VSTS.TCM.Steps'];
      if (rawSteps) {
        const { steps } = parseXMLSteps(normalizeFieldText(rawSteps).trim());
        setEditSteps(steps.map((step, idx) => ({ ...step, index: idx + 1 })));
      } else {
        setEditSteps([]);
      }

      setEditValidationErrors([]);
    }
  }, [isEditMode, testCase]);

  const stepsForDisplay = useMemo(() => {
    if (!testCase) return [];
    return parseStepsForDisplay(testCase.fields['Microsoft.VSTS.TCM.Steps']);
  }, [testCase]);


  const mainRows = useMemo(() => {
    if (!testCase) return [];
    return buildMainDetailRows(testCase);
  }, [testCase]);

  const additionalRows = useMemo(() => {
    if (!testCase) return [];
    return buildAdditionalDetailRows(testCase, plan);
  }, [plan, testCase]);

  const loadingView = (
    <div className="cases-loading-state" aria-live="polite">
      <div className="suite-response-skeleton" aria-hidden="true">
        <span className="skeleton skeleton--line" />
        <span className="skeleton skeleton--line" />
        <span className="skeleton skeleton--line skeleton--line-wide" />
        <span className="skeleton skeleton--line" />
        <span className="skeleton skeleton--line-sm" />
      </div>
    </div>
  );

  if (loading && !testCase) {
    if (embedded) return loadingView;
    return (
      <MainLayout title="Test Case Detail" onSettingsClick={onSettingsClick}>
        {loadingView}
      </MainLayout>
    );
  }

  if (!testCase) {
    const emptyView = <p className="text-sm text-secondary">Test case not found.</p>;
    if (embedded) return emptyView;
    return (
      <MainLayout title="Test Case Detail" onSettingsClick={onSettingsClick}>
        {emptyView}
      </MainLayout>
    );
  }

  const parentSuiteName = suite.parent?.name || plan.rootSuite.name;
  [plan.name, parentSuiteName, suite.name, testCase.name]
      .filter((item) => item.trim().length > 0)
      .filter((item, index, arr) => index === 0 || item !== arr[index - 1]);
  const content = (
    <>
      <div className={`case-detail-pane${isEditMode ? ' case-detail-pane--edit' : ''}`}>
        <div className="case-detail-pane__header-fixed">
          {loadWarning && <p className="text-sm text-secondary mb-md">{loadWarning}</p>}

          <div className="case-detail-section__head case-detail-section__head--merged case-detail-section__head--fixed">
            <div>
              <h3>Details & Steps</h3>
            </div>
            <div className="case-detail-section__actions">
              {!isEditMode && (
                <>
                  <button
                    type="button"
                    className={`btn btn--secondary btn--sm case-detail-pane__edit-btn${isEditMode ? ' is-active' : ''}`}
                    onClick={() => setIsEditMode((prev) => !prev)}
                    aria-pressed={isEditMode}
                  >
                    <IconEdit size={15} />
                    Edit
                  </button>
                  <button
                    type="button"
                    className="btn btn--secondary btn--sm"
                    onClick={() => setIsAdditionalModalOpen(true)}
                    disabled={additionalRows.length === 0}
                  >
                    More Details
                  </button>
                  <button type="button" className="btn btn--secondary btn--sm" onClick={onBackToCases}>
                    Back
                  </button>
                </>
              )}
              {isEditMode && (
                <>
                  <button
                    type="button"
                    className="btn btn--primary btn--sm"
                    disabled={isSaving}
                    onClick={async () => {
                      const errors: string[] = [];
                      if (!editFormData.status.trim()) errors.push('Status is required');
                      if (!editFormData.method.trim()) errors.push('Testing Method is required');
                      if (!editFormData.region.trim()) errors.push('Region is required');
                      if (!editFormData.execProcess.trim()) errors.push('Executive Process is required');
                      if (!editFormData.pltpProcess.trim()) errors.push('PLTP Process is required');
                      if (editSteps.length === 0) errors.push('At least one step is required');

                      // Validate individual steps
                      editSteps.forEach((step, idx) => {
                        if (!step.action.trim()) {
                          errors.push(`Step ${idx + 1}: Action is required`);
                          return;
                        }

                        // Get the action definition to check which fields are required
                        const actionDef = ACTION_REGISTRY[step.action];

                        // Only require Locator if the action actually uses elements
                        if (actionDef?.contract.element === 'required' && !step.element?.trim()) {
                          errors.push(`Step ${idx + 1}: Locator is required`);
                        }

                        if (!step.description?.trim()) {
                          errors.push(`Step ${idx + 1}: Step Summary is required`);
                        }
                      });

                      if (errors.length > 0) {
                        setEditValidationErrors(errors);
                        return;
                      }

                      setIsSaving(true);
                      try {
                        // Serialize steps to XML format
                        const stepsXml = serializeStepsToXML(editSteps);
                        console.log('[TestCaseDetail Save] Steps being saved:', {
                          stepCount: editSteps.length,
                          xmlLength: stepsXml.length,
                          xmlPreview: stepsXml.substring(0, 200),
                        });

                        // Call update API
                        await updateTestCase(workspaceSettings, testCase.id, {
                          status: editFormData.status,
                          method: editFormData.method,
                          region: editFormData.region,
                          execProcess: editFormData.execProcess,
                          pltpProcess: editFormData.pltpProcess,
                          initialSteps: editFormData.initialSteps,
                          stepsXml,
                        }, testCase._links?.workItem?.href ?? testCase._links?.self?.href);

                        // Reload test case data with fresh API call
                        console.log('[TestCaseDetail] Fetching updated test case after save...');
                        const updatedCase = await fetchTestCaseDetail(
                          workspaceSettings,
                          testCase.id,
                          testCase._links?.workItem?.href ?? testCase._links?.self?.href,
                        );
                        console.log('[TestCaseDetail] Updated test case received:', {
                          id: updatedCase.id,
                          stepsCount: (updatedCase.fields?.['Microsoft.VSTS.TCM.Steps'] as string)?.length || 0,
                          hasSteps: !!updatedCase.fields?.['Microsoft.VSTS.TCM.Steps'],
                        });
                        setTestCase(updatedCase);
                        setIsEditMode(false);
                        setEditValidationErrors([]);
                      } catch (error) {
                        const message = error instanceof Error ? error.message : 'Failed to save changes';
                        setEditValidationErrors([`Save failed: ${message}`]);
                      } finally {
                        setIsSaving(false);
                      }
                    }}
                  >
                    {isSaving ? 'Saving...' : 'Save'}
                  </button>
                  <button
                    type="button"
                    className="btn btn--secondary btn--sm"
                    onClick={() => setIsEditMode(false)}
                  >
                    Exit Edit
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="case-detail-pane__content">
          {!isEditMode ? (
            <>
              {mainRows.length > 0 && (
                <div className="case-detail-grid">
                  {mainRows.map((row) => (
                    <article key={row.label} className="case-detail-card">
                      <span className="case-detail-card__label">{row.label}</span>
                      <p className="case-detail-card__value">{row.value || 'Not set'}</p>
                    </article>
                  ))}
                </div>
              )}

              <div className="case-detail-steps-container">
                {(() => {
                  const initialStepsText = normalizeFieldText(testCase.fields?.['Custom.InitialStep']);
                  if (initialStepsText) {
                    return (
                      <article className="case-detail-step-item">
                        <p className="case-detail-step-item__title">
                          <span className="case-detail-step-item__index">Step 0:</span>
                          <strong className="case-detail-step-item__name">Initial Steps</strong>
                        </p>
                        <pre className="case-detail-step-item__full">{initialStepsText}</pre>
                      </article>
                    );
                  }
                  return null;
                })()}
                {stepsForDisplay.length > 0 ? (
                  <div className="case-detail-steps-list pt-md">
                    {stepsForDisplay.map((step) => (
                      <article key={`${testCase.id}-step-${step.index}`} className="case-detail-step-item">
                        <p className="case-detail-step-item__title">
                          <span className="case-detail-step-item__index">Step {step.index}:</span>
                          <strong className="case-detail-step-item__name">{step.name}</strong>
                        </p>
                        <pre className="case-detail-step-item__full">{formatStepTextWithBoldLabels(step.fullText)}</pre>
                      </article>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-secondary">No step definition available.</p>
                )}
              </div>
            </>
          ) : (
            <section className="case-detail-edit-section">
              {editValidationErrors.length > 0 && (
                <div className="case-detail-edit-errors">
                  {editValidationErrors.map((error, idx) => (
                    <p key={idx} className="case-detail-edit-error">{error}</p>
                  ))}
                </div>
              )}

              <div className="case-detail-edit-form">
                <div className="case-detail-edit-form__field">
                  <label className="case-detail-edit-form__label">Status</label>
                  <input
                    type="text"
                    className="case-detail-edit-form__input"
                    value={editFormData.status}
                    onChange={(e) => setEditFormData(prev => ({ ...prev, status: e.target.value }))}
                    placeholder="e.g., Design, Active"
                  />
                </div>

                <div className="case-detail-edit-form__field">
                  <label className="case-detail-edit-form__label">Testing Method</label>
                  <input
                    type="text"
                    className="case-detail-edit-form__input"
                    value={editFormData.method}
                    onChange={(e) => setEditFormData(prev => ({ ...prev, method: e.target.value }))}
                    placeholder="e.g., Manual, Automated"
                  />
                </div>

                <div className="case-detail-edit-form__field">
                  <label className="case-detail-edit-form__label">Region</label>
                  <input
                    type="text"
                    className="case-detail-edit-form__input"
                    value={editFormData.region}
                    onChange={(e) => setEditFormData(prev => ({ ...prev, region: e.target.value }))}
                    placeholder="e.g., US, EU, APAC"
                  />
                </div>

                <div className="case-detail-edit-form__field">
                  <label className="case-detail-edit-form__label">Executive Process</label>
                  <input
                    type="text"
                    className="case-detail-edit-form__input"
                    value={editFormData.execProcess}
                    onChange={(e) => setEditFormData(prev => ({ ...prev, execProcess: e.target.value }))}
                    placeholder="Enter executive process"
                  />
                </div>

                <div className="case-detail-edit-form__field">
                  <label className="case-detail-edit-form__label">PLTP Process</label>
                  <input
                    type="text"
                    className="case-detail-edit-form__input"
                    value={editFormData.pltpProcess}
                    onChange={(e) => setEditFormData(prev => ({ ...prev, pltpProcess: e.target.value }))}
                    placeholder="Enter PLTP process area"
                  />
                </div>

                <div className="case-detail-edit-form__field">
                  <label className="case-detail-edit-form__label">Initial Steps</label>
                  <input
                    type="text"
                    className="case-detail-edit-form__input"
                    value={editFormData.initialSteps}
                    onChange={(e) => setEditFormData(prev => ({ ...prev, initialSteps: e.target.value }))}
                    placeholder="Enter initial setup steps or preconditions..."
                  />
                </div>
              </div>

              <StepsEditor
                rawSteps={testCase.fields['Microsoft.VSTS.TCM.Steps']}
                onChange={setEditSteps}
                errors={editValidationErrors.filter((e) => e.includes('step'))}
              />

            </section>
          )}
        </div>
      </div>

      {isAdditionalModalOpen && (
        <div className="settings-overlay" role="dialog" aria-modal="true" aria-label="Additional Details">
          <button
            type="button"
            className="settings-overlay__backdrop"
            onClick={() => setIsAdditionalModalOpen(false)}
            aria-label="Close additional details"
          />
          <div className="settings-dock settings-dock--no-aside">
            <section className="settings-workbench">
              <header className="settings-workbench__header">
                <div>
                  <p className="settings-workbench__crumb">Additional Details</p>
                  <h1 className="settings-workbench__title" title={testCase.name}>{testCase.name}</h1>
                  <p className="settings-workbench__subtitle">Additional information and metadata for this test case.</p>
                </div>
                <button
                  type="button"
                  className="settings-workbench__close"
                  onClick={() => setIsAdditionalModalOpen(false)}
                  aria-label="Close additional details"
                  title="Close additional details"
                >
                  <IconX size={18} />
                </button>
              </header>

              <div className="settings-workbench__body">
                <div className="settings-content">
                  {additionalRows.length > 0 ? (
                    <section className="settings-pane">
                      <div className="case-detail-modal__meta-grid">
                        {additionalRows.map((row) => (
                          <article key={row.label} className="case-detail-modal__meta-card">
                            <span className="case-detail-modal__meta-label">{row.label}</span>
                            <strong className="case-detail-modal__meta-value">{row.value || 'Not set'}</strong>
                          </article>
                        ))}
                      </div>
                    </section>
                  ) : (
                    <p className="text-sm text-secondary">No additional details available.</p>
                  )}
                </div>
              </div>
            </section>
          </div>
        </div>
      )}

    </>
  );

  if (embedded) return content;

  return (
    <MainLayout title="Test Case Detail" onSettingsClick={onSettingsClick}>
      <PageDetailLayout

        breadcrumbs={[
          { label: 'Plans', onClick: onBackToCases, isLink: true },
          { label: plan.rootSuite.name, isLink: true, onClick: onBackToCases },
          { label: suite.name, isLink: true, onClick: onBackToCases },
          { label: testCase.name, isActive: true },
        ]
      }
        heading={{
          title: testCase.name,
          id: testCase.id,
          count: stepsForDisplay.length,
          countLabel: 'Steps',
        }}
      >
        {content}
      </PageDetailLayout>
    </MainLayout>
  );
}
