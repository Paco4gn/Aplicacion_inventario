import { useEffect, useState, useRef } from 'react';
import { Plus, Pencil, Trash2, Monitor, Eye, Download, Upload, QrCode, History, CheckSquare, Square, X, ShieldAlert, ShieldCheck, ShieldOff, Printer } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { logAction } from '../lib/audit';
import { exportCSV, parseCSV } from '../lib/csv';
import { useToast } from '../contexts/ToastContext';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { SearchInput } from '../components/ui/SearchInput';
import { Pagination } from '../components/ui/Pagination';
import { SkeletonRow } from '../components/ui/SkeletonRow';
import type { Asset, Employee, AssetAssignment } from '../types';

const PAGE_SIZE = 15;
const ASSET_TYPES = ['Laptop', 'Torre', 'Server', 'Printer', 'Monitor', 'Peripheral', 'Other'];
const STATUSES = [
  { value: 'active', label: 'Activo' },
  { value: 'repair', label: 'En Reparación' },
  { value: 'retired', label: 'Retirado' },
];

const emptyAsset: Partial<Asset> = {
  serial_number: '', name: '', asset_type: 'Laptop', brand: '', model: '',
  status: 'active', location: '', purchase_date: null, purchase_value: null,
  operating_system: '', ip_address: '', mac_address: '', processor: '',
  ram_gb: null, storage_gb: null, last_inventory_at: null,
  warranty_expiry: null, end_of_life: null, notes: '', image_url: '',
};

function statusBadge(s: string) {
  if (s === 'active') return <Badge variant="success">Activo</Badge>;
  if (s === 'repair') return <Badge variant="warning">Reparación</Badge>;
  return <Badge variant="danger">Retirado</Badge>;
}

function warrantyBadge(expiry: string | null) {
  if (!expiry) return null;
  const days = Math.ceil((new Date(expiry).getTime() - Date.now()) / 86400000);
  if (days < 0) return <Badge variant="danger">Garantía vencida</Badge>;
  if (days <= 90) return <Badge variant="warning">Garantía &lt;90d</Badge>;
  return null;
}

const APP_BASE_URL = new URL(import.meta.env.BASE_URL || '/', window.location.origin).toString().replace(/\/$/, '');

function buildPublicUrl(serial: string) {
  return `${APP_BASE_URL}/?asset=${encodeURIComponent(serial)}`;
}

function buildQrUrl(serial: string) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(buildPublicUrl(serial))}`;
}

function statusLabel(s: string) {
  if (s === 'active') return 'Activo';
  if (s === 'repair') return 'En reparacion';
  return 'Retirado';
}

function downloadTextFile(filename: string, content: string, type: string) {
  const blob = new Blob(['\uFEFF' + content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function buildLabelHtml(serial: string, qrSrc: string): string {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/>
<title>Etiqueta ${serial}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0;}
  @page{size:62mm 29mm;margin:0;}
  body{font-family:ui-monospace,monospace;background:white;width:62mm;height:29mm;display:flex;flex-direction:row;align-items:center;justify-content:center;gap:3mm;padding:2mm;}
  .qr{width:25mm;height:25mm;flex-shrink:0;}
  .serial{font-size:14pt;font-weight:800;color:#000;letter-spacing:-0.5px;word-break:break-all;line-height:1.2;}
</style></head><body>
<img class="qr" src="${qrSrc}" alt="QR"/>
<div class="serial">${serial}</div>
<script>
  var img=document.querySelector('img');
  if(img.complete){window.print();}
  else{img.onload=function(){window.print();};img.onerror=function(){window.print();};}
<\/script>
</body></html>`;
}

function printViaIframe(html: string) {
  const existing = document.getElementById('__print_iframe__');
  if (existing) existing.remove();
  const iframe = document.createElement('iframe');
  iframe.id = '__print_iframe__';
  iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:0;height:0;border:none;';
  document.body.appendChild(iframe);
  const doc = iframe.contentDocument!;
  doc.open();
  doc.write(html);
  doc.close();
}

function daysUntil(date: string | null): number | null {
  if (!date) return null;
  return Math.ceil((new Date(date).getTime() - Date.now()) / 86400000);
}

interface HistoryEntry {
  type: 'assignment' | 'incident';
  date: string;
  label: string;
  sublabel: string;
  badge: React.ReactNode;
}

export function Assets() {
  const { showToast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);


  const [assets, setAssets] = useState<Asset[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [assignments, setAssignments] = useState<AssetAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterAvailability, setFilterAvailability] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  const [editing, setEditing] = useState<Partial<Asset>>(emptyAsset);
  const [selected, setSelected] = useState<Asset | null>(null);
  const [assignEmployeeId, setAssignEmployeeId] = useState('');
  const [historyEntries, setHistoryEntries] = useState<HistoryEntry[]>([]);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState<Asset['status']>('active');

  async function load() {
    const [{ data: a }, { data: e }, { data: asgn }] = await Promise.all([
      supabase.from('assets').select('*').order('serial_number'),
      supabase.from('employees').select('*').eq('active', true).order('name'),
      supabase.from('asset_assignments').select('*, employee:employees(id,name)').is('returned_at', null),
    ]);
    setAssets(a ?? []);
    setEmployees(e ?? []);
    setAssignments(asgn ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);
  useEffect(() => { setPage(1); setSelectedIds(new Set()); }, [search, filterStatus, filterType, filterAvailability]);

  function currentEmployee(assetId: string) {
    const asgn = assignments.find(a => a.asset_id === assetId);
    return asgn ? (asgn.employee as unknown as Employee) : null;
  }

  const filtered = assets.filter(a => {
    const q = search.toLowerCase();
    const emp = currentEmployee(a.id);
    const isAvailable = a.status === 'active' && !emp;
    return (
      (!q || a.serial_number.toLowerCase().includes(q) || a.brand.toLowerCase().includes(q)
        || a.model.toLowerCase().includes(q) || a.location.toLowerCase().includes(q)
        || (a.operating_system ?? '').toLowerCase().includes(q)
        || (a.ip_address ?? '').toLowerCase().includes(q)
        || (a.mac_address ?? '').toLowerCase().includes(q)
        || (emp?.name ?? '').toLowerCase().includes(q))
      && (!filterStatus || a.status === filterStatus)
      && (!filterType || a.asset_type === filterType)
      && (!filterAvailability
        || (filterAvailability === 'available' && isAvailable)
        || (filterAvailability === 'assigned' && Boolean(emp))
        || (filterAvailability === 'unlocated' && !a.location?.trim()))
    );
  });

  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const pageIds = paginated.map(a => a.id);
  const allPageSelected = pageIds.length > 0 && pageIds.every(id => selectedIds.has(id));

  function toggleOne(id: string) {
    setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }
  function togglePage() {
    if (allPageSelected) {
      setSelectedIds(prev => { const n = new Set(prev); pageIds.forEach(id => n.delete(id)); return n; });
    } else {
      setSelectedIds(prev => { const n = new Set(prev); pageIds.forEach(id => n.add(id)); return n; });
    }
  }
  function clearSelection() { setSelectedIds(new Set()); }

  async function save() {
    const sn = editing.serial_number?.trim() ?? '';
    const nm = editing.name?.trim() ?? '';
    if (!sn) { showToast('Nº de serie es obligatorio', 'error'); return; }
    if (!nm) { showToast('Nombre es obligatorio', 'error'); return; }

    if (editing.id) {
      const { error } = await supabase.from('assets')
        .update({ ...editing, updated_at: new Date().toISOString() })
        .eq('id', editing.id);
      if (error) { showToast('Error al actualizar', 'error'); return; }
      await logAction('updated', 'asset', editing.id, sn);
      showToast('Activo actualizado');
    } else {
      const { data, error } = await supabase.from('assets').insert([editing]).select().maybeSingle();
      if (error) {
        showToast(error.message.includes('unique') ? 'Nº de serie ya existe' : 'Error al crear', 'error');
        return;
      }
      if (data) await logAction('created', 'asset', data.id, data.serial_number);
      showToast('Activo creado');
    }
    setModalOpen(false);
    load();
  }

  async function deleteAsset() {
    if (!selected) return;
    await supabase.from('assets').delete().eq('id', selected.id);
    await logAction('deleted', 'asset', selected.id, selected.serial_number);
    showToast('Activo eliminado', 'warning');
    load();
  }

  async function bulkDelete() {
    const ids = Array.from(selectedIds);
    await supabase.from('assets').delete().in('id', ids);
    showToast(`${ids.length} activos eliminados`, 'warning');
    clearSelection();
    load();
  }

  async function bulkUpdateStatus() {
    const ids = Array.from(selectedIds);
    await supabase.from('assets').update({ status: bulkStatus, updated_at: new Date().toISOString() }).in('id', ids);
    showToast(`${ids.length} activos actualizados`);
    clearSelection();
    load();
  }

  async function assign() {
    if (!selected) return;
    await supabase.from('asset_assignments')
      .update({ returned_at: new Date().toISOString() })
      .eq('asset_id', selected.id)
      .is('returned_at', null);
    if (assignEmployeeId && assignEmployeeId !== 'none') {
      await supabase.from('asset_assignments').insert([{
        asset_id: selected.id, employee_id: assignEmployeeId, notes: 'Asignado manualmente',
      }]);
      const emp = employees.find(e => e.id === assignEmployeeId);
      await logAction('assigned', 'asset', selected.id, selected.serial_number, { employee: emp?.name });
      showToast('Activo asignado');
    } else {
      showToast('Asignación liberada');
    }
    setDetailOpen(false);
    load();
  }

  async function openHistory(asset: Asset) {
    setSelected(asset);
    const [{ data: asgns }, { data: incs }] = await Promise.all([
      supabase.from('asset_assignments').select('*, employee:employees(name)').eq('asset_id', asset.id).order('assigned_at', { ascending: false }),
      supabase.from('incidents').select('*').eq('asset_id', asset.id).order('opened_at', { ascending: false }),
    ]);
    const entries: HistoryEntry[] = [
      ...(asgns ?? []).map(a => ({
        type: 'assignment' as const,
        date: a.assigned_at,
        label: (a.employee as { name?: string } | null)?.name ?? 'Sin empleado',
        sublabel: a.returned_at ? `Devuelto: ${new Date(a.returned_at).toLocaleDateString('es-ES')}` : 'En uso actualmente',
        badge: a.returned_at ? <Badge variant="neutral">Devuelto</Badge> : <Badge variant="success">En uso</Badge>,
      })),
      ...(incs ?? []).map(i => ({
        type: 'incident' as const,
        date: i.opened_at,
        label: i.title,
        sublabel: i.resolution || 'Sin resolución',
        badge: i.status === 'closed' ? <Badge variant="success">Cerrada</Badge>
          : i.status === 'in_progress' ? <Badge variant="warning">En Progreso</Badge>
          : <Badge variant="danger">Abierta</Badge>,
      })),
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    setHistoryEntries(entries);
    setHistoryOpen(true);
  }

  function handlePrint() {
    if (!qrAsset) return;
    const employee = currentEmployee(qrAsset.id);
    const wDays = daysUntil(qrAsset.warranty_expiry ?? null);
    const eDays = daysUntil(qrAsset.end_of_life ?? null);
    const rows: [string, string][] = [
      ['Nº de Serie', qrAsset.serial_number],
      ['Tipo', qrAsset.asset_type],
      ['Marca / Modelo', `${qrAsset.brand} ${qrAsset.model}`],
      ['Ubicación', qrAsset.location || '—'],
      ['Estado', qrAsset.status === 'active' ? 'Activo' : qrAsset.status === 'repair' ? 'En Reparación' : 'Retirado'],
      ['Asignado a', employee?.name ?? 'Sin asignar'],
      ['Fin de Garantía', qrAsset.warranty_expiry ? new Date(qrAsset.warranty_expiry).toLocaleDateString('es-ES') : '—'],
      ['Fin de Vida', qrAsset.end_of_life ? new Date(qrAsset.end_of_life).toLocaleDateString('es-ES') : '—'],
    ];
    const qrSrc = buildQrUrl(qrAsset.serial_number);
    const today = new Date().toLocaleDateString('es-ES', { dateStyle: 'long' });
    const rowsHtml = rows.map(([k, v]) => `
      <tr style="border-bottom:1px solid #f3f4f6;">
        <td style="padding:6px 8px;color:#6b7280;font-weight:500;width:130px;">${k}</td>
        <td style="padding:6px 8px;color:#111;font-weight:${k === 'Nº de Serie' ? 700 : 400};font-family:${k === 'Nº de Serie' ? 'monospace' : 'inherit'};">${v}</td>
      </tr>`).join('');
    const warrantyWarning = wDays !== null && wDays <= 90
      ? `<p style="color:${wDays < 0 ? '#dc2626' : '#d97706'};font-size:12px;margin-top:8px;">${wDays < 0 ? 'Garantia vencida' : `Garantía vence en ${wDays} días`}</p>` : '';
    const eolWarning = eDays !== null && eDays <= 180
      ? `<p style="color:${eDays < 0 ? '#dc2626' : '#d97706'};font-size:12px;margin-top:4px;">${eDays < 0 ? 'Activo fuera de vida útil' : `Fin de vida en ${eDays} días`}</p>` : '';
    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"/>
<title>Ficha ${qrAsset.serial_number}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0;}
  @page{size:A4 portrait;margin:20mm;}
  body{font-family:system-ui,-apple-system,sans-serif;background:white;display:flex;flex-direction:column;align-items:center;gap:20px;padding:40px;}
</style></head><body>
<div style="text-align:center;">
  <div style="font-size:22px;font-weight:700;color:#111;">Ficha de Activo</div>
  <div style="font-size:13px;color:#666;margin-top:4px;">Inventario TI</div>
</div>
<img src="${qrSrc}" alt="QR" style="width:200px;height:200px;border:1px solid #e5e7eb;border-radius:8px;"/>
<table style="width:320px;border-collapse:collapse;font-size:13px;">${rowsHtml}</table>
${warrantyWarning}${eolWarning}
<div style="font-size:11px;color:#9ca3af;margin-top:8px;">Generado: ${today}</div>
<script>
  var img = document.querySelector('img');
  if (img.complete) { window.print(); }
  else { img.onload = function(){ window.print(); }; img.onerror = function(){ window.print(); }; }
<\/script>
</body></html>`;
    printViaIframe(html);
  }

  function handleExportCSV() {
    exportCSV('activos.csv', filtered, [
      { key: 'serial_number', label: 'Nº Serie' },
      { key: 'asset_type', label: 'Tipo' },
      { key: 'brand', label: 'Marca' },
      { key: 'model', label: 'Modelo' },
      { key: 'status', label: 'Estado' },
      { key: 'location', label: 'Ubicación' },
      { key: 'purchase_date', label: 'Fecha Compra' },
      { key: 'purchase_value', label: 'Valor €' },
      { key: 'warranty_expiry', label: 'Fin Garantía' },
      { key: 'end_of_life', label: 'Fin de Vida' },
      { key: 'notes', label: 'Notas' },
    ]);
  }

  function handleExportWordLabels() {
    const list = selectedIds.size > 0
      ? assets.filter(a => selectedIds.has(a.id))
      : filtered;
    if (list.length === 0) {
      showToast('No hay activos para exportar', 'error');
      return;
    }

    const rows = list.map(a => {
      const employee = currentEmployee(a.id);
      const publicUrl = buildPublicUrl(a.serial_number);
      return {
        N_SERIE: a.serial_number,
        NOMBRE: a.name,
        TIPO: a.asset_type,
        MARCA: a.brand,
        MODELO: a.model,
        MARCA_MODELO: `${a.brand} ${a.model}`.trim(),
        UBICACION: a.location,
        ESTADO: statusLabel(a.status),
        ASIGNADO_A: employee?.name ?? '',
        URL_PUBLICA: publicUrl,
        QR_URL: buildQrUrl(a.serial_number),
        TEXTO_ETIQUETA: `${a.serial_number} - ${a.brand} ${a.model}`.trim(),
        APLI_REFERENCIA: '1272',
        APLI_MEDIDA: '70 x 35 mm',
        FECHA_GENERACION: new Date().toLocaleDateString('es-ES'),
      };
    });

    exportCSV('destinatarios-etiquetas-apli-1272.csv', rows, [
      { key: 'N_SERIE', label: 'N_SERIE' },
      { key: 'NOMBRE', label: 'NOMBRE' },
      { key: 'TIPO', label: 'TIPO' },
      { key: 'MARCA', label: 'MARCA' },
      { key: 'MODELO', label: 'MODELO' },
      { key: 'MARCA_MODELO', label: 'MARCA_MODELO' },
      { key: 'UBICACION', label: 'UBICACION' },
      { key: 'ESTADO', label: 'ESTADO' },
      { key: 'ASIGNADO_A', label: 'ASIGNADO_A' },
      { key: 'URL_PUBLICA', label: 'URL_PUBLICA' },
      { key: 'QR_URL', label: 'QR_URL' },
      { key: 'TEXTO_ETIQUETA', label: 'TEXTO_ETIQUETA' },
      { key: 'APLI_REFERENCIA', label: 'APLI_REFERENCIA' },
      { key: 'APLI_MEDIDA', label: 'APLI_MEDIDA' },
      { key: 'FECHA_GENERACION', label: 'FECHA_GENERACION' },
    ]);
    showToast(`Destinatarios Word exportados: ${rows.length}`);
  }

  function handleExportWordLabelDocument() {
    const list = selectedIds.size > 0
      ? assets.filter(a => selectedIds.has(a.id))
      : filtered;
    if (list.length === 0) {
      showToast('No hay activos para exportar', 'error');
      return;
    }

    const labelsHtml = list.map(a => `
      <td class="label">
        <table class="inner" role="presentation">
          <tr>
            <td class="qr-cell"><img class="qr" src="${buildQrUrl(a.serial_number)}" alt="QR ${a.serial_number}"/></td>
            <td class="serial">${a.serial_number}</td>
          </tr>
        </table>
      </td>
    `);

    const rows: string[] = [];
    for (let i = 0; i < labelsHtml.length; i += 3) {
      rows.push(`<tr>${labelsHtml.slice(i, i + 3).join('')}${'<td class="label"></td>'.repeat(Math.max(0, 3 - labelsHtml.slice(i, i + 3).length))}</tr>`);
    }

    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<title>Etiquetas APLI 1272</title>
<style>
  @page WordSection1 { size: 210mm 297mm; margin: 8.5mm 0mm 8.5mm 0mm; }
  div.WordSection1 { page: WordSection1; }
  body { margin: 0; padding: 0; background: #fff; font-family: Arial, sans-serif; }
  table.sheet { width: 210mm; border-collapse: collapse; table-layout: fixed; }
  td.label { width: 70mm; height: 35mm; padding: 0; margin: 0; vertical-align: middle; text-align: center; }
  table.inner { width: 70mm; height: 35mm; border-collapse: collapse; table-layout: fixed; }
  td.qr-cell { width: 34mm; text-align: right; vertical-align: middle; padding: 0 2mm 0 1mm; }
  img.qr { width: 24mm; height: 24mm; display: block; margin-left: auto; }
  td.serial { width: 36mm; text-align: left; vertical-align: middle; padding: 0 1mm 0 1mm; font-family: Arial, sans-serif; font-size: 16pt; font-weight: 700; color: #000; }
</style>
</head>
<body>
<div class="WordSection1">
  <table class="sheet" role="presentation">
    ${rows.join('\n')}
  </table>
</div>
</body>
</html>`;

    downloadTextFile('etiquetas-apli-1272-qr.doc', html, 'application/msword;charset=utf-8;');
    showToast(`Word de etiquetas generado: ${list.length}`);
  }

  function handlePrintAllLabels() {
    const list = filtered.length > 0 ? filtered : assets;
    if (list.length === 0) return;
    const labelsHtml = list.map(a => {
      const qrSrc = buildQrUrl(a.serial_number);
      return `<div class="label">
        <img class="qr" src="${qrSrc}" alt="QR"/>
        <span class="serial">${a.serial_number}</span>
      </div>`;
    }).join('');
    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><title>Etiquetas</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0;}
  @page{size:A4;margin:8mm;}
  body{font-family:ui-monospace,monospace;background:white;}
  .grid{display:grid;grid-template-columns:repeat(3,62mm);gap:3mm;}
  .label{width:62mm;height:29mm;display:flex;flex-direction:row;align-items:center;justify-content:center;gap:3mm;padding:2mm;border:0.5pt solid #ccc;border-radius:2px;}
  .qr{width:25mm;height:25mm;flex-shrink:0;}
  .serial{font-size:12pt;font-weight:800;color:#000;letter-spacing:-0.5px;word-break:break-all;line-height:1.2;}
</style></head><body>
<div class="grid">${labelsHtml}</div>
<script>
  var imgs=document.querySelectorAll('img');
  var loaded=0;
  function tryPrint(){loaded++;if(loaded>=imgs.length){window.print();}}
  imgs.forEach(function(i){if(i.complete){tryPrint();}else{i.onload=tryPrint;i.onerror=tryPrint;}});
  if(imgs.length===0){window.print();}
<\/script>
</body></html>`;
    printViaIframe(html);
  }

  async function handleImportCSV(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const rows = parseCSV(text);
    if (!rows.length) { showToast('CSV vacío o inválido', 'error'); return; }
    const toInsert = rows.map(r => ({
      serial_number: r['Nº Serie'] || r['serial_number'] || '',
      name: r['Nombre'] || r['name'] || r['Nº Serie'] || r['serial_number'] || '',
      asset_type: r['Tipo'] || r['asset_type'] || 'Other',
      brand: r['Marca'] || r['brand'] || '',
      model: r['Modelo'] || r['model'] || '',
      status: (r['Estado'] || r['status'] || 'active') as Asset['status'],
      location: r['Ubicación'] || r['location'] || '',
      purchase_date: r['Fecha Compra'] || r['purchase_date'] || null,
      purchase_value: parseFloat(r['Valor €'] || r['purchase_value'] || '') || null,
      warranty_expiry: r['Fin Garantía'] || r['warranty_expiry'] || null,
      end_of_life: r['Fin de Vida'] || r['end_of_life'] || null,
      operating_system: r['Sistema operativo'] || r['operating_system'] || '',
      ip_address: r['IP'] || r['ip_address'] || '',
      mac_address: r['MAC'] || r['mac_address'] || '',
      processor: r['Procesador'] || r['processor'] || '',
      ram_gb: parseFloat(r['RAM (GB)'] || r['ram_gb'] || '') || null,
      storage_gb: parseFloat(r['Disco (GB)'] || r['storage_gb'] || '') || null,
      last_inventory_at: r['Ultimo inventario'] || r['last_inventory_at'] || new Date().toISOString(),
      notes: r['Notas'] || r['notes'] || '',
    })).filter(r => r.serial_number);
    if (!toInsert.length) { showToast('No se encontraron filas válidas (columna "Nº Serie" requerida)', 'error'); return; }
    const { error } = await supabase.from('assets').upsert(toInsert, { onConflict: 'serial_number' });
    if (error) { showToast('Error en importación: ' + error.message, 'error'); return; }
    showToast(`${toInsert.length} activos importados/actualizados`);
    load();
    if (fileRef.current) fileRef.current.value = '';
  }

  const qrAsset = selected;
  const qrEmployee = qrAsset ? currentEmployee(qrAsset.id) : null;
  const warrantyDays = daysUntil(qrAsset?.warranty_expiry ?? null);
  const eolDays = daysUntil(qrAsset?.end_of_life ?? null);

  return (
    <>

      <div className="p-6 space-y-4">
        {/* Bulk action bar */}
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-2.5">
            <span className="text-sm font-medium text-blue-800">{selectedIds.size} seleccionado{selectedIds.size > 1 ? 's' : ''}</span>
            <div className="flex items-center gap-2 ml-auto">
              <select value={bulkStatus} onChange={e => setBulkStatus(e.target.value as Asset['status'])} className="text-sm border border-blue-200 rounded-lg px-2 py-1.5 bg-white text-gray-700 focus:outline-none">
                {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
              <button onClick={bulkUpdateStatus} className="text-sm font-medium px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors">Cambiar estado</button>
              <button onClick={() => setBulkDeleteOpen(true)} className="text-sm font-medium px-3 py-1.5 bg-white hover:bg-red-50 text-red-600 border border-red-200 rounded-lg transition-colors">Eliminar</button>
              <button onClick={clearSelection} className="p-1.5 rounded-lg hover:bg-blue-100 text-blue-500 transition-colors"><X size={15} /></button>
            </div>
          </div>
        )}

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3">
          <SearchInput value={search} onChange={setSearch} placeholder="Buscar activo o empleado..." />
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white text-gray-700">
            <option value="">Todos los estados</option>
            {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <select value={filterType} onChange={e => setFilterType(e.target.value)} className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white text-gray-700">
            <option value="">Todos los tipos</option>
            {ASSET_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <select value={filterAvailability} onChange={e => setFilterAvailability(e.target.value)} className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white text-gray-700">
            <option value="">Todos</option>
            <option value="available">Disponibles</option>
            <option value="assigned">Ocupados</option>
            <option value="unlocated">Sin ubicacion</option>
          </select>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-sm text-gray-500">{filtered.length} activos</span>
            <button onClick={handlePrintAllLabels} className="flex items-center gap-2 text-gray-600 hover:text-gray-900 bg-white border border-gray-200 hover:border-gray-300 text-sm font-medium px-3 py-2 rounded-lg transition-colors"><Printer size={15} /> Etiquetas</button>
            <button onClick={handleExportWordLabelDocument} className="flex items-center gap-2 text-gray-600 hover:text-gray-900 bg-white border border-gray-200 hover:border-gray-300 text-sm font-medium px-3 py-2 rounded-lg transition-colors"><Download size={15} /> Word etiquetas</button>
            <button onClick={handleExportWordLabels} className="flex items-center gap-2 text-gray-600 hover:text-gray-900 bg-white border border-gray-200 hover:border-gray-300 text-sm font-medium px-3 py-2 rounded-lg transition-colors"><Download size={15} /> Word APLI 1272</button>
            <button onClick={handleExportCSV} className="flex items-center gap-2 text-gray-600 hover:text-gray-900 bg-white border border-gray-200 hover:border-gray-300 text-sm font-medium px-3 py-2 rounded-lg transition-colors"><Download size={15} /> CSV</button>
            <button onClick={() => fileRef.current?.click()} className="flex items-center gap-2 text-gray-600 hover:text-gray-900 bg-white border border-gray-200 hover:border-gray-300 text-sm font-medium px-3 py-2 rounded-lg transition-colors"><Upload size={15} /> Importar</button>
            <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleImportCSV} />
            <button onClick={() => { setEditing({ ...emptyAsset }); setModalOpen(true); }} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"><Plus size={16} /> Nuevo Activo</button>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-4 py-3 w-8">
                    <button onClick={togglePage} className="text-gray-400 hover:text-gray-600">
                      {allPageSelected ? <CheckSquare size={15} className="text-blue-600" /> : <Square size={15} />}
                    </button>
                  </th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">Nº Serie</th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">Tipo</th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">Marca / Modelo</th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">Ubicación</th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">Asignado a</th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">Garantía</th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">Estado</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {loading
                  ? Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} cols={9} />)
                  : paginated.map(a => {
                      const emp = currentEmployee(a.id);
                      const isChecked = selectedIds.has(a.id);
                      const wDays = daysUntil(a.warranty_expiry);
                      return (
                        <tr key={a.id} className={`border-b border-gray-50 transition-colors ${isChecked ? 'bg-blue-50/50' : 'hover:bg-gray-50'}`}>
                          <td className="px-4 py-3 w-8">
                            <button onClick={() => toggleOne(a.id)} className="text-gray-400 hover:text-gray-600">
                              {isChecked ? <CheckSquare size={15} className="text-blue-600" /> : <Square size={15} />}
                            </button>
                          </td>
                          <td className="px-4 py-3 font-mono text-xs font-semibold text-gray-700">{a.serial_number}</td>
                          <td className="px-4 py-3"><span className="flex items-center gap-1.5 text-gray-700"><Monitor size={14} className="text-gray-400" />{a.asset_type}</span></td>
                          <td className="px-4 py-3 text-gray-700">{a.brand} {a.model}</td>
                          <td className="px-4 py-3 text-gray-500">{a.location || '—'}</td>
                          <td className="px-4 py-3">{emp ? <span className="text-gray-800 font-medium">{emp.name}</span> : <span className="text-gray-400 italic">Sin asignar</span>}</td>
                          <td className="px-4 py-3">
                            {!a.warranty_expiry ? (
                              <span className="text-gray-300 text-xs">—</span>
                            ) : wDays !== null && wDays < 0 ? (
                              <span className="flex items-center gap-1 text-xs text-red-500"><ShieldOff size={13} /> Vencida</span>
                            ) : wDays !== null && wDays <= 90 ? (
                              <span className="flex items-center gap-1 text-xs text-amber-500"><ShieldAlert size={13} /> {wDays}d</span>
                            ) : (
                              <span className="flex items-center gap-1 text-xs text-emerald-600"><ShieldCheck size={13} /> OK</span>
                            )}
                          </td>
                          <td className="px-4 py-3">{statusBadge(a.status)}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1 justify-end">
                              <button onClick={() => { setSelected(a); setAssignEmployeeId(currentEmployee(a.id)?.id ?? 'none'); setDetailOpen(true); }} className="p-1.5 rounded-lg hover:bg-blue-50 text-gray-400 hover:text-blue-600 transition-colors" title="Asignar"><Eye size={15} /></button>
                              <button onClick={() => openHistory(a)} className="p-1.5 rounded-lg hover:bg-amber-50 text-gray-400 hover:text-amber-600 transition-colors" title="Historial"><History size={15} /></button>
                              <button onClick={() => { setSelected(a); setQrOpen(true); }} className="p-1.5 rounded-lg hover:bg-emerald-50 text-gray-400 hover:text-emerald-600 transition-colors" title="Código QR"><QrCode size={15} /></button>
                              <button onClick={() => { setEditing({ ...a }); setModalOpen(true); }} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors" title="Editar"><Pencil size={15} /></button>
                              <button onClick={() => { setSelected(a); setDeleteOpen(true); }} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors" title="Eliminar"><Trash2 size={15} /></button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                }
                {!loading && paginated.length === 0 && (
                  <tr><td colSpan={9} className="px-4 py-10 text-center text-gray-400">No se encontraron activos</td></tr>
                )}
              </tbody>
            </table>
          </div>
          {!loading && <Pagination page={page} pageSize={PAGE_SIZE} total={filtered.length} onChange={setPage} />}
        </div>

        {/* Create / Edit */}
        <Modal open={modalOpen} onClose={() => { setModalOpen(false); setEditing({ ...emptyAsset }); }} title={editing.id ? 'Editar Activo' : 'Nuevo Activo'} size="lg">
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Nº de Serie *"><input value={editing.serial_number ?? ''} onChange={e => setEditing(p => ({ ...p, serial_number: e.target.value }))} className="input" maxLength={100} /></FormField>
            <FormField label="Nombre *"><input value={editing.name ?? ''} onChange={e => setEditing(p => ({ ...p, name: e.target.value }))} className="input" maxLength={200} /></FormField>
            <FormField label="Tipo">
              <select value={editing.asset_type ?? 'Laptop'} onChange={e => setEditing(p => ({ ...p, asset_type: e.target.value }))} className="input">
                {ASSET_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </FormField>
            <FormField label="Estado">
              <select value={editing.status ?? 'active'} onChange={e => setEditing(p => ({ ...p, status: e.target.value as Asset['status'] }))} className="input">
                {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </FormField>
            <FormField label="Marca"><input value={editing.brand ?? ''} onChange={e => setEditing(p => ({ ...p, brand: e.target.value }))} className="input" maxLength={100} /></FormField>
            <FormField label="Modelo"><input value={editing.model ?? ''} onChange={e => setEditing(p => ({ ...p, model: e.target.value }))} className="input" maxLength={100} /></FormField>
            <FormField label="Ubicación"><input value={editing.location ?? ''} onChange={e => setEditing(p => ({ ...p, location: e.target.value }))} className="input" maxLength={200} /></FormField>
            <FormField label="Fecha Compra"><input type="date" value={editing.purchase_date ?? ''} onChange={e => setEditing(p => ({ ...p, purchase_date: e.target.value || null }))} className="input" /></FormField>
            <FormField label="Valor (€)"><input type="number" step="0.01" min="0" value={editing.purchase_value ?? ''} onChange={e => setEditing(p => ({ ...p, purchase_value: e.target.value ? parseFloat(e.target.value) : null }))} className="input" /></FormField>
            <FormField label="Imagen URL"><input value={editing.image_url ?? ''} onChange={e => setEditing(p => ({ ...p, image_url: e.target.value }))} className="input" placeholder="https://..." /></FormField>
            <FormField label="Fin de Garantía">
              <input type="date" value={editing.warranty_expiry ?? ''} onChange={e => setEditing(p => ({ ...p, warranty_expiry: e.target.value || null }))} className="input" />
            </FormField>
            <FormField label="Fin de Vida (EOL)">
              <input type="date" value={editing.end_of_life ?? ''} onChange={e => setEditing(p => ({ ...p, end_of_life: e.target.value || null }))} className="input" />
            </FormField>
            <div className="col-span-2 pt-2 border-t border-gray-100">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Inventario tecnico</p>
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Sistema operativo"><input value={editing.operating_system ?? ''} onChange={e => setEditing(p => ({ ...p, operating_system: e.target.value }))} className="input" maxLength={200} /></FormField>
                <FormField label="Procesador"><input value={editing.processor ?? ''} onChange={e => setEditing(p => ({ ...p, processor: e.target.value }))} className="input" maxLength={200} /></FormField>
                <FormField label="IP"><input value={editing.ip_address ?? ''} onChange={e => setEditing(p => ({ ...p, ip_address: e.target.value }))} className="input" maxLength={64} /></FormField>
                <FormField label="MAC"><input value={editing.mac_address ?? ''} onChange={e => setEditing(p => ({ ...p, mac_address: e.target.value }))} className="input font-mono" maxLength={64} /></FormField>
                <FormField label="RAM (GB)"><input type="number" min="0" step="0.01" value={editing.ram_gb ?? ''} onChange={e => setEditing(p => ({ ...p, ram_gb: e.target.value ? parseFloat(e.target.value) : null }))} className="input" /></FormField>
                <FormField label="Disco (GB)"><input type="number" min="0" step="0.01" value={editing.storage_gb ?? ''} onChange={e => setEditing(p => ({ ...p, storage_gb: e.target.value ? parseFloat(e.target.value) : null }))} className="input" /></FormField>
                <FormField label="Ultimo inventario"><input type="datetime-local" value={editing.last_inventory_at ? editing.last_inventory_at.slice(0, 16) : ''} onChange={e => setEditing(p => ({ ...p, last_inventory_at: e.target.value ? new Date(e.target.value).toISOString() : null }))} className="input" /></FormField>
              </div>
            </div>
            <div className="col-span-2">
              <FormField label="Notas"><textarea rows={2} value={editing.notes ?? ''} onChange={e => setEditing(p => ({ ...p, notes: e.target.value }))} className="input resize-none" maxLength={1000} /></FormField>
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-5">
            <button onClick={() => { setModalOpen(false); setEditing({ ...emptyAsset }); }} className="btn-secondary">Cancelar</button>
            <button onClick={save} className="btn-primary">Guardar</button>
          </div>
        </Modal>

        {/* Assign modal */}
        <Modal open={detailOpen} onClose={() => setDetailOpen(false)} title={`Asignar: ${selected?.serial_number}`} size="sm">
          {selected && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <DetailItem label="Tipo" value={selected.asset_type} />
                <DetailItem label="Marca/Modelo" value={`${selected.brand} ${selected.model}`} />
                <DetailItem label="Estado" value={statusBadge(selected.status)} />
                <DetailItem label="Ubicación" value={selected.location || '—'} />
                {(selected.operating_system || selected.ip_address || selected.mac_address || selected.processor) && (
                  <>
                    <DetailItem label="Sistema" value={selected.operating_system || '—'} />
                    <DetailItem label="IP / MAC" value={`${selected.ip_address || '—'} / ${selected.mac_address || '—'}`} />
                    <DetailItem label="CPU" value={selected.processor || '—'} />
                    <DetailItem label="RAM / Disco" value={`${selected.ram_gb ?? '—'} GB / ${selected.storage_gb ?? '—'} GB`} />
                  </>
                )}
                {selected.warranty_expiry && (
                  <DetailItem label="Fin Garantía" value={new Date(selected.warranty_expiry).toLocaleDateString('es-ES')} />
                )}
                {selected.end_of_life && (
                  <DetailItem label="Fin de Vida" value={new Date(selected.end_of_life).toLocaleDateString('es-ES')} />
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Asignar a empleado</label>
                <select value={assignEmployeeId} onChange={e => setAssignEmployeeId(e.target.value)} className="input mb-3">
                  <option value="none">Sin asignar</option>
                  {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
                <button onClick={assign} className="btn-primary w-full">Guardar Asignación</button>
              </div>
            </div>
          )}
        </Modal>

        {/* Full history modal */}
        <Modal open={historyOpen} onClose={() => setHistoryOpen(false)} title={`Historial completo: ${selected?.serial_number}`} size="lg">
          <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
            {historyEntries.length === 0 ? (
              <p className="text-center text-gray-400 py-8">Sin historial registrado</p>
            ) : historyEntries.map((entry, i) => (
              <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors">
                <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${entry.type === 'assignment' ? 'bg-blue-400' : 'bg-amber-400'}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-gray-800 truncate">{entry.label}</span>
                    {entry.badge}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{entry.sublabel}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{entry.type === 'assignment' ? 'Asignacion' : 'Incidencia'} · {new Date(entry.date).toLocaleDateString('es-ES')}</p>
                </div>
              </div>
            ))}
          </div>
        </Modal>

        {/* QR modal — rich card */}
        <Modal open={qrOpen} onClose={() => setQrOpen(false)} title={`Ficha QR: ${selected?.serial_number}`} size="md">
          {selected && (
            <div className="space-y-4">
              {/* Card preview */}
              <div className="border border-gray-200 rounded-xl p-5 bg-gray-50">
                <div className="flex gap-5 items-start">
                  <img
                    src={buildQrUrl(selected.serial_number)}
                    alt={`QR ${selected.serial_number}`}
                    className="w-32 h-32 rounded-lg border border-gray-200 bg-white flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0 space-y-1.5 text-sm">
                    <p className="font-mono font-bold text-gray-900 text-base">{selected.serial_number}</p>
                    <p className="text-gray-600">{selected.asset_type} · {selected.brand} {selected.model}</p>
                    <div className="flex items-center gap-2 flex-wrap mt-1">
                      {statusBadge(selected.status)}
                      {warrantyBadge(selected.warranty_expiry)}
                    </div>
                    <div className="pt-2 border-t border-gray-200 space-y-1">
                      <InfoRow label="Ubicacion" value={selected.location || '—'} />
                      <InfoRow label="Asignado a" value={qrEmployee?.name ?? 'Sin asignar'} />
                      {selected.operating_system && (
                        <InfoRow label="Sistema" value={selected.operating_system} />
                      )}
                      {(selected.ip_address || selected.mac_address) && (
                        <InfoRow label="Red" value={`${selected.ip_address || '—'} / ${selected.mac_address || '—'}`} />
                      )}
                      {selected.processor && (
                        <InfoRow label="CPU" value={selected.processor} />
                      )}
                      {(selected.ram_gb || selected.storage_gb) && (
                        <InfoRow label="RAM / Disco" value={`${selected.ram_gb ?? '—'} GB / ${selected.storage_gb ?? '—'} GB`} />
                      )}
                      {selected.warranty_expiry && (
                        <InfoRow label="Garantia hasta" value={new Date(selected.warranty_expiry).toLocaleDateString('es-ES')} />
                      )}
                      {selected.end_of_life && (
                        <InfoRow label="Fin de vida" value={new Date(selected.end_of_life).toLocaleDateString('es-ES')} />
                      )}
                      {selected.purchase_date && (
                        <InfoRow label="Fecha compra" value={new Date(selected.purchase_date).toLocaleDateString('es-ES')} />
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Warranty/EOL alerts inside the modal */}
              {(warrantyDays !== null && warrantyDays <= 90) && (
                <div className={`flex items-center gap-2 text-sm px-3 py-2 rounded-lg ${warrantyDays < 0 ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}>
                  <ShieldAlert size={15} />
                  {warrantyDays < 0
                    ? `Garantia vencida hace ${Math.abs(warrantyDays)} dias`
                    : `Garantia vence en ${warrantyDays} dias`}
                </div>
              )}
              {(eolDays !== null && eolDays <= 180) && (
                <div className={`flex items-center gap-2 text-sm px-3 py-2 rounded-lg ${eolDays < 0 ? 'bg-red-50 text-red-700' : 'bg-orange-50 text-orange-700'}`}>
                  <ShieldOff size={15} />
                  {eolDays < 0
                    ? `Equipo en fin de vida hace ${Math.abs(eolDays)} dias`
                    : `Fin de vida en ${eolDays} dias — planificar reemplazo`}
                </div>
              )}

              {/* Public URL to share / copy */}
              <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2">
                <span className="text-xs text-gray-400 flex-shrink-0">URL publica</span>
                <span className="text-xs font-mono text-gray-600 truncate flex-1">{buildPublicUrl(selected.serial_number)}</span>
                <button
                  onClick={() => { navigator.clipboard.writeText(buildPublicUrl(selected.serial_number)); showToast('URL copiada'); }}
                  className="text-xs text-blue-600 hover:text-blue-800 font-medium flex-shrink-0 hover:underline"
                >
                  Copiar
                </button>
              </div>

              <div className="flex gap-2">
                <a
                  href={buildQrUrl(selected.serial_number)}
                  download={`qr-${selected.serial_number}.png`}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-secondary flex items-center gap-2 flex-1 justify-center"
                >
                  <Download size={15} /> Descargar QR
                </a>
                <button
                  onClick={() => printViaIframe(buildLabelHtml(selected.serial_number, buildQrUrl(selected.serial_number)))}
                  className="btn-secondary flex items-center gap-2 flex-1 justify-center"
                >
                  <Printer size={15} /> Etiqueta
                </button>
                <button onClick={handlePrint} className="btn-primary flex items-center gap-2 flex-1 justify-center">
                  Imprimir Ficha
                </button>
              </div>
            </div>
          )}
        </Modal>

        <ConfirmDialog open={deleteOpen} onClose={() => setDeleteOpen(false)} onConfirm={deleteAsset} title="Eliminar Activo" message={`¿Eliminar el activo ${selected?.serial_number}? Esta accion no se puede deshacer.`} confirmLabel="Eliminar" danger />
        <ConfirmDialog open={bulkDeleteOpen} onClose={() => setBulkDeleteOpen(false)} onConfirm={bulkDelete} title="Eliminar Activos" message={`¿Eliminar ${selectedIds.size} activos seleccionados? Esta accion no se puede deshacer.`} confirmLabel={`Eliminar ${selectedIds.size}`} danger />
      </div>
    </>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
      {children}
    </div>
  );
}

function DetailItem({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-gray-400">{label}</p>
      <div className="font-medium text-gray-800">{value}</div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-gray-400 text-xs w-24 flex-shrink-0">{label}</span>
      <span className="text-gray-700 text-xs font-medium truncate">{value}</span>
    </div>
  );
}
