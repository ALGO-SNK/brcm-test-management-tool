/**
 * XML to JSON Step Parser
 * Parses Azure DevOps XML steps to JSON format
 * Handles the actual ADO step XML structure with <steps><step><parameterizedString> format
 * Handles malformed XML with error recovery
 */

import type { StepData, XMLParseResult, ElementCategory } from '../types';

/**
 * Parse XML steps string from ADO custom field
 * Actual format:
 * <steps id="0" last="16">
 *   <step id="2" type="ActionStep">
 *     <parameterizedString isformatted="true">&lt;DIV&gt;&lt;P&gt;Action=DELAY|Value=5|&lt;/P&gt;&lt;/DIV&gt;</parameterizedString>
 *     <description/>
 *   </step>
 * </steps>
 */
export function parseXMLSteps(xmlString: string): XMLParseResult {
  const steps: StepData[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!xmlString || xmlString.trim() === '') {
    return { steps, errors, warnings };
  }

  try {
    // Parse the actual ADO step XML structure
    return parseADOStepStructure(xmlString);
  } catch (error) {
    // Last resort: try to recover from pipe-delimited format
    const partial = recoverFromPipeDelimited(xmlString);
    errors.push(`Failed to parse XML structure: ${error instanceof Error ? error.message : String(error)}`);
    return {
      steps: partial,
      errors,
      warnings: partial.length > 0 ? ['Parsed with errors - some steps may be incomplete'] : [],
    };
  }
}

/**
 * Parse the actual ADO <steps><step><parameterizedString> structure
 */
function parseADOStepStructure(xmlString: string): XMLParseResult {
  const steps: StepData[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];

  // Remove XML declaration
  const cleanXml = xmlString.replace(/<\?xml[^?]*\?>/, '').trim();

  // Extract all <step> elements
  const stepPattern = /<step\s+id="([^"]+)"[^>]*>([\s\S]*?)<\/step>/gi;
  let match;
  let stepOrder = 0;

  while ((match = stepPattern.exec(cleanXml)) !== null) {
    const stepId = match[1];
    const stepContent = match[2];

    try {
      // Extract parameterizedString elements
      const paramStrings = extractParameterizedStrings(stepContent);

      if (paramStrings.length === 0) {
        warnings.push(`Step ${stepId} has no action content`);
        continue;
      }

      // Parse the pipe-delimited action from first parameterizedString
      const step = parsePipeDelimitedAction(paramStrings[0], stepOrder, stepId);

      if (step && step.action) {
        steps.push(step);
        stepOrder++;
      } else {
        warnings.push(`Step ${stepId} could not be parsed`);
      }
    } catch (error) {
      warnings.push(`Failed to parse step ${stepId}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  if (steps.length === 0 && warnings.length === 0) {
    errors.push('No valid steps found in XML');
  }

  return { steps, errors, warnings };
}

/**
 * Extract parameterizedString elements from step content
 */
function extractParameterizedStrings(stepContent: string): string[] {
  const strings: string[] = [];
  const paramPattern = /<parameterizedString[^>]*>([\s\S]*?)<\/parameterizedString>/gi;
  let match;

  while ((match = paramPattern.exec(stepContent)) !== null) {
    const content = match[1];
    strings.push(content);
  }

  return strings;
}

/**
 * Parse pipe-delimited action format: Action=VALUE|Element=VALUE|...
 * Handles HTML-encoded content like &lt;DIV&gt;&lt;P&gt;Action=...&lt;/P&gt;&lt;/DIV&gt;
 */
function parsePipeDelimitedAction(content: string, order: number, stepId?: string): StepData | null {
  // Unescape HTML entities first
  let cleanContent = unescapeHTML(content);

  // Remove HTML tags if present: <DIV><P>Action=...| </P></DIV>
  cleanContent = cleanContent.replace(/<[^>]+>/g, '').trim();

  if (!cleanContent) {
    return null;
  }

  // Parse pipe-delimited key=value pairs
  const attributes: Record<string, string> = {};
  const pairs = cleanContent.split('|').filter((p) => p.trim());

  for (const pair of pairs) {
    const [key, ...valueParts] = pair.split('=');
    if (key && valueParts.length > 0) {
      const value = valueParts.join('=').trim(); // Handle values with = in them
      attributes[key.trim()] = value;
    }
  }

  const action = attributes['Action'];
  if (!action) {
    return null;
  }

  // Build StepData object - preserve original step ID from ADO
  const step: StepData = {
    id: stepId ?? '', // Keep original step ID from ADO XML (e.g., "15", "14", "2", etc.)
    action: action.toUpperCase(),
    element: attributes['Element'] || '',
    elementCategory: normalizeElementCategory(attributes['ElementCategory'] || 'XPATH'),
    value: attributes['Value'] || '',
    expectedValue: attributes['ExpectedVl'] || attributes['ExpectedValue'] || '',
    key: attributes['DataKey'] || attributes['Key'] || '',
    headers: attributes['Headers'] || '',
    description: attributes['Description'] || '',
    stepDescription: attributes['Description'] || '',
    isConcatenated: attributes['IsConcatenated']?.toLowerCase() === 'true',
    isElementPathDynamic: attributes['IsElementPathDynamic']?.toLowerCase() === 'true',
    elementReplaceTextDataKey: attributes['ElementPathReplaceKey'] || attributes['ElementReplaceTextDataKey'] || '',
    extraFields: {
      // Store any extra fields not in the standard contract
      ...Object.keys(attributes)
        .filter(k => !['Action', 'Element', 'ElementCategory', 'Value', 'ExpectedVl', 'DataKey', 'Headers', 'Description', 'Key', 'ExpectedValue', 'IsConcatenated', 'IsElementPathDynamic', 'ElementPathReplaceKey', 'ElementReplaceTextDataKey'].includes(k))
        .reduce((acc, k) => ({ ...acc, [k]: attributes[k] }), {})
    },
    order,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  return step;
}

/**
 * Recover steps from pipe-delimited format (fallback)
 */
function recoverFromPipeDelimited(xmlString: string): StepData[] {
  const steps: StepData[] = [];
  const lines = xmlString.split('\n');
  let stepOrder = 0;

  for (const line of lines) {
    if (line.includes('Action=')) {
      try {
        const step = parsePipeDelimitedAction(line, stepOrder);
        if (step?.action) {
          steps.push(step);
          stepOrder++;
        }
      } catch {
        // Skip invalid lines
      }
    }
  }

  return steps;
}

/**
 * Normalize ElementCategory to known values
 */
function normalizeElementCategory(category: string): ElementCategory {
  const known: ElementCategory[] = ['XPATH', 'ID', 'TAGNAME', 'CSSSELECTOR', 'LINKTEXT', 'NAME', 'URL', 'JSPATH', 'VERIFY', 'VERIFYERROR'];

  const normalized = category.toUpperCase().trim();
  if (known.includes(normalized as ElementCategory)) {
    return normalized as ElementCategory;
  }

  // Default to XPATH if unknown
  console.warn(`Unknown ElementCategory: ${category}, defaulting to XPATH`);
  return 'XPATH';
}

/**
 * Unescape HTML/XML entities (&lt; → <, &nbsp; → space, etc.)
 */
function unescapeHTML(text: string): string {
  if (!text) {
    return text;
  }

  const entities: Record<string, string> = {
    '&lt;': '<',
    '&gt;': '>',
    '&amp;': '&',
    '&quot;': '"',
    '&apos;': "'",
    '&#39;': "'",
    '&nbsp;': ' ',
    '&tab;': '\t',
  };

  let result = text;

  // Replace named entities (must do &amp; last to avoid double-unescaping)
  for (const [entity, char] of Object.entries(entities)) {
    result = result.replace(new RegExp(entity, 'g'), char);
  }

  // Handle numeric entities &#123; or &#xAB;
  result = result.replace(/&#(\d+);/g, (_match, code) => String.fromCharCode(parseInt(code, 10)));
  result = result.replace(/&#x([0-9A-Fa-f]+);/g, (_match, code) => String.fromCharCode(parseInt(code, 16)));

  return result;
}


/**
 * Extract steps from ADO work item custom field
 */
export function extractStepsFromWorkItem(
  workItem: { fields?: Record<string, unknown> },
  fieldName: string = 'Microsoft.VSTS.TCM.Steps',
): XMLParseResult {
  const stepsField = workItem.fields?.[fieldName];

  if (typeof stepsField !== 'string') {
    return {
      steps: [],
      errors: [`Field ${fieldName} not found in work item`],
      warnings: [],
    };
  }

  return parseXMLSteps(stepsField);
}

/**
 * Validate XML structure (basic check)
 */
export function isValidXML(xmlString: string): boolean {
  if (!xmlString || xmlString.trim() === '') {
    return true; // Empty is valid
  }

  try {
    // Check for matching < and >
    const openCount = (xmlString.match(/</g) || []).length;
    const closeCount = (xmlString.match(/>/g) || []).length;

    if (openCount !== closeCount) {
      return false;
    }

    // Try to parse
    const result = parseXMLSteps(xmlString);
    return result.errors.length === 0;
  } catch {
    return false;
  }
}

/**
 * Count steps in XML without full parsing
 */
export function countStepsInXML(xmlString: string): number {
  const matches = xmlString.match(/Action=/g) || [];
  return matches.length;
}

/**
 * Escape HTML/XML special characters
 */
function escapeXmlText(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Build step command text from fields (pipe-delimited format)
 * Ensures trailing pipe at the end for ADO format compatibility
 */
function buildStepCommandText(step: {
  action?: string;
  element?: string;
  elementCategory?: string;
  value?: string;
  expectedValue?: string;
  key?: string;
  headers?: string;
  description?: string;
  isConcatenated?: boolean;
  isElementPathDynamic?: boolean;
  elementReplaceTextDataKey?: string;
}): string {
  const parts: string[] = [];

  if (step.action) parts.push(`Action=${step.action}`);
  if (step.element) parts.push(`Element=${step.element}`);
  if (step.elementCategory) parts.push(`ElementCategory=${step.elementCategory}`);
  if (step.value) parts.push(`Value=${step.value}`);
  if (step.expectedValue) parts.push(`ExpectedValue=${step.expectedValue}`);
  if (step.key) parts.push(`DataKey=${step.key}`);
  if (step.headers) parts.push(`Headers=${step.headers}`);
  if (step.description) parts.push(`Description=${step.description}`);
  if (step.isConcatenated) parts.push(`IsConcatenated=true`);
  if (step.isElementPathDynamic) parts.push(`IsElementPathDynamic=true`);
  if (step.elementReplaceTextDataKey) parts.push(`ElementReplaceTextDataKey=${step.elementReplaceTextDataKey}`);

  let commandText = parts.join('|');

  // Ensure trailing pipe for ADO format compatibility
  if (commandText && !commandText.endsWith('|')) {
    commandText += '|';
  }

  return commandText;
}

/**
 * Serialize steps back to ADO XML format
 * Converts StepData or ParsedStep objects to the XML structure expected by ADO
 * Matches the ADO XML structure with proper escaping and formatting
 */
export function serializeStepsToXML(
  steps: Array<{
    id?: string;
    action?: string;
    element?: string;
    elementCategory?: string | ElementCategory;
    value?: string;
    expectedValue?: string;
    key?: string;
    headers?: string;
    description?: string;
    isConcatenated?: boolean;
    isElementPathDynamic?: boolean;
    elementReplaceTextDataKey?: string;
    order?: number;
  }>,
): string {
  if (!steps || steps.length === 0) {
    return '';
  }

  // Calculate "last" attribute: use the highest step ID number
  const lastId = Math.max(...steps.map(step => Number(step.id) || Number(step.order) + 1 || 0), 0);

  const lines = [
    '<?xml version="1.0" encoding="utf-16"?>',
    `<steps id="0" last="${lastId}">`,
  ];

  steps.forEach(step => {
    const stepId = String(step.id ?? (step.order ?? 0) + 1);
    const commandText = buildStepCommandText(step);

    // Wrap in DIV/P tags and escape
    const wrappedCommand = `<DIV><P>${commandText}</P></DIV>`;
    const escapedCommand = escapeXmlText(wrappedCommand);

    // Build the step element with proper formatting
    lines.push(`  <step id="${escapeXmlText(stepId)}" type="ActionStep">`);
    lines.push(`    <parameterizedString isformatted="true">${escapedCommand}</parameterizedString>`);
    // Include second parameterizedString with BR tag (required by ADO)
    lines.push(`    <parameterizedString isformatted="true">&lt;DIV&gt;&lt;P&gt;&lt;BR/&gt;&lt;/P&gt;&lt;/DIV&gt;</parameterizedString>`);
    lines.push(`    <description />`);
    lines.push(`  </step>`);
  });

  lines.push(`</steps>`);
  return lines.join('\n');
}
