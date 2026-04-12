import { useState, useEffect } from 'react';
import {
  Box,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Button,
  Stack,
  Typography,
  Alert,
} from '@mui/material';
import { Save, Cancel } from '@mui/icons-material';
import type { StepData, ElementCategory } from '../../types';

interface StepFormProps {
  step: StepData;
  onSave: (step: StepData) => void;
  onCancel: () => void;
}

const ELEMENT_CATEGORIES: ElementCategory[] = [
  'XPATH',
  'ID',
  'TAGNAME',
  'CSSSELECTOR',
  'LINKTEXT',
  'NAME',
  'URL',
  'JSPATH',
  'VERIFY',
  'VERIFYERROR',
];

const COMMON_ACTIONS = [
  'NAVIGATE',
  'CLICK',
  'ENTER_TEXT',
  'CLEAR_TEXT',
  'VERIFY_TEXT',
  'VERIFY_ELEMENT_VISIBLE',
  'DELAY',
  'TAKE_SCREENSHOT',
  'HOVER',
  'DOUBLE_CLICK',
  'RIGHT_CLICK',
  'PRESS_KEY',
  'SELECT_OPTION',
  'SWITCH_TO_FRAME',
  'EXECUTE_SCRIPT',
];

export function StepForm({ step, onSave, onCancel }: StepFormProps) {
  const [formData, setFormData] = useState<StepData>(step);
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    setFormData(step);
    setErrors([]);
  }, [step]);

  const handleChange = (field: keyof StepData, value: string | number | boolean) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
      updatedAt: new Date().toISOString(),
    }));

    // Clear errors when user starts typing
    if (errors.length > 0) {
      setErrors([]);
    }
  };

  const validate = (): boolean => {
    const newErrors: string[] = [];

    if (!formData.action || formData.action.trim() === '') {
      newErrors.push('Action is required');
    }

    if (!formData.elementCategory) {
      newErrors.push('Element category is required');
    }

    // Validate element if action requires it (not for navigation/delay)
    if (['NAVIGATE', 'DELAY', 'TAKE_SCREENSHOT'].indexOf(formData.action) === -1) {
      if (!formData.element || formData.element.trim() === '') {
        newErrors.push('Element is required for this action');
      }
    }

    // Validate value if action requires it
    if (['NAVIGATE', 'ENTER_TEXT', 'DELAY', 'VERIFY_TEXT'].indexOf(formData.action) !== -1) {
      if (!formData.value || formData.value.trim() === '') {
        newErrors.push('Value is required for this action');
      }
    }

    setErrors(newErrors);
    return newErrors.length === 0;
  };

  const handleSave = () => {
    if (validate()) {
      onSave(formData);
    }
  };

  return (
    <Box sx={{ p: 3, bgcolor: 'background.paper', borderRadius: 1 }}>
      <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
        Edit Step {(formData.order ?? 0) + 1}
      </Typography>

      {errors.length > 0 && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {errors.map((err, idx) => (
            <div key={idx}>{err}</div>
          ))}
        </Alert>
      )}

      <Stack spacing={2}>
        <FormControl fullWidth>
          <InputLabel>Action</InputLabel>
          <Select
            value={formData.action}
            label="Action"
            onChange={e => handleChange('action', e.target.value)}
          >
            {COMMON_ACTIONS.map(action => (
              <MenuItem key={action} value={action}>
                {action}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl fullWidth>
          <InputLabel>Element Category</InputLabel>
          <Select
            value={formData.elementCategory}
            label="Element Category"
            onChange={e => handleChange('elementCategory', e.target.value as ElementCategory)}
          >
            {ELEMENT_CATEGORIES.map(cat => (
              <MenuItem key={cat} value={cat}>
                {cat}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <TextField
          label="Element"
          placeholder="XPath, CSS Selector, ID, etc."
          value={formData.element}
          onChange={e => handleChange('element', e.target.value)}
          fullWidth
          multiline
          rows={2}
        />

        <TextField
          label="Value"
          placeholder="Value for action (text to enter, URL, etc.)"
          value={formData.value}
          onChange={e => handleChange('value', e.target.value)}
          fullWidth
          multiline
          rows={2}
        />

        <TextField
          label="Expected Value"
          placeholder="For verification actions"
          value={formData.expectedValue}
          onChange={e => handleChange('expectedValue', e.target.value)}
          fullWidth
        />

        <TextField
          label="Description"
          placeholder="Step description"
          value={formData.description}
          onChange={e => handleChange('description', e.target.value)}
          fullWidth
          multiline
          rows={2}
        />

        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end', pt: 2 }}>
          <Button variant="outlined" startIcon={<Cancel />} onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="contained" startIcon={<Save />} onClick={handleSave}>
            Save Step
          </Button>
        </Box>
      </Stack>
    </Box>
  );
}
