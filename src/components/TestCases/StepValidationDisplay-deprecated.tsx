/**
 * Step Validation Display Component
 * Shows validation errors and warnings inline
 */

/**
 * Step Validation Display Component
 * Shows validation errors and warnings inline
 */
/*import type {ValidationError} from '../../utils/stepValidation';*/

/*
interface StepValidationDisplayProps {
  errors: ValidationError[];
  className?: string;
}

export function StepValidationDisplay({
  errors,
  className = '',
}: StepValidationDisplayProps) {
  if (errors.length === 0) {
    return null;
  }

  const errorList = errors.filter(e => e.severity === 'error');
  const warningList = errors.filter(e => e.severity === 'warning');

  return (
    <div className={`step-validation ${className}`}>
      {errorList.length > 0 && (
        <div className="step-validation__group step-validation__errors">
          <div className="step-validation__title">
            <span className="step-validation__icon">⚠️</span>
            Errors ({errorList.length})
          </div>
          <ul className="step-validation__list">
            {errorList.map((error, idx) => (
              <li key={idx} className="step-validation__item">
                <strong>{getFieldLabel(error.field)}:</strong> {error.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {warningList.length > 0 && (
        <div className="step-validation__group step-validation__warnings">
          <div className="step-validation__title">
            <span className="step-validation__icon">ℹ️</span>
            Warnings ({warningList.length})
          </div>
          <ul className="step-validation__list">
            {warningList.map((warning, idx) => (
              <li key={idx} className="step-validation__item">
                <strong>{getFieldLabel(warning.field)}:</strong> {warning.message}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function getFieldLabel(field: string): string {
  const labels: Record<string, string> = {
    action: 'Action',
    element: 'Locator',
    elementCategory: 'Locator Type',
    value: 'Value',
    expectedValue: 'Expected Value',
    key: 'Data Key',
    headers: 'Headers',
    elementReplaceTextDataKey: 'Element Replace Key',
    isElementPathDynamic: 'Dynamic Locator',
    isConcatenated: 'Concatenated',
    description: 'Step Summary',
  };
  return labels[field] || field;
}
*/

/**
 * Field-level validation indicator
 */
/*interface FieldValidationIndicatorProps {
  hasError: boolean;
  hasWarning: boolean;
}*/

/*export function FieldValidationIndicator({
  hasError,
  hasWarning,
}: FieldValidationIndicatorProps) {
  if (!hasError && !hasWarning) {
    return null;
  }

  return (
    <div className={`field-validation-indicator ${hasError ? 'error' : 'warning'}`}>
      {hasError ? '✕' : '⚠'}
    </div>
  );
}*/

/**
 * Inline field error message
 */
/*interface FieldErrorMessageProps {
  error?: ValidationError;
}*/

/*export function FieldErrorMessage({ error }: FieldErrorMessageProps) {
  if (!error) {
    return null;
  }

  return (
    <div className={`field-error-message ${error.severity}`}>
      {error.message}
    </div>
  );
}*/
