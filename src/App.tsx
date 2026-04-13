import { useState } from 'react';
import { ThemeContextProvider } from './context/ThemeContext';
import { NotificationContextProvider } from './context/NotificationContext';
import { Toast } from './components/Common/Toast';
import { Landing } from './components/pages/Landing';
import { TestCaseList } from './components/pages/TestCaseList';
import { WorkspaceSettings, type WorkspaceSettingsValues } from './components/pages/WorkspaceSettings';
import type { ADOTestPlan, ADOTestSuite, ADOTestCase } from './types';

type PageType = 'landing' | 'cases' | 'detail' | 'settings';
type ContentPage = 'landing' | 'cases' | 'detail';

const WORKSPACE_SETTINGS_KEY = 'workspace-settings';

function getInitialWorkspaceSettings(): WorkspaceSettingsValues {
  const fallback: WorkspaceSettingsValues = {
    organization: '',
    projectName: '',
    patToken: '',
    apiVersion: '7.2',
  };

  try {
    const raw = localStorage.getItem(WORKSPACE_SETTINGS_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<WorkspaceSettingsValues> & { organizationUrl?: string };
    return {
      ...fallback,
      ...parsed,
      organization: parsed.organization ?? parsed.organizationUrl ?? fallback.organization,
    };
  } catch {
    return fallback;
  }
}

export function App() {
  const [currentPage, setCurrentPage] = useState<PageType>('landing');
  const [previousPage, setPreviousPage] = useState<ContentPage>('landing');
  const [selectedPlan, setSelectedPlan] = useState<ADOTestPlan | null>(null);
  const [selectedSuite, setSelectedSuite] = useState<ADOTestSuite | null>(null);
  const [selectedCase, setSelectedCase] = useState<ADOTestCase | null>(null);
  const [workspaceSettings, setWorkspaceSettings] = useState<WorkspaceSettingsValues>(getInitialWorkspaceSettings);

  const handleSelectPlan = (plan: ADOTestPlan) => {
    setSelectedPlan(plan);
    setCurrentPage('cases');
    setSelectedSuite(null);
    setSelectedCase(null);
  };

  const handleSelectSuite = (suite: ADOTestSuite) => {
    setSelectedSuite(suite);
    setSelectedCase(null);
  };

  const handleSelectCase = (testCase: ADOTestCase) => {
    setSelectedCase(testCase);
    setCurrentPage('detail');
  };

  const handleBackToPlan = () => {
    setCurrentPage('landing');
    setSelectedPlan(null);
    setSelectedSuite(null);
    setSelectedCase(null);
  };

  const handleBackToCases = () => {
    setCurrentPage('cases');
    setSelectedCase(null);
  };

  const handleSettingsClick = () => {
    if (currentPage !== 'settings') {
      setPreviousPage(currentPage as ContentPage);
    }
    setCurrentPage('settings');
  };

  const handleBackFromSettings = () => {
    setCurrentPage(previousPage);
  };

  const handleSaveWorkspaceSettings = (values: WorkspaceSettingsValues) => {
    setWorkspaceSettings(values);
    localStorage.setItem(WORKSPACE_SETTINGS_KEY, JSON.stringify(values));
  };

  const isSettingsOpen = currentPage === 'settings';
  const activeContentPage: ContentPage = isSettingsOpen ? previousPage : (currentPage as ContentPage);

  return (
    <ThemeContextProvider>
      <NotificationContextProvider>
        <Toast />

        {activeContentPage === 'landing' && (
          <Landing
            onSelectPlan={handleSelectPlan}
            onSettingsClick={handleSettingsClick}
            workspaceSettings={workspaceSettings}
          />
        )}

        {(activeContentPage === 'cases' || activeContentPage === 'detail') && selectedPlan && (
          <TestCaseList
            plan={selectedPlan}
            suite={selectedSuite}
            selectedCase={selectedCase}
            onSelectSuite={handleSelectSuite}
            onSelectCase={handleSelectCase}
            onBackToCases={handleBackToCases}
            onBackToPlan={handleBackToPlan}
            onSettingsClick={handleSettingsClick}
            workspaceSettings={workspaceSettings}
          />
        )}

        {isSettingsOpen && (
          <WorkspaceSettings
            values={workspaceSettings}
            onSave={handleSaveWorkspaceSettings}
            onBack={handleBackFromSettings}
          />
        )}
      </NotificationContextProvider>
    </ThemeContextProvider>
  );
}

export default App;
