import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, BookOpen, Key, Download, AlertTriangle, CheckCircle, Copy, Monitor, User } from 'lucide-react';
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
import type { Asset, Employee, LicenseAssignment, Software as SoftwareType, License } from '../types';

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
  const isAssigned = l.seats_used > 0;
  if (!l.expiry_date) return <Badge variant="neutral">Sin vencimiento</Badge>;
  const days = Math.ceil((new Date(l.expiry_date).getTime() - Date.now()) / 86400000);
  if (days < 0) return <Badge variant="danger">Vencida</Badge>;
  if (days <= 30) return <Badge variant="warning">Vence pronto</Badge>;
  return <Badge variant={isAssigned ? 'blue' : 'success'}>{isAssigned ? 'Asignada' : 'Libre'}</Badge>;
}

export function Software() {
  const { showToast } = useToast();
  const [software, setSoftware] = useState<SoftwareType[]>([]);
  const [licenses, setLicenses] = useState<License[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [licenseAssignments, setLicenseAssignments] = useState<LicenseAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'software' | 'licenses'>('software');
  const [licenseFilter, setLicenseFilter] = useState('');
  const [page, setPage] = useState(1);

  const [swModalOpen, setSwModalOpen] = useState(false);
  const [licModalOpen, setLicModalOpen] = useState(false);
  const [deleteSwOpen, setDeleteSwOpen] = useState(false);
  const [deleteLicOpen, setDeleteLicOpen] = useState(false);
  const [splitLicOpen, setSplitLicOpen] = useState(false);

  const [editingSw, setEditingSw] = useState<Partial<SoftwareType>>(emptySw);
  const [editingLic, setEditingLic] = useState<Partial<License>>(emptyLic);
  const [bulkLicenses, setBulkLicenses] = useState(1);
  const [assignEmployeeId, setAssignEmployeeId] = useState('none');
  const [assignAssetId, setAssignAssetId] = useState('none');
  const [selectedSw, setSelectedSw] = useState<SoftwareType | null>(null);
  const [selectedLic, setSelectedLic] = useState<License | null>(null);

  async function load() {
    const [{ data: sw }, { data: lic }, { data: emps }, { data: assetRows }, assignmentResult] = await Promise.all([
      supabase.from('software').select('*').order('name'),
      supabase.from('licenses').select('*, software:software(name,vendor)').order('expiry_date'),
      supabase.from('employees').select('*').eq('active', true).order('name'),
      supabase.from('assets').select('*').neq('status', 'retired').order('serial_number'),
      supabase.from('license_assignments').select('*, employee:employees(id,name,email,department,position,active,created_at,updated_at), asset:assets(*)').is('returned_at', null),
    ]);
    setSoftware(sw ?? []);
    setLicenses(lic ?? []);
    setEmployees(emps ?? []);
    setAssets(assetRows ?? []);
    setLicenseAssignments(assignmentResult.data ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);
  useEffect(() => { setPage(1); }, [search, tab, licenseFilter]);

  const filteredSw = software.filter(s => {
    const q = search.toLowerCase();
    return !q || s.name.toLowerCase().includes(q) || s.vendor.toLowerCase().includes(q) || s.category.toLowerCase().includes(q);
  });

  const filteredLic = licenses.filter(l => {
    const q = search.toLowerCase();
    const daysLeft = l.expiry_date ? Math.ceil((new Date(l.expiry_date).getTime() - Date.now()) / 86400000) : null;
    const assignment = currentLicenseAssignment(l.id);
    const employeeName = (assignment?.employee as Employee | null)?.name ?? '';
    const assetSerial = (assignment?.asset as Asset | null)?.serial_number ?? '';
    const matchesStatus = !licenseFilter
      || (licenseFilter === 'assigned' && l.seats_used > 0)
      || (licenseFilter === 'expiring' && daysLeft !== null && daysLeft >= 0 && daysLeft <= 30)
      || (licenseFilter === 'expired' && daysLeft !== null && daysLeft < 0)
      || (licenseFilter === 'available' && Math.max((l.seats ?? 1) - l.seats_used, 0) > 0);
    const matchesSearch = !q
      || ((l.software as { name?: string } | null)?.name ?? '').toLowerCase().includes(q)
      || l.license_type.toLowerCase().includes(q)
      || l.license_key.toLowerCase().includes(q)
      || employeeName.toLowerCase().includes(q)
      || assetSerial.toLowerCase().includes(q);
    return matchesStatus && matchesSearch;
  });

  const paginatedSw = filteredSw.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const paginatedLic = filteredLic.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function currentLicenseAssignment(licenseId: string) {
    return licenseAssignments.find(a => a.license_id === licenseId) ?? null;
  }

  function openLicenseModal(license: License) {
    const assignment = currentLicenseAssignment(license.id);
    setEditingLic({ ...license });
    setAssignEmployeeId(assignment?.employee_id ?? 'none');
    setAssignAssetId(assignment?.asset_id ?? 'none');
    setLicModalOpen(true);
  }

  const assignedLicenses = licenses.reduce((sum, l) => sum + Math.min(l.seats_used, l.seats ?? 1), 0);
  const availableLicenses = licenses.reduce((sum, l) => sum + Math.max((l.seats ?? 1) - l.seats_used, 0), 0);
  const totalLicenseSeats = licenses.reduce((sum, l) => sum + (l.seats ?? 1), 0);
  const expiringCount = licenses.filter(l => {
    if (!l.expiry_date) return false;
    const days = Math.ceil((new Date(l.expiry_date).getTime() - Date.now()) / 86400000);
    return days >= 0 && days <= 30;
  }).length;
  const expiredCount = licenses.filter(l => l.expiry_date && new Date(l.expiry_date).getTime() < Date.now()).length;

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
    const totalSeats = Math.max(1, editingLic.seats ?? 1);
    const assignmentRequested = editingLic.id && totalSeats === 1 && (assignEmployeeId !== 'none' || assignAssetId !== 'none');
    const assignedSeats = assignmentRequested ? 1 : Math.min(editingLic.seats_used ?? 0, totalSeats);
    const licensePayload = {
      software_id: editingLic.software_id,
      license_key: editingLic.license_key ?? '',
      license_type: editingLic.license_type ?? 'commercial',
      seats: totalSeats,
      seats_used: assignedSeats,
      purchase_date: editingLic.purchase_date ?? null,
      expiry_date: editingLic.expiry_date ?? null,
      cost: editingLic.cost ?? null,
      vendor_contact: editingLic.vendor_contact ?? '',
      notes: editingLic.notes ?? '',
    };
    if (editingLic.id) {
      const { error } = await supabase.from('licenses').update({ ...licensePayload, updated_at: new Date().toISOString() }).eq('id', editingLic.id);
      if (error) { showToast(`No se pudo guardar: ${error.message}`, 'error'); return; }
      if (totalSeats === 1) {
        const assignmentError = await syncLicenseAssignment(editingLic.id, assignEmployeeId, assignAssetId);
        if (assignmentError) { showToast(assignmentError, 'error'); return; }
      }
      showToast('Licencia actualizada');
    } else {
      const count = Math.max(1, bulkLicenses);
      const newLicensePayload = { ...licensePayload, seats: 1, seats_used: editingLic.seats_used ? 1 : 0 };
      const rows = Array.from({ length: count }, (_, index) => ({
        ...newLicensePayload,
        license_key: count > 1 && newLicensePayload.license_key ? `${newLicensePayload.license_key}-${index + 1}` : newLicensePayload.license_key,
      }));
      const { data, error } = await supabase.from('licenses').insert(rows).select();
      if (error) { showToast(`No se pudo crear: ${error.message}`, 'error'); return; }
      if (data?.[0]) {
        const sw = software.find(s => s.id === editingLic.software_id);
        await logAction('created', 'license', data[0].id, `${count} licencia${count !== 1 ? 's' : ''} ${sw?.name ?? ''}`);
      }
      showToast(`${count} licencia${count !== 1 ? 's' : ''} añadida${count !== 1 ? 's' : ''}`);
    }
    setLicModalOpen(false);
    setEditingLic({ ...emptyLic });
    setBulkLicenses(1);
    load();
  }

  async function syncLicenseAssignment(licenseId: string, employeeId: string, assetId: string) {
    const wantsAssignment = employeeId !== 'none' || assetId !== 'none';
    const current = currentLicenseAssignment(licenseId);
    const sameAssignment = current
      && (current.employee_id ?? 'none') === employeeId
      && (current.asset_id ?? 'none') === assetId;

    if (sameAssignment) return '';

    if (current) {
      const { error } = await supabase
        .from('license_assignments')
        .update({ returned_at: new Date().toISOString() })
        .eq('id', current.id);
      if (error) return `No se pudo cerrar la asignacion anterior: ${error.message}`;
    }

    if (!wantsAssignment) {
      await supabase.from('licenses').update({ seats_used: 0, updated_at: new Date().toISOString() }).eq('id', licenseId);
      await logAction('unassigned', 'license', licenseId, 'Licencia liberada');
      return '';
    }

    const { error } = await supabase.from('license_assignments').insert([{
      license_id: licenseId,
      employee_id: employeeId === 'none' ? null : employeeId,
      asset_id: assetId === 'none' ? null : assetId,
      notes: 'Asignacion manual',
    }]);
    if (error) return `No se pudo guardar la asignacion. Aplica la migracion de license_assignments. ${error.message}`;

    await supabase.from('licenses').update({ seats_used: 1, updated_at: new Date().toISOString() }).eq('id', licenseId);
    await logAction('assigned', 'license', licenseId, 'Licencia asignada', {
      employee: employees.find(e => e.id === employeeId)?.name,
      asset: assets.find(a => a.id === assetId)?.serial_number,
    });
    return '';
  }

  async function deleteLic() {
    if (!selectedLic) return;
    await supabase.from('licenses').delete().eq('id', selectedLic.id);
    await logAction('deleted', 'license', selectedLic.id, (selectedLic.software as { name?: string } | null)?.name ?? '');
    showToast('Licencia eliminada', 'warning');
    load();
  }

  async function splitLicenseIntoSeats() {
    if (!selectedLic || (selectedLic.seats ?? 1) <= 1) return;
    const total = selectedLic.seats ?? 1;
    const assigned = Math.min(selectedLic.seats_used ?? 0, total);
    const rows = Array.from({ length: total }, (_, index) => ({
      software_id: selectedLic.software_id,
      license_key: selectedLic.license_key ? `${selectedLic.license_key}-${index + 1}` : '',
      license_type: selectedLic.license_type,
      seats: 1,
      seats_used: index < assigned ? 1 : 0,
      purchase_date: selectedLic.purchase_date,
      expiry_date: selectedLic.expiry_date,
      cost: selectedLic.cost != null ? Math.round((selectedLic.cost / total) * 100) / 100 : null,
      vendor_contact: selectedLic.vendor_contact,
      notes: selectedLic.notes,
    }));
    const { error: insertError } = await supabase.from('licenses').insert(rows);
    if (insertError) { showToast('Error al dividir licencias', 'error'); return; }
    const { error: deleteError } = await supabase.from('licenses').delete().eq('id', selectedLic.id);
    if (deleteError) { showToast('Licencias creadas, pero no se pudo eliminar el bloque original', 'warning'); return; }
    await logAction('updated', 'license', selectedLic.id, `Dividida en ${total} licencias`);
    showToast(`Licencia dividida en ${total} licencias`);
    setSplitLicOpen(false);
    setSelectedLic(null);
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
        { key: 'seats_used', label: 'Asignada' },
        { key: 'expiry_date', label: 'Vencimiento' },
        { key: 'cost', label: 'Coste €' },
      ]);
    }
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        <button onClick={() => setTab('software')} className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${tab === 'software' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
          Software
        </button>
        <button onClick={() => setTab('licenses')} className={`relative px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${tab === 'licenses' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
          Licencias
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <button onClick={() => { setTab('licenses'); setLicenseFilter(''); }} className="bg-white border border-gray-100 rounded-xl p-4 text-left hover:border-blue-200 hover:bg-blue-50/30 transition-colors">
          <div className="flex items-center gap-2 text-gray-500 text-xs font-medium mb-1"><Key size={14} /> Licencias</div>
          <div className="text-2xl font-black text-gray-900">{totalLicenseSeats}</div>
        </button>
        <button onClick={() => { setTab('licenses'); setLicenseFilter('available'); }} className="bg-white border border-emerald-100 rounded-xl p-4 text-left hover:bg-emerald-50/40 transition-colors">
          <div className="flex items-center gap-2 text-emerald-600 text-xs font-medium mb-1"><CheckCircle size={14} /> Licencias libres</div>
          <div className="text-2xl font-black text-emerald-700">{availableLicenses}</div>
        </button>
        <button onClick={() => { setTab('licenses'); setLicenseFilter('assigned'); }} className="bg-white border border-blue-100 rounded-xl p-4 text-left hover:bg-blue-50/40 transition-colors">
          <div className="flex items-center gap-2 text-blue-600 text-xs font-medium mb-1"><Key size={14} /> Licencias asignadas</div>
          <div className="text-2xl font-black text-blue-700">{assignedLicenses}</div>
        </button>
        <button onClick={() => { setTab('licenses'); setLicenseFilter('expiring'); }} className="bg-white border border-amber-100 rounded-xl p-4 text-left hover:bg-amber-50/40 transition-colors">
          <div className="flex items-center gap-2 text-amber-600 text-xs font-medium mb-1"><AlertTriangle size={14} /> Vencen pronto</div>
          <div className="text-2xl font-black text-amber-700">{expiringCount}</div>
        </button>
        <button onClick={() => { setTab('licenses'); setLicenseFilter('expired'); }} className="bg-white border border-gray-100 rounded-xl p-4 text-left hover:bg-gray-50 transition-colors">
          <div className="flex items-center gap-2 text-gray-500 text-xs font-medium mb-1"><AlertTriangle size={14} /> Vencidas</div>
          <div className="text-2xl font-black text-gray-900">{expiredCount}</div>
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <SearchInput value={search} onChange={setSearch} placeholder={tab === 'software' ? 'Buscar software...' : 'Buscar licencia...'} />
        {tab === 'licenses' && (
          <select value={licenseFilter} onChange={e => setLicenseFilter(e.target.value)} className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white text-gray-700">
            <option value="">Todas las licencias</option>
            <option value="available">Licencias libres</option>
            <option value="assigned">Licencias asignadas</option>
            <option value="expiring">Vencen pronto</option>
            <option value="expired">Vencidas</option>
          </select>
        )}
        <div className="ml-auto flex items-center gap-2">
          <button onClick={handleExport} className="flex items-center gap-2 text-gray-600 hover:text-gray-900 bg-white border border-gray-200 hover:border-gray-300 text-sm font-medium px-3 py-2 rounded-lg transition-colors">
            <Download size={15} /> CSV
          </button>
          {tab === 'software' ? (
            <button onClick={() => { setEditingSw({ ...emptySw }); setSwModalOpen(true); }} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
              <Plus size={16} /> Nuevo Software
            </button>
          ) : (
            <button onClick={() => { setEditingLic({ ...emptyLic, software_id: software[0]?.id ?? '' }); setBulkLicenses(1); setAssignEmployeeId('none'); setAssignAssetId('none'); setLicModalOpen(true); }} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
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
                  const assigned = swLics.reduce((sum, l) => sum + Math.min(l.seats_used, l.seats ?? 1), 0);
                  const available = swLics.reduce((sum, l) => sum + Math.max((l.seats ?? 1) - l.seats_used, 0), 0);
                  const totalLicencias = swLics.reduce((sum, l) => sum + (l.seats ?? 1), 0);
                  return (
                    <div key={sw.id} className="px-4 py-4 hover:bg-gray-50 transition-colors">
                      <div className="flex items-start gap-3">
                        <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <BookOpen size={15} className="text-blue-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            <span className="font-semibold text-gray-900">{sw.name}</span>
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
                            <span className="text-sm font-bold text-gray-800">{totalLicencias}</span>
                            <span className="text-xs text-gray-400">licencia{totalLicencias !== 1 ? 's' : ''}</span>
                          </div>
                          {swLics.length > 0 && (
                            <p className="text-xs text-gray-400">{available} libres / {assigned} asignados</p>
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
              <span>Licencia</span>
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
                  const assignment = currentLicenseAssignment(l.id);
                  const assignedEmployee = assignment?.employee as Employee | null | undefined;
                  const assignedAsset = assignment?.asset as Asset | null | undefined;
                  return (
                    <div key={l.id} className="px-4 py-4 transition-colors hover:bg-gray-50">
                      <div className="flex items-start gap-3">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 ${l.seats_used > 0 ? 'bg-blue-50' : 'bg-emerald-50'}`}>
                          <Key size={15} className={l.seats_used > 0 ? 'text-blue-500' : 'text-emerald-500'} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            <span className="font-semibold text-gray-900">{swName}</span>
                            {licenseStatusBadge(l)}
                            {(l.seats ?? 1) > 1 && <Badge variant="warning">Bloque antiguo</Badge>}
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
                          {assignment && (
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500 mt-1">
                              {assignedEmployee?.name && <span className="inline-flex items-center gap-1"><User size={12} /> {assignedEmployee.name}</span>}
                              {assignedAsset?.serial_number && <span className="inline-flex items-center gap-1"><Monitor size={12} /> {assignedAsset.serial_number}</span>}
                            </div>
                          )}
                          {l.notes && (
                            <p className="text-xs text-gray-400 mt-1 line-clamp-1 italic">{l.notes}</p>
                          )}
                        </div>
                        <div className="flex-shrink-0 text-right space-y-1 min-w-[120px]">
                          <div>
                            {l.seats_used > 0
                              ? <Badge variant="blue">{l.seats_used > 1 ? `${l.seats_used} asignadas` : 'Asignada'}</Badge>
                              : <Badge variant="success">{(l.seats ?? 1) > 1 ? `${l.seats} libres` : 'Libre'}</Badge>}
                          </div>
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
                          {(l.seats ?? 1) > 1 && (
                            <button onClick={() => { setSelectedLic(l); setSplitLicOpen(true); }} className="p-1.5 rounded-lg hover:bg-blue-50 text-gray-400 hover:text-blue-600 transition-colors" title="Dividir en licencias">
                              <Copy size={14} />
                            </button>
                          )}
                          <button onClick={() => openLicenseModal(l)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors">
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
            <label className="block text-xs font-medium text-gray-500 mb-1">Numero de licencias</label>
            <input
              type="number"
              min={editingLic.id ? Math.max(1, editingLic.seats_used ?? 0) : 1}
              value={editingLic.id ? (editingLic.seats ?? 1) : bulkLicenses}
              onChange={e => {
                const value = parseInt(e.target.value) || 1;
                if (editingLic.id) {
                  const assigned = editingLic.seats_used ?? 0;
                  setEditingLic(p => ({ ...p, seats: Math.max(value, assigned, 1) }));
                } else {
                  setBulkLicenses(value);
                }
              }}
              className="input"
            />
          </div>
          <div>
            {(editingLic.seats ?? 1) > 1 ? (
              <>
                <label className="block text-xs font-medium text-gray-500 mb-1">Licencias asignadas</label>
                <input
                  type="number"
                  min="0"
                  max={editingLic.seats ?? 1}
                  value={editingLic.seats_used ?? 0}
                  onChange={e => setEditingLic(p => ({ ...p, seats_used: Math.min(parseInt(e.target.value) || 0, p.seats ?? 1) }))}
                  className="input"
                />
              </>
            ) : (
              <>
                <label className="block text-xs font-medium text-gray-500 mb-1">Estado de la licencia</label>
                <select value={(editingLic.seats_used ?? 0) > 0 ? 'assigned' : 'available'} onChange={e => {
                  const assigned = e.target.value === 'assigned';
                  if (!assigned) {
                    setAssignEmployeeId('none');
                    setAssignAssetId('none');
                  }
                  setEditingLic(p => ({ ...p, seats_used: assigned ? 1 : 0 }));
                }} className="input">
                  <option value="available">Libre</option>
                  <option value="assigned">Asignada</option>
                </select>
              </>
            )}
          </div>
          {editingLic.id && (editingLic.seats ?? 1) === 1 && (
            <div className="col-span-2 grid grid-cols-2 gap-4 rounded-xl border border-gray-100 bg-gray-50/60 p-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Asignada a empleado</label>
                <select
                  value={assignEmployeeId}
                  onChange={e => {
                    setAssignEmployeeId(e.target.value);
                    setEditingLic(p => ({ ...p, seats_used: e.target.value !== 'none' || assignAssetId !== 'none' ? 1 : p.seats_used }));
                  }}
                  className="input bg-white"
                >
                  <option value="none">Sin empleado</option>
                  {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Asignada a equipo</label>
                <select
                  value={assignAssetId}
                  onChange={e => {
                    setAssignAssetId(e.target.value);
                    setEditingLic(p => ({ ...p, seats_used: e.target.value !== 'none' || assignEmployeeId !== 'none' ? 1 : p.seats_used }));
                  }}
                  className="input bg-white"
                >
                  <option value="none">Sin equipo</option>
                  {assets.map(a => <option key={a.id} value={a.id}>{a.serial_number} - {a.name}</option>)}
                </select>
              </div>
            </div>
          )}
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
      <ConfirmDialog
        open={splitLicOpen}
        onClose={() => setSplitLicOpen(false)}
        onConfirm={splitLicenseIntoSeats}
        title="Dividir licencia en licencias"
        message={`Convertir esta licencia agrupada en ${selectedLic?.seats ?? 0} licencias individuales editables. Se conservaran los datos principales y se reemplazara el bloque original.`}
        confirmLabel="Dividir"
      />
    </div>
  );
}
