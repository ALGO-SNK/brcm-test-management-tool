import { useState } from 'react';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  Tabs,
  Tab,
  Stack,
  Divider,
} from '@mui/material';
import { Refresh, Settings } from '@mui/icons-material';
import { MainLayout } from '../layouts/MainLayout';
import { PlansList } from '../TestPlans/PlansList';
import type { ADOTestPlan } from '../../types';
import { mockTestPlans } from '../../mock/data';

interface LandingProps {
  onSelectPlan: (plan: ADOTestPlan) => void;
  onSettingsClick: () => void;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index } = props;
  return (
    <div hidden={value !== index}>
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );
}

export function Landing({ onSelectPlan, onSettingsClick }: LandingProps) {
  const [tabValue, setTabValue] = useState(0);

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const projectName = mockTestPlans.length > 0 ? mockTestPlans[0].project.name : 'Unknown';

  return (
    <MainLayout title="Test Plans" onSettingsClick={onSettingsClick}>
      <Box>
        {/* Header Section */}
        <Box
          sx={{
            background: 'linear-gradient(135deg, rgba(0, 120, 212, 0.15) 0%, rgba(80, 230, 255, 0.05) 100%)',
            border: '1px solid rgba(0, 120, 212, 0.2)',
            borderRadius: 2,
            p: 4,
            mb: 4,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 3 }}>
            <Box>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, letterSpacing: 0.5 }}>
                AZURE WORKSPACE
              </Typography>
              <Typography
                variant="h4"
                sx={{
                  fontWeight: 700,
                  mt: 1,
                  background: 'linear-gradient(135deg, #0078d4 0%, #50e6ff 100%)',
                  backgroundClip: 'text',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                Azure Test Plans
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button size="small" startIcon={<Refresh />} variant="outlined">
                Refresh
              </Button>
              <Button size="small" startIcon={<Settings />} variant="outlined" onClick={onSettingsClick}>
                Workspace Settings
              </Button>
            </Box>
          </Box>

          <Divider sx={{ my: 3 }} />

          {/* Stats Cards */}
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' }, gap: 2 }}>
            <Card sx={{ bgcolor: 'rgba(0, 120, 212, 0.08)', border: '1px solid rgba(0, 120, 212, 0.2)' }}>
              <CardContent sx={{ p: 2 }}>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                  PLANS
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 700, mt: 1, color: 'primary.main' }}>
                  {mockTestPlans.length}
                </Typography>
              </CardContent>
            </Card>

            <Card sx={{ bgcolor: 'rgba(0, 120, 212, 0.08)', border: '1px solid rgba(0, 120, 212, 0.2)' }}>
              <CardContent sx={{ p: 2 }}>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                  PROJECT
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 700, mt: 1, lineHeight: 1.4 }}>
                  {projectName}
                </Typography>
              </CardContent>
            </Card>

            <Card sx={{ bgcolor: 'rgba(34, 197, 94, 0.08)', border: '1px solid rgba(34, 197, 94, 0.2)' }}>
              <CardContent sx={{ p: 2 }}>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                  RUNTIME
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                  <Box
                    sx={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      bgcolor: '#22c55e',
                    }}
                  />
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>
                    Connected
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Box>
        </Box>

        {/* Navigation Tabs */}
        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
          <Tabs value={tabValue} onChange={handleTabChange}>
            <Tab label="Plans" />
            <Tab label="Suites" />
            <Tab label="Tests" />
            <Tab label="Details" />
          </Tabs>
        </Box>

        {/* Tab Content */}
        <TabPanel value={tabValue} index={0}>
          <Stack spacing={3}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                Test Plans
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                Organize your tests by plan. Each plan can contain multiple suites and test cases.
              </Typography>
            </Box>
            <PlansList onSelectPlan={onSelectPlan} />
          </Stack>
        </TabPanel>

        <TabPanel value={tabValue} index={1}>
          <Typography color="textSecondary">Test Suites will appear here. Select a plan to view its suites.</Typography>
        </TabPanel>

        <TabPanel value={tabValue} index={2}>
          <Typography color="textSecondary">Test Cases will appear here. Select a suite to view its test cases.</Typography>
        </TabPanel>

        <TabPanel value={tabValue} index={3}>
          <Typography color="textSecondary">Details will appear here. Select a plan or test case to view details.</Typography>
        </TabPanel>
      </Box>
    </MainLayout>
  );
}
