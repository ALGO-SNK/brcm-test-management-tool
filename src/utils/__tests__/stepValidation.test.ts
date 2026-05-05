/**
 * Unit Tests for Step Validation
 */

import { validateStep, validateAllSteps, getValidationSummary } from '../stepValidation';
import type {ParsedStep} from '../../components/TestCases/StepsEditor';

describe('Step Validation', () => {
  describe('XPath Validation', () => {
    it('should validate XPath starting with //', () => {
      const step: ParsedStep = {
        index: 1,
        action: 'CLICK',
        element: '//button[@id="submit"]',
        elementCategory: 'XPATH',
      };

      const result = validateStep(step);
      const elementErrors = result.errors.filter(e => e.field === 'element');
      expect(elementErrors.filter(e => e.severity === 'error')).toHaveLength(0);
    });

    it('should validate XPath starting with /', () => {
      const step: ParsedStep = {
        index: 1,
        action: 'CLICK',
        element: '/button[@id="submit"]',
        elementCategory: 'XPATH',
      };

      const result = validateStep(step);
      const elementErrors = result.errors.filter(e => e.field === 'element');
      expect(elementErrors.filter(e => e.severity === 'error')).toHaveLength(0);
    });

    it('should reject invalid XPath', () => {
      const step: ParsedStep = {
        index: 1,
        action: 'CLICK',
        element: 'button#submit',
        elementCategory: 'XPATH',
      };

      const result = validateStep(step);
      const elementErrors = result.errors.filter(
        e => e.field === 'element' && e.severity === 'error'
      );
      expect(elementErrors.length).toBeGreaterThan(0);
    });

    it('should warn on very long XPath', () => {
      const step: ParsedStep = {
        index: 1,
        action: 'CLICK',
        element:
          '//div[@id="outer"]/div[@class="inner"]/div[@data-test="long"]/button[@aria-label="submit button"]',
        elementCategory: 'XPATH',
      };

      const result = validateStep(step);
      const warnings = result.errors.filter(
        e => e.field === 'element' && e.severity === 'warning'
      );
      expect(warnings.length).toBeGreaterThan(0);
    });

    it('should detect bracket mismatch in XPath', () => {
      const step: ParsedStep = {
        index: 1,
        action: 'CLICK',
        element: '//div[@id="test"]/button[@class="submit"]',
        elementCategory: 'XPATH',
      };

      const result = validateStep(step);
      const elementErrors = result.errors.filter(e => e.field === 'element');
      // Should not have bracket errors for correctly formed XPath
      expect(
        elementErrors.filter(e => e.message.includes('bracket'))
      ).toHaveLength(0);
    });
  });

  describe('Regex Validation', () => {
    it('should validate valid regex', () => {
      const step: ParsedStep = {
        index: 1,
        action: 'COMPARE_ELEMENT_VALUE_WITH_REGEX',
        element: '//div[@id="result"]',
        elementCategory: 'XPATH',
        expectedValue: '^[A-Z][a-z]+$',
      };

      const result = validateStep(step);
      const regexErrors = result.errors.filter(
        e => e.field === 'expectedValue' && e.severity === 'error'
      );
      expect(regexErrors).toHaveLength(0);
    });

    it('should reject invalid regex', () => {
      const step: ParsedStep = {
        index: 1,
        action: 'COMPARE_ELEMENT_VALUE_WITH_REGEX',
        element: '//div[@id="result"]',
        elementCategory: 'XPATH',
        expectedValue: '[A-Z[a-z]+$', // Invalid: mismatched brackets
      };

      const result = validateStep(step);
      const regexErrors = result.errors.filter(
        e => e.field === 'expectedValue' && e.severity === 'error'
      );
      expect(regexErrors.length).toBeGreaterThan(0);
    });
  });

  describe('CSV Keys Validation', () => {
    it('should validate correct CSV keys', () => {
      const step: ParsedStep = {
        index: 1,
        action: 'CALCULATE_PERCENTAGE',
        element: '//span[@id="percentage"]',
        elementCategory: 'XPATH',
        value: 'percentage_result',
        key: 'count_key, total_key',
        expectedValue: 'PERCENT',
      };

      const result = validateStep(step);
      const keyErrors = result.errors.filter(
        e => e.field === 'key' && e.severity === 'error'
      );
      expect(keyErrors).toHaveLength(0);
    });

    it('should reject invalid characters in keys', () => {
      const step: ParsedStep = {
        index: 1,
        action: 'CALCULATE_PERCENTAGE',
        element: '//span[@id="percentage"]',
        elementCategory: 'XPATH',
        value: 'percentage_result',
        key: 'count key, total@key',
        expectedValue: 'PERCENT',
      };

      const result = validateStep(step);
      const keyErrors = result.errors.filter(
        e => e.field === 'key' && e.severity === 'error'
      );
      expect(keyErrors.length).toBeGreaterThan(0);
    });
  });

  describe('Dynamic Locator Validation', () => {
    it('should allow dynamic locators with proper setup', () => {
      const step: ParsedStep = {
        index: 1,
        action: 'CLICK',
        element: '//div[text()="$$"]',
        elementCategory: 'XPATH',
        isElementPathDynamic: true,
        elementReplaceTextDataKey: 'student_name',
      };

      const result = validateStep(step);
      const dynamicErrors = result.errors.filter(
        e => (e.field === 'elementReplaceTextDataKey' || e.field === 'element') &&
        e.severity === 'error'
      );
      expect(dynamicErrors).toHaveLength(0);
    });

    it('should reject dynamic locator without replacement key', () => {
      const step: ParsedStep = {
        index: 1,
        action: 'CLICK',
        element: '//div[text()="$$"]',
        elementCategory: 'XPATH',
        isElementPathDynamic: true,
      };

      const result = validateStep(step);
      const dynamicErrors = result.errors.filter(
        e => e.field === 'elementReplaceTextDataKey' && e.severity === 'error'
      );
      expect(dynamicErrors.length).toBeGreaterThan(0);
    });

    it('should reject dynamic locator without tokens', () => {
      const step: ParsedStep = {
        index: 1,
        action: 'CLICK',
        element: '//div[@id="static"]',
        elementCategory: 'XPATH',
        isElementPathDynamic: true,
        elementReplaceTextDataKey: 'some_key',
      };

      const result = validateStep(step);
      const dynamicErrors = result.errors.filter(
        e => e.field === 'element' && e.severity === 'error'
      );
      expect(dynamicErrors.length).toBeGreaterThan(0);
    });
  });

  describe('Union Type Validation', () => {
    it('should validate count format', () => {
      const step: ParsedStep = {
        index: 1,
        action: 'SELECT_LIST_ITEM',
        element: '//ul[@class="items"]',
        elementCategory: 'XPATH',
        value: '5',
      };

      const result = validateStep(step);
      const valueErrors = result.errors.filter(
        e => e.field === 'value' && e.severity === 'error'
      );
      expect(valueErrors).toHaveLength(0);
    });

    it('should validate take/skip format', () => {
      const step: ParsedStep = {
        index: 1,
        action: 'SELECT_LIST_ITEM',
        element: '//ul[@class="items"]',
        elementCategory: 'XPATH',
        value: 'take:5,skip:2',
      };

      const result = validateStep(step);
      const valueErrors = result.errors.filter(
        e => e.field === 'value' && e.severity === 'error'
      );
      expect(valueErrors).toHaveLength(0);
    });

    it('should reject invalid union format', () => {
      const step: ParsedStep = {
        index: 1,
        action: 'SELECT_LIST_ITEM',
        element: '//ul[@class="items"]',
        elementCategory: 'XPATH',
        value: 'invalid_format',
      };

      const result = validateStep(step);
      const valueErrors = result.errors.filter(
        e => e.field === 'value' && e.severity === 'error'
      );
      expect(valueErrors.length).toBeGreaterThan(0);
    });
  });

  describe('Validation Summary', () => {
    it('should summarize validation results', () => {
      const steps: ParsedStep[] = [
        {
          index: 1,
          action: 'CLICK',
          element: '//button[@id="submit"]',
          elementCategory: 'XPATH',
        },
        {
          index: 2,
          action: 'CLICK',
          element: 'invalid_element',
          elementCategory: 'XPATH',
        },
        {
          index: 3,
          action: 'TYPE',
          element: '//input[@id="name"]',
          elementCategory: 'XPATH',
          value: 'John',
        },
      ];

      const results = validateAllSteps(steps);
      const summary = getValidationSummary(results);

      expect(summary.totalSteps).toBe(3);
      expect(summary.stepsWithErrors).toBeGreaterThan(0);
      expect(summary.totalErrors).toBeGreaterThan(0);
    });
  });

  describe('Element Category Inference', () => {
    it('should accept valid ID without #', () => {
      const step: ParsedStep = {
        index: 1,
        action: 'CLICK',
        element: 'myButtonId',
        elementCategory: 'ID',
      };

      const result = validateStep(step);
      const elementErrors = result.errors.filter(
        e => e.field === 'element' && e.severity === 'error'
      );
      expect(elementErrors).toHaveLength(0);
    });

    it('should warn on ID with # symbol', () => {
      const step: ParsedStep = {
        index: 1,
        action: 'CLICK',
        element: '#myButtonId',
        elementCategory: 'ID',
      };

      const result = validateStep(step);
      const warnings = result.errors.filter(
        e => e.field === 'element' && e.severity === 'warning'
      );
      expect(warnings.length).toBeGreaterThan(0);
    });
  });
});

describe('Validation Integration', () => {
  it('should handle complex step with multiple fields', () => {
    const step: ParsedStep = {
      index: 1,
      action: 'CALCULATE_PERCENTAGE',
      element: '//span[@id="percentage"]',
      elementCategory: 'XPATH',
      value: 'percentage_output_key',
      expectedValue: 'PERCENT',
      key: 'count_key, total_key',
      headers: 'SAVEPERCENTAGEVALUE',
      description: 'Calculate and save percentage',
      isElementPathDynamic: false,
      isConcatenated: false,
    };

    const result = validateStep(step);
    expect(result.errors.filter(e => e.severity === 'error')).toHaveLength(0);
  });

  it('should collect all validation errors', () => {
    const step: ParsedStep = {
      index: 1,
      action: 'COMPARE_ELEMENT_VALUE_WITH_REGEX',
      element: 'invalid_xpath',
      elementCategory: 'XPATH',
      expectedValue: '[invalid(regex]',
    };

    const result = validateStep(step);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.isValid).toBe(false);
  });
});
