import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { Header } from '../layouts/Header';
import { PlansList, type ConnectionStatus } from '../TestPlans/PlansList';
import { DbUpdaterModal } from '../DbUpdater/DbUpdaterModal';
import { SeleniumRepoBrowserModal } from '../TestCases/SeleniumRepoBrowserModal';
import type { WorkspaceSettingsValues } from './WorkspaceSettings';
import { IconDatabase, IconSchedule, IconMoreHoriz } from '../Common/Icons';
import type { ADOTestPlan } from '../../types';
import { ScheduleRunWorkspace } from './ScheduleRunWorkspace';
import { ScheduleRunHistoryPage } from './ScheduleRunHistoryPage';
import { ActionCatalogPanel } from '../ActionCatalogPanel';

export type MainWorkspaceSection = 'plans' | 'schedule-run' | 'automation-repo' | 'db-manager' | 'schedule-history';

interface MainWorkspaceProps {
  section: MainWorkspaceSection;
  onSectionChange: (section: MainWorkspaceSection) => void;
  workspaceSettings: WorkspaceSettingsValues;
  onSaveWorkspaceSettings: (values: WorkspaceSettingsValues) => void;
  onSelectPlan: (plan: ADOTestPlan) => void;
  onCreateSuiteForPlan: (plan: ADOTestPlan) => void;
  onAutomationRepoClick: () => void;
  onSettingsClick: () => void;
  onHelpClick: () => void;
}

interface WorkspaceNavItem {
  id: MainWorkspaceSection;
  title: string;
  icon: ReactNode;
}

const WORKSPACE_NAV_ITEMS: WorkspaceNavItem[] = [
  {
    id: 'plans',
    title: 'Plans',
    icon: <span className="material-symbols" aria-hidden="true">list_alt</span>,
  },
  {
    id: 'schedule-run',
    title: 'Schedule Run',
    icon: <IconSchedule size={16} />,
  },
  {
    id: 'schedule-history',
    title: 'Run History',
    icon: <span className="material-symbols" aria-hidden="true">history</span>,
  },
  {
    id: 'db-manager',
    title: 'Database Manager',
    icon: <IconDatabase size={16} />,
  },
];

function getConnectionMeta(status: ConnectionStatus) {
  if (status === 'connected') {
    return { label: 'Connected', dotClass: 'dot--green' };
  }
  if (status === 'cached') {
    return { label: 'Cached', dotClass: 'dot--yellow' };
  }
  if (status === 'disconnected') {
    return { label: 'Disconnected', dotClass: 'dot--red' };
  }
  return { label: 'Checking', dotClass: 'dot--blue' };
}

export function MainWorkspace({
  section,
  onSectionChange,
  workspaceSettings,
  onSelectPlan,
  onCreateSuiteForPlan,
  onAutomationRepoClick,
  onSettingsClick,
  onHelpClick,
}: MainWorkspaceProps) {
  const [planCount, setPlanCount] = useState(0);
  const [planRefreshToken, setPlanRefreshToken] = useState(0);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('checking');
  const [showActionCatalog, setShowActionCatalog] = useState(false);
  const projectName = workspaceSettings.projectName.trim() || 'Azure Test Plans';
  const connectionMeta = useMemo(() => getConnectionMeta(connectionStatus), [connectionStatus]);
  const seleniumRepoPath = workspaceSettings.seleniumRepoPath.trim();
  const handleRefreshPlans = useCallback(() => {
    setPlanRefreshToken((current) => current + 1);
  }, []);

  // useCallback critical here — PlansList's effect has these in its dep array.
  // Without stable refs, the effect would refire every render, causing an API
  // call loop (especially noticeable when clicking refresh).
  const handlePlansLoaded = useCallback((plans: ADOTestPlan[]) => {
    setPlanCount(plans.length);
  }, []);

  const handleConnectionStatusChange = useCallback((status: ConnectionStatus) => {
    setConnectionStatus(status);
  }, []);

  const plansView = (
    <div className="plans-view-container">
      <section className="workspace-hub__plans-panel">
        <div className="settings-panel__head workspace-hub__plans-head">
          <div>
            <div className="suite-main-heading">
              <h2>Plans</h2>
            </div>
            <p className="settings-panel__sub">Choose a plan to open suite tree and test table view.</p>
          </div>
          <div className="workspace-hub__plans-meta">
            <span className="meta-pill">
              <span className={`dot ${connectionMeta.dotClass}`} />
              <span>{connectionMeta.label}</span>
            </span>
            <span className="meta-pill">{planCount} plans</span>
            <button
              className="btn btn--secondary btn--sm"
              onClick={() => setShowActionCatalog(!showActionCatalog)}
              title="Toggle action catalog"
            >
              <IconMoreHoriz size={16} />
              {showActionCatalog ? 'Hide' : 'Actions'}
            </button>
          </div>
        </div>
        <div className="workspace-hub__plans-body">
          <PlansList
            onSelectPlan={onSelectPlan}
            onCreateSuiteForPlan={onCreateSuiteForPlan}
            workspaceSettings={workspaceSettings}
            onPlansLoaded={handlePlansLoaded}
            onConnectionStatusChange={handleConnectionStatusChange}
            onRefreshPlans={handleRefreshPlans}
            refreshToken={planRefreshToken}
          />
        </div>
      </section>
      {showActionCatalog && (
        <ActionCatalogPanel onClose={() => setShowActionCatalog(false)} />
      )}
    </div>
  );

  const scheduleRunView = (
    <ScheduleRunWorkspace workspaceSettings={workspaceSettings} />
  );

  const content = (() => {
    if (section === 'plans') {
      return plansView;
    }
    if (section === 'schedule-run') {
      return scheduleRunView;
    }
    if (section === 'schedule-history') {
      return <ScheduleRunHistoryPage />;
    }
    if (section === 'db-manager') {
      return <DbUpdaterModal workspaceSettings={workspaceSettings} onClose={() => onSectionChange('plans')} embedded />;
    }
    if (!seleniumRepoPath) {
      return (
        <section className="settings-panel workspace-hub__empty">
          <div className="settings-panel__head">
            <h2 className="settings-panel__title">Automation Repo</h2>
            <p className="settings-panel__sub">Set Selenium repo folder in Workspace Manager to browse scripts here.</p>
          </div>
          <div className="empty-state">
            <p className="empty-state__desc">Open Workspace Manager and configure Selenium repo path first.</p>
            <div className="empty-state__actions">
              <button
                type="button"
                className="btn btn--primary btn--sm"
                onClick={onSettingsClick}
              >
                Open Workspace Manager
              </button>
            </div>
          </div>
        </section>
      );
    }
    return <SeleniumRepoBrowserModal repoPath={seleniumRepoPath} onClose={() => onSectionChange('plans')} embedded workspaceSettings={workspaceSettings} />;
  })();

  return (
    <div className="app-shell">
      <Header
        title={projectName}
        onAutomationRepoClick={onAutomationRepoClick}
        onSettingsClick={onSettingsClick}
        onHelpClick={onHelpClick}
      />
      <main className="app-main app-main--scroll">
        <div className="split-pane split-pane--workspace">
          <aside className="split-pane__sidebar split-pane__sidebar--workspace">
            <div className="workspace-hub__nav-shell">
              <nav className="workspace-hub__nav" aria-label="Main workspace sections">
                {WORKSPACE_NAV_ITEMS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`settings-nav-item${section === item.id ? ' is-active' : ''}`}
                    onClick={() => onSectionChange(item.id)}
                    title={item.title}
                  >
                    <span className="workspace-hub__nav-icon">{item.icon}</span>
                    <span className="workspace-hub__nav-copy">
                      <span className="settings-nav-item__title">{item.title}</span>
                    </span>
                  </button>
                ))}
              </nav>
            </div>
          </aside>
          <section className="split-pane__main split-pane__main--workspace">
            <div className="split-pane__content workspace-hub__content">
              {content}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
