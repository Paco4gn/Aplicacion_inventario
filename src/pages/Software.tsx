import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, BookOpen, Key, Download, AlertTriangle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { logAction } from '../lib/audit';
import { exportCSV } from '../lib/csv';
import { useToast } from '../contexts/ToastContext';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { SearchInput } from '../components/ui/SearchInput';
import { Pagination } from '../components/ui/Pagination';
import { SkeletonRow } from '../components/ui/SkeletonRow';
import type { Software as SoftwareType, License } from '../types';

const PAGE_SIZE = 15;

const LICENSE_TYPES = [
  { value: 'commercial', label: 'Comercial' },
  { value: 'oem', label: 'OEM' },
  { value: 'volume', label: 'Volumen' },
  { value: 'freeware', label: 'Gratuito' },
];

const emptySw: Partial<SoftwareType> = { name: '', vendor: '', category: '', version: '', notes: '' };
const emptyLic: Partial<License> = {
  license_key: '', license_type: 'commercial', seats: 1, seats_used: 0,
  purchase_date: null, expiry_date: null, cost: null, vendor_contact: '', notes: '',
};

function licenseStatusBadge(l: License) {
  const overused = l.seats_used > l.seats;
  if (overused) return <Badge variant="danger">Sobreutilizada</Badge>;
  if (!l.expiry_date) return <Badge variant="neutral">Sin vencimiento</Badge>;
  const days = Math.ceil((new Date(l.expiry_date).getTime() - Date.now()) / 86400000);
  if (days < 0) return <Badge variant="danger">Vencida</Badge>;
  if (days <= 30) return <Badge variant="warning">Vence pronto</Badge>;
  return <Badge variant="success">Vigente</Badge>;
}

function seatsBar(used: number, total: number) {
  const pct = total > 0 ? Math.min((used / total) * 100, 100) : 0;
  const over = used > total;
  return (
    <div className="flex items-center gap-2">
      <span className={`text-sm font-medium ${over ? 'text-red-600' : 'text-gray-700'}`}>{used}/{total}</span>
      <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${over ? 'bg-red-500' : pct >= 80 ? 'bg-amber-400' : 'bg-emerald-500'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {over && <AlertTriangle size={12} className="text-red-500 flex-shrink-0" />}
    </div>
  );
}

export function Software() {
  const { showToast } = useToast();
  const [software, setSoftware] = useState<SoftwareType[]>([]);
  const [licenses, setLicenses] = useState<License[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'software' | 'licenses'>('software');
  const [page, setPage] = useState(1);

  const [swModalOpen, setSwModalOpen] = useState(false);
  const [licModalOpen, setLicModalOpen] = useState(false);
  const [deleteSwOpen, setDeleteSwOpen] = useState(false);
  const [deleteLicOpen, setDeleteLicOpen] = useState(false);

  const [editingSw, setEditingSw] = useState<Partial<SoftwareType>>(emptySw);
  const [editingLic, setEditingLic] = useState<Partial<License>>(emptyLic);
  const [selectedSw, setSelectedSw] = useState<SoftwareType | null>(null);
  const [selectedLic, setSelectedLic] = useState<License | null>(null);

  async function load() {
    const [{ data: sw }, { data: lic }] = await Promise.all([
      supabase.from('software').select('*').order('name'),
      supabase.from('licenses').select('*, software:software(name,vendor)').order('expiry_date'),
    ]);
    setSoftware(sw ?? []);
    setLicenses(lic ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);
  useEffect(() => { setPage(1); }, [search, tab]);

  const filteredSw = software.filter(s => {
    const q = search.toLowerCase();
    return !q || s.name.toLowerCase().includes(q) || s.vendor.toLowerCase().includes(q) || s.category.toLowerCase().includes(q);
  });

  const filteredLic = licenses.filter(l => {
    const q = search.toLowerCase();
    return !q
      || ((l.software as { name?: string } | null)?.name ?? '').toLowerCase().includes(q)
      || l.license_type.toLowerCase().includes(q)
      || l.license_key.toLowerCase().includes(q);
  });

  const paginatedSw = filteredSw.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const paginatedLic = filteredLic.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const overusedCount = licenses.filter(l => l.seats_used > l.seats).length;

  async function saveSw() {
    if (!editingSw.name?.trim()) { showToast('Nombre es obligatorio', 'error'); return; }
    if (editingSw.id) {
      await supabase.from('software').update({ ...editingSw, updated_at: new Date().toISOString() }).eq('id', editingSw.id);
      await logAction('updated', 'software', editingSw.id, editingSw.name ?? '');
      showToast('Software actualizado');
    } else {
      const { data } = await supabase.from('software').insert([editingSw]).select().maybeSingle();
      if (data) await logAction('created', 'software', data.id, data.name);
      showToast('Software añadido');
    }
    setSwModalOpen(false);
    setEditingSw({ ...emptySw });
    load();
  }

  async function deleteSw() {
    if (!selectedSw) return;
    const affectedLicenses = licenses.filter(l => l.software_id === selectedSw.id).length;
    await supabase.from('software').delete().eq('id', selectedSw.id);
    await logAction('deleted', 'software', selectedSw.id, selectedSw.name);
    showToast(`Software eliminado (${affectedLicenses} licencia${affectedLicenses !== 1 ? 's' : ''} borrada${affectedLicenses !== 1 ? 's' : ''})`, 'warning');
    load();
  }

  async function saveLic() {
    if (!editingLic.software_id) { showToast('Selecciona un software', 'error'); return; }
    const seats = editingLic.seats ?? 1;
    const used = editingLic.seats_used ?? 0;
    if (used > seats) {
      showToast(`Asientos en uso (${used}) no puede superar el total (${seats})`, 'error');
      return;
    }
    if (editingLic.id) {
      await supabase.from('licenses').update({ ...editingLic, updated_at: new Date().toISOString() }).eq('id', editingLic.id);
      showToast('Licencia actualizada');
    } else {
      const { data } = await supabase.from('licenses').insert([editingLic]).select().maybeSingle();
      if (data) {
        const sw = software.find(s => s.id === editingLic.software_id);
        await logAction('created', 'license', data.id, sw?.name ?? '');
      }
      showToast('Licencia añadida');
    }
    setLicModalOpen(false);
    setEditingLic({ ...emptyLic });
    load();
  }

  async function deleteLic() {
    if (!selectedLic) return;
    await supabase.from('licenses').delete().eq('id', selectedLic.id);
    await logAction('deleted', 'license', selectedLic.id, (selectedLic.software as { name?: string } | null)?.name ?? '');
    showToast('Licencia eliminada', 'warning');
    load();
  }

  function handleExport() {
    if (tab === 'software') {
      exportCSV('software.csv', filteredSw, [
        { key: 'name', label: 'Nombre' },
        { key: 'vendor', label: 'Fabricante' },
        { key: 'category', label: 'Categoría' },
        { key: 'version', label: 'Versión' },
      ]);
    } else {
      exportCSV('licencias.csv', filteredLic.map(l => ({ ...l, software_name: (l.software as { name?: string } | null)?.name })), [
        { key: 'software_name', label: 'Software' },
        { key: 'license_type', label: 'Tipo' },
        { key: 'seats', label: 'Asientos' },
        { key: 'seats_used', label: 'En Uso' },
        { key: 'expiry_date', label: 'Vencimiento' },
        { key: 'cost', label: 'Coste €' },
      ]);
    }
  }

  return (
    <div className="p-6 space-y-4">
      {/* Overused alert banner */}
      {overusedCount > 0 && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          <AlertTriangle size={16} className="text-red-500 flex-shrink-0" />
          <span className="text-sm text-red-700 font-medium">
            {overusedCount} licencia{overusedCount > 1 ? 's' : ''} sobreutilizada{overusedCount > 1 ? 's' : ''} — los asientos en uso superan el total contratado
          </span>
          <button onClick={() => setTab('licenses')} className="ml-auto text-xs font-medium text-red-600 hover:text-red-800 underline">
            Ver licencias
          </button>
        </div>
      )}

      <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        <button onClick={() => setTab('software')} className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${tab === 'software' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
          Software
        </button>
        <button onClick={() => setTab('licenses')} className={`relative px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${tab === 'licenses' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
          Licencias
          {overusedCount > 0 && <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-500 rounded-full text-[9px] text-white flex items-center justify-center font-bold">{overusedCount}</span>}
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <SearchInput value={search} onChange={setSearch} placeholder={tab === 'software' ? 'Buscar software...' : 'Buscar licencia...'} />
        <div className="ml-auto flex items-center gap-2">
          <button onClick={handleExport} className="flex items-center gap-2 text-gray-600 hover:text-gray-900 bg-white border border-gray-200 hover:border-gray-300 text-sm font-medium px-3 py-2 rounded-lg transition-colors">
            <Download size={15} /> CSV
          </button>
          {tab === 'software' ? (
            <button onClick={() => { setEditingSw({ ...emptySw }); setSwModalOpen(true); }} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
              <Plus size={16} /> Nuevo Software
            </button>
          ) : (
            <button onClick={() => { setEditingLic({ ...emptyLic, software_id: software[0]?.id ?? '' }); setLicModalOpen(true); }} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
              <Plus size={16} /> Nueva Licencia
            </button>
          )}
        </div>
      </div>

      {tab === 'software' ? (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="divide-y divide-gray-50">
            {/* Header */}
            <div className="hidden lg:grid grid-cols-[2fr_1fr_1fr_1fr_80px_60px] gap-4 px-4 py-3 bg-gray-50 border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase tracking-wide">
              <span>Nombre</span>
              <span>Fabricante</span>
              <span>Categoría / Versión</span>
              <span>Licencias</span>
              <span>Notas</span>
              <span />
            </div>
            {loading
              ? Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} cols={6} />)
              : paginatedSw.map(sw => {
                  const swLics = licenses.filter(l => l.software_id === sw.id);
                  const hasOveruse = swLics.some(l => l.seats_used > l.seats);
                  const totalSeats = swLics.reduce((s, l) => s + l.seats, 0);
                  const usedSeats = swLics.reduce((s, l) => s + l.seats_used, 0);
                  return (
                    <div key={sw.id} className="px-4 py-4 hover:bg-gray-50 transition-colors">
                      <div className="flex items-start gap-3">
                        <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <BookOpen size={15} className="text-blue-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            <span className="font-semibold text-gray-900">{sw.name}</span>
                            {hasOveruse && (
                              <span className="flex items-center gap-1 text-xs text-red-600 bg-red-50 px-2 py-0.5 rounded-full font-medium">
                                <AlertTriangle size={10} /> Sobreutilizada
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
                            {sw.vendor && <span className="font-medium text-gray-600">{sw.vendor}</span>}
                            {sw.category && <span className="bg-gray-100 px-1.5 py-0.5 rounded text-gray-600">{sw.category}</span>}
                            {sw.version && <span>v{sw.version}</span>}
                          </div>
                          {sw.notes && (
                            <p className="text-xs text-gray-400 mt-1 line-clamp-1 italic">{sw.notes}</p>
                          )}
                        </div>
                        <div className="flex-shrink-0 text-right">
                          <div className="flex items-center gap-1.5 justify-end mb-1">
                            <Key size={12} className="text-gray-400" />
                            <span className="text-sm font-bold text-gray-800">{swLics.length}</span>
                            <span className="text-xs text-gray-400">licencia{swLics.length !== 1 ? 's' : ''}</span>
                          </div>
                          {swLics.length > 0 && (
                            <p className="text-xs text-gray-400">{usedSeats}/{totalSeats} asientos</p>
                          )}
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                          <button onClick={() => { setEditingSw({ ...sw }); setSwModalOpen(true); }} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors">
                            <Pencil size={14} />
                          </button>
                          <button onClick={() => { setSelectedSw(sw); setDeleteSwOpen(true); }} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
            }
            {!loading && paginatedSw.length === 0 && (
              <div className="px-4 py-12 text-center">
                <BookOpen size={28} className="text-gray-300 mx-auto mb-2" />
                <p className="text-gray-400 text-sm">No se encontró software</p>
              </div>
            )}
          </div>
          {!loading && <Pagination page={page} pageSize={PAGE_SIZE} total={filteredSw.length} onChange={setPage} />}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="divide-y divide-gray-50">
            {/* Header */}
            <div className="hidden lg:grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_60px] gap-4 px-4 py-3 bg-gray-50 border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase tracking-wide">
              <span>Software / Clave</span>
              <span>Tipo</span>
              <span>Asientos</span>
              <span>Vencimiento</span>
              <span>Coste</span>
              <span>Estado</span>
              <span />
            </div>
            {loading
              ? Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} cols={7} />)
              : paginatedLic.map(l => {
                  const swName = (l.software as { name?: string } | null)?.name ?? '—';
                  const daysLeft = l.expiry_date ? Math.ceil((new Date(l.expiry_date).getTime() - Date.now()) / 86400000) : null;
                  return (
                    <div key={l.id} className={`px-4 py-4 transition-colors ${l.seats_used > l.seats ? 'bg-red-50/40 hover:bg-red-50/60' : 'hover:bg-gray-50'}`}>
                      <div className="flex items-start gap-3">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 ${l.seats_used > l.seats ? 'bg-red-100' : 'bg-amber-50'}`}>
                          <Key size={15} className={l.seats_used > l.seats ? 'text-red-500' : 'text-amber-500'} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            <span className="font-semibold text-gray-900">{swName}</span>
                            {licenseStatusBadge(l)}
                          </div>
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
                            <span className="bg-gray-100 px-1.5 py-0.5 rounded text-gray-600 font-medium">{LICENSE_TYPES.find(t => t.value === l.license_type)?.label}</span>
                            {l.license_key && (
                              <span className="font-mono text-gray-500 bg-gray-50 border border-gray-200 px-2 py-0.5 rounded text-[11px] max-w-[200px] truncate" title={l.license_key}>
                                {l.license_key}
                              </span>
                            )}
                            {l.vendor_contact && (
                              <span className="text-gray-400">Contacto: {l.vendor_contact}</span>
                            )}
                          </div>
                          {l.notes && (
                            <p className="text-xs text-gray-400 mt-1 line-clamp-1 italic">{l.notes}</p>
                          )}
                        </div>
                        <div className="flex-shrink-0 text-right space-y-1 min-w-[120px]">
                          <div>{seatsBar(l.seats_used, l.seats)}</div>
                          <div className="text-xs text-gray-500">
                            {l.cost != null ? <span className="font-semibold text-gray-800">{l.cost.toLocaleString('es-ES')} €</span> : <span className="text-gray-300">Sin coste</span>}
                          </div>
                          {l.expiry_date && (
                            <div className={`text-xs font-medium ${daysLeft !== null && daysLeft < 0 ? 'text-red-600' : daysLeft !== null && daysLeft <= 30 ? 'text-amber-600' : 'text-gray-400'}`}>
                              {daysLeft !== null && daysLeft < 0
                                ? `Vencida hace ${Math.abs(daysLeft)}d`
                                : daysLeft !== null && daysLeft <= 30
                                ? `Vence en ${daysLeft}d`
                                : new Date(l.expiry_date).toLocaleDateString('es-ES')}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                          <button onClick={() => { setEditingLic({ ...l }); setLicModalOpen(true); }} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors">
                            <Pencil size={14} />
                          </button>
                          <button onClick={() => { setSelectedLic(l); setDeleteLicOpen(true); }} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
            }
            {!loading && paginatedLic.length === 0 && (
              <div className="px-4 py-12 text-center">
                <Key size={28} className="text-gray-300 mx-auto mb-2" />
                <p className="text-gray-400 text-sm">No se encontraron licencias</p>
              </div>
            )}
          </div>
          {!loading && <Pagination page={page} pageSize={PAGE_SIZE} total={filteredLic.length} onChange={setPage} />}
        </div>
      )}

      {/* Software modal */}
      <Modal open={swModalOpen} onClose={() => { setSwModalOpen(false); setEditingSw({ ...emptySw }); }} title={editingSw.id ? 'Editar Software' : 'Nuevo Software'} size="md">
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="block text-xs font-medium text-gray-500 mb-1">Nombre *</label>
            <input value={editingSw.name ?? ''} onChange={e => setEditingSw(p => ({ ...p, name: e.target.value }))} className="input" maxLength={200} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Fabricante</label>
            <input value={editingSw.vendor ?? ''} onChange={e => setEditingSw(p => ({ ...p, vendor: e.target.value }))} className="input" maxLength={100} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Categoría</label>
            <input value={editingSw.category ?? ''} onChange={e => setEditingSw(p => ({ ...p, category: e.target.value }))} className="input" placeholder="Ofimática, Seguridad..." maxLength={100} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Versión</label>
            <input value={editingSw.version ?? ''} onChange={e => setEditingSw(p => ({ ...p, version: e.target.value }))} className="input" maxLength={50} />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium text-gray-500 mb-1">Notas</label>
            <textarea rows={2} value={editingSw.notes ?? ''} onChange={e => setEditingSw(p => ({ ...p, notes: e.target.value }))} className="input resize-none" maxLength={1000} />
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-5">
          <button onClick={() => { setSwModalOpen(false); setEditingSw({ ...emptySw }); }} className="btn-secondary">Cancelar</button>
          <button onClick={saveSw} className="btn-primary">Guardar</button>
        </div>
      </Modal>

      {/* License modal */}
      <Modal open={licModalOpen} onClose={() => { setLicModalOpen(false); setEditingLic({ ...emptyLic }); }} title={editingLic.id ? 'Editar Licencia' : 'Nueva Licencia'} size="lg">
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="block text-xs font-medium text-gray-500 mb-1">Software *</label>
            <select value={editingLic.software_id ?? ''} onChange={e => setEditingLic(p => ({ ...p, software_id: e.target.value }))} className="input">
              <option value="">Seleccionar...</option>
              {software.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Tipo de Licencia</label>
            <select value={editingLic.license_type ?? 'commercial'} onChange={e => setEditingLic(p => ({ ...p, license_type: e.target.value as License['license_type'] }))} className="input">
              {LICENSE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Clave de Licencia</label>
            <input value={editingLic.license_key ?? ''} onChange={e => setEditingLic(p => ({ ...p, license_key: e.target.value }))} className="input font-mono" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Asientos Totales</label>
            <input type="number" min="1" value={editingLic.seats ?? 1} onChange={e => setEditingLic(p => ({ ...p, seats: parseInt(e.target.value) || 1 }))} className="input" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Asientos en Uso
              {(editingLic.seats_used ?? 0) > (editingLic.seats ?? 1) && (
                <span className="ml-2 text-red-500 text-xs font-normal">supera el total</span>
              )}
            </label>
            <input
              type="number"
              min="0"
              max={editingLic.seats ?? 999}
              value={editingLic.seats_used ?? 0}
              onChange={e => setEditingLic(p => ({ ...p, seats_used: parseInt(e.target.value) || 0 }))}
              className={`input ${(editingLic.seats_used ?? 0) > (editingLic.seats ?? 1) ? 'border-red-300 focus:border-red-400 focus:ring-red-500/20' : ''}`}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Fecha Compra</label>
            <input type="date" value={editingLic.purchase_date ?? ''} onChange={e => setEditingLic(p => ({ ...p, purchase_date: e.target.value || null }))} className="input" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Fecha Vencimiento</label>
            <input type="date" value={editingLic.expiry_date ?? ''} onChange={e => setEditingLic(p => ({ ...p, expiry_date: e.target.value || null }))} className="input" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Coste (€)</label>
            <input type="number" step="0.01" min="0" value={editingLic.cost ?? ''} onChange={e => setEditingLic(p => ({ ...p, cost: e.target.value ? parseFloat(e.target.value) : null }))} className="input" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Contacto Proveedor</label>
            <input value={editingLic.vendor_contact ?? ''} onChange={e => setEditingLic(p => ({ ...p, vendor_contact: e.target.value }))} className="input" />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium text-gray-500 mb-1">Notas</label>
            <textarea rows={2} value={editingLic.notes ?? ''} onChange={e => setEditingLic(p => ({ ...p, notes: e.target.value }))} className="input resize-none" maxLength={1000} />
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-5">
          <button onClick={() => { setLicModalOpen(false); setEditingLic({ ...emptyLic }); }} className="btn-secondary">Cancelar</button>
          <button onClick={saveLic} className="btn-primary">Guardar</button>
        </div>
      </Modal>

      <ConfirmDialog
        open={deleteSwOpen}
        onClose={() => setDeleteSwOpen(false)}
        onConfirm={deleteSw}
        title="Eliminar Software"
        message={`¿Eliminar "${selectedSw?.name}" y todas sus licencias (${licenses.filter(l => l.software_id === selectedSw?.id).length})?`}
        confirmLabel="Eliminar todo"
        danger
      />
      <ConfirmDialog open={deleteLicOpen} onClose={() => setDeleteLicOpen(false)} onConfirm={deleteLic} title="Eliminar Licencia" message="¿Eliminar esta licencia?" confirmLabel="Eliminar" danger />
    </div>
  );
}
