import { useMemo, useState, type ReactNode } from 'react';
import { Header } from '../layouts/Header';
import { PlansList, type ConnectionStatus } from '../TestPlans/PlansList';
import { DbUpdaterModal } from '../DbUpdater/DbUpdaterModal';
import { SeleniumRepoBrowserModal } from '../TestCases/SeleniumRepoBrowserModal';
import type { WorkspaceSettingsValues } from './WorkspaceSettings';
import { IconDatabase, IconFolderCode } from '../Common/Icons';
import type { ADOTestPlan } from '../../types';

export type MainWorkspaceSection = 'plans' | 'automation-repo' | 'db-manager';

interface MainWorkspaceProps {
  section: MainWorkspaceSection;
  onSectionChange: (section: MainWorkspaceSection) => void;
  workspaceSettings: WorkspaceSettingsValues;
  onSaveWorkspaceSettings: (values: WorkspaceSettingsValues) => void;
  onSelectPlan: (plan: ADOTestPlan) => void;
  onCreateSuiteForPlan: (plan: ADOTestPlan) => void;
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
    id: 'automation-repo',
    title: 'Automation Repo',
    icon: <IconFolderCode size={16} />,
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
  onSaveWorkspaceSettings,
  onSelectPlan,
  onCreateSuiteForPlan,
  onSettingsClick,
  onHelpClick,
}: MainWorkspaceProps) {
  const [planCount, setPlanCount] = useState(0);
  const [planRefreshToken, setPlanRefreshToken] = useState(0);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('checking');
  const projectName = workspaceSettings.projectName.trim() || 'Azure Test Plans';
  const connectionMeta = useMemo(() => getConnectionMeta(connectionStatus), [connectionStatus]);
  const seleniumRepoPath = workspaceSettings.seleniumRepoPath.trim();
  const handleRefreshPlans = () => {
    setPlanRefreshToken((current) => current + 1);
  };

  const plansView = (
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
        </div>
      </div>
      <div className="workspace-hub__plans-body">
        <PlansList
          onSelectPlan={onSelectPlan}
          onCreateSuiteForPlan={onCreateSuiteForPlan}
          workspaceSettings={workspaceSettings}
          onPlansLoaded={(plans) => setPlanCount(plans.length)}
          onConnectionStatusChange={setConnectionStatus}
          onRefreshPlans={handleRefreshPlans}
          refreshToken={planRefreshToken}
        />
      </div>
    </section>
  );

  const content = (() => {
    if (section === 'plans') {
      return plansView;
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
    return <SeleniumRepoBrowserModal repoPath={seleniumRepoPath} onClose={() => onSectionChange('plans')} embedded />;
  })();

  return (
    <div className="app-shell">
      <Header
        title={projectName}
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
