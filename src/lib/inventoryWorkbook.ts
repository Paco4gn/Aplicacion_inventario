import { api } from './api';
import type { Asset, AssetAssignment, AuditLog, Component, ComponentMovement, Employee, Incident, IncidentComment, License, LicenseAssignment, Software } from '../types';

type Column = { header: string; key: string; width?: number };
type Row = Record<string, string | number | boolean | null | undefined>;

function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export async function downloadCompleteInventoryXlsx() {
  const [
    assetsResult, employeesResult, assignmentsResult, incidentsResult, commentsResult,
    softwareResult, licensesResult, licenseAssignmentsResult, componentsResult,
    movementsResult, auditResult,
  ] = await Promise.all([
    api.from('assets').select('*').order('serial_number'),
    api.from('employees').select('*').order('name'),
    api.from('asset_assignments').select('*').order('assigned_at', { ascending: false }),
    api.from('incidents').select('*').order('opened_at', { ascending: false }),
    api.from('incident_comments').select('*').order('created_at'),
    api.from('software').select('*').order('name'),
    api.from('licenses').select('*').order('expiry_date'),
    api.from('license_assignments').select('*').order('assigned_at', { ascending: false }),
    api.from('components').select('*').order('name'),
    api.from('component_movements').select('*').order('moved_at', { ascending: false }),
    api.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(5000),
  ]);

  const results = [assetsResult, employeesResult, assignmentsResult, incidentsResult, commentsResult, softwareResult, licensesResult, licenseAssignmentsResult, componentsResult, movementsResult, auditResult];
  const failed = results.find(result => result.error);
  if (failed?.error) throw new Error(failed.error.message);

  const assets = (assetsResult.data ?? []) as Asset[];
  const employees = (employeesResult.data ?? []) as Employee[];
  const assignments = (assignmentsResult.data ?? []) as AssetAssignment[];
  const incidents = (incidentsResult.data ?? []) as Incident[];
  const comments = (commentsResult.data ?? []) as IncidentComment[];
  const software = (softwareResult.data ?? []) as Software[];
  const licenses = (licensesResult.data ?? []) as License[];
  const licenseAssignments = (licenseAssignmentsResult.data ?? []) as LicenseAssignment[];
  const components = (componentsResult.data ?? []) as Component[];
  const movements = (movementsResult.data ?? []) as ComponentMovement[];
  const audit = (auditResult.data ?? []) as AuditLog[];

  const employeeById = new Map(employees.map(item => [item.id, item]));
  const assetById = new Map(assets.map(item => [item.id, item]));
  const softwareById = new Map(software.map(item => [item.id, item]));
  const licenseById = new Map(licenses.map(item => [item.id, item]));
  const componentById = new Map(components.map(item => [item.id, item]));
  const currentAssetAssignment = new Map(assignments.filter(item => !item.returned_at).map(item => [item.asset_id, item]));

  const ExcelJS = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'IT Inventario FEVAL';
  workbook.created = new Date();
  workbook.modified = new Date();

  function addSheet(name: string, columns: Column[], rows: Row[]) {
    const sheet = workbook.addWorksheet(name, { views: [{ state: 'frozen', ySplit: 1 }] });
    sheet.columns = columns.map(column => ({ ...column, width: column.width ?? Math.min(Math.max(column.header.length + 3, 14), 34) }));
    rows.forEach(row => sheet.addRow(row));
    sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: Math.max(sheet.rowCount, 1), column: columns.length } };
    const header = sheet.getRow(1);
    header.height = 24;
    header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF173B70' } };
    header.alignment = { vertical: 'middle', horizontal: 'left' };
    sheet.eachRow((row, rowNumber) => {
      row.alignment = { vertical: 'top', wrapText: false };
      if (rowNumber > 1 && rowNumber % 2 === 0) row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F8FC' } };
      row.eachCell(cell => { cell.border = { bottom: { style: 'hair', color: { argb: 'FFD9E2EE' } } }; });
    });
    return sheet;
  }

  const summary = workbook.addWorksheet('Resumen', { views: [{ showGridLines: false }] });
  summary.columns = [{ width: 35 }, { width: 22 }];
  summary.mergeCells('A1:B1');
  summary.getCell('A1').value = 'IT Inventario FEVAL';
  summary.getCell('A1').font = { size: 22, bold: true, color: { argb: 'FFFFFFFF' } };
  summary.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF173B70' } };
  summary.getCell('A1').alignment = { vertical: 'middle' };
  summary.getRow(1).height = 40;
  const activeAssignments = assignments.filter(item => !item.returned_at);
  const openIncidents = incidents.filter(item => !['resolved', 'closed'].includes(item.status));
  const summaryRows: Array<[string, string | number]> = [
    ['Generado', new Date().toLocaleString('es-ES')], ['Activos', assets.length], ['Activos asignados', activeAssignments.length],
    ['Empleados activos', employees.filter(item => item.active).length], ['Incidencias abiertas', openIncidents.length],
    ['Aplicaciones', software.length], ['Licencias', licenses.length], ['Componentes', components.length],
    ['Valor de activos €', assets.reduce((total, item) => total + (item.purchase_value ?? 0), 0)],
    ['Valor de componentes €', components.reduce((total, item) => total + item.stock * (item.unit_cost ?? 0), 0)],
  ];
  summaryRows.forEach(([label, value], index) => {
    const row = index + 3;
    summary.getCell(row, 1).value = label;
    summary.getCell(row, 2).value = value;
    summary.getCell(row, 1).font = { bold: true, color: { argb: 'FF334155' } };
    summary.getCell(row, 2).font = { bold: true, color: { argb: 'FF173B70' } };
    summary.getRow(row).height = 22;
  });

  addSheet('Activos', [
    { header: 'ID', key: 'id', width: 38 }, { header: 'Nº serie', key: 'serial_number', width: 20 }, { header: 'Nombre', key: 'name', width: 24 }, { header: 'Tipo', key: 'asset_type' },
    { header: 'Marca', key: 'brand' }, { header: 'Modelo', key: 'model', width: 24 }, { header: 'Estado', key: 'status' }, { header: 'Asignado a', key: 'employee', width: 28 },
    { header: 'Email', key: 'email', width: 28 }, { header: 'Departamento', key: 'department', width: 22 }, { header: 'Fecha asignación', key: 'assigned_at', width: 21 },
    { header: 'Ubicación', key: 'location', width: 20 }, { header: 'Valor €', key: 'purchase_value' }, { header: 'Compra', key: 'purchase_date' }, { header: 'Garantía', key: 'warranty_expiry' }, { header: 'Fin de vida', key: 'end_of_life' },
    { header: 'Sistema operativo', key: 'operating_system', width: 30 }, { header: 'Procesador', key: 'processor', width: 30 }, { header: 'RAM GB', key: 'ram_gb' }, { header: 'Disco GB', key: 'storage_gb' },
    { header: 'IP', key: 'ip_address', width: 18 }, { header: 'MAC', key: 'mac_address', width: 20 }, { header: 'IMEI', key: 'imei', width: 20 }, { header: 'SIM', key: 'sim_number', width: 20 },
    { header: 'Conexión', key: 'connection_type' }, { header: 'Pantalla', key: 'screen_size' }, { header: 'Resolución', key: 'resolution' }, { header: 'Tóner', key: 'toner_model' },
    { header: 'Último inventario', key: 'last_inventory_at', width: 21 }, { header: 'Notas', key: 'notes', width: 35 },
  ], assets.map(asset => {
    const assignment = currentAssetAssignment.get(asset.id);
    const employee = assignment?.employee_id ? employeeById.get(assignment.employee_id) : null;
    const plainAsset = Object.fromEntries(Object.entries(asset).filter(([key]) => key !== 'current_employee' && key !== 'parent_asset')) as Row;
    return { ...plainAsset, employee: employee?.name, email: employee?.email, department: employee?.department, assigned_at: assignment?.assigned_at };
  }));

  addSheet('Empleados', [
    { header: 'ID', key: 'id', width: 38 }, { header: 'Nombre', key: 'name', width: 28 }, { header: 'Email', key: 'email', width: 28 }, { header: 'Departamento', key: 'department', width: 22 },
    { header: 'Cargo', key: 'position', width: 24 }, { header: 'Activo', key: 'active' }, { header: 'Equipos asignados', key: 'assets', width: 38 }, { header: 'Creado', key: 'created_at', width: 21 },
  ], employees.map(employee => ({ ...employee, assets: activeAssignments.filter(item => item.employee_id === employee.id).map(item => assetById.get(item.asset_id)?.serial_number).filter(Boolean).join(' | ') })));

  addSheet('Asignaciones', [
    { header: 'ID', key: 'id', width: 38 }, { header: 'Activo', key: 'asset', width: 22 }, { header: 'Empleado', key: 'employee', width: 28 }, { header: 'Asignado', key: 'assigned_at', width: 21 },
    { header: 'Devuelto', key: 'returned_at', width: 21 }, { header: 'Estado', key: 'state' }, { header: 'Notas', key: 'notes', width: 35 },
  ], assignments.map(item => ({ ...item, asset: assetById.get(item.asset_id)?.serial_number, employee: item.employee_id ? employeeById.get(item.employee_id)?.name : '', state: item.returned_at ? 'Devuelto' : 'Vigente' })));

  addSheet('Incidencias', [
    { header: 'ID', key: 'id', width: 38 }, { header: 'Título', key: 'title', width: 35 }, { header: 'Estado', key: 'status' }, { header: 'Prioridad', key: 'priority' },
    { header: 'Activo', key: 'asset', width: 22 }, { header: 'Empleado', key: 'employee', width: 28 }, { header: 'Responsable', key: 'assigned_to', width: 28 },
    { header: 'Descripción', key: 'description', width: 45 }, { header: 'Resolución', key: 'resolution', width: 45 }, { header: 'Abierta', key: 'opened_at', width: 21 }, { header: 'Vence', key: 'due_at', width: 21 }, { header: 'Cerrada', key: 'closed_at', width: 21 },
    { header: 'Comentarios', key: 'comments', width: 55 },
  ], incidents.map(item => ({ ...item, asset: item.asset_id ? assetById.get(item.asset_id)?.serial_number : '', employee: item.employee_id ? employeeById.get(item.employee_id)?.name : '', assigned_to: item.assigned_to_name || item.assigned_to_email, comments: comments.filter(comment => comment.incident_id === item.id).map(comment => `${comment.author_name}: ${comment.body}`).join(' | ') })));

  addSheet('Software y licencias', [
    { header: 'Software', key: 'software', width: 28 }, { header: 'Fabricante', key: 'vendor', width: 22 }, { header: 'Categoría', key: 'category' }, { header: 'Versión', key: 'version' },
    { header: 'ID licencia', key: 'id', width: 38 }, { header: 'Clave', key: 'license_key', width: 30 }, { header: 'Tipo', key: 'license_type' }, { header: 'Puestos', key: 'seats' }, { header: 'Usados', key: 'seats_used' },
    { header: 'Compra', key: 'purchase_date' }, { header: 'Vencimiento', key: 'expiry_date' }, { header: 'Coste €', key: 'cost' }, { header: 'Contacto', key: 'vendor_contact', width: 28 }, { header: 'Notas', key: 'notes', width: 35 },
  ], licenses.map(item => { const sw = softwareById.get(item.software_id); return { ...item, software: sw?.name, vendor: sw?.vendor, category: sw?.category, version: sw?.version }; }));

  addSheet('Asignaciones licencias', [
    { header: 'Licencia', key: 'license', width: 32 }, { header: 'Software', key: 'software', width: 28 }, { header: 'Empleado', key: 'employee', width: 28 }, { header: 'Activo', key: 'asset', width: 22 },
    { header: 'Asignada', key: 'assigned_at', width: 21 }, { header: 'Devuelta', key: 'returned_at', width: 21 }, { header: 'Notas', key: 'notes', width: 35 },
  ], licenseAssignments.map(item => { const license = licenseById.get(item.license_id); return { ...item, license: license?.license_key, software: license ? softwareById.get(license.software_id)?.name : '', employee: item.employee_id ? employeeById.get(item.employee_id)?.name : '', asset: item.asset_id ? assetById.get(item.asset_id)?.serial_number : '' }; }));

  addSheet('Componentes', [
    { header: 'ID', key: 'id', width: 38 }, { header: 'Nombre', key: 'name', width: 28 }, { header: 'Tipo', key: 'component_type' }, { header: 'Marca', key: 'brand' }, { header: 'Modelo', key: 'model', width: 22 },
    { header: 'Stock', key: 'stock' }, { header: 'Mínimo', key: 'min_stock' }, { header: 'Ubicación', key: 'location', width: 20 }, { header: 'Coste unidad €', key: 'unit_cost' }, { header: 'Valor total €', key: 'total_value' }, { header: 'Notas', key: 'notes', width: 35 },
  ], components.map(item => ({ ...item, total_value: item.stock * (item.unit_cost ?? 0) })));

  addSheet('Movimientos', [
    { header: 'Componente', key: 'component', width: 28 }, { header: 'Movimiento', key: 'movement_type' }, { header: 'Cantidad', key: 'quantity' }, { header: 'Motivo', key: 'reason', width: 35 },
    { header: 'Activo', key: 'asset', width: 22 }, { header: 'Fecha', key: 'moved_at', width: 21 },
  ], movements.map(item => ({ ...item, component: componentById.get(item.component_id)?.name, asset: item.asset_id ? assetById.get(item.asset_id)?.serial_number : '' })));

  addSheet('Auditoría', [
    { header: 'Fecha', key: 'created_at', width: 21 }, { header: 'Acción', key: 'action' }, { header: 'Entidad', key: 'entity_type' }, { header: 'Nombre', key: 'entity_name', width: 30 },
    { header: 'ID entidad', key: 'entity_id', width: 38 }, { header: 'Usuario', key: 'performed_by', width: 28 }, { header: 'Detalles', key: 'details', width: 55 },
  ], audit.map(item => ({ ...item, details: JSON.stringify(item.details ?? {}) })));

  const buffer = await workbook.xlsx.writeBuffer();
  const filename = `it-inventario-completo-${new Date().toISOString().slice(0, 10)}.xlsx`;
  downloadBlob(filename, new Blob([buffer as ArrayBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
}
