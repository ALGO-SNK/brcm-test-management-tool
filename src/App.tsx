import {useEffect, useMemo, useState, type ReactNode} from 'react';
import {ThemeProvider, createTheme} from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import {ThemeContextProvider} from './context/ThemeContext';
import {useThemeContext} from './context/useThemeContext';
import {NotificationContextProvider} from './context/NotificationContext';
import {Toast} from './components/Common/Toast';
import {TestCaseList} from './components/pages/TestCaseList';
import {HelpGuide} from './components/pages/HelpGuide';
import {MainWorkspace, type MainWorkspaceSection} from './components/pages/MainWorkspace';
import {SeleniumRepoBrowserModal} from './components/TestCases/SeleniumRepoBrowserModal';
import {AppScheduler} from './components/AppScheduler';
import {
    DEFAULT_DB_MAPPINGS,
    WorkspaceSettings,
    normalizeWorkspaceDbMappings,
    type WorkspaceSettingsValues,
} from './components/pages/WorkspaceSettings';
import type {ADOTestPlan, ADOTestSuite, ADOTestCase} from './types';
import type {AppFontMode} from './context/themeContext.shared';

type PageType = 'landing' | 'cases' | 'detail' | 'settings' | 'help';
type ContentPage = 'landing' | 'cases' | 'detail';

const WORKSPACE_SETTINGS_KEY = 'workspace-settings';

const FALLBACK_WORKSPACE_SETTINGS: WorkspaceSettingsValues = {
    organization: '',
    projectName: '',
    patToken: '',
    apiVersion: '7.1',
    seleniumRepoPath: '',
    dbDirectory: 'C:\\Automation Tests\\Database',
    mainDbName: 'BromcomTestCases.db',
    worldPayDbName: 'BromcomWorldPayTestCases.db',
    dbMappings: DEFAULT_DB_MAPPINGS,
    testRunWorkingDirectory: '',
    testRunProjectPath: 'BromCom.Tests\\BromCom.Tests.csproj',
    testRunSettingsPath: 'BromCom.Tests\\Bromcom.runsettings',
    testRunLogger: 'console;verbosity=detailed',
    testRunUsePatAsEnv: true,
    schedulerEnabled: true,
    schedulerTimezone: 'Asia/Kolkata',
    schedulerPollSeconds: 30,
    schedulerDefaultCron: '0 0 1 * * *',
    schedulerDefaultMode: 'nightly_full',
    schedulerDefaultBatchSize: 10,
    schedulerMaxHistoryRows: 500,
    schedulerPointBatchSize: 15,
    schedulerBuildDefinitionId: 762,
    schedulerDefaultConfigurationId: 33,
    schedulerDefaultPointConfigurationId: 33,
    schedulerReleaseDefinitionFolder: 'Overnight CDs A, Overnight CDs B',
    schedulerExcludedReleaseDefinitionIdsCsv: '24, 25',
    schedulerWorldPayRegressionBranch: 'refs/heads/regression_worldpay',
    schedulerWorldPayKanbanBranch: 'refs/heads/kanban_worldpay',
    schedulerSagePayTestPlanId: 78806,
    schedulerWorldPayTestPlanId: 139145,
    schedulerEnabledPlanIds: [78806, 139145],
    schedulerMappingWorkItemIds: '136838,147829',
    schedulerRequireSuiteMapping: true,
    schedulerArtifactAlias: '_Automated Testing Framework-ASP.NET Core-CI',
    schedulerManualEnvironmentsCsv: 'Test Run Execute',
    schedulerExcludedSuiteIdsCsv: '209484, 144095, 144094',
    schedulerExcludedSuiteNamePatterns: 'initial,intial',
};

function mergeWorkspaceSettings(
    parsed: Partial<WorkspaceSettingsValues> & { organizationUrl?: string },
): WorkspaceSettingsValues {
    const nextSettings = {
        ...FALLBACK_WORKSPACE_SETTINGS,
        ...parsed,
        organization:
            parsed.organization ?? parsed.organizationUrl ?? FALLBACK_WORKSPACE_SETTINGS.organization,
    };
    return {
        ...nextSettings,
        dbMappings: normalizeWorkspaceDbMappings(nextSettings),
    };
}

// Synchronous first-paint value: localStorage cache, else hard-coded fallback.
// The authoritative DB-backed values load asynchronously after mount.
function getInitialWorkspaceSettings(): WorkspaceSettingsValues {
    try {
        const raw = localStorage.getItem(WORKSPACE_SETTINGS_KEY);
        if (!raw) return FALLBACK_WORKSPACE_SETTINGS;
        return mergeWorkspaceSettings(
            JSON.parse(raw) as Partial<WorkspaceSettingsValues> & { organizationUrl?: string },
        );
    } catch {
        return FALLBACK_WORKSPACE_SETTINGS;
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
function MuiThemeAdapter({children}: { children: ReactNode }) {
    const {mode, font} = useThemeContext();
    const fontFamilies = resolveFontFamilies(font);

    const muiTheme = useMemo(() => {
        const isLight = mode === 'light';
        const isPaper = mode === 'paper';
        const isHighContrast = mode === 'high-contrast';
        // const muiMode        = (isLight || isPaper) ? 'light' : 'dark';

        return createTheme({
            palette: {
                // mode: muiMode,
                primary: {main: '#1a237e', light: '#3949ab', dark: '#0d47a1', contrastText: '#ffffff'},
                secondary: {main: '#004d40', light: '#00695c', dark: '#00251a', contrastText: '#ffffff'},
                error: {main: '#bf360c'},
                warning: {main: '#bf360c'},
                success: {main: '#1b5e20'},
                info: {main: '#01579b'},
                /*background: isLight
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
                divider: isLight ? '#d8d8d8' : isPaper ? '#d8d5cc' : isHighContrast ? '#8a8a8a' : '#3a3a3a',*/
                background: isLight
                    ? {
                        default: '#f9f6f1', // Spring Wood
                        paper: '#ffffff',
                    }
                    : isPaper
                        ? {
                            default: '#eae6e6', // Ebb
                            paper: '#fffdf8',
                        }
                        : isHighContrast
                            ? {
                                default: '#000000',
                                paper: '#050505',
                            }
                            : {
                                default: '#000000',
                                paper: '#111111',
                            },

                text: isLight
                    ? {
                        primary: '#2a1f2f',
                        secondary: '#5e4861',
                    }
                    : isPaper
                        ? {
                            primary: '#1f1f2d',
                            secondary: '#5f5a55',
                        }
                        : isHighContrast
                            ? {
                                primary: '#ffffff',
                                secondary: '#f0f0f0',
                            }
                            : {
                                primary: '#e8e8e8',
                                secondary: '#bdbdbd',
                            },

                divider: isLight
                    ? '#c8bcc2' // Pale Slate
                    : isPaper
                        ? '#dad1c8' // Swirl
                        : isHighContrast
                            ? '#8a8a8a'
                            : '#3a3a3a',
            },
            typography: {
                fontFamily: fontFamilies.body,
                h1: {fontFamily: fontFamilies.display},
                h2: {fontFamily: fontFamilies.display},
                h3: {fontFamily: fontFamilies.display},
                h4: {fontFamily: fontFamilies.display},
                h5: {fontFamily: fontFamilies.display},
                h6: {fontFamily: fontFamilies.display},
                fontSize: 14,
            },
            shape: {borderRadius: 10},
            components: {
                MuiPaper: {styleOverrides: {root: {backgroundImage: 'none'}}},
            },
        });
    }, [mode, font]);

    return (
        <ThemeProvider theme={muiTheme}>
            <CssBaseline/>
            {children}
        </ThemeProvider>
    );
}

/* --------------------------------------------------------------------------
   App root
   -------------------------------------------------------------------------- */
export function App() {
    const [currentPage, setCurrentPage] = useState<PageType>('landing');
    const [previousPage, setPreviousPage] = useState<ContentPage>('landing');
    const [mainSection, setMainSection] = useState<MainWorkspaceSection>('plans');
    const [selectedPlan, setSelectedPlan] = useState<ADOTestPlan | null>(null);
    const [selectedSuite, setSelectedSuite] = useState<ADOTestSuite | null>(null);
    const [selectedSuitePath, setSelectedSuitePath] = useState<ADOTestSuite[]>([]);
    const [selectedCase, setSelectedCase] = useState<ADOTestCase | null>(null);
    const [planSuiteCreateRequest, setPlanSuiteCreateRequest] = useState(0);
    const [workspaceSettings, setWorkspaceSettings] =
        useState<WorkspaceSettingsValues>(getInitialWorkspaceSettings);
    const [isAutomationRepoModalOpen, setIsAutomationRepoModalOpen] = useState(false);

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
    const handleAutomationRepoClick = () => {
        if (!workspaceSettings.seleniumRepoPath.trim()) {
            handleSettingsClick();
            return;
        }
        setIsAutomationRepoModalOpen(true);
    };
    const handleBackFromSettings = () => setCurrentPage(previousPage);
    const handleBackFromHelp = () => setCurrentPage(previousPage);
    const handleSaveWorkspaceSettings = (values: WorkspaceSettingsValues) => {
        setWorkspaceSettings(values);
        localStorage.setItem(WORKSPACE_SETTINGS_KEY, JSON.stringify(values));
        // Persist to the DB layer; this flips is_user_modified = 1 so factory
        // defaults never overwrite the user's saved values on a version update.
        void window.desktop?.setConfig?.('workspace.settings', values).catch(() => {
            // Ignore optional desktop bridge failures (e.g. web build).
        });
    };

    // Authoritative load: pull workspace settings from the DB once on mount and
    // merge over the synchronous localStorage/fallback value used for first paint.
    useEffect(() => {
        if (!window.desktop?.getConfig) {
            return;
        }
        let cancelled = false;
        void window.desktop
            .getConfig()
            .then((config) => {
                if (cancelled) return;
                const stored = config?.['workspace.settings'];
                if (!stored) return;
                const parsed =
                    typeof stored === 'string'
                        ? (JSON.parse(stored) as Partial<WorkspaceSettingsValues>)
                        : (stored as Partial<WorkspaceSettingsValues>);
                const merged = mergeWorkspaceSettings(parsed);
                setWorkspaceSettings(merged);
                localStorage.setItem(WORKSPACE_SETTINGS_KEY, JSON.stringify(merged));
            })
            .catch(() => {
                // Keep the localStorage/fallback value if the DB read fails.
            });
        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        if (!window.desktop?.syncSchedulerConfig) {
            return;
        }
        void window.desktop.syncSchedulerConfig({
            enabled: workspaceSettings.schedulerEnabled,
            timezone: workspaceSettings.schedulerTimezone,
            pollSeconds: workspaceSettings.schedulerPollSeconds,
            defaultCron: workspaceSettings.schedulerDefaultCron,
            defaultMode: workspaceSettings.schedulerDefaultMode,
            defaultBatchSize: workspaceSettings.schedulerDefaultBatchSize,
            maxHistoryRows: workspaceSettings.schedulerMaxHistoryRows,
        }).catch(() => {
            // Ignore optional desktop bridge failures.
        });
    }, [workspaceSettings]);


    const isSettingsOpen = currentPage === 'settings';
    const isHelpOpen = currentPage === 'help';
    const activeContentPage: ContentPage = (isSettingsOpen || isHelpOpen)
        ? previousPage
        : (currentPage as ContentPage);

    return (
        <ThemeContextProvider>
            <MuiThemeAdapter>
                <NotificationContextProvider>
                    <Toast/>
                    <AppScheduler workspaceSettings={workspaceSettings} />

                    {activeContentPage === 'landing' && (
                        <MainWorkspace
                            section={mainSection}
                            onSectionChange={setMainSection}
                            workspaceSettings={workspaceSettings}
                            onSaveWorkspaceSettings={handleSaveWorkspaceSettings}
                            onSelectPlan={handleSelectPlan}
                            onCreateSuiteForPlan={handleCreateSuiteForPlan}
                            onAutomationRepoClick={handleAutomationRepoClick}
                            onSettingsClick={handleSettingsClick}
                            onHelpClick={handleHelpClick}
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
                            onAutomationRepoClick={handleAutomationRepoClick}
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
                        <HelpGuide onBack={handleBackFromHelp}/>
                    )}

                    {isAutomationRepoModalOpen && workspaceSettings.seleniumRepoPath.trim() && (
                        <SeleniumRepoBrowserModal
                            repoPath={workspaceSettings.seleniumRepoPath.trim()}
                            onClose={() => setIsAutomationRepoModalOpen(false)}
                            workspaceSettings={workspaceSettings}
                        />
                    )}


                </NotificationContextProvider>
            </MuiThemeAdapter>
        </ThemeContextProvider>
    );
}

export default App;
