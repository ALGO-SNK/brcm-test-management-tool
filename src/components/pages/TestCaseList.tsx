import { useState, useEffect } from 'react';
import { Box, Breadcrumbs, Link, Typography } from '@mui/material';
import { MainLayout } from '../layouts/MainLayout';
import { CaseTable } from '../TestCases/CaseTable';
import type { ADOTestPlan, ADOTestSuite, ADOTestCase } from '../../types';
import { fetchTestSuiteById } from '../../mock/handlers';

interface TestCaseListProps {
  plan: ADOTestPlan;
  suite: ADOTestSuite | null;
  onSelectCase: (testCase: ADOTestCase) => void;
  onBackToPlan: () => void;
  onSettingsClick: () => void;
}

export function TestCaseList({
  plan,
  suite,
  onSelectCase,
  onBackToPlan,
  onSettingsClick,
}: TestCaseListProps) {
  const [currentSuite, setCurrentSuite] = useState<ADOTestSuite | null>(suite);

  useEffect(() => {
    if (!suite) return;

    const loadSuite = async () => {
      const data = await fetchTestSuiteById(suite.id);
      if (data) {
        setCurrentSuite(data);
      }
    };

    loadSuite();
  }, [suite]);

  if (!currentSuite) {
    return (
      <MainLayout title="Test Cases" onSettingsClick={onSettingsClick}>
        <Typography>Suite not found</Typography>
      </MainLayout>
    );
  }

  return (
    <MainLayout title="Test Cases" onSettingsClick={onSettingsClick}>
      <Box sx={{ mb: 3 }}>
        <Breadcrumbs sx={{ mb: 2 }}>
          <Link
            component="button"
            variant="body2"
            onClick={onBackToPlan}
            sx={{ cursor: 'pointer', color: 'primary.main' }}
          >
            Test Plans
          </Link>
          <Link
            component="button"
            variant="body2"
            onClick={onBackToPlan}
            sx={{ cursor: 'pointer', color: 'primary.main' }}
          >
            {plan.name}
          </Link>
          <Typography color="textPrimary">{currentSuite.name}</Typography>
        </Breadcrumbs>

        <Box>
          <Typography variant="h5" sx={{ fontWeight: 600 }}>
            {currentSuite.name}
          </Typography>
          <Typography variant="body2" color="textSecondary" sx={{ mt: 0.5 }}>
            Test Plan: {plan.name}
          </Typography>
        </Box>
      </Box>

      <CaseTable planId={plan.id} suiteId={currentSuite.id} onSelectCase={onSelectCase} />
    </MainLayout>
  );
}
