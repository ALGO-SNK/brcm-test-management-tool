import {
  Box,
  Card,
  CardContent,
  IconButton,
  Typography,
  Button,
  Stack,
  Chip,
} from '@mui/material';
import { Delete, Add, FileCopy } from '@mui/icons-material';
import type { StepData } from '../../types';

interface StepsListProps {
  steps: StepData[];
  onSelectStep: (step: StepData, index: number) => void;
  onDeleteStep: (index: number) => void;
  onAddStep: () => void;
  onDuplicateStep: (index: number) => void;
  selectedIndex: number | null;
}

const ACTION_COLORS: { [key: string]: { bg: string; text: string } } = {
  NAVIGATE: { bg: '#3b82f6', text: '#93c5fd' },
  CLICK: { bg: '#f97316', text: '#fedd5e' },
  ENTER_TEXT: { bg: '#8b5cf6', text: '#ddd6fe' },
  VERIFY_TEXT: { bg: '#06b6d4', text: '#cffafe' },
  VERIFY_ELEMENT_VISIBLE: { bg: '#10b981', text: '#d1fae5' },
  DELAY: { bg: '#6366f1', text: '#e0e7ff' },
  CLEAR_TEXT: { bg: '#ec4899', text: '#fbcfe8' },
  HOVER: { bg: '#14b8a6', text: '#ccfbf1' },
  DOUBLE_CLICK: { bg: '#f59e0b', text: '#fef3c7' },
  RIGHT_CLICK: { bg: '#ef4444', text: '#fecaca' },
  PRESS_KEY: { bg: '#8b5cf6', text: '#ede9fe' },
  SELECT_OPTION: { bg: '#06b6d4', text: '#cffafe' },
  TAKE_SCREENSHOT: { bg: '#64748b', text: '#cbd5e1' },
  SWITCH_TO_FRAME: { bg: '#a78bfa', text: '#ede9fe' },
  EXECUTE_SCRIPT: { bg: '#7c3aed', text: '#ede9fe' },
};

export function StepsList({
  steps,
  onSelectStep,
  onDeleteStep,
  onAddStep,
  onDuplicateStep,
  selectedIndex,
}: StepsListProps) {
  const getActionColor = (action: string) => {
    return ACTION_COLORS[action] || { bg: '#6b7280', text: '#d1d5db' };
  };

  if (steps.length === 0) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography color="textSecondary" sx={{ mb: 2 }}>
          No steps yet
        </Typography>
        <Button variant="contained" startIcon={<Add />} onClick={onAddStep}>
          Add First Step
        </Button>
      </Box>
    );
  }

  return (
    <Box>
      <Stack spacing={1.5}>
        {steps.map((step, idx) => {
          const colors = getActionColor(step.action);
          const isSelected = selectedIndex === idx;

          return (
            <Card
              key={step.id}
              onClick={() => onSelectStep(step, idx)}
              sx={{
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                border: isSelected ? '2px solid' : '1px solid',
                borderColor: isSelected ? 'primary.main' : 'divider',
                bgcolor: isSelected ? 'rgba(0,120,212,0.08)' : 'background.paper',
                '&:hover': {
                  boxShadow: isSelected ? '0 4px 12px rgba(0,120,212,0.3)' : '0 2px 8px rgba(0,120,212,0.15)',
                  borderColor: 'primary.main',
                },
              }}
            >
              <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 40,
                      height: 40,
                      bgcolor: 'action.hover',
                      borderRadius: '50%',
                      fontWeight: 700,
                      fontSize: '1.1rem',
                      flexShrink: 0,
                    }}
                  >
                    {(step.order ?? 0) + 1}
                  </Box>

                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                      <Chip
                        label={step.action}
                        size="small"
                        sx={{
                          bgcolor: colors.bg,
                          color: '#fff',
                          fontWeight: 600,
                          height: 28,
                          '& .MuiChip-label': {
                            px: 1,
                            fontSize: '0.8rem',
                          },
                        }}
                      />
                    </Box>
                    <Typography
                      variant="body2"
                      sx={{
                        color: 'textSecondary',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {step.element || step.value || step.description || 'No details'}
                    </Typography>
                  </Box>

                  <Box sx={{ display: 'flex', gap: 0.5, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                    <IconButton
                      size="small"
                      onClick={() => onDuplicateStep(idx)}
                      title="Duplicate step"
                      sx={{
                        '&:hover': { bgcolor: 'action.hover' },
                      }}
                    >
                      <FileCopy fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => onDeleteStep(idx)}
                      title="Delete step"
                      color="error"
                      sx={{
                        '&:hover': { bgcolor: 'rgba(239, 68, 68, 0.1)' },
                      }}
                    >
                      <Delete fontSize="small" />
                    </IconButton>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          );
        })}
      </Stack>

      <Box sx={{ mt: 2 }}>
        <Button variant="outlined" startIcon={<Add />} onClick={onAddStep} fullWidth>
          Add Step
        </Button>
      </Box>
    </Box>
  );
}
