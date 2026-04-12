import { useState, useEffect } from 'react';
import { Box, Breadcrumbs, Link, Typography, Tabs, Tab, Chip, Stack, CircularProgress } from '@mui/material';
import { MainLayout } from '../layouts/MainLayout';
import { StepsEditor } from '../StepsEditor/StepsEditor';
import type { ADOTestPlan, ADOTestSuite, ADOTestCase } from '../../types';
import { fetchTestCaseById } from '../../mock/handlers';

interface TestCaseDetailProps {
  plan: ADOTestPlan;
  suite: ADOTestSuite;
  caseId: number;
  onBackToCases: () => void;
  onSettingsClick: () => void;
}

export function TestCaseDetail({
  plan,
  suite,
  caseId,
  onBackToCases,
  onSettingsClick,
}: TestCaseDetailProps) {
  const [testCase, setTestCase] = useState<ADOTestCase | null>(null);
  const [loading, setLoading] = useState(true);
  const [tabValue, setTabValue] = useState(0);

  useEffect(() => {
    const loadCase = async () => {
      try {
        setLoading(true);
        const data = await fetchTestCaseById(caseId);
        if (data) {
          setTestCase(data);
        }
      } finally {
        setLoading(false);
      }
    };

    loadCase();
  }, [caseId]);

  if (loading) {
    return (
      <MainLayout title="Test Case Detail" onSettingsClick={onSettingsClick}>
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress />
        </Box>
      </MainLayout>
    );
  }

  if (!testCase) {
    return (
      <MainLayout title="Test Case Detail" onSettingsClick={onSettingsClick}>
        <Typography>Test case not found</Typography>
      </MainLayout>
    );
  }

  const stateColor =
    testCase.state === 'Active'
      ? ('success' as const)
      : testCase.state === 'Ready'
        ? ('info' as const)
        : ('default' as const);

  return (
    <MainLayout title="Test Case Detail" onSettingsClick={onSettingsClick}>
      <Box sx={{ mb: 3 }}>
        <Breadcrumbs sx={{ mb: 2 }}>
          <Link
            component="button"
            variant="body2"
            onClick={onBackToCases}
            sx={{ cursor: 'pointer', color: 'primary.main' }}
          >
            Test Plans
          </Link>
          <Link
            component="button"
            variant="body2"
            onClick={onBackToCases}
            sx={{ cursor: 'pointer', color: 'primary.main' }}
          >
            {plan.name}
          </Link>
          <Link
            component="button"
            variant="body2"
            onClick={onBackToCases}
            sx={{ cursor: 'pointer', color: 'primary.main' }}
          >
            {suite.name}
          </Link>
          <Typography color="textPrimary">{testCase.name}</Typography>
        </Breadcrumbs>

        <Box>
          <Typography variant="h5" sx={{ fontWeight: 600, mb: 1 }}>
            {testCase.name}
          </Typography>

          <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: 'wrap' }}>
            <Chip
              label={`ID: ${testCase.id}`}
              size="small"
              variant="outlined"
            />
            <Chip
              label={testCase.state}
              size="small"
              color={stateColor}
              variant="outlined"
            />
            <Chip
              label={`Priority: ${testCase.priority}`}
              size="small"
              variant="outlined"
            />
            {testCase.assignedTo && (
              <Chip
                label={`Assigned to: ${testCase.assignedTo.displayName}`}
                size="small"
                variant="outlined"
              />
            )}
          </Stack>

          <Typography variant="body2" color="textSecondary">
            Last updated: {new Date(testCase.lastUpdatedDate).toLocaleDateString()}
          </Typography>
        </Box>
      </Box>

      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={tabValue} onChange={(_, value) => setTabValue(value)}>
          <Tab label="Steps" />
          <Tab label="Details" />
        </Tabs>
      </Box>

      {tabValue === 0 && (
        <StepsEditor
          testCase={testCase}
          onSaved={() => {
            // Refresh case or handle success
          }}
        />
      )}

      {tabValue === 1 && (
        <Box sx={{ bgcolor: 'background.paper', p: 3, borderRadius: 1 }}>
          <Stack spacing={2}>
            <Box>
              <Typography variant="body2" color="textSecondary" sx={{ mb: 0.5 }}>
                Test Plan
              </Typography>
              <Typography>{plan.name}</Typography>
            </Box>

            <Box>
              <Typography variant="body2" color="textSecondary" sx={{ mb: 0.5 }}>
                Suite
              </Typography>
              <Typography>{suite.name}</Typography>
            </Box>

            <Box>
              <Typography variant="body2" color="textSecondary" sx={{ mb: 0.5 }}>
                Project
              </Typography>
              <Typography>{plan.project.name}</Typography>
            </Box>

            {testCase.assignedTo && (
              <Box>
                <Typography variant="body2" color="textSecondary" sx={{ mb: 0.5 }}>
                  Assigned To
                </Typography>
                <Typography>
                  {testCase.assignedTo.displayName} ({testCase.assignedTo.uniqueName})
                </Typography>
              </Box>
            )}

            <Box>
              <Typography variant="body2" color="textSecondary" sx={{ mb: 0.5 }}>
                Created
              </Typography>
              <Typography>{new Date(testCase.lastUpdatedDate).toLocaleString()}</Typography>
            </Box>
          </Stack>
        </Box>
      )}
    </MainLayout>
  );
}
