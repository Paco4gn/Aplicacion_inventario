import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Monitor, Download, History, UserCheck, Key } from 'lucide-react';
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
import type { Employee, AssetAssignment, Asset, LicenseAssignment } from '../types';

const PAGE_SIZE = 15;
const emptyEmployee: Partial<Employee> = { name: '', email: '', department: '', position: '', active: true };
type AssetOption = Pick<Asset, 'id' | 'serial_number' | 'brand' | 'model' | 'asset_type' | 'status'>;

export function Employees() {
  const { showToast } = useToast();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [assignments, setAssignments] = useState<AssetAssignment[]>([]);
  const [licenseAssignments, setLicenseAssignments] = useState<LicenseAssignment[]>([]);
  const [allAssets, setAllAssets] = useState<AssetOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<Employee>>(emptyEmployee);
  const [selected, setSelected] = useState<Employee | null>(null);
  const [history, setHistory] = useState<AssetAssignment[]>([]);
  const [assignAssetId, setAssignAssetId] = useState('');

  async function load() {
    const [{ data: e }, { data: asgn }, { data: a }, licenseResult] = await Promise.all([
      supabase.from('employees').select('*').order('name'),
      supabase.from('asset_assignments').select('*, asset:assets(id,serial_number,brand,model,asset_type)').is('returned_at', null),
      supabase.from('assets').select('id,serial_number,brand,model,asset_type,status').eq('status', 'active').order('serial_number'),
      supabase.from('license_assignments').select('*, license:licenses(id,license_key,software:software(name))').is('returned_at', null),
    ]);
    setEmployees(e ?? []);
    setAssignments(asgn ?? []);
    setLicenseAssignments(licenseResult.data ?? []);
    setAllAssets(a ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);
  useEffect(() => { setPage(1); }, [search, filterDept]);

  function currentAssets(empId: string) {
    return assignments.filter(a => a.employee_id === empId);
  }

  function currentLicenses(empId: string) {
    return licenseAssignments.filter(a => a.employee_id === empId);
  }

  const departments = [
    'Proyectos TIC',
    'Ferias y eventos',
    'Comunicación',
    'Dirección',
    'Mantenimiento',
    'Financiero',
  ];

  const filtered = employees.filter(e => {
    const q = search.toLowerCase();
    const matchSearch = !q || e.name.toLowerCase().includes(q) || (e.email ?? '').toLowerCase().includes(q) || e.department.toLowerCase().includes(q) || e.position.toLowerCase().includes(q);
    const matchDept = !filterDept || e.department === filterDept;
    return matchSearch && matchDept;
  });

  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  async function save() {
    if (!editing.name?.trim()) { showToast('Nombre es obligatorio', 'error'); return; }
    if (editing.id) {
      const { error } = await supabase.from('employees').update({ ...editing, updated_at: new Date().toISOString() }).eq('id', editing.id);
      if (error) { showToast('Error al actualizar', 'error'); return; }
      await logAction('updated', 'employee', editing.id, editing.name ?? '');
      showToast('Empleado actualizado');
    } else {
      const { data, error } = await supabase.from('employees').insert([editing]).select().maybeSingle();
      if (error) { showToast('Error al crear', 'error'); return; }
      if (data) await logAction('created', 'employee', data.id, data.name);
      showToast('Empleado creado');
    }
    setModalOpen(false);
    setEditing({ ...emptyEmployee });
    load();
  }

  async function deactivateEmployee() {
    if (!selected) return;
    await supabase.from('employees').update({ active: false, updated_at: new Date().toISOString() }).eq('id', selected.id);
    await logAction('deactivated', 'employee', selected.id, selected.name);
    showToast('Empleado desactivado', 'warning');
    load();
  }

  async function openHistory(emp: Employee) {
    setSelected(emp);
    const { data } = await supabase
      .from('asset_assignments')
      .select('*, asset:assets(serial_number,brand,model,asset_type)')
      .eq('employee_id', emp.id)
      .order('assigned_at', { ascending: false });
    setHistory(data ?? []);
    setHistoryOpen(true);
  }

  async function openAssign(emp: Employee) {
    setSelected(emp);
    setAssignAssetId('');
    setAssignOpen(true);
  }

  async function assignAsset() {
    if (!selected || !assignAssetId) { showToast('Selecciona un equipo', 'error'); return; }
    await supabase.from('asset_assignments').insert([{
      asset_id: assignAssetId,
      employee_id: selected.id,
      notes: 'Asignado desde empleado',
    }]);
    const asset = allAssets.find(a => a.id === assignAssetId);
    await logAction('assigned', 'asset', assignAssetId, asset?.serial_number ?? '', { employee: selected.name });
    showToast(`Equipo asignado a ${selected.name}`);
    setAssignOpen(false);
    load();
  }

  async function returnAsset(asgn: AssetAssignment) {
    await supabase.from('asset_assignments')
      .update({ returned_at: new Date().toISOString() })
      .eq('id', asgn.id);
    const asset = asgn.asset as { serial_number?: string } | null;
    showToast(`Equipo ${asset?.serial_number ?? ''} devuelto`);
    load();
  }

  function handleExport() {
    exportCSV('empleados.csv', filtered.map(emp => ({
      ...emp,
      assigned_assets: currentAssets(emp.id).length,
      assigned_licenses: currentLicenses(emp.id).length,
    })), [
      { key: 'name', label: 'Nombre' },
      { key: 'email', label: 'Email' },
      { key: 'department', label: 'Departamento' },
      { key: 'position', label: 'Cargo' },
      { key: 'assigned_assets', label: 'Equipos asignados' },
      { key: 'assigned_licenses', label: 'Licencias asignadas' },
      { key: 'active', label: 'Activo' },
    ]);
  }

  // Free (unassigned) assets
  const assignedAssetIds = new Set(assignments.map(a => a.asset_id));
  const freeAssets = allAssets.filter(a => !assignedAssetIds.has(a.id));

  return (
    <div className="p-6 space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <SearchInput value={search} onChange={setSearch} placeholder="Buscar empleado..." />
        <select
          value={filterDept}
          onChange={e => setFilterDept(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white text-gray-700"
        >
          <option value="">Todos los departamentos</option>
          {departments.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-sm text-gray-500">{filtered.length} empleados</span>
          <button onClick={handleExport} className="flex items-center gap-2 text-gray-600 hover:text-gray-900 bg-white border border-gray-200 hover:border-gray-300 text-sm font-medium px-3 py-2 rounded-lg transition-colors">
            <Download size={15} /> CSV
          </button>
          <button onClick={() => { setEditing({ ...emptyEmployee }); setModalOpen(true); }} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
            <Plus size={16} /> Nuevo Empleado
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-3 text-gray-500 font-medium">Nombre</th>
                <th className="text-left px-4 py-3 text-gray-500 font-medium">Email</th>
                <th className="text-left px-4 py-3 text-gray-500 font-medium">Departamento</th>
                <th className="text-left px-4 py-3 text-gray-500 font-medium">Cargo</th>
                <th className="text-left px-4 py-3 text-gray-500 font-medium">Equipos asignados</th>
                <th className="text-left px-4 py-3 text-gray-500 font-medium">Licencias</th>
                <th className="text-left px-4 py-3 text-gray-500 font-medium">Estado</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {loading
                ? Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} cols={8} />)
                : paginated.map(emp => {
                    const myAssets = currentAssets(emp.id);
                    const myLicenses = currentLicenses(emp.id);
                    return (
                      <tr key={emp.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-semibold text-xs flex-shrink-0">
                              {emp.name.split(' ').map(p => p[0]).slice(0, 2).join('')}
                            </div>
                            <span className="font-medium text-gray-800">{emp.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-500">{emp.email || '—'}</td>
                        <td className="px-4 py-3 text-gray-600">{emp.department || '—'}</td>
                        <td className="px-4 py-3 text-gray-600">{emp.position || '—'}</td>
                        <td className="px-4 py-3">
                          {myAssets.length > 0 ? (
                            <div className="space-y-0.5">
                              {myAssets.slice(0, 2).map(a => (
                                <div key={a.id} className="flex items-center gap-1.5">
                                  <Monitor size={11} className="text-blue-500 flex-shrink-0" />
                                  <span className="text-xs font-mono text-gray-700">{(a.asset as { serial_number?: string } | null)?.serial_number}</span>
                                </div>
                              ))}
                              {myAssets.length > 2 && (
                                <span className="text-xs text-gray-400">+{myAssets.length - 2} mas</span>
                              )}
                            </div>
                          ) : (
                            <span className="text-gray-400 italic text-xs">Sin equipo</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {myLicenses.length > 0 ? (
                            <div className="space-y-0.5">
                              {myLicenses.slice(0, 2).map(a => {
                                const lic = a.license as { license_key?: string; software?: { name?: string } } | null;
                                return (
                                  <div key={a.id} className="flex items-center gap-1.5">
                                    <Key size={11} className="text-amber-500 flex-shrink-0" />
                                    <span className="text-xs text-gray-700 truncate max-w-[160px]">{lic?.software?.name ?? lic?.license_key ?? 'Licencia'}</span>
                                  </div>
                                );
                              })}
                              {myLicenses.length > 2 && (
                                <span className="text-xs text-gray-400">+{myLicenses.length - 2} mas</span>
                              )}
                            </div>
                          ) : (
                            <span className="text-gray-400 italic text-xs">Sin licencias</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {emp.active ? <Badge variant="success">Activo</Badge> : <Badge variant="neutral">Inactivo</Badge>}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1 justify-end">
                            <button onClick={() => openAssign(emp)} className="p-1.5 rounded-lg hover:bg-emerald-50 text-gray-400 hover:text-emerald-600 transition-colors" title="Asignar equipo">
                              <UserCheck size={15} />
                            </button>
                            <button onClick={() => openHistory(emp)} className="p-1.5 rounded-lg hover:bg-blue-50 text-gray-400 hover:text-blue-600 transition-colors" title="Historial">
                              <History size={15} />
                            </button>
                            <button onClick={() => { setEditing({ ...emp }); setModalOpen(true); }} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors">
                              <Pencil size={15} />
                            </button>
                            <button onClick={() => { setSelected(emp); setDeleteOpen(true); }} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors">
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
              }
              {!loading && paginated.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-10 text-center text-gray-400">No se encontraron empleados</td></tr>
              )}
            </tbody>
          </table>
        </div>
        {!loading && <Pagination page={page} pageSize={PAGE_SIZE} total={filtered.length} onChange={setPage} />}
      </div>

      {/* Create/Edit */}
      <Modal open={modalOpen} onClose={() => { setModalOpen(false); setEditing({ ...emptyEmployee }); }} title={editing.id ? 'Editar Empleado' : 'Nuevo Empleado'} size="md">
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="block text-xs font-medium text-gray-500 mb-1">Nombre *</label>
            <input value={editing.name ?? ''} onChange={e => setEditing(p => ({ ...p, name: e.target.value }))} className="input" maxLength={200} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Email</label>
            <input type="email" value={editing.email ?? ''} onChange={e => setEditing(p => ({ ...p, email: e.target.value }))} className="input" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Departamento</label>
            <select value={editing.department ?? ''} onChange={e => setEditing(p => ({ ...p, department: e.target.value }))} className="input bg-white">
              <option value="">Seleccionar...</option>
              {departments.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Cargo</label>
            <input value={editing.position ?? ''} onChange={e => setEditing(p => ({ ...p, position: e.target.value }))} className="input" maxLength={100} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Estado</label>
            <select value={editing.active ? 'true' : 'false'} onChange={e => setEditing(p => ({ ...p, active: e.target.value === 'true' }))} className="input">
              <option value="true">Activo</option>
              <option value="false">Inactivo</option>
            </select>
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-5">
          <button onClick={() => { setModalOpen(false); setEditing({ ...emptyEmployee }); }} className="btn-secondary">Cancelar</button>
          <button onClick={save} className="btn-primary">Guardar</button>
        </div>
      </Modal>

      {/* Assign asset modal */}
      <Modal open={assignOpen} onClose={() => setAssignOpen(false)} title={`Asignar equipo a ${selected?.name}`} size="md">
        <div className="space-y-4">
          {/* Current assignments */}
          {selected && currentAssets(selected.id).length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-500 mb-2">Equipos actuales</p>
              <div className="space-y-1.5">
                {currentAssets(selected.id).map(a => (
                  <div key={a.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                    <div className="flex items-center gap-2">
                      <Monitor size={13} className="text-blue-500" />
                      <span className="text-sm font-mono text-gray-700">{(a.asset as { serial_number?: string; brand?: string; model?: string } | null)?.serial_number}</span>
                      <span className="text-xs text-gray-400">{(a.asset as { brand?: string; model?: string } | null)?.brand} {(a.asset as { model?: string } | null)?.model}</span>
                    </div>
                    <button
                      onClick={() => returnAsset(a)}
                      className="text-xs text-red-500 hover:text-red-700 font-medium px-2 py-1 rounded hover:bg-red-50 transition-colors"
                    >
                      Devolver
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Assign new */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-2">Asignar nuevo equipo</label>
            {freeAssets.length === 0 ? (
              <p className="text-sm text-gray-400 italic">No hay equipos activos disponibles sin asignar</p>
            ) : (
              <div className="space-y-3">
                <select
                  value={assignAssetId}
                  onChange={e => setAssignAssetId(e.target.value)}
                  className="input"
                >
                  <option value="">Seleccionar equipo...</option>
                  {freeAssets.map(a => (
                    <option key={a.id} value={a.id}>{a.serial_number} — {a.brand} {a.model} ({a.asset_type})</option>
                  ))}
                </select>
                <button onClick={assignAsset} disabled={!assignAssetId} className="btn-primary w-full disabled:opacity-40 disabled:cursor-not-allowed">
                  Asignar equipo
                </button>
              </div>
            )}
          </div>
        </div>
        <div className="flex justify-end mt-5">
          <button onClick={() => setAssignOpen(false)} className="btn-secondary">Cerrar</button>
        </div>
      </Modal>

      {/* History */}
      <Modal open={historyOpen} onClose={() => setHistoryOpen(false)} title={`Historial de ${selected?.name}`} size="lg">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100">
              <tr>
                <th className="text-left py-2 text-gray-500 font-medium">Equipo</th>
                <th className="text-left py-2 text-gray-500 font-medium">Tipo</th>
                <th className="text-left py-2 text-gray-500 font-medium">Asignado</th>
                <th className="text-left py-2 text-gray-500 font-medium">Devuelto</th>
                <th className="text-left py-2 text-gray-500 font-medium">Estado</th>
              </tr>
            </thead>
            <tbody>
              {history.map(h => (
                <tr key={h.id} className="border-b border-gray-50">
                  <td className="py-2.5 font-mono text-xs">{(h.asset as { serial_number?: string } | null)?.serial_number}</td>
                  <td className="py-2.5 text-gray-600">{(h.asset as { asset_type?: string; brand?: string; model?: string } | null)?.asset_type} {(h.asset as { brand?: string } | null)?.brand} {(h.asset as { model?: string } | null)?.model}</td>
                  <td className="py-2.5 text-gray-600">{new Date(h.assigned_at).toLocaleDateString('es-ES')}</td>
                  <td className="py-2.5 text-gray-600">{h.returned_at ? new Date(h.returned_at).toLocaleDateString('es-ES') : '—'}</td>
                  <td className="py-2.5">{h.returned_at ? <Badge variant="neutral">Devuelto</Badge> : <Badge variant="success">En uso</Badge>}</td>
                </tr>
              ))}
              {history.length === 0 && <tr><td colSpan={5} className="py-6 text-center text-gray-400">Sin historial</td></tr>}
            </tbody>
          </table>
        </div>
      </Modal>

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={deactivateEmployee}
        title="Desactivar Empleado"
        message={`¿Desactivar a ${selected?.name}? Se conservara su historial.`}
        confirmLabel="Desactivar"
        danger
      />
    </div>
  );
}
