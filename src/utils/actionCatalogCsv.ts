/**
 * CSV serialization/parsing for the action catalog.
 * Flat schema so the file opens cleanly in Excel and round-trips the contract.
 */

export const ACTION_CSV_CONTRACT_FIELDS = [
  'locator', 'locatorType', 'value', 'expectedVl', 'dataKey',
  'headers', 'elementPathReplaceKey', 'isElementPathDynamic', 'isConcatenated',
] as const;

const HEADERS = [
  'action_key', 'label', 'description', 'category',
  ...ACTION_CSV_CONTRACT_FIELDS,
  'is_deprecated',
] as const;

type ContractValue = 'required' | 'optional' | 'not-used';

export interface CsvActionRow {
  action_key: string;
  label: string;
  description: string;
  category: string;
  contract: Record<string, ContractValue>;
  is_deprecated: number;
}

interface CsvActionInput {
  action_key: string;
  label?: string;
  description?: string;
  category?: string;
  contract?: Record<string, string>;
  is_deprecated?: number;
}

function escapeCsvCell(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function actionsToCsv(actions: CsvActionInput[]): string {
  const lines: string[] = [HEADERS.join(',')];

  for (const action of actions) {
    const contract = action.contract || {};
    const cells: string[] = [
      action.action_key ?? '',
      action.label ?? '',
      action.description ?? '',
      action.category ?? '',
      ...ACTION_CSV_CONTRACT_FIELDS.map((f) => contract[f] ?? 'not-used'),
      String(action.is_deprecated ? 1 : 0),
    ];
    lines.push(cells.map((c) => escapeCsvCell(String(c))).join(','));
  }

  // UTF-8 BOM so Excel opens it with correct encoding.
  return '﻿' + lines.join('\r\n');
}

/**
 * Tolerant CSV parser: handles quoted fields, escaped quotes, commas and
 * newlines inside quotes, CRLF/LF, and a leading UTF-8 BOM.
 */
function parseCsv(text: string): string[][] {
  const clean = text.replace(/^﻿/, '');
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];

    if (inQuotes) {
      if (ch === '"') {
        if (clean[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(cell);
      cell = '';
    } else if (ch === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else if (ch === '\r') {
      // swallow; handled by the following \n (or finalize at EOF below)
    } else {
      cell += ch;
    }
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  return rows.filter((r) => r.length > 0 && !(r.length === 1 && r[0].trim() === ''));
}

function normalizeContractValue(raw: string): ContractValue {
  const v = raw.trim().toLowerCase();
  if (v === 'required') return 'required';
  if (v === 'optional') return 'optional';
  return 'not-used';
}

export interface CsvParseResult {
  rows: CsvActionRow[];
  errors: string[];
}

export function parseActionsCsv(text: string): CsvParseResult {
  const grid = parseCsv(text);
  const errors: string[] = [];

  if (grid.length === 0) {
    return { rows: [], errors: ['File is empty.'] };
  }

  const header = grid[0].map((h) => h.trim());
  const idx = (name: string) => header.indexOf(name);

  if (idx('action_key') === -1) {
    return { rows: [], errors: ['Missing required "action_key" column in header row.'] };
  }

  const rows: CsvActionRow[] = [];

  for (let r = 1; r < grid.length; r++) {
    const cols = grid[r];
    const key = (cols[idx('action_key')] ?? '').trim().toUpperCase();

    if (!key) {
      errors.push(`Row ${r + 1}: skipped (empty action_key).`);
      continue;
    }

    const get = (name: string) => {
      const i = idx(name);
      return i === -1 ? '' : (cols[i] ?? '').trim();
    };

    const contract: Record<string, ContractValue> = {};
    for (const f of ACTION_CSV_CONTRACT_FIELDS) {
      contract[f] = normalizeContractValue(get(f));
    }

    rows.push({
      action_key: key,
      label: get('label') || key,
      description: get('description'),
      category: get('category') || 'custom',
      contract,
      is_deprecated: get('is_deprecated') === '1' ? 1 : 0,
    });
  }

  return { rows, errors };
}
