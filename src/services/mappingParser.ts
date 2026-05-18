import type { TestSuiteMapping } from '../types/api';

/**
 * Parses test suite mappings from XML stored in Azure DevOps work item fields.
 * Expected format: XML with rows containing TestSuiteId, TestSuiteName, ReleaseDefinitionId, etc.
 */

interface MappingRow {
  testSuiteId?: string;
  testSuiteName?: string;
  releaseDefinitionId?: string;
  releaseDefinitionName?: string;
  assignedPerson?: string;
  tag?: string;
  priority?: string;
}

function parseXmlValue(xmlString: string, tagName: string): string | null {
  const regex = new RegExp(`<${tagName}[^>]*>([^<]*)</${tagName}>`, 'i');
  const match = xmlString.match(regex);
  return match ? match[1] : null;
}

function parseXmlRows(xmlString: string): MappingRow[] {
  const rows: MappingRow[] = [];

  try {
    const rowRegex = /<row[^>]*>(.*?)<\/row>/gi;
    let rowMatch;

    while ((rowMatch = rowRegex.exec(xmlString)) !== null) {
      const rowContent = rowMatch[1];
      const row: MappingRow = {
        testSuiteId: parseXmlValue(rowContent, 'TestSuiteId') || undefined,
        testSuiteName: parseXmlValue(rowContent, 'TestSuiteName') || undefined,
        releaseDefinitionId: parseXmlValue(rowContent, 'ReleaseDefinitionId') || undefined,
        releaseDefinitionName: parseXmlValue(rowContent, 'ReleaseDefinitionName') || undefined,
        assignedPerson: parseXmlValue(rowContent, 'AssignedPerson') || undefined,
        tag: parseXmlValue(rowContent, 'Tag') || undefined,
        priority: parseXmlValue(rowContent, 'Priority') || undefined,
      };

      if (row.testSuiteId && row.releaseDefinitionId) {
        rows.push(row);
      }
    }
  } catch {
    // Silently handle parse errors and return empty array
  }

  return rows;
}

export function parseTestSuiteMappings(xmlString: string): TestSuiteMapping[] {
  if (!xmlString || typeof xmlString !== 'string') {
    return [];
  }

  const rows = parseXmlRows(xmlString);
  const mappings = rows
    .map((row) => {
      const suiteId = Number(row.testSuiteId);
      const releaseDefId = Number(row.releaseDefinitionId);
      const priority = row.priority ? Number(row.priority) : null;

      if (!Number.isFinite(suiteId) || !Number.isFinite(releaseDefId)) {
        return null;
      }

      return {
        testSuiteId: suiteId,
        testSuiteName: String(row.testSuiteName || '').trim(),
        releaseDefinitionId: releaseDefId,
        releaseDefinitionName: String(row.releaseDefinitionName || '').trim(),
        assignedPerson: row.assignedPerson ? String(row.assignedPerson).trim() : undefined,
        tag: row.tag ? String(row.tag).trim() : undefined,
        priority: Number.isFinite(priority) ? priority : undefined,
      } satisfies TestSuiteMapping;
    }) as TestSuiteMapping[];

  // Deduplicate by testSuiteId, keeping the first occurrence
  const seen = new Set<number>();
  return mappings.filter((mapping) => {
    if (seen.has(mapping.testSuiteId)) {
      return false;
    }
    seen.add(mapping.testSuiteId);
    return true;
  });
}

/**
 * Parse CSV of work item IDs and return as array of numbers
 */
export function parseWorkItemIdsCsv(csv: string): number[] {
  return Array.from(
    new Set(
      csv
        .split(/[,\s]+/)
        .map((token) => Number(token.trim()))
        .filter((token) => Number.isFinite(token) && token > 0),
    ),
  );
}

/**
 * Parse CSV of excluded suite IDs
 */
export function parseExcludedSuiteIdsCsv(csv: string): Set<number> {
  const ids = new Set<number>();
  csv
    .split(/[,\s]+/)
    .map((token) => Number(token.trim()))
    .filter((token) => Number.isFinite(token) && token > 0)
    .forEach((id) => ids.add(id));
  return ids;
}

/**
 * Parse CSV of excluded release-definition (CD) ids
 */
export function parseExcludedReleaseDefinitionIdsCsv(csv: string): Set<number> {
  const ids = new Set<number>();
  csv
    .split(/[,\s]+/)
    .map((token) => Number(token.trim()))
    .filter((token) => Number.isFinite(token) && token > 0)
    .forEach((id) => ids.add(id));
  return ids;
}

/**
 * Parse CSV of excluded suite name patterns
 */
export function parseExcludedSuiteNamePatterns(csv: string): string[] {
  return csv
    .split(/[,;]+/)
    .map((pattern) => pattern.trim().toLowerCase())
    .filter((pattern) => pattern.length > 0);
}

/**
 * Check if a suite name matches any excluded pattern
 */
export function isSuiteNameExcluded(suiteName: string, excludedPatterns: string[]): boolean {
  const normalized = suiteName.toLowerCase();
  return excludedPatterns.some((pattern) => normalized.includes(pattern));
}
