import { useState, useMemo, type ReactNode } from 'react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { ThemeContextProvider } from './context/ThemeContext';
import { useThemeContext } from './context/useThemeContext';
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

/* --------------------------------------------------------------------------
   MUI theme adapter
   Reads ThemeContext and builds a matching MUI palette so MUI Paper/Card
   surfaces switch correctly alongside the CSS-variable-based theme.
   -------------------------------------------------------------------------- */
function MuiThemeAdapter({ children }: { children: ReactNode }) {
  const { mode } = useThemeContext();

  const muiTheme = useMemo(() => {
    const isLight        = mode === 'light';
    const isPaper        = mode === 'paper';
    const isHighContrast = mode === 'high-contrast';
    const muiMode        = (isLight || isPaper) ? 'light' : 'dark';

    return createTheme({
      palette: {
        mode: muiMode,
        primary:   { main: '#1a237e', light: '#3949ab', dark: '#0d47a1', contrastText: '#ffffff' },
        secondary: { main: '#004d40', light: '#00695c', dark: '#00251a', contrastText: '#ffffff' },
        error:     { main: '#bf360c' },
        warning:   { main: '#bf360c' },
        success:   { main: '#1b5e20' },
        info:      { main: '#01579b' },
        background: isLight
          ? { default: '#f7f7f7',  paper: '#ffffff' }
          : isPaper
          ? { default: '#f5f5f2',  paper: '#fffdf8' }
          : isHighContrast
          ? { default: '#000000',  paper: '#050505' }
          : { default: '#000000',  paper: '#111111' },
        text: isLight
          ? { primary: '#1f1f1f',  secondary: '#4f4f4f' }
          : isPaper
          ? { primary: '#1e1e1e',  secondary: '#555555' }
          : isHighContrast
          ? { primary: '#ffffff',  secondary: '#f0f0f0' }
          : { primary: '#e8e8e8',  secondary: '#bdbdbd' },
        divider: isLight ? '#d8d8d8' : isPaper ? '#d8d5cc' : isHighContrast ? '#8a8a8a' : '#3a3a3a',
      },
      typography: {
        fontFamily: '"IBM Plex Mono", "JetBrains Mono", "Roboto Mono", ui-monospace, monospace',
        fontSize: 14,
      },
      shape: { borderRadius: 10 },
      components: {
        MuiPaper: { styleOverrides: { root: { backgroundImage: 'none' } } },
      },
    });
  }, [mode]);

  return (
    <ThemeProvider theme={muiTheme}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  );
}

/* --------------------------------------------------------------------------
   App root
   -------------------------------------------------------------------------- */
export function App() {
  const [currentPage, setCurrentPage]     = useState<PageType>('landing');
  const [previousPage, setPreviousPage]   = useState<ContentPage>('landing');
  const [selectedPlan, setSelectedPlan]   = useState<ADOTestPlan | null>(null);
  const [selectedSuite, setSelectedSuite] = useState<ADOTestSuite | null>(null);
  const [selectedCase, setSelectedCase]   = useState<ADOTestCase | null>(null);
  const [workspaceSettings, setWorkspaceSettings] =
    useState<WorkspaceSettingsValues>(getInitialWorkspaceSettings);

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
    if (currentPage !== 'settings') setPreviousPage(currentPage as ContentPage);
    setCurrentPage('settings');
  };
  const handleBackFromSettings = () => setCurrentPage(previousPage);
  const handleSaveWorkspaceSettings = (values: WorkspaceSettingsValues) => {
    setWorkspaceSettings(values);
    localStorage.setItem(WORKSPACE_SETTINGS_KEY, JSON.stringify(values));
  };

  const isSettingsOpen = currentPage === 'settings';
  const activeContentPage: ContentPage = isSettingsOpen ? previousPage : (currentPage as ContentPage);

  return (
    <ThemeContextProvider>
      <MuiThemeAdapter>
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
      </MuiThemeAdapter>
    </ThemeContextProvider>
  );
}

export default App;
