import { useState, useEffect } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  CircularProgress,
  Box,
  Typography,
  Checkbox,
  TableSortLabel,
  Avatar,
  Chip,
} from '@mui/material';
import type { ADOTestCase } from '../../types';
import { fetchTestCases } from '../../mock/handlers';

interface CaseTableProps {
  planId: number;
  suiteId: number;
  onSelectCase: (testCase: ADOTestCase) => void;
}

type SortField = 'id' | 'name' | 'state' | 'priority';
type SortOrder = 'asc' | 'desc';

export function CaseTable({ planId, suiteId, onSelectCase }: CaseTableProps) {
  const [cases, setCases] = useState<ADOTestCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [sortField, setSortField] = useState<SortField>('id');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

  useEffect(() => {
    const loadCases = async () => {
      try {
        setLoading(true);
        const data = await fetchTestCases(planId, suiteId);
        setCases(data);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load test cases');
      } finally {
        setLoading(false);
      }
    };

    loadCases();
  }, [planId, suiteId]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const getStateColor = (state: string) => {
    switch (state) {
      case 'Active':
        return { bg: 'rgba(34, 197, 94, 0.15)', text: '#22c55e' };
      case 'Ready':
        return { bg: 'rgba(59, 130, 246, 0.15)', text: '#3b82f6' };
      default:
        return { bg: 'rgba(107, 114, 128, 0.15)', text: '#6b7280' };
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const sortedCases = [...cases].sort((a, b) => {
    let aVal: string | number = '';
    let bVal: string | number = '';

    switch (sortField) {
      case 'id':
        aVal = a.id;
        bVal = b.id;
        break;
      case 'name':
        aVal = a.name;
        bVal = b.name;
        break;
      case 'state':
        aVal = a.state;
        bVal = b.state;
        break;
      case 'priority':
        aVal = a.priority;
        bVal = b.priority;
        break;
    }

    if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
    return 0;
  });

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelected(new Set(cases.map(c => c.id)));
    } else {
      setSelected(new Set());
    }
  };

  const handleSelectCase = (caseId: number) => {
    const newSelected = new Set(selected);
    if (newSelected.has(caseId)) {
      newSelected.delete(caseId);
    } else {
      newSelected.add(caseId);
    }
    setSelected(newSelected);
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 2, bgcolor: 'error.lighter', borderRadius: 1 }}>
        <Typography color="error">{error}</Typography>
      </Box>
    );
  }

  if (cases.length === 0) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <Typography color="textSecondary">No test cases found</Typography>
      </Box>
    );
  }

  return (
    <TableContainer component={Paper} sx={{ borderRadius: 1.5, border: '1px solid', borderColor: 'divider' }}>
      <Table>
        <TableHead>
          <TableRow
            sx={{
              bgcolor: 'rgba(0, 120, 212, 0.08)',
              '& th': {
                fontWeight: 700,
                fontSize: '0.9rem',
                color: 'text.primary',
                borderBottom: '2px solid',
                borderColor: 'divider',
              },
            }}
          >
            <TableCell padding="checkbox" width={50}>
              <Checkbox
                indeterminate={selected.size > 0 && selected.size < cases.length}
                checked={selected.size === cases.length && cases.length > 0}
                onChange={handleSelectAll}
              />
            </TableCell>
            <TableCell width="80px">
              <TableSortLabel
                active={sortField === 'id'}
                direction={sortOrder}
                onClick={() => handleSort('id')}
              >
                ID
              </TableSortLabel>
            </TableCell>
            <TableCell>
              <TableSortLabel
                active={sortField === 'name'}
                direction={sortOrder}
                onClick={() => handleSort('name')}
              >
                Name
              </TableSortLabel>
            </TableCell>
            <TableCell width="110px">
              <TableSortLabel
                active={sortField === 'state'}
                direction={sortOrder}
                onClick={() => handleSort('state')}
              >
                State
              </TableSortLabel>
            </TableCell>
            <TableCell align="center" width="100px">
              <TableSortLabel
                active={sortField === 'priority'}
                direction={sortOrder}
                onClick={() => handleSort('priority')}
              >
                Priority
              </TableSortLabel>
            </TableCell>
            <TableCell>Assigned To</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {sortedCases.map(testCase => {
            const stateColor = getStateColor(testCase.state);

            return (
              <TableRow
                key={testCase.id}
                onClick={() => onSelectCase(testCase)}
                selected={selected.has(testCase.id)}
                sx={{
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  '&:hover': {
                    bgcolor: 'rgba(0, 120, 212, 0.05)',
                  },
                  '&.Mui-selected': {
                    bgcolor: 'rgba(0, 120, 212, 0.1)',
                    '&:hover': {
                      bgcolor: 'rgba(0, 120, 212, 0.15)',
                    },
                  },
                }}
              >
                <TableCell padding="checkbox" onClick={e => e.stopPropagation()}>
                  <Checkbox
                    checked={selected.has(testCase.id)}
                    onChange={() => handleSelectCase(testCase.id)}
                  />
                </TableCell>
                <TableCell sx={{ fontWeight: 600, color: 'primary.main' }}>
                  {testCase.id}
                </TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Avatar sx={{ width: 28, height: 28, fontSize: '0.75rem', fontWeight: 700 }}>
                      {getInitials(testCase.name)}
                    </Avatar>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      {testCase.name}
                    </Typography>
                  </Box>
                </TableCell>
                <TableCell>
                  <Chip
                    label={testCase.state}
                    size="small"
                    sx={{
                      bgcolor: stateColor.bg,
                      color: stateColor.text,
                      fontWeight: 600,
                      height: 24,
                    }}
                  />
                </TableCell>
                <TableCell align="center">
                  <Box
                    sx={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 28,
                      height: 28,
                      borderRadius: '50%',
                      bgcolor: testCase.priority === 1 ? 'rgba(239, 68, 68, 0.2)' : 'rgba(107, 114, 128, 0.2)',
                      color: testCase.priority === 1 ? '#ef4444' : '#6b7280',
                      fontSize: '0.9rem',
                      fontWeight: 700,
                    }}
                  >
                    {testCase.priority}
                  </Box>
                </TableCell>
                <TableCell>
                  {testCase.assignedTo ? (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Avatar sx={{ width: 28, height: 28, fontSize: '0.75rem' }}>
                        {getInitials(testCase.assignedTo.displayName)}
                      </Avatar>
                      <Typography variant="body2">{testCase.assignedTo.displayName}</Typography>
                    </Box>
                  ) : (
                    <Typography variant="body2" color="textSecondary">
                      Unassigned
                    </Typography>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
