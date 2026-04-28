import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Monitor, MapPin, User, Building2, Briefcase, ShieldCheck, ShieldAlert, ShieldOff,
  Calendar, AlertTriangle, CheckCircle, Wrench, Archive, Package, Plus, Send,
  ChevronDown, ChevronUp, Printer, RefreshCw, Clock, Flag, X, Lock, KeyRound,
  Settings,
} from 'lucide-react';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

interface PublicAsset {
  id: string;
  serial_number: string;
  name: string;
  asset_type: string;
  brand: string;
  model: string;
  status: string;
  location: string;
  purchase_date: string | null;
  purchase_value: number | null;
  warranty_expiry: string | null;
  end_of_life: string | null;
  notes: string;
  image_url: string;
}

interface PublicEmployee {
  id: string;
  name: string;
  department: string;
  position: string;
  email?: string;
}

interface PublicAssignment {
  assigned_at: string;
  notes: string;
  employee: PublicEmployee | null;
}

interface RecentIncident {
  id: string;
  title: string;
  status: string;
  priority: string;
  opened_at: string;
}

interface PublicData {
  asset: PublicAsset;
  assignment: PublicAssignment | null;
  openIncidents: number;
  recentIncidents: RecentIncident[];
  employees: PublicEmployee[];
}

function apiFetch(serial: string, method: string, body?: object) {
  return fetch(
    `${SUPABASE_URL}/functions/v1/asset-public?serial=${encodeURIComponent(serial)}`,
    {
      method,
      headers: {
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    }
  );
}

function daysUntil(date: string | null) {
  if (!date) return null;
  return Math.ceil((new Date(date).getTime() - Date.now()) / 86400000);
}

function statusMeta(s: string) {
  if (s === 'active')  return { label: 'Activo',          Icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' };
  if (s === 'repair')  return { label: 'En Reparación',   Icon: Wrench,      color: 'text-amber-600',   bg: 'bg-amber-50',   border: 'border-amber-200'   };
  return               { label: 'Retirado',               Icon: Archive,     color: 'text-gray-500',    bg: 'bg-gray-50',    border: 'border-gray-200'    };
}

function priorityMeta(p: string) {
  if (p === 'critical') return { label: 'Crítica', color: 'text-red-600 bg-red-50 border-red-200' };
  if (p === 'high')     return { label: 'Alta',    color: 'text-orange-600 bg-orange-50 border-orange-200' };
  if (p === 'medium')   return { label: 'Media',   color: 'text-amber-600 bg-amber-50 border-amber-200' };
  return                { label: 'Baja',           color: 'text-gray-500 bg-gray-50 border-gray-200' };
}

function incidentStatusMeta(s: string) {
  if (s === 'open')        return { label: 'Abierta',     color: 'text-red-600'   };
  if (s === 'in_progress') return { label: 'En progreso', color: 'text-amber-600' };
  return                   { label: 'Cerrada',            color: 'text-emerald-600' };
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

function buildQrUrl(targetUrl: string) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=400x400&margin=10&data=${encodeURIComponent(targetUrl)}`;
}

// ── Print label modal ─────────────────────────────────────────────────────────
function buildPrintHtml(asset: PublicAsset, qrSrc: string, statusLabel: string): string {
  const warranty = asset.warranty_expiry ? new Date(asset.warranty_expiry).toLocaleDateString('es-ES') : null;
  const purchase = asset.purchase_date ? new Date(asset.purchase_date).toLocaleDateString('es-ES') : null;
  const today = new Date().toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });

  const rows = [
    { label: 'Estado',    value: statusLabel },
    { label: 'Ubicación', value: asset.location || '—' },
    ...(warranty ? [{ label: 'Garantía', value: warranty }] : []),
    ...(purchase ? [{ label: 'Compra',   value: purchase }] : []),
  ];

  const rowsHtml = rows.map(r => `
    <div style="display:flex;gap:6px;align-items:baseline;">
      <span style="font-size:7pt;color:#94a3b8;width:44px;flex-shrink:0;font-weight:500;">${r.label}</span>
      <span style="font-size:7.5pt;color:#334155;font-weight:600;">${r.value}</span>
    </div>`).join('');

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<title>Etiqueta — ${asset.serial_number}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  @page { size: A6 landscape; margin: 6mm; }
  body { font-family: system-ui, -apple-system, sans-serif; background: white; }
</style>
</head>
<body>
<div style="display:flex;flex-direction:row;width:148mm;min-height:105mm;border:1.5px solid #e5e7eb;border-radius:10px;overflow:hidden;background:white;">
  <div style="flex-shrink:0;width:96mm;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#f8fafc;border-right:1.5px solid #e5e7eb;padding:8mm 7mm;gap:5px;">
    <img src="${qrSrc}" alt="QR" style="width:70mm;height:70mm;display:block;" crossorigin="anonymous"/>
    <p style="font-size:7.5pt;color:#94a3b8;text-align:center;letter-spacing:0.2px;">Escanea para ver la ficha</p>
  </div>
  <div style="flex:1;display:flex;flex-direction:column;padding:7mm 8mm;gap:8px;">
    <div>
      <p style="font-size:6.5pt;color:#94a3b8;margin:0 0 2px 0;text-transform:uppercase;letter-spacing:1.2px;font-weight:600;">Inventario TI</p>
      <div style="height:1px;background:#f1f5f9;margin-bottom:6px;"></div>
      <p style="font-size:18pt;font-weight:800;color:#0f172a;font-family:ui-monospace,monospace;letter-spacing:-0.5px;line-height:1.1;word-break:break-all;">${asset.serial_number}</p>
    </div>
    <div>
      <p style="font-size:10pt;font-weight:700;color:#1e293b;margin:0 0 1px 0;line-height:1.2;">${asset.brand} ${asset.model}</p>
      <p style="font-size:8pt;color:#64748b;">${asset.asset_type}</p>
    </div>
    <div style="display:flex;flex-direction:column;gap:3px;">${rowsHtml}</div>
    <div style="margin-top:auto;padding-top:5px;border-top:1px solid #f1f5f9;">
      <p style="font-size:6pt;color:#cbd5e1;">${today}</p>
    </div>
  </div>
</div>
<script>
  var img = document.querySelector('img');
  if (img.complete) { window.print(); }
  else { img.onload = function(){ window.print(); }; img.onerror = function(){ window.print(); }; }
<\/script>
</body>
</html>`;
}

function PrintLabelModal({ asset, qrSrc, onClose }: { asset: PublicAsset; qrSrc: string; onClose: () => void }) {
  const statusLabel = asset.status === 'active' ? 'Activo' : asset.status === 'repair' ? 'En reparación' : 'Retirado';

  function handlePrint() {
    const html = buildPrintHtml(asset, qrSrc, statusLabel);
    printViaIframe(html);
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <p className="font-semibold text-gray-800 text-sm">Etiqueta para imprimir</p>
            <p className="text-xs text-gray-400 mt-0.5">Vista previa · A6 apaisado</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="p-5 bg-gray-50 flex justify-center">
          <LabelCard asset={asset} qrSrc={qrSrc} statusLabel={statusLabel} preview />
        </div>

        <div className="px-5 py-4 border-t border-gray-100 flex gap-2">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 font-medium transition-colors">
            Cancelar
          </button>
          <button
            onClick={handlePrint}
            className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
          >
            <Printer size={14} /> Imprimir
          </button>
        </div>
      </div>
    </div>
  );
}

// ── The actual label card (used in both preview and print) ────────────────────
function LabelCard({ asset, qrSrc, statusLabel, preview }: {
  asset: PublicAsset;
  qrSrc: string;
  statusLabel: string;
  preview: boolean;
}) {
  const scale = preview ? 'scale-[0.62] origin-top' : '';

  return (
    <div className={preview ? 'w-full overflow-hidden' : ''}>
      <div
        className={`${scale}`}
        style={{
          width: preview ? undefined : '148mm',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >
        {/* Label body */}
        <div style={{
          display: 'flex',
          flexDirection: 'row',
          width: preview ? '100%' : '148mm',
          minHeight: preview ? undefined : '105mm',
          border: '1.5px solid #e5e7eb',
          borderRadius: 10,
          overflow: 'hidden',
          background: 'white',
        }}>
          {/* LEFT — QR code centered */}
          <div style={{
            flexShrink: 0,
            width: preview ? 160 : '96mm',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#f8fafc',
            borderRight: '1.5px solid #e5e7eb',
            padding: preview ? '16px 12px' : '8mm 7mm',
            gap: preview ? 6 : 5,
          }}>
            <img
              src={qrSrc}
              alt="QR"
              style={{ width: preview ? 110 : '70mm', height: preview ? 110 : '70mm', display: 'block' }}
            />
            <p style={{ fontSize: preview ? 9 : 7.5, color: '#94a3b8', textAlign: 'center', margin: 0, letterSpacing: 0.2 }}>
              Escanea para ver la ficha
            </p>
          </div>

          {/* RIGHT — info */}
          <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            padding: preview ? '14px 16px' : '7mm 8mm',
            gap: preview ? 10 : 8,
          }}>
            {/* Top label */}
            <div>
              <p style={{ fontSize: preview ? 8 : 6.5, color: '#94a3b8', margin: '0 0 2px 0', textTransform: 'uppercase', letterSpacing: 1.2, fontWeight: 600 }}>
                Inventario TI
              </p>
              <div style={{ height: 1, background: '#f1f5f9', marginBottom: preview ? 8 : 6 }} />
              {/* Serial — biggest element */}
              <p style={{
                fontSize: preview ? 22 : 18,
                fontWeight: 800,
                color: '#0f172a',
                margin: 0,
                fontFamily: 'ui-monospace, monospace',
                letterSpacing: -0.5,
                lineHeight: 1.1,
                wordBreak: 'break-all',
              }}>
                {asset.serial_number}
              </p>
            </div>

            {/* Device name */}
            <div>
              <p style={{ fontSize: preview ? 12 : 10, fontWeight: 700, color: '#1e293b', margin: '0 0 1px 0', lineHeight: 1.2 }}>
                {asset.brand} {asset.model}
              </p>
              <p style={{ fontSize: preview ? 9.5 : 8, color: '#64748b', margin: 0 }}>
                {asset.asset_type}
              </p>
            </div>

            {/* Key fields */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: preview ? 4 : 3 }}>
              {[
                { label: 'Estado',    value: statusLabel },
                { label: 'Ubicación', value: asset.location || '—' },
                ...(asset.warranty_expiry ? [{ label: 'Garantía',  value: new Date(asset.warranty_expiry).toLocaleDateString('es-ES') }] : []),
                ...(asset.purchase_date  ? [{ label: 'Compra',    value: new Date(asset.purchase_date).toLocaleDateString('es-ES') }]   : []),
              ].map(r => (
                <div key={r.label} style={{ display: 'flex', gap: 6, alignItems: 'baseline' }}>
                  <span style={{ fontSize: preview ? 8 : 7, color: '#94a3b8', width: preview ? 52 : 44, flexShrink: 0, fontWeight: 500 }}>{r.label}</span>
                  <span style={{ fontSize: preview ? 9 : 7.5, color: '#334155', fontWeight: 600 }}>{r.value}</span>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div style={{ marginTop: 'auto', paddingTop: preview ? 8 : 5, borderTop: '1px solid #f1f5f9' }}>
              <p style={{ fontSize: preview ? 7.5 : 6, color: '#cbd5e1', margin: 0 }}>
                {new Date().toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function AssetPublic({ serial }: { serial: string }) {
  const [data, setData] = useState<PublicData | null>(null);
  const [error, setError] = useState<'not_found' | 'error' | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Report incident form
  const [showReportForm, setShowReportForm] = useState(false);
  const [incTitle, setIncTitle] = useState('');
  const [incDesc, setIncDesc] = useState('');
  const [incPriority, setIncPriority] = useState<'low' | 'medium' | 'high' | 'critical'>('medium');
  const [reporting, setReporting] = useState(false);
  const [reportSuccess, setReportSuccess] = useState(false);

  // Incidents panel + print label modal
  const [showIncidents, setShowIncidents] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);

  // PIN + tech panel
  const [showPinModal, setShowPinModal] = useState(false);
  const [techUnlocked, setTechUnlocked] = useState(false);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState(false);
  const pinRef = useRef<HTMLInputElement>(null);
  const [techStatus, setTechStatus] = useState('');
  const [techLocation, setTechLocation] = useState('');
  const [techNotes, setTechNotes] = useState('');
  const [techEmployeeId, setTechEmployeeId] = useState<string>('__unchanged__');
  const [techSaving, setTechSaving] = useState(false);
  const [techSuccess, setTechSuccess] = useState(false);

  const fetchData = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    try {
      const res = await apiFetch(serial, 'GET');
      if (res.status === 404) { setError('not_found'); return; }
      if (!res.ok) { setError('error'); return; }
      setData(await res.json());
      setError(null);
    } catch {
      setError('error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [serial]);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function submitReport() {
    if (!incTitle.trim()) return;
    setReporting(true);
    try {
      const res = await apiFetch(serial, 'POST', { title: incTitle, description: incDesc, priority: incPriority });
      if (res.ok) {
        setReportSuccess(true);
        setIncTitle(''); setIncDesc(''); setIncPriority('medium');
        setShowReportForm(false);
        fetchData();
      }
    } finally {
      setReporting(false);
    }
  }

  function openTechPanel() {
    if (techUnlocked) return;
    setPin('');
    setPinError(false);
    setShowPinModal(true);
    setTimeout(() => pinRef.current?.focus(), 50);
  }

  function checkPin() {
    if (pin === '1234') {
      setTechUnlocked(true);
      setShowPinModal(false);
      setPinError(false);
    } else {
      setPinError(true);
      setPin('');
      setTimeout(() => pinRef.current?.focus(), 50);
    }
  }

  async function submitTechUpdate() {
    if (!data) return;
    setTechSaving(true);
    try {
      const body: Record<string, unknown> = { pin: '1234' };
      if (techStatus) body.status = techStatus;
      if (techLocation.trim()) body.location = techLocation.trim();
      if (techNotes.trim() !== '') body.notes = techNotes.trim();
      if (techEmployeeId !== '__unchanged__') body.employee_id = techEmployeeId === '' ? null : techEmployeeId;

      const res = await apiFetch(serial, 'PUT', body);
      if (res.ok) {
        setTechSuccess(true);
        setTechStatus('');
        setTechLocation('');
        setTechNotes('');
        setTechEmployeeId('__unchanged__');
        fetchData();
        setTimeout(() => setTechSuccess(false), 4000);
      }
    } finally {
      setTechSaving(false);
    }
  }

  // ── States ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-10 h-10 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-gray-500">Cargando ficha del activo...</p>
        </div>
      </div>
    );
  }

  if (error === 'not_found') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center space-y-4 max-w-sm">
          <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto">
            <Package size={28} className="text-gray-400" />
          </div>
          <h1 className="text-xl font-bold text-gray-800">Activo no encontrado</h1>
          <p className="text-sm text-gray-500">No existe ningún activo con el número de serie <span className="font-mono font-semibold text-gray-700">{serial}</span>.</p>
        </div>
      </div>
    );
  }

  if (error === 'error' || !data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center space-y-4">
          <AlertTriangle size={32} className="text-amber-400 mx-auto" />
          <p className="text-gray-600 text-sm">Error al cargar la ficha.</p>
          <button onClick={() => fetchData()} className="text-sm text-blue-600 underline">Reintentar</button>
        </div>
      </div>
    );
  }

  const { asset, assignment, openIncidents, recentIncidents, employees } = data;
  const status = statusMeta(asset.status);
  const { Icon: StatusIcon } = status;
  const wDays = daysUntil(asset.warranty_expiry);
  const eolDays = daysUntil(asset.end_of_life);
  const pageUrl = `${window.location.origin}${window.location.pathname}?asset=${encodeURIComponent(serial)}`;
  const qrSrc = buildQrUrl(pageUrl);

  return (
    <>
      {/* Print label modal */}
      {showPrintModal && (
        <PrintLabelModal asset={asset} qrSrc={qrSrc} onClose={() => setShowPrintModal(false)} />
      )}

      {/* PIN modal */}
      {showPinModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xs overflow-hidden">
            <div className="px-6 pt-6 pb-2 text-center">
              <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <KeyRound size={22} className="text-slate-600" />
              </div>
              <p className="font-bold text-gray-800 text-base">Acceso técnico</p>
              <p className="text-xs text-gray-400 mt-1">Introduce el PIN para editar este activo</p>
            </div>
            <div className="px-6 pb-6 mt-4 space-y-3">
              <input
                ref={pinRef}
                type="password"
                inputMode="numeric"
                maxLength={4}
                value={pin}
                onChange={e => { setPin(e.target.value.replace(/\D/g, '')); setPinError(false); }}
                onKeyDown={e => e.key === 'Enter' && checkPin()}
                placeholder="····"
                className={`w-full text-center text-2xl tracking-[0.5em] border rounded-xl px-3 py-3 focus:outline-none focus:ring-2 transition-colors ${pinError ? 'border-red-400 focus:ring-red-200 bg-red-50' : 'border-gray-200 focus:ring-blue-500/20 focus:border-blue-400'}`}
              />
              {pinError && (
                <p className="text-xs text-red-500 text-center font-medium">PIN incorrecto. Inténtalo de nuevo.</p>
              )}
              <div className="flex gap-2 pt-1">
                <button onClick={() => { setShowPinModal(false); setPin(''); setPinError(false); }} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 font-medium transition-colors">
                  Cancelar
                </button>
                <button onClick={checkPin} className="flex-1 py-2.5 rounded-xl bg-slate-800 text-white text-sm font-semibold hover:bg-slate-900 transition-colors flex items-center justify-center gap-2">
                  <Lock size={13} /> Acceder
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="min-h-screen bg-gray-50">
        {/* Top bar */}
        <div className="bg-white border-b border-gray-100 sticky top-0 z-10">
          <div className="max-w-xl mx-auto px-4 py-3 flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center flex-shrink-0">
              <Monitor size={17} className="text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] text-gray-400 leading-none uppercase tracking-wide">Ficha de activo</p>
              <p className="text-sm font-bold text-gray-800 font-mono truncate">{asset.serial_number}</p>
            </div>
            <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border text-xs font-medium flex-shrink-0 ${status.bg} ${status.border} ${status.color}`}>
              <StatusIcon size={11} />
              {status.label}
            </div>
            <button
              onClick={() => setShowPrintModal(true)}
              className="p-2 rounded-xl hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors flex-shrink-0"
              title="Imprimir etiqueta"
            >
              <Printer size={16} />
            </button>
            <button
              onClick={() => fetchData(true)}
              className={`p-2 rounded-xl hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors flex-shrink-0 ${refreshing ? 'animate-spin' : ''}`}
            >
              <RefreshCw size={15} />
            </button>
            <button
              onClick={techUnlocked ? () => setTechUnlocked(false) : openTechPanel}
              className={`p-2 rounded-xl transition-colors flex-shrink-0 ${techUnlocked ? 'bg-slate-800 text-white hover:bg-slate-900' : 'hover:bg-gray-100 text-gray-400 hover:text-gray-700'}`}
              title={techUnlocked ? 'Cerrar panel técnico' : 'Acceso técnico'}
            >
              <KeyRound size={15} />
            </button>
          </div>
        </div>

        <div className="max-w-xl mx-auto px-4 py-5 space-y-3">

          {/* ── Device card ── */}
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            {asset.image_url && (
              <img src={asset.image_url} alt={asset.name} className="w-full h-40 object-cover" />
            )}
            <div className="p-5">
              <p className="text-[11px] font-semibold text-blue-600 uppercase tracking-widest mb-1">{asset.asset_type}</p>
              <h1 className="text-xl font-bold text-gray-900 leading-tight">{asset.brand} {asset.model}</h1>
              {asset.name && asset.name !== asset.serial_number && (
                <p className="text-sm text-gray-400 mt-0.5">{asset.name}</p>
              )}

              <div className="mt-4 space-y-2">
                <DataRow icon={Monitor} label="Nº Serie" value={asset.serial_number} mono />
                <DataRow icon={MapPin} label="Ubicación" value={asset.location || '—'} />
                {asset.purchase_date && (
                  <DataRow icon={Calendar} label="Compra" value={new Date(asset.purchase_date).toLocaleDateString('es-ES', { dateStyle: 'long' })} />
                )}
              </div>

            </div>
          </div>

          {/* ── Tech panel (unlocked) ── */}
          {techUnlocked && (
            <div className="bg-white rounded-2xl border-2 border-slate-800 overflow-hidden">
              <div className="flex items-center gap-2 px-5 py-3.5 bg-slate-800">
                <Settings size={14} className="text-slate-300" />
                <p className="text-sm font-semibold text-white flex-1">Panel técnico</p>
                <button onClick={() => setTechUnlocked(false)} className="p-1 rounded-lg hover:bg-slate-700 text-slate-400 transition-colors">
                  <X size={14} />
                </button>
              </div>

              <div className="p-5 space-y-4">
                {techSuccess && (
                  <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2.5">
                    <CheckCircle size={14} className="text-emerald-600 flex-shrink-0" />
                    <p className="text-sm text-emerald-700 font-medium">Cambios guardados correctamente.</p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">Estado</label>
                    <select
                      value={techStatus || asset.status}
                      onChange={e => setTechStatus(e.target.value)}
                      className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-slate-500/20 focus:border-slate-400 bg-white"
                    >
                      <option value="active">Activo</option>
                      <option value="repair">En Reparación</option>
                      <option value="retired">Retirado</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">Ubicación</label>
                    <input
                      value={techLocation !== '' ? techLocation : asset.location}
                      onChange={e => setTechLocation(e.target.value)}
                      placeholder={asset.location || 'Ubicación'}
                      className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-slate-500/20 focus:border-slate-400"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">Asignado a</label>
                  <select
                    value={techEmployeeId === '__unchanged__' ? (assignment?.employee ? (assignment.employee as PublicEmployee).id ?? '' : '') : techEmployeeId}
                    onChange={e => setTechEmployeeId(e.target.value)}
                    className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-slate-500/20 focus:border-slate-400 bg-white"
                  >
                    <option value="">Sin asignar</option>
                    {employees.map(emp => (
                      <option key={emp.id} value={emp.id}>{emp.name}{emp.department ? ` — ${emp.department}` : ''}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">Notas</label>
                  <textarea
                    value={techNotes !== '' ? techNotes : asset.notes}
                    onChange={e => setTechNotes(e.target.value)}
                    placeholder="Notas internas del activo"
                    rows={3}
                    className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-slate-500/20 focus:border-slate-400 resize-none"
                  />
                </div>

                <button
                  onClick={submitTechUpdate}
                  disabled={techSaving}
                  className="w-full py-3 rounded-xl bg-slate-800 text-white text-sm font-semibold hover:bg-slate-900 disabled:opacity-40 transition-colors flex items-center justify-center gap-2"
                >
                  <Send size={13} /> {techSaving ? 'Guardando...' : 'Guardar cambios'}
                </button>
              </div>
            </div>
          )}

          {/* ── Assigned to ── */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-3">Responsable</p>
            {assignment?.employee ? (
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-sm flex-shrink-0">
                  {assignment.employee.name.split(' ').map((p: string) => p[0]).slice(0, 2).join('')}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 leading-tight">{assignment.employee.name}</p>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5">
                    {assignment.employee.position && (
                      <span className="flex items-center gap-1 text-xs text-gray-500"><Briefcase size={10} />{assignment.employee.position}</span>
                    )}
                    {assignment.employee.department && (
                      <span className="flex items-center gap-1 text-xs text-gray-500"><Building2 size={10} />{assignment.employee.department}</span>
                    )}
                  </div>
                  {assignment.employee.email && (
                    <a href={`mailto:${assignment.employee.email}`} className="text-xs text-blue-500 hover:underline mt-0.5 block">{assignment.employee.email}</a>
                  )}
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-[10px] text-gray-400">Desde</p>
                  <p className="text-xs font-medium text-gray-600">{new Date(assignment.assigned_at).toLocaleDateString('es-ES')}</p>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-gray-400 py-1">
                <User size={15} />
                <span className="text-sm">Sin asignar actualmente</span>
              </div>
            )}
          </div>

          {/* ── Lifecycle ── */}
          {(asset.warranty_expiry || asset.end_of_life) && (
            <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Ciclo de vida</p>
              {asset.warranty_expiry && (
                <LifecycleRow
                  icon={wDays !== null && wDays < 0 ? ShieldOff : wDays !== null && wDays <= 90 ? ShieldAlert : ShieldCheck}
                  label="Fin de garantía"
                  date={new Date(asset.warranty_expiry).toLocaleDateString('es-ES', { dateStyle: 'long' })}
                  days={wDays}
                  warnThreshold={90}
                />
              )}
              {asset.end_of_life && (
                <LifecycleRow
                  icon={eolDays !== null && eolDays < 0 ? ShieldOff : ShieldAlert}
                  label="Fin de vida (EOL)"
                  date={new Date(asset.end_of_life).toLocaleDateString('es-ES', { dateStyle: 'long' })}
                  days={eolDays}
                  warnThreshold={180}
                />
              )}
            </div>
          )}

          {/* ── Incidents ── */}
          {(openIncidents > 0 || recentIncidents.length > 0) && (
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              <button
                onClick={() => setShowIncidents(p => !p)}
                className="w-full flex items-center gap-3 px-5 py-4 hover:bg-gray-50 transition-colors"
              >
                <AlertTriangle size={15} className={openIncidents > 0 ? 'text-amber-500' : 'text-gray-400'} />
                <span className="text-sm font-medium text-gray-800 flex-1 text-left">
                  {openIncidents > 0
                    ? `${openIncidents} incidencia${openIncidents > 1 ? 's' : ''} abierta${openIncidents > 1 ? 's' : ''}`
                    : 'Historial de incidencias'}
                </span>
                {showIncidents ? <ChevronUp size={15} className="text-gray-400" /> : <ChevronDown size={15} className="text-gray-400" />}
              </button>

              {showIncidents && recentIncidents.length > 0 && (
                <div className="border-t border-gray-100 divide-y divide-gray-50">
                  {recentIncidents.map(inc => {
                    const p = priorityMeta(inc.priority);
                    const s = incidentStatusMeta(inc.status);
                    return (
                      <div key={inc.id} className="px-5 py-3 flex items-start gap-3">
                        <Flag size={13} className="text-gray-400 mt-0.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-800 leading-tight">{inc.title}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${p.color}`}>{p.label}</span>
                            <span className={`text-[10px] font-medium ${s.color}`}>{s.label}</span>
                            <span className="text-[10px] text-gray-400 ml-auto flex items-center gap-1">
                              <Clock size={9} />{new Date(inc.opened_at).toLocaleDateString('es-ES')}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── Notes ── */}
          {asset.notes && (
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Notas</p>
              <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">{asset.notes}</p>
            </div>
          )}

          {/* ── Report incident ── */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-3">Reportar incidencia</p>

            {reportSuccess && (
              <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2.5 mb-3">
                <CheckCircle size={14} className="text-emerald-600" />
                <p className="text-sm text-emerald-700 font-medium">Incidencia reportada. El equipo de soporte la revisará.</p>
              </div>
            )}

            {!showReportForm ? (
              <button
                onClick={() => { setShowReportForm(true); setReportSuccess(false); }}
                className="flex items-center gap-2 w-full justify-center py-2.5 rounded-xl border-2 border-dashed border-gray-200 text-sm text-gray-500 hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50 transition-colors font-medium"
              >
                <Plus size={15} /> Nueva incidencia sobre este equipo
              </button>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">Título del problema *</label>
                  <input
                    value={incTitle}
                    onChange={e => setIncTitle(e.target.value)}
                    placeholder="Ej: Pantalla parpadeante, teclado no funciona..."
                    className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                    autoFocus
                    maxLength={200}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">Descripción</label>
                  <textarea
                    value={incDesc}
                    onChange={e => setIncDesc(e.target.value)}
                    placeholder="Describe el problema con más detalle (opcional)"
                    rows={3}
                    className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 resize-none"
                    maxLength={1000}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">Prioridad</label>
                  <div className="grid grid-cols-4 gap-1.5">
                    {(['low', 'medium', 'high', 'critical'] as const).map(p => {
                      const m = priorityMeta(p);
                      const active = incPriority === p;
                      return (
                        <button
                          key={p}
                          onClick={() => setIncPriority(p)}
                          className={`py-2 rounded-xl text-xs font-semibold border transition-colors ${active ? m.color + ' border-current' : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100'}`}
                        >
                          {m.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => setShowReportForm(false)}
                    className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 font-medium transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={submitReport}
                    disabled={!incTitle.trim() || reporting}
                    className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-40 transition-colors flex items-center justify-center gap-2"
                  >
                    <Send size={13} /> {reporting ? 'Enviando...' : 'Enviar reporte'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* ── Print label shortcut ── */}
          <button
            onClick={() => setShowPrintModal(true)}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border border-gray-200 text-sm text-gray-500 hover:text-gray-700 hover:bg-white hover:border-gray-300 transition-all font-medium"
          >
            <Printer size={15} /> Imprimir etiqueta con QR
          </button>

          {/* Footer */}
          <p className="text-center text-xs text-gray-300 pb-6">
            Inventario TI · {new Date().toLocaleDateString('es-ES', { dateStyle: 'long' })}
          </p>
        </div>
      </div>
    </>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function DataRow({ icon: Icon, label, value, mono = false }: { icon: React.ElementType; label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <Icon size={13} className="text-gray-400 flex-shrink-0" />
      <span className="text-xs text-gray-400 w-20 flex-shrink-0">{label}</span>
      <span className={`text-sm text-gray-700 font-medium ${mono ? 'font-mono' : ''}`}>{value}</span>
    </div>
  );
}

function LifecycleRow({ icon: Icon, label, date, days, warnThreshold }: {
  icon: React.ElementType;
  label: string;
  date: string;
  days: number | null;
  warnThreshold: number;
}) {
  const expired = days !== null && days < 0;
  const warning = days !== null && !expired && days <= warnThreshold;
  const color = expired ? 'text-red-500' : warning ? 'text-amber-500' : 'text-emerald-500';
  const sublabel = expired
    ? `Vencida hace ${Math.abs(days!)} días`
    : warning
    ? `Vence en ${days} días`
    : 'Vigente';

  return (
    <div className="flex items-center gap-3">
      <Icon size={15} className={`${color} flex-shrink-0`} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-700 leading-tight">{label}</p>
        <p className="text-xs text-gray-400">{date}</p>
      </div>
      <span className={`text-xs font-semibold flex-shrink-0 ${color}`}>{sublabel}</span>
    </div>
  );
}

export { AssetPublic }
