import { Card, CardContent, CardActions, Typography, Button, Box, Chip, Stack, Avatar } from '@mui/material';
import { ArrowForward, FolderOpen } from '@mui/icons-material';
import type { ADOTestPlan } from '../../types';

interface PlanCardProps {
  plan: ADOTestPlan;
  onSelect: (plan: ADOTestPlan) => void;
}

export function PlanCard({ plan, onSelect }: PlanCardProps) {
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <Card
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        cursor: 'pointer',
        background: 'linear-gradient(135deg, rgba(0,120,212,0.1) 0%, rgba(80,230,255,0.05) 100%)',
        border: '1px solid rgba(0,120,212,0.2)',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        '&:hover': {
          boxShadow: '0 12px 24px rgba(0,120,212,0.3)',
          transform: 'translateY(-4px)',
          borderColor: 'rgba(0,120,212,0.4)',
          background: 'linear-gradient(135deg, rgba(0,120,212,0.15) 0%, rgba(80,230,255,0.1) 100%)',
        },
      }}
      onClick={() => onSelect(plan)}
    >
      <CardContent sx={{ flexGrow: 1, pb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, mb: 2 }}>
          <Avatar
            sx={{
              bgcolor: 'primary.main',
              width: 48,
              height: 48,
              fontSize: '1rem',
              fontWeight: 700,
            }}
          >
            {getInitials(plan.name)}
          </Avatar>
          <Box sx={{ flex: 1 }}>
            <Typography
              variant="h6"
              sx={{
                fontWeight: 700,
                fontSize: '1.1rem',
                mb: 0.5,
                lineHeight: 1.3,
              }}
            >
              {plan.name}
            </Typography>
            <Typography variant="caption" color="textSecondary">
              {plan.project.name}
            </Typography>
          </Box>
        </Box>

        <Stack spacing={1.5} sx={{ mt: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="body2" color="textSecondary" sx={{ minWidth: 60 }}>
              Status:
            </Typography>
            <Chip
              label={plan.state}
              size="small"
              sx={{
                bgcolor: plan.state === 'Active' ? 'rgba(34, 197, 94, 0.2)' : 'rgba(107, 114, 128, 0.2)',
                color: plan.state === 'Active' ? '#22c55e' : '#6b7280',
                fontWeight: 600,
                height: 24,
              }}
            />
          </Box>

          {plan.owner && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="body2" color="textSecondary" sx={{ minWidth: 60 }}>
                Owner:
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                {plan.owner.displayName}
              </Typography>
            </Box>
          )}

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <FolderOpen fontSize="small" sx={{ color: 'primary.main', opacity: 0.7 }} />
            <Typography variant="body2" color="textSecondary">
              {plan.rootSuite.name}
            </Typography>
          </Box>
        </Stack>
      </CardContent>

      <CardActions sx={{ pt: 1 }}>
        <Button
          size="small"
          endIcon={<ArrowForward />}
          onClick={() => onSelect(plan)}
          sx={{
            ml: 'auto',
            color: 'primary.main',
            fontWeight: 600,
            '&:hover': {
              bgcolor: 'rgba(0,120,212,0.1)',
            },
          }}
        >
          Open
        </Button>
      </CardActions>
    </Card>
  );
}
