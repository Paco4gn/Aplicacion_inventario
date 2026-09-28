export interface CsvColumn<T extends object> {
  key?: keyof T | string;
  label: string;
  value?: (row: T) => unknown;
}

function cellValue(value: unknown) {
  if (value == null) return '';
  if (typeof value === 'boolean') return value ? 'Sí' : 'No';
  if (Array.isArray(value)) return value.join(' | ');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

const EXCEL_DELIMITER = ';';

function escapeCell(value: unknown, delimiter = EXCEL_DELIMITER) {
  const isText = typeof value === 'string';
  let text = cellValue(value);
  // Avoid spreadsheet formula execution when a CSV is opened in Excel or LibreOffice.
  if (isText && /^[\t\r ]*[=+\-@]/.test(text)) text = `'${text}`;
  if (text.includes(delimiter) || text.includes(',') || text.includes('"') || text.includes('\n') || text.includes('\r')) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function buildCSV<T extends object>(rows: T[], columns: CsvColumn<T>[]) {
  const headerRow = columns.map(column => escapeCell(column.label)).join(EXCEL_DELIMITER);
  const dataRows = rows.map(row => {
    const record = row as Record<string, unknown>;
    return columns.map(column => escapeCell(column.value ? column.value(row) : record[String(column.key ?? '')])).join(EXCEL_DELIMITER);
  });
  // Excel reads this directive before applying the computer's regional list separator.
  return [`sep=${EXCEL_DELIMITER}`, headerRow, ...dataRows].join('\r\n');
}

export function exportCSV<T extends object>(filename: string, rows: T[], columns: CsvColumn<T>[]) {
  const csv = buildCSV(rows, columns);

  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function parseCSV(text: string): Record<string, string>[] {
  let source = text.replace(/^\uFEFF/, '');
  const separatorDirective = source.match(/^sep=(.)\r?\n/i);
  const explicitDelimiter = separatorDirective?.[1];
  if (separatorDirective) source = source.slice(separatorDirective[0].length);
  const firstLine = source.split(/\r?\n/, 1)[0] ?? '';
  const delimiter = explicitDelimiter
    ?? ((firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ';' : ',');
  const rows: string[][] = [];
  let row: string[] = [];
  let value = '';
  let quoted = false;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (char === '"') {
      if (quoted && source[index + 1] === '"') {
        value += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === delimiter && !quoted) {
      row.push(value.trim());
      value = '';
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && source[index + 1] === '\n') index += 1;
      row.push(value.trim());
      if (row.some(cell => cell.length > 0)) rows.push(row);
      row = [];
      value = '';
    } else {
      value += char;
    }
  }
  row.push(value.trim());
  if (row.some(cell => cell.length > 0)) rows.push(row);
  if (rows.length < 2) return [];

  const headers = rows[0];
  return rows.slice(1).map(values => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ''])));
}
