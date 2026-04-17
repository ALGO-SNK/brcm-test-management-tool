import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {MainLayout} from '../layouts/MainLayout';
import {PageDetailLayout} from '../layouts/PageDetailLayout';
import {IconEdit, IconOpenInNew, IconX} from '../Common/Icons';
import type {ADOTestCase, ADOTestPlan, ADOTestSuite} from '../../types';
import type {WorkspaceSettingsValues} from './WorkspaceSettings';
import {buildWorkItemAdoUrl, fetchTestCaseDetail, updateTestCase} from '../../services/adoApi';
import {parseXMLSteps} from '../../utils/xmlParser';
import {buildTestCaseData} from '../../utils/testCaseBuilder';
import type {ParsedStep} from '../TestCases/StepsEditor';
import {StepsEditor} from '../TestCases/StepsEditor';
import {TestCaseFormFields} from '../TestCases/TestCaseFormFields';
import {ACTION_REGISTRY} from '../../utils/actionRegistry';
import {useNotification} from '../../context/useNotification';

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
    title: '',
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
  const [showUnsavedConfirm, setShowUnsavedConfirm] = useState(false);
  const [pendingExitAction, setPendingExitAction] = useState<'back' | 'exit' | 'window-close' | null>(null);
  const [confirmExitRequested, setConfirmExitRequested] = useState(false);
  const reloadCaseControllerRef = useRef<AbortController | null>(null);
  const editBaselineRef = useRef<{
    formData: typeof editFormData;
    steps: ParsedStep[];
  } | null>(null);
  const allowWindowCloseRef = useRef(false);
  const { addNotification } = useNotification();

  const workspaceReady = Boolean(
    workspaceSettings.organization.trim()
      && workspaceSettings.projectName.trim()
      && workspaceSettings.patToken.trim(),
  );
  const canOpenInAdo = Boolean(
    workspaceSettings.organization.trim()
      && workspaceSettings.projectName.trim(),
  );

  useEffect(() => {
    let active = true;
    const controller = new AbortController();

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
        const data = await fetchTestCaseDetail(
          workspaceSettings,
          caseId,
          preferredHref,
          selectedCase ?? undefined,
          controller.signal,
        );
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
      controller.abort();
    };
  }, [caseData, caseId, workspaceReady, workspaceSettings]);

  useEffect(() => () => {
    reloadCaseControllerRef.current?.abort();
    reloadCaseControllerRef.current = null;
  }, []);

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
        title: testCase.name || '',
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
        editBaselineRef.current = {
          formData: newFormData,
          steps: steps.map((step, idx) => ({ ...step, index: idx + 1 })),
        };
      } else {
        setEditSteps([]);
        editBaselineRef.current = {
          formData: newFormData,
          steps: [],
        };
      }

      setEditValidationErrors([]);
      setShowUnsavedConfirm(false);
      setPendingExitAction(null);
    }
  }, [isEditMode, testCase]);

  const isEditDirty = useMemo(() => {
    const baseline = editBaselineRef.current;
    if (!isEditMode || !baseline) return false;

    const normalizeStep = (step: ParsedStep) => {
      const { index, ...rest } = step as ParsedStep & { index?: number };
      return rest;
    };

    return JSON.stringify(editFormData) !== JSON.stringify(baseline.formData)
      || JSON.stringify(editSteps.map(normalizeStep)) !== JSON.stringify(baseline.steps.map(normalizeStep));
  }, [editFormData, editSteps, isEditMode]);

  useEffect(() => {
    if (!isEditDirty) return;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (allowWindowCloseRef.current) {
        return;
      }

      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isEditDirty]);

  useEffect(() => {
    window.desktop?.setUnsavedChanges?.(`test-case-edit:${caseId}`, isEditDirty);

    return () => {
      window.desktop?.setUnsavedChanges?.(`test-case-edit:${caseId}`, false);
    };
  }, [caseId, isEditDirty]);

  useEffect(() => {
    if (!isEditDirty) return;

    return window.desktop?.onWindowCloseRequested?.(() => {
      setPendingExitAction('window-close');
      setShowUnsavedConfirm(true);
    });
  }, [isEditDirty]);

  const requestExitEdit = useCallback((action: 'back' | 'exit' | 'window-close') => {
    if (isEditDirty) {
      setPendingExitAction(action);
      setShowUnsavedConfirm(true);
      return;
    }

    if (action === 'back') {
      onBackToCases();
      return;
    }

    setIsEditMode(false);
  }, [isEditDirty, onBackToCases]);

  const discardEditChanges = useCallback(() => {
    setShowUnsavedConfirm(false);
    setConfirmExitRequested(true);
  }, []);

  const keepEditing = useCallback(() => {
    allowWindowCloseRef.current = false;
    if (pendingExitAction === 'window-close') {
      window.desktop?.respondToWindowClose?.(false);
    }
    setPendingExitAction(null);
    setShowUnsavedConfirm(false);
  }, [pendingExitAction]);

  useEffect(() => {
    if (showUnsavedConfirm || !confirmExitRequested || pendingExitAction === null) return;

    const action = pendingExitAction;
    setConfirmExitRequested(false);
    setPendingExitAction(null);
    editBaselineRef.current = null;

    if (action === 'back') {
      setIsEditMode(false);
      onBackToCases();
      return;
    }

    if (action === 'window-close') {
      allowWindowCloseRef.current = true;
      window.desktop?.respondToWindowClose?.(true);
      return;
    }

    setIsEditMode(false);
  }, [confirmExitRequested, onBackToCases, pendingExitAction, showUnsavedConfirm]);

  const handleSaveChanges = useCallback(async () => {
    if (!testCase || isSaving) return;

    const errors: string[] = [];
    if (!editFormData.title.trim()) errors.push('Test Title is required');
    if (!editFormData.status.trim()) errors.push('Status is required');
    if (!editFormData.method.trim()) errors.push('Testing Method is required');
    if (!editFormData.region.trim()) errors.push('Region is required');
    if (!editFormData.execProcess.trim()) errors.push('Executive Process is required');
    if (!editFormData.pltpProcess.trim()) errors.push('PLTP Process is required');
    if (editSteps.length === 0) errors.push('At least one step is required');

    editSteps.forEach((step, idx) => {
      if (!step.action.trim()) {
        errors.push(`Step ${idx + 1}: Action is required`);
        return;
      }

      const actionDef = ACTION_REGISTRY[step.action];

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
    let reloadController: AbortController | null = null;
    try {
      const testCaseData = buildTestCaseData(editFormData, editSteps);

      console.log('[TestCaseDetail Save] Steps being saved:', {
        stepCount: editSteps.length,
        xmlLength: testCaseData.stepsXml?.length || 0,
        xmlPreview: testCaseData.stepsXml?.substring(0, 200),
      });

      await updateTestCase(
        workspaceSettings,
        testCase.id,
        testCaseData,
        testCase._links?.workItem?.href ?? testCase._links?.self?.href,
      );

      console.log('[TestCaseDetail] Fetching updated test case after save...');
      reloadCaseControllerRef.current?.abort();
      reloadController = new AbortController();
      reloadCaseControllerRef.current = reloadController;
      const updatedCase = await fetchTestCaseDetail(
        workspaceSettings,
        testCase.id,
        testCase._links?.workItem?.href ?? testCase._links?.self?.href,
        undefined,
        reloadController.signal,
      );
      console.log('[TestCaseDetail] Updated test case received:', {
        id: updatedCase.id,
        stepsCount: (updatedCase.fields?.['Microsoft.VSTS.TCM.Steps'] as string)?.length || 0,
        hasSteps: !!updatedCase.fields?.['Microsoft.VSTS.TCM.Steps'],
      });
      setTestCase(updatedCase);
      setIsEditMode(false);
      setEditValidationErrors([]);
      editBaselineRef.current = null;
      setShowUnsavedConfirm(false);
      setPendingExitAction(null);
      addNotification('success', `Test case "${updatedCase.name}" updated successfully.`);
      if (reloadCaseControllerRef.current === reloadController) {
        reloadCaseControllerRef.current = null;
      }
    } catch (error) {
      if (reloadController?.signal.aborted) {
        return;
      }
      const message = error instanceof Error ? error.message : 'Failed to save changes';
      setEditValidationErrors([`Save failed: ${message}`]);
    } finally {
      if (!reloadController?.signal.aborted) {
        setIsSaving(false);
      }
    }
  }, [addNotification, editFormData, editSteps, isSaving, testCase, workspaceSettings]);

  useEffect(() => {
    if (!isEditMode) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.repeat) return;
      const isSaveShortcut = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's';
      if (!isSaveShortcut) return;

      event.preventDefault();
      event.stopPropagation();
      void handleSaveChanges();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [handleSaveChanges, isEditMode]);

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

  const planBreadcrumbLabel = plan.name.trim() || `Plan ${plan.id}`;
  const parentSuiteName = suite.parent?.name?.trim() ?? '';
  const detailBreadcrumbs = [
    { label: 'Plans', onClick: () => requestExitEdit('back'), isLink: true },
    { label: planBreadcrumbLabel, onClick: () => requestExitEdit('back'), isLink: true },
    ...[parentSuiteName, suite.name]
      .filter((item) => item.trim().length > 0)
      .filter((item, index, arr) => index === 0 || item !== arr[index - 1])
      .map((label) => ({
        label,
        isLink: true,
        onClick: () => requestExitEdit('back'),
      })),
  ];
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
                        className="btn btn--secondary btn--sm"
                        onClick={() => window.open(buildWorkItemAdoUrl(workspaceSettings, testCase.id), '_blank', 'noopener,noreferrer')}
                        disabled={!canOpenInAdo}
                      >
                        <IconOpenInNew size={15} />
                        Open in ADO
                      </button>
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
                    onClick={() => { void handleSaveChanges(); }}
                  >
                    {isSaving ? 'Saving...' : 'Save'}
                  </button>
                  <button
                    type="button"
                    className="btn btn--secondary btn--sm"
                    onClick={() => requestExitEdit('exit')}
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
              <TestCaseFormFields
                formData={editFormData}
                onChange={(updatedData) => setEditFormData((prev) => ({ ...prev, ...updatedData }))}
                isLoading={isSaving}
                showTitle
                validationErrors={editValidationErrors}
                titlePlaceholder="Enter test title"
              />

              <StepsEditor
                rawSteps={testCase.fields['Microsoft.VSTS.TCM.Steps']}
                onChange={setEditSteps}
                errors={editValidationErrors.filter((e) => e.toLowerCase().includes('step'))}
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

      {showUnsavedConfirm && (
        <div className="steps-editor__confirm-overlay" role="dialog" aria-modal="true" aria-label="Unsaved edit changes">
          <button
            type="button"
            className="steps-editor__confirm-backdrop"
            onClick={keepEditing}
            aria-label="Close unsaved changes confirmation"
          />
          <div className="steps-editor__confirm-card steps-editor__confirm-card--warning" role="document">
            <div className="steps-editor__confirm-head">
              <div>
                <p className="steps-editor__confirm-kicker steps-editor__confirm-kicker--warning">Unsaved changes</p>
                <h3 className="steps-editor__confirm-title steps-editor__confirm-title--warning">
                  Discard edits on this test case?
                </h3>
              </div>
              <button
                type="button"
                className="steps-editor__confirm-close"
                onClick={keepEditing}
                aria-label="Close unsaved changes confirmation"
                title="Close"
              >
                <IconX size={16} />
              </button>
            </div>

            <p className="steps-editor__confirm-copy">
              {pendingExitAction === 'window-close'
                ? 'You have unsaved changes in edit mode. Closing the app now will discard your updates to the title, fields, and steps.'
                : 'You have unsaved changes in edit mode. Discarding now will remove your updates to the title, fields, and steps.'}
            </p>

            <div className="steps-editor__confirm-actions">
              <button type="button" className="btn btn--secondary btn--sm" onClick={keepEditing}>
                Keep editing
              </button>
              <button type="button" className="btn btn--danger btn--sm" onClick={discardEditChanges}>
                {pendingExitAction === 'window-close' ? 'Close without saving' : 'Discard changes'}
              </button>
            </div>
          </div>
        </div>
      )}

    </>
  );

  if (embedded) return content;

  return (
    <MainLayout title="Test Case Detail" onSettingsClick={onSettingsClick}>
      <PageDetailLayout
        breadcrumbs={detailBreadcrumbs}
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
