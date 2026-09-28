export function exportDate(value: string | null | undefined) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('es-ES');
}

export function exportDateTime(value: string | null | undefined) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('es-ES');
}

export function datedCsvFilename(name: string) {
  return `${name}-${new Date().toISOString().slice(0, 10)}.csv`;
}

export function joinExportValues(values: Array<string | number | null | undefined>) {
  return values.filter(value => value !== null && value !== undefined && String(value).trim()).join(' | ');
}
