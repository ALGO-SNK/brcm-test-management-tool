import { useState, useMemo, type ReactNode } from 'react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { ThemeContextProvider } from './context/ThemeContext';
import { useThemeContext } from './context/useThemeContext';
import { NotificationContextProvider } from './context/NotificationContext';
import { Toast } from './components/Common/Toast';
import { Landing } from './components/pages/Landing';
import { TestCaseList } from './components/pages/TestCaseList';
import { HelpGuide } from './components/pages/HelpGuide';
import { WorkspaceSettings, type WorkspaceSettingsValues } from './components/pages/WorkspaceSettings';
import type { ADOTestPlan, ADOTestSuite, ADOTestCase } from './types';
import type { AppFontMode } from './context/themeContext.shared';

type PageType = 'landing' | 'cases' | 'detail' | 'settings' | 'help';
type ContentPage = 'landing' | 'cases' | 'detail';

const WORKSPACE_SETTINGS_KEY = 'workspace-settings';

function getInitialWorkspaceSettings(): WorkspaceSettingsValues {
  const fallback: WorkspaceSettingsValues = {
    organization: '',
    projectName: '',
    patToken: '',
    apiVersion: '7.1',
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

function resolveFontFamilies(font: AppFontMode): { body: string; display: string } {
  switch (font) {
    case 'droid-serif':
      return {
        body: '"Droid Serif", Georgia, serif',
        display: '"Droid Serif", Georgia, serif',
      };
    case 'georgia':
      return {
        body: 'Georgia, "Times New Roman", serif',
        display: 'Georgia, "Times New Roman", serif',
      };
    case 'helvetica':
      return {
        body: 'Helvetica, "Helvetica Neue", Arial, sans-serif',
        display: 'Helvetica, "Helvetica Neue", Arial, sans-serif',
      };
    case 'lucida':
      return {
        body: '"Lucida Grande", "Lucida Sans Unicode", "Lucida Sans", Geneva, Verdana, sans-serif',
        display: '"Lucida Grande", "Lucida Sans Unicode", "Lucida Sans", Geneva, Verdana, sans-serif',
      };
    case 'aptos-narrow':
      return {
        body: '"Aptos Narrow", "Segoe UI", sans-serif',
        display: '"Aptos Narrow", "Segoe UI", sans-serif',
      };
    case 'jetbrains-mono':
      return {
        body: '"JetBrains Mono", "Source Code Pro", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
        display: '"JetBrains Mono", "Source Code Pro", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
      };
    case 'source-code-pro':
      return {
        body: '"Source Code Pro", "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
        display: '"Source Code Pro", "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
      };
    case 'manrope':
      return {
        body: '"Manrope", "Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        display: '"Manrope", "Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      };
    case 'google-sans':
      return {
        body: '"Google Sans Text", "Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        display: '"Google Sans Text", "Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      };
    case 'montserrat':
      return {
        body: '"Montserrat", "Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        display: '"Montserrat", "Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      };
    case 'quicksand':
      return {
        body: '"Quicksand", "Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        display: '"Quicksand", "Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      };
    case 'inter':
    case 'system':
    default:
      return {
        body: '"Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        display: '"Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      };
  }
}

/* --------------------------------------------------------------------------
   MUI theme adapter
   Reads ThemeContext and builds a matching MUI palette so MUI Paper/Card
   surfaces switch correctly alongside the CSS-variable-based theme.
   -------------------------------------------------------------------------- */
function MuiThemeAdapter({ children }: { children: ReactNode }) {
  const { mode, font } = useThemeContext();
  const fontFamilies = resolveFontFamilies(font);

  const muiTheme = useMemo(() => {
    const isLight        = mode === 'light';
    const isPaper        = mode === 'paper';
    const isHighContrast = mode === 'high-contrast';
    // const muiMode        = (isLight || isPaper) ? 'light' : 'dark';

    return createTheme({
      palette: {
        // mode: muiMode,
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
        fontFamily: fontFamilies.body,
        h1: { fontFamily: fontFamilies.display },
        h2: { fontFamily: fontFamilies.display },
        h3: { fontFamily: fontFamilies.display },
        h4: { fontFamily: fontFamilies.display },
        h5: { fontFamily: fontFamilies.display },
        h6: { fontFamily: fontFamilies.display },
        fontSize: 14,
      },
      shape: { borderRadius: 10 },
      components: {
        MuiPaper: { styleOverrides: { root: { backgroundImage: 'none' } } },
      },
    });
  }, [mode, font]);

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
  const [selectedSuitePath, setSelectedSuitePath] = useState<ADOTestSuite[]>([]);
  const [selectedCase, setSelectedCase]   = useState<ADOTestCase | null>(null);
  const [planSuiteCreateRequest, setPlanSuiteCreateRequest] = useState(0);
  const [workspaceSettings, setWorkspaceSettings] =
    useState<WorkspaceSettingsValues>(getInitialWorkspaceSettings);

  const handleSelectPlan = (plan: ADOTestPlan) => {
    setSelectedPlan(plan);
    setCurrentPage('cases');
    setSelectedSuite(null);
    setSelectedSuitePath([]);
    setSelectedCase(null);
    setPlanSuiteCreateRequest(0);
  };
  const handleCreateSuiteForPlan = (plan: ADOTestPlan) => {
    setSelectedPlan(plan);
    setCurrentPage('cases');
    setSelectedSuite(null);
    setSelectedSuitePath([]);
    setSelectedCase(null);
    setPlanSuiteCreateRequest((value) => value + 1);
  };
  const handleSelectSuite = (suite: ADOTestSuite, path: ADOTestSuite[] = [suite]) => {
    setSelectedSuite(suite);
    setSelectedSuitePath(path);
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
    setSelectedSuitePath([]);
    setSelectedCase(null);
  };
  const handleBackToCases = () => {
    setCurrentPage('cases');
    setSelectedCase(null);
  };
  const handleSettingsClick = () => {
    if (currentPage !== 'settings' && currentPage !== 'help') {
      setPreviousPage(currentPage as ContentPage);
    }
    setCurrentPage('settings');
  };
  const handleHelpClick = () => {
    if (currentPage !== 'settings' && currentPage !== 'help') {
      setPreviousPage(currentPage as ContentPage);
    }
    setCurrentPage('help');
  };
  const handleBackFromSettings = () => setCurrentPage(previousPage);
  const handleBackFromHelp = () => setCurrentPage(previousPage);
  const handleSaveWorkspaceSettings = (values: WorkspaceSettingsValues) => {
    setWorkspaceSettings(values);
    localStorage.setItem(WORKSPACE_SETTINGS_KEY, JSON.stringify(values));
  };

  const isSettingsOpen = currentPage === 'settings';
  const isHelpOpen = currentPage === 'help';
  const activeContentPage: ContentPage = (isSettingsOpen || isHelpOpen)
    ? previousPage
    : (currentPage as ContentPage);

  return (
    <ThemeContextProvider>
      <MuiThemeAdapter>
        <NotificationContextProvider>
          <Toast />

          {activeContentPage === 'landing' && (
            <Landing
              onSelectPlan={handleSelectPlan}
              onCreateSuiteForPlan={handleCreateSuiteForPlan}
              onHelpClick={handleHelpClick}
              onSettingsClick={handleSettingsClick}
              workspaceSettings={workspaceSettings}
            />
          )}

          {(activeContentPage === 'cases' || activeContentPage === 'detail') && selectedPlan && (
            <TestCaseList
              plan={selectedPlan}
              suite={selectedSuite}
              suitePath={selectedSuitePath}
              selectedCase={selectedCase}
              onSelectSuite={handleSelectSuite}
              onSelectCase={handleSelectCase}
              onBackToCases={handleBackToCases}
              onBackToPlan={handleBackToPlan}
              onHelpClick={handleHelpClick}
              onSettingsClick={handleSettingsClick}
              workspaceSettings={workspaceSettings}
              createPlanSuiteRequest={planSuiteCreateRequest}
            />
          )}

          {isSettingsOpen && (
            <WorkspaceSettings
              values={workspaceSettings}
              onSave={handleSaveWorkspaceSettings}
              onBack={handleBackFromSettings}
            />
          )}

          {isHelpOpen && (
            <HelpGuide onBack={handleBackFromHelp} />
          )}
        </NotificationContextProvider>
      </MuiThemeAdapter>
    </ThemeContextProvider>
  );
}

export default App;
