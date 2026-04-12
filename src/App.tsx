import { useState } from 'react';
import { CssBaseline } from '@mui/material';
import { ThemeContextProvider } from './context/ThemeContext';
import { NotificationContextProvider } from './context/NotificationContext';
import { Toast } from './components/Common/Toast';
import { Landing } from './components/pages/Landing';
import { TestCaseList } from './components/pages/TestCaseList';
import { TestCaseDetail } from './components/pages/TestCaseDetail';
import type { ADOTestPlan, ADOTestSuite, ADOTestCase } from './types';

type PageType = 'landing' | 'cases' | 'detail';

export function App() {
  const [currentPage, setCurrentPage] = useState<PageType>('landing');
  const [selectedPlan, setSelectedPlan] = useState<ADOTestPlan | null>(null);
  const [selectedSuite, setSelectedSuite] = useState<ADOTestSuite | null>(null);
  const [selectedCase, setSelectedCase] = useState<ADOTestCase | null>(null);

  const handleSelectPlan = (plan: ADOTestPlan) => {
    setSelectedPlan(plan);
    setCurrentPage('cases');
    setSelectedSuite(null);
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
    // In future: navigate to settings page
    console.log('Settings clicked');
  };

  return (
    <ThemeContextProvider>
      <NotificationContextProvider>
        <CssBaseline />
        <Toast />

        {currentPage === 'landing' && (
          <Landing
            onSelectPlan={handleSelectPlan}
            onSettingsClick={handleSettingsClick}
          />
        )}

        {currentPage === 'cases' && selectedPlan && (
          <TestCaseList
            plan={selectedPlan}
            suite={selectedSuite}
            onSelectCase={handleSelectCase}
            onBackToPlan={handleBackToPlan}
            onSettingsClick={handleSettingsClick}
          />
        )}

        {currentPage === 'detail' && selectedPlan && selectedSuite && selectedCase && (
          <TestCaseDetail
            plan={selectedPlan}
            suite={selectedSuite}
            caseId={selectedCase.id}
            onBackToCases={handleBackToCases}
            onSettingsClick={handleSettingsClick}
          />
        )}
      </NotificationContextProvider>
    </ThemeContextProvider>
  );
}

export default App;
