import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, CheckCircle, Download, CheckSquare, Square, X, Settings, Mail, Bell } from 'lucide-react';
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
import type { Incident, Asset, Employee, IncidentNotificationRecipient } from '../types';

const PAGE_SIZE = 15;
type AssetOption = Pick<Asset, 'id' | 'serial_number' | 'brand' | 'model'>;
type EmployeeOption = Pick<Employee, 'id' | 'name' | 'email'>;

const PRIORITIES = [
  { value: 'low', label: 'Baja' },
  { value: 'medium', label: 'Media' },
  { value: 'high', label: 'Alta' },
  { value: 'critical', label: 'Crítica' },
];

const STATUSES = [
  { value: 'open', label: 'Abierta' },
  { value: 'in_progress', label: 'En Progreso' },
  { value: 'closed', label: 'Cerrada' },
];

const emptyIncident: Partial<Incident> = {
  title: '', description: '', asset_id: null, employee_id: null, assigned_to_id: null,
  status: 'open', priority: 'medium', resolution: '',
};

const emptyRecipient: Partial<IncidentNotificationRecipient> = { email: '', name: '', enabled: true };

function priorityBadge(p: string) {
  if (p === 'critical') return <Badge variant="danger">Crítica</Badge>;
  if (p === 'high') return <Badge variant="warning">Alta</Badge>;
  if (p === 'medium') return <Badge variant="info">Media</Badge>;
  return <Badge variant="neutral">Baja</Badge>;
}

function statusBadge(s: string) {
  if (s === 'open') return <Badge variant="danger">Abierta</Badge>;
  if (s === 'in_progress') return <Badge variant="warning">En Progreso</Badge>;
  return <Badge variant="success">Cerrada</Badge>;
}

export function Incidents() {
  const { showToast } = useToast();
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [assets, setAssets] = useState<AssetOption[]>([]);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<Incident>>(emptyIncident);
  const [editingRecipient, setEditingRecipient] = useState<Partial<IncidentNotificationRecipient>>(emptyRecipient);
  const [selected, setSelected] = useState<Incident | null>(null);
  const [recipients, setRecipients] = useState<IncidentNotificationRecipient[]>([]);
  const [notificationReady, setNotificationReady] = useState(true);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState<Incident['status']>('closed');

  async function load() {
    const [{ data: inc, error: incError }, { data: a }, { data: e }, { data: allEmployees }] = await Promise.all([
      supabase.from('incidents')
        .select('*, asset:assets(serial_number,brand,model)')
        .order('opened_at', { ascending: false }),
      supabase.from('assets').select('id,serial_number,brand,model').order('serial_number'),
      supabase.from('employees').select('id,name,email').eq('active', true).order('name'),
      supabase.from('employees').select('id,name,email').order('name'),
    ]);
    if (incError) {
      showToast(`Error cargando incidencias: ${incError.message}`, 'error');
      setLoading(false);
      return;
    }
    const employeeMap = new Map((allEmployees ?? []).map(employee => [employee.id, employee]));
    setIncidents((inc ?? []).map(incident => ({
      ...incident,
      employee: incident.employee_id ? employeeMap.get(incident.employee_id) ?? null : null,
      assigned_to: incident.assigned_to_id ? employeeMap.get(incident.assigned_to_id) ?? null : null,
    })) as Incident[]);
    setAssets(a ?? []);
    setEmployees(e ?? []);
    setLoading(false);
  }

  async function loadRecipients() {
    const { data, error } = await supabase
      .from('incident_notification_recipients')
      .select('*')
      .order('enabled', { ascending: false })
      .order('email');
    if (error) {
      setNotificationReady(false);
      return;
    }
    setNotificationReady(true);
    setRecipients(data ?? []);
  }

  useEffect(() => { load(); loadRecipients(); }, []);
  useEffect(() => { setPage(1); setSelectedIds(new Set()); }, [search, filterStatus, filterPriority]);

  const filtered = incidents.filter(i => {
    const q = search.toLowerCase();
    const matchSearch = !q
      || i.title.toLowerCase().includes(q)
      || i.description.toLowerCase().includes(q)
      || ((i.asset as { serial_number?: string } | null)?.serial_number ?? '').toLowerCase().includes(q)
      || ((i.employee as { name?: string } | null)?.name ?? '').toLowerCase().includes(q)
      || ((i.assigned_to as { name?: string } | null)?.name ?? '').toLowerCase().includes(q);
    return matchSearch
      && (!filterStatus || i.status === filterStatus)
      && (!filterPriority || i.priority === filterPriority);
  });

  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const pageIds = paginated.map(i => i.id);
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

  async function notifyIncident(incidentId: string, event: 'created' | 'updated' | 'assigned') {
    try {
      await supabase.functions.invoke('notify-incident', { body: { incident_id: incidentId, event } });
    } catch {
      // El correo no debe bloquear la creacion o edicion de incidencias.
    }
  }

  async function save() {
    if (!editing.title?.trim()) { showToast('Título es obligatorio', 'error'); return; }
    const previous = editing.id ? incidents.find(i => i.id === editing.id) : null;
    const payload = {
      ...editing,
      asset_id: editing.asset_id || null,
      employee_id: editing.employee_id || null,
      assigned_to_id: editing.assigned_to_id || null,
      closed_at: editing.status === 'closed' ? (editing.closed_at ?? new Date().toISOString()) : null,
    };
    if (editing.id) {
      const { error } = await supabase.from('incidents')
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq('id', editing.id);
      if (error) { showToast('Error al actualizar', 'error'); return; }
      await logAction('updated', 'incident', editing.id, editing.title ?? '');
      showToast('Incidencia actualizada');
      if (previous?.assigned_to_id !== payload.assigned_to_id || previous?.status !== payload.status || previous?.priority !== payload.priority) {
        notifyIncident(editing.id, previous?.assigned_to_id !== payload.assigned_to_id ? 'assigned' : 'updated');
      }
    } else {
      const { data, error } = await supabase.from('incidents').insert([payload]).select().maybeSingle();
      if (error) { showToast('Error al crear', 'error'); return; }
      if (data) await logAction('created', 'incident', data.id, data.title);
      showToast('Incidencia creada');
      if (data) notifyIncident(data.id, 'created');
    }
    setModalOpen(false);
    load();
  }

  async function saveRecipient() {
    const email = editingRecipient.email?.trim().toLowerCase();
    if (!email) { showToast('Email obligatorio', 'error'); return; }
    const payload = {
      email,
      name: editingRecipient.name?.trim() ?? '',
      enabled: editingRecipient.enabled ?? true,
      updated_at: new Date().toISOString(),
    };
    const query = editingRecipient.id
      ? supabase.from('incident_notification_recipients').update(payload).eq('id', editingRecipient.id)
      : supabase.from('incident_notification_recipients').insert([payload]);
    const { error } = await query;
    if (error) { showToast('No se pudo guardar el correo', 'error'); return; }
    setEditingRecipient(emptyRecipient);
    showToast('Correo de aviso guardado');
    loadRecipients();
  }

  async function toggleRecipient(recipient: IncidentNotificationRecipient) {
    const { error } = await supabase
      .from('incident_notification_recipients')
      .update({ enabled: !recipient.enabled, updated_at: new Date().toISOString() })
      .eq('id', recipient.id);
    if (error) { showToast('No se pudo actualizar el correo', 'error'); return; }
    loadRecipients();
  }

  async function deleteRecipient(recipient: IncidentNotificationRecipient) {
    const { error } = await supabase.from('incident_notification_recipients').delete().eq('id', recipient.id);
    if (error) { showToast('No se pudo eliminar el correo', 'error'); return; }
    showToast('Correo eliminado', 'warning');
    loadRecipients();
  }

  async function closeIncident(inc: Incident) {
    await supabase.from('incidents')
      .update({ status: 'closed', closed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', inc.id);
    await logAction('closed', 'incident', inc.id, inc.title);
    showToast('Incidencia cerrada');
    notifyIncident(inc.id, 'updated');
    load();
  }

  async function deleteIncident() {
    if (!selected) return;
    await supabase.from('incidents').delete().eq('id', selected.id);
    await logAction('deleted', 'incident', selected.id, selected.title);
    showToast('Incidencia eliminada', 'warning');
    load();
  }

  async function bulkDelete() {
    const ids = Array.from(selectedIds);
    await supabase.from('incidents').delete().in('id', ids);
    showToast(`${ids.length} incidencias eliminadas`, 'warning');
    clearSelection();
    load();
  }

  async function bulkUpdateStatus() {
    const ids = Array.from(selectedIds);
    const now = new Date().toISOString();
    await supabase.from('incidents').update({
      status: bulkStatus,
      closed_at: bulkStatus === 'closed' ? now : null,
      updated_at: now,
    }).in('id', ids);
    showToast(`${ids.length} incidencias actualizadas`);
    clearSelection();
    load();
  }

  function handleExport() {
    exportCSV('incidencias.csv', filtered, [
      { key: 'title', label: 'Título' },
      { key: 'priority', label: 'Prioridad' },
      { key: 'status', label: 'Estado' },
      { key: 'assigned_to_id', label: 'Responsable ID' },
      { key: 'description', label: 'Descripción' },
      { key: 'resolution', label: 'Resolución' },
      { key: 'opened_at', label: 'Apertura' },
      { key: 'closed_at', label: 'Cierre' },
    ]);
  }

  return (
    <div className="p-6 space-y-4">
      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-2.5">
          <span className="text-sm font-medium text-blue-800">{selectedIds.size} seleccionada{selectedIds.size > 1 ? 's' : ''}</span>
          <div className="flex items-center gap-2 ml-auto">
            <select
              value={bulkStatus}
              onChange={e => setBulkStatus(e.target.value as Incident['status'])}
              className="text-sm border border-blue-200 rounded-lg px-2 py-1.5 bg-white text-gray-700 focus:outline-none"
            >
              {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
            <button onClick={bulkUpdateStatus} className="text-sm font-medium px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors">
              Cambiar estado
            </button>
            <button onClick={() => setBulkDeleteOpen(true)} className="text-sm font-medium px-3 py-1.5 bg-white hover:bg-red-50 text-red-600 border border-red-200 rounded-lg transition-colors">
              Eliminar
            </button>
            <button onClick={clearSelection} className="p-1.5 rounded-lg hover:bg-blue-100 text-blue-500 transition-colors">
              <X size={15} />
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <SearchInput value={search} onChange={setSearch} placeholder="Buscar incidencia..." />
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white text-gray-700">
          <option value="">Todos los estados</option>
          {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)} className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white text-gray-700">
          <option value="">Todas las prioridades</option>
          {PRIORITIES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-sm text-gray-500">{filtered.length} incidencias</span>
          <button onClick={() => { setSettingsOpen(true); loadRecipients(); }} className="flex items-center gap-2 text-gray-600 hover:text-gray-900 bg-white border border-gray-200 hover:border-gray-300 text-sm font-medium px-3 py-2 rounded-lg transition-colors">
            <Settings size={15} /> Avisos
          </button>
          <button onClick={handleExport} className="flex items-center gap-2 text-gray-600 hover:text-gray-900 bg-white border border-gray-200 hover:border-gray-300 text-sm font-medium px-3 py-2 rounded-lg transition-colors">
            <Download size={15} /> CSV
          </button>
          <button
            onClick={() => { setEditing(emptyIncident); setModalOpen(true); }}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            <Plus size={16} /> Nueva Incidencia
          </button>
        </div>
      </div>

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
                <th className="text-left px-4 py-3 text-gray-500 font-medium">Título</th>
                <th className="text-left px-4 py-3 text-gray-500 font-medium">Activo</th>
                <th className="text-left px-4 py-3 text-gray-500 font-medium">Empleado</th>
                <th className="text-left px-4 py-3 text-gray-500 font-medium">Responsable</th>
                <th className="text-left px-4 py-3 text-gray-500 font-medium">Prioridad</th>
                <th className="text-left px-4 py-3 text-gray-500 font-medium">Estado</th>
                <th className="text-left px-4 py-3 text-gray-500 font-medium">Apertura</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {loading
                ? Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} cols={9} />)
                : paginated.map(inc => {
                    const isChecked = selectedIds.has(inc.id);
                    return (
                      <tr key={inc.id} className={`border-b border-gray-50 transition-colors ${isChecked ? 'bg-blue-50/50' : 'hover:bg-gray-50'}`}>
                        <td className="px-4 py-3 w-8">
                          <button onClick={() => toggleOne(inc.id)} className="text-gray-400 hover:text-gray-600">
                            {isChecked ? <CheckSquare size={15} className="text-blue-600" /> : <Square size={15} />}
                          </button>
                        </td>
                        <td className="px-4 py-3 font-medium text-gray-800 max-w-xs truncate">{inc.title}</td>
                        <td className="px-4 py-3 font-mono text-xs text-gray-600">
                          {(inc.asset as { serial_number?: string } | null)?.serial_number ?? '—'}
                        </td>
                        <td className="px-4 py-3 text-gray-600">
                          {(inc.employee as { name?: string } | null)?.name ?? '—'}
                        </td>
                        <td className="px-4 py-3 text-gray-600">
                          {(inc.assigned_to as { name?: string } | null)?.name ?? <span className="text-gray-400 italic">Sin asignar</span>}
                        </td>
                        <td className="px-4 py-3">{priorityBadge(inc.priority)}</td>
                        <td className="px-4 py-3">{statusBadge(inc.status)}</td>
                        <td className="px-4 py-3 text-gray-500">{new Date(inc.opened_at).toLocaleDateString('es-ES')}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1 justify-end">
                            {inc.status !== 'closed' && (
                              <button onClick={() => closeIncident(inc)} className="p-1.5 rounded-lg hover:bg-emerald-50 text-gray-400 hover:text-emerald-600 transition-colors" title="Cerrar">
                                <CheckCircle size={15} />
                              </button>
                            )}
                            <button onClick={() => { setEditing({ ...inc }); setModalOpen(true); }} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors">
                              <Pencil size={15} />
                            </button>
                            <button onClick={() => { setSelected(inc); setDeleteOpen(true); }} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors">
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
              }
              {!loading && paginated.length === 0 && (
                <tr><td colSpan={9} className="px-4 py-10 text-center text-gray-400">No se encontraron incidencias</td></tr>
              )}
            </tbody>
          </table>
        </div>
        {!loading && <Pagination page={page} pageSize={PAGE_SIZE} total={filtered.length} onChange={setPage} />}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing.id ? 'Editar Incidencia' : 'Nueva Incidencia'} size="lg">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Título *</label>
            <input value={editing.title ?? ''} onChange={e => setEditing(p => ({ ...p, title: e.target.value }))} className="input" maxLength={200} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Descripción</label>
            <textarea rows={3} value={editing.description ?? ''} onChange={e => setEditing(p => ({ ...p, description: e.target.value }))} className="input resize-none" maxLength={2000} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Activo</label>
              <select value={editing.asset_id ?? ''} onChange={e => setEditing(p => ({ ...p, asset_id: e.target.value || null }))} className="input">
                <option value="">Sin activo</option>
                {assets.map(a => <option key={a.id} value={a.id}>{a.serial_number} — {a.brand} {a.model}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Empleado</label>
              <select value={editing.employee_id ?? ''} onChange={e => setEditing(p => ({ ...p, employee_id: e.target.value || null }))} className="input">
                <option value="">Sin empleado</option>
                {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Responsable</label>
              <select value={editing.assigned_to_id ?? ''} onChange={e => setEditing(p => ({ ...p, assigned_to_id: e.target.value || null }))} className="input">
                <option value="">Sin responsable</option>
                {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Prioridad</label>
              <select value={editing.priority ?? 'medium'} onChange={e => setEditing(p => ({ ...p, priority: e.target.value as Incident['priority'] }))} className="input">
                {PRIORITIES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Estado</label>
              <select value={editing.status ?? 'open'} onChange={e => setEditing(p => ({ ...p, status: e.target.value as Incident['status'] }))} className="input">
                {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Resolución</label>
            <textarea rows={2} value={editing.resolution ?? ''} onChange={e => setEditing(p => ({ ...p, resolution: e.target.value }))} className="input resize-none" maxLength={2000} />
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-5">
          <button onClick={() => setModalOpen(false)} className="btn-secondary">Cancelar</button>
          <button onClick={save} className="btn-primary">Guardar</button>
        </div>
      </Modal>

      <Modal open={settingsOpen} onClose={() => setSettingsOpen(false)} title="Avisos de Incidencias" size="lg">
        <div className="space-y-5">
          {!notificationReady && (
            <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <Bell size={18} className="mt-0.5 flex-shrink-0" />
              <p>Falta aplicar la actualizacion de Supabase para activar la configuracion de avisos.</p>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-3 items-end">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Correo</label>
              <input
                type="email"
                value={editingRecipient.email ?? ''}
                onChange={e => setEditingRecipient(p => ({ ...p, email: e.target.value }))}
                className="input"
                placeholder="soporte@feval.com"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Nombre</label>
              <input
                value={editingRecipient.name ?? ''}
                onChange={e => setEditingRecipient(p => ({ ...p, name: e.target.value }))}
                className="input"
                placeholder="Equipo soporte"
              />
            </div>
            <button onClick={saveRecipient} className="btn-primary whitespace-nowrap">
              {editingRecipient.id ? 'Guardar' : 'Añadir'}
            </button>
          </div>

          <div className="rounded-2xl border border-gray-100 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">Correo</th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">Nombre</th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">Estado</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {recipients.map(recipient => (
                  <tr key={recipient.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-800">
                      <span className="inline-flex items-center gap-2"><Mail size={14} className="text-gray-400" /> {recipient.email}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{recipient.name || '—'}</td>
                    <td className="px-4 py-3">
                      <button onClick={() => toggleRecipient(recipient)} className={`rounded-full px-2.5 py-1 text-xs font-semibold ${recipient.enabled ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                        {recipient.enabled ? 'Activo' : 'Pausado'}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <button onClick={() => setEditingRecipient(recipient)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors">
                          <Pencil size={15} />
                        </button>
                        <button onClick={() => deleteRecipient(recipient)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {recipients.length === 0 && (
                  <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400">No hay correos configurados</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-gray-400">Se avisara al crear una incidencia, cambiar prioridad/estado o asignar un responsable.</p>
        </div>
      </Modal>

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={deleteIncident}
        title="Eliminar Incidencia"
        message={`¿Eliminar "${selected?.title}"?`}
        confirmLabel="Eliminar"
        danger
      />

      <ConfirmDialog
        open={bulkDeleteOpen}
        onClose={() => setBulkDeleteOpen(false)}
        onConfirm={bulkDelete}
        title="Eliminar Incidencias"
        message={`¿Eliminar ${selectedIds.size} incidencias seleccionadas? Esta acción no se puede deshacer.`}
        confirmLabel={`Eliminar ${selectedIds.size}`}
        danger
      />
    </div>
  );
}
