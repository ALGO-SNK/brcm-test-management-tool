import { useState, useEffect } from 'react';
import { Grid, CircularProgress, Box, Typography } from '@mui/material';
import type { ADOTestPlan } from '../../types';
import { PlanCard } from './PlanCard';
import { fetchTestPlans } from '../../mock/handlers';

interface PlansListProps {
  onSelectPlan: (plan: ADOTestPlan) => void;
}

export function PlansList({ onSelectPlan }: PlansListProps) {
  const [plans, setPlans] = useState<ADOTestPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadPlans = async () => {
      try {
        setLoading(true);
        const data = await fetchTestPlans();
        setPlans(data);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load test plans');
      } finally {
        setLoading(false);
      }
    };

    loadPlans();
  }, []);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3, bgcolor: 'error.lighter', borderRadius: 1 }}>
        <Typography color="error">{error}</Typography>
      </Box>
    );
  }

  if (plans.length === 0) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <Typography color="textSecondary">No test plans found</Typography>
      </Box>
    );
  }

  return (
    <Grid container spacing={3}>
      {plans.map(plan => (
        <Grid item xs={12} sm={6} md={4} lg={3} key={plan.id}>
          <PlanCard plan={plan} onSelect={onSelectPlan} />
        </Grid>
      ))}
    </Grid>
  );
}
