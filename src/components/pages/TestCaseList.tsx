import { useState, useEffect, useCallback, useRef } from 'react';
import { Header } from '../layouts/Header';
import { SuiteTreePanel } from '../SuiteTree/SuiteTreePanel';
import { CaseTable } from '../TestCases/CaseTable';
import { TestCaseDetail } from './TestCaseDetail';
import { PageDetailLayout } from '../layouts/PageDetailLayout';
import type { ADOTestPlan, ADOTestSuite, ADOTestCase } from '../../types';
import type { WorkspaceSettingsValues } from './WorkspaceSettings';

interface TestCaseListProps {
  plan: ADOTestPlan;
  suite: ADOTestSuite | null;
  suitePath: ADOTestSuite[];
  selectedCase: ADOTestCase | null;
  onSelectSuite: (suite: ADOTestSuite, path: ADOTestSuite[]) => void;
  onSelectCase: (testCase: ADOTestCase) => void;
  onBackToCases: () => void;
  onBackToPlan: () => void;
  onHelpClick: () => void;
  onSettingsClick: () => void;
  workspaceSettings: WorkspaceSettingsValues;
  createPlanSuiteRequest?: number;
}

const MIN_SIDEBAR = 220;
const MAX_SIDEBAR_RATIO = 0.5;
const DEFAULT_SIDEBAR = 300;

export function TestCaseList({
  plan,
  suite,
  suitePath,
  selectedCase,
  onSelectSuite,
  onSelectCase,
  onBackToCases,
  onBackToPlan,
  onHelpClick,
  onSettingsClick,
  workspaceSettings,
  createPlanSuiteRequest = 0,
}: TestCaseListProps) {
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_SIDEBAR);
  const [isDragging, setIsDragging] = useState(false);
  const [suiteCaseCountBySuiteId, setSuiteCaseCountBySuiteId] = useState<Record<number, number>>({});
  const [isCreateMode, setIsCreateMode] = useState(false);
  const dragging = useRef(false);
  const preserveCreateModeOnSuiteChangeRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = useCallback(() => {
    dragging.current = true;
    setIsDragging(true);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!dragging.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const newWidth = Math.min(
        Math.max(e.clientX - rect.left, MIN_SIDEBAR),
        rect.width * MAX_SIDEBAR_RATIO,
      );
      setSidebarWidth(newWidth);
    };

    const handleMouseUp = () => {
      if (dragging.current) {
        dragging.current = false;
        setIsDragging(false);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  useEffect(() => {
    if (!suite) return;
    if (preserveCreateModeOnSuiteChangeRef.current) {
      preserveCreateModeOnSuiteChangeRef.current = false;
      return;
    }
    setIsCreateMode(false);
  }, [suite?.id]);

  const handleAddTestCaseFromSuite = useCallback((targetSuite: ADOTestSuite, path: ADOTestSuite[]) => {
    preserveCreateModeOnSuiteChangeRef.current = true;
    onSelectSuite(targetSuite, path);
    setIsCreateMode(true);
  }, [onSelectSuite]);

  const currentSuiteCount = suite
    ? suiteCaseCountBySuiteId[suite.id] ?? (typeof suite.testCaseCount === 'number' ? suite.testCaseCount : null)
    : null;

  const planBreadcrumbLabel = plan.name.trim() || `Plan ${plan.id}`;
  const resolvedSuitePath = suitePath.length > 0
    ? suitePath
    : (suite ? [suite] : []);
  const breadcrumbSuitePath = selectedCase
    ? resolvedSuitePath
    : resolvedSuitePath.slice(0, -1);
  const breadcrumbs = [
    { label: 'Plans', onClick: onBackToPlan, isLink: true, title: 'Plans' },
    { label: planBreadcrumbLabel, onClick: onBackToPlan, isLink: true, title: planBreadcrumbLabel },
    ...breadcrumbSuitePath.map((pathSuite, index) => ({
      label: pathSuite.name,
      title: pathSuite.name,
      isLink: true,
      onClick: () => onSelectSuite(pathSuite, breadcrumbSuitePath.slice(0, index + 1)),
    })),
  ];

  return (
    <div className="app-shell">
      <Header title={plan.name} onHelpClick={onHelpClick} onSettingsClick={onSettingsClick} />

      <div className="split-pane" ref={containerRef}>
        {/* Sidebar */}
        <div className="split-pane__sidebar" style={{ width: sidebarWidth }}>
          <SuiteTreePanel
            plan={plan}
            selectedSuiteId={suite?.id ?? null}
            onSelectSuite={onSelectSuite}
            onAddTestCase={handleAddTestCaseFromSuite}
            onBackToPlan={onBackToPlan}
            workspaceSettings={workspaceSettings}
            createPlanSuiteRequest={createPlanSuiteRequest}
          />
        </div>

        {/* Drag handle */}
        <div
          className={`split-pane__handle${isDragging ? ' split-pane__handle--active' : ''}`}
          onMouseDown={handleMouseDown}
        />

        {/* Main content */}
        <div className="split-pane__main">
          <div className="split-pane__content" style={{ padding: sidebarWidth ? 'var(--space-5) clamp(10px, 1.8vw, 16px)' : '0' }}>
            {suite ? (
              <PageDetailLayout
                breadcrumbs={breadcrumbs}
                heading={{
                  title: selectedCase ? selectedCase.name : suite.name,
                  id: selectedCase ? selectedCase.id : suite.id,
                  count: selectedCase ? (
                    selectedCase.fields?.['Microsoft.VSTS.TCM.Steps']
                      ? (selectedCase.fields['Microsoft.VSTS.TCM.Steps'] as string).match(/Action=/g)?.length ?? 0
                      : 0
                  ) : currentSuiteCount ?? 0,
                  countLabel: selectedCase ? 'Steps' : 'Test Count',
                }}
              >
                {selectedCase ? (
                  <TestCaseDetail
                    plan={plan}
                    suite={suite}
                    caseId={selectedCase.id}
                    caseData={selectedCase}
                    workspaceSettings={workspaceSettings}
                    onBackToCases={onBackToCases}
                    onSettingsClick={onSettingsClick}
                    embedded
                  />
                ) : (
                  <CaseTable
                    planId={plan.id}
                    suiteId={suite.id}
                    suiteName={suite.name}
                    suiteTestCasesHref={suite._links?.testCases?.href}
                    suiteSelfHref={suite._links?.self?.href ?? suite._links?._self?.href}
                    workspaceSettings={workspaceSettings}
                    onSelectCase={onSelectCase}
                    onCaseCountChange={(count) => {
                      setSuiteCaseCountBySuiteId((prev) => {
                        if (prev[suite.id] === count) return prev;
                        return { ...prev, [suite.id]: count };
                      });
                    }}
                    onTestCaseCreated={(newCase) => {
                      // Update case count
                      setSuiteCaseCountBySuiteId((prev) => {
                        const current = prev[suite.id] ?? 0;
                        return { ...prev, [suite.id]: current + 1 };
                      });
                      // Navigate to the newly created case's detail view
                      onSelectCase(newCase);
                    }}
                    isCreateMode={isCreateMode}
                    onCreateModeChange={setIsCreateMode}
                  />
                )}
              </PageDetailLayout>
            ) : (
              <div className="cases-loading-state" aria-live="polite">
                <div className="mb-lg">
                  <h2 className="text-2xl font-semibold">Loading first suite...</h2>
                  <p className="text-sm text-secondary mt-xs">
                    Selecting the first available suite automatically.
                  </p>
                </div>
                <div className="suite-response-skeleton" aria-hidden="true">
                  <span className="skeleton skeleton--line" />
                  <span className="skeleton skeleton--line" />
                  <span className="skeleton skeleton--line skeleton--line-wide" />
                  <span className="skeleton skeleton--line" />
                  <span className="skeleton skeleton--line-sm" />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
