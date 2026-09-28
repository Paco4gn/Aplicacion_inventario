import { describe, expect, it } from 'vitest';
import { buildCSV, parseCSV } from './csv';

describe('CSV utilities', () => {
  it('exports formatted relations, quotes and booleans', () => {
    const csv = buildCSV(
      [{ name: 'Equipo, principal', active: true, employee: { name: 'Ana' } }],
      [
        { key: 'name', label: 'Activo' },
        { key: 'active', label: 'En uso' },
        { label: 'Empleado', value: row => row.employee.name },
      ],
    );
    expect(csv).toBe('sep=;\r\nActivo;En uso;Empleado\r\n"Equipo, principal";Sí;Ana');
    expect(parseCSV(csv)).toEqual([{ Activo: 'Equipo, principal', 'En uso': 'Sí', Empleado: 'Ana' }]);
  });

  it('prevents formulas and parses quoted multiline values', () => {
    const csv = buildCSV([{ notes: '=HYPERLINK("bad")\nsegunda línea', variation: -3 }], [
      { key: 'notes', label: 'Notas' },
      { key: 'variation', label: 'Variación' },
    ]);
    expect(csv).toContain("'=HYPERLINK");
    expect(parseCSV(csv)).toEqual([{ Notas: "'=HYPERLINK(\"bad\")\nsegunda línea", Variación: '-3' }]);
  });

  it('accepts semicolon-delimited imports', () => {
    expect(parseCSV('Nombre;Notas\r\nPC-01;Listo')).toEqual([{ Nombre: 'PC-01', Notas: 'Listo' }]);
  });

  it('keeps compatibility with older comma-delimited imports', () => {
    expect(parseCSV('Nombre,Notas\r\nPC-01,"Con monitor, teclado y ratón"')).toEqual([
      { Nombre: 'PC-01', Notas: 'Con monitor, teclado y ratón' },
    ]);
  });
});
