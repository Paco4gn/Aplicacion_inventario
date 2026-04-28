import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, TrendingUp, TrendingDown, AlertCircle, Download } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { logAction } from '../lib/audit';
import { exportCSV } from '../lib/csv';
import { useToast } from '../contexts/ToastContext';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { SearchInput } from '../components/ui/SearchInput';
import { Pagination } from '../components/ui/Pagination';
import type { Component, ComponentMovement } from '../types';

const PAGE_SIZE = 15;
const COMPONENT_TYPES = ['RAM', 'HDD', 'SSD', 'GPU', 'CPU', 'PSU', 'Motherboard', 'Monitor', 'Teclado', 'Ratón', 'Cable', 'Otro'];

const emptyComponent: Partial<Component> = {
  name: '', component_type: 'RAM', brand: '', model: '',
  stock: 0, min_stock: 1, location: '', unit_cost: null, notes: '',
};

export function Components() {
  const { showToast } = useToast();
  const [components, setComponents] = useState<Component[]>([]);
  const [movements, setMovements] = useState<ComponentMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'stock' | 'movements'>('stock');
  const [page, setPage] = useState(1);

  const [modalOpen, setModalOpen] = useState(false);
  const [moveModalOpen, setMoveModalOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const [editing, setEditing] = useState<Partial<Component>>(emptyComponent);
  const [selected, setSelected] = useState<Component | null>(null);
  const [moveType, setMoveType] = useState<'in' | 'out'>('in');
  const [moveQty, setMoveQty] = useState(1);
  const [moveReason, setMoveReason] = useState('');

  async function load() {
    const [{ data: c }, { data: m }] = await Promise.all([
      supabase.from('components').select('*').order('name'),
      supabase.from('component_movements')
        .select('*, component:components(name,component_type)')
        .order('moved_at', { ascending: false })
        .limit(200),
    ]);
    setComponents(c ?? []);
    setMovements(m ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);
  useEffect(() => { setPage(1); }, [search, tab]);

  const filteredComponents = components.filter(c => {
    const q = search.toLowerCase();
    return !q || c.name.toLowerCase().includes(q) || c.component_type.toLowerCase().includes(q) || c.brand.toLowerCase().includes(q);
  });

  const filteredMovements = movements.filter(m => {
    const q = search.toLowerCase();
    return !q || ((m.component as any)?.name ?? '').toLowerCase().includes(q);
  });

  const paginatedComponents = filteredComponents.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const paginatedMovements = filteredMovements.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  async function save() {
    if (!editing.name?.trim()) { showToast('Nombre es obligatorio', 'error'); return; }
    if (editing.id) {
      await supabase.from('components').update({ ...editing, updated_at: new Date().toISOString() }).eq('id', editing.id);
      await logAction('updated', 'component', editing.id, editing.name ?? '');
      showToast('Componente actualizado');
    } else {
      const { data } = await supabase.from('components').insert([editing]).select().maybeSingle();
      if (data) await logAction('created', 'component', data.id, data.name);
      showToast('Componente añadido');
    }
    setModalOpen(false);
    load();
  }

  async function deleteComponent() {
    if (!selected) return;
    await supabase.from('components').delete().eq('id', selected.id);
    await logAction('deleted', 'component', selected.id, selected.name);
    showToast('Componente eliminado', 'warning');
    load();
  }

  async function registerMovement() {
    if (!selected) return;
    if (moveType === 'out' && moveQty > selected.stock) {
      showToast('Stock insuficiente', 'error'); return;
    }
    const newStock = moveType === 'in' ? selected.stock + moveQty : selected.stock - moveQty;
    await supabase.from('components').update({ stock: newStock, updated_at: new Date().toISOString() }).eq('id', selected.id);
    await supabase.from('component_movements').insert([{
      component_id: selected.id, movement_type: moveType, quantity: moveQty, reason: moveReason,
    }]);
    await logAction(moveType === 'in' ? 'stock_in' : 'stock_out', 'component', selected.id, selected.name, { qty: moveQty });
    showToast(`Movimiento registrado: ${moveType === 'in' ? '+' : '-'}${moveQty}`);
    setMoveModalOpen(false);
    setMoveQty(1);
    setMoveReason('');
    load();
  }

  function handleExport() {
    exportCSV('componentes.csv', filteredComponents, [
      { key: 'name', label: 'Nombre' },
      { key: 'component_type', label: 'Tipo' },
      { key: 'brand', label: 'Marca' },
      { key: 'model', label: 'Modelo' },
      { key: 'stock', label: 'Stock' },
      { key: 'min_stock', label: 'Stock Mínimo' },
      { key: 'location', label: 'Ubicación' },
      { key: 'unit_cost', label: 'Coste Unitario €' },
    ]);
  }

  if (loading) return (
    <div className="flex justify-center items-center h-64">
      <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        <button onClick={() => setTab('stock')} className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${tab === 'stock' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Stock</button>
        <button onClick={() => setTab('movements')} className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${tab === 'movements' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Movimientos</button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <SearchInput value={search} onChange={setSearch} placeholder="Buscar componente..." />
        <div className="ml-auto flex items-center gap-2">
          {tab === 'stock' && (
            <>
              <button onClick={handleExport} className="flex items-center gap-2 text-gray-600 hover:text-gray-900 bg-white border border-gray-200 hover:border-gray-300 text-sm font-medium px-3 py-2 rounded-lg transition-colors">
                <Download size={15} /> CSV
              </button>
              <button onClick={() => { setEditing(emptyComponent); setModalOpen(true); }} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
                <Plus size={16} /> Nuevo Componente
              </button>
            </>
          )}
        </div>
      </div>

      {tab === 'stock' ? (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">Nombre</th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">Tipo</th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">Marca/Modelo</th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">Ubicación</th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">Stock</th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">Estado</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {paginatedComponents.map(c => (
                  <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-800">{c.name}</td>
                    <td className="px-4 py-3 text-gray-600">{c.component_type}</td>
                    <td className="px-4 py-3 text-gray-600">{c.brand} {c.model}</td>
                    <td className="px-4 py-3 text-gray-500">{c.location || '—'}</td>
                    <td className="px-4 py-3 font-semibold text-gray-800">{c.stock}</td>
                    <td className="px-4 py-3">
                      {c.stock === 0
                        ? <Badge variant="danger">Sin stock</Badge>
                        : c.stock <= c.min_stock
                          ? <Badge variant="warning"><AlertCircle size={11} className="inline mr-1" />Stock bajo</Badge>
                          : <Badge variant="success">OK</Badge>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        <button onClick={() => { setSelected(c); setMoveType('in'); setMoveModalOpen(true); }} className="p-1.5 rounded-lg hover:bg-emerald-50 text-gray-400 hover:text-emerald-600 transition-colors" title="Entrada">
                          <TrendingUp size={15} />
                        </button>
                        <button onClick={() => { setSelected(c); setMoveType('out'); setMoveModalOpen(true); }} className="p-1.5 rounded-lg hover:bg-amber-50 text-gray-400 hover:text-amber-600 transition-colors" title="Salida">
                          <TrendingDown size={15} />
                        </button>
                        <button onClick={() => { setEditing({ ...c }); setModalOpen(true); }} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors">
                          <Pencil size={15} />
                        </button>
                        <button onClick={() => { setSelected(c); setDeleteOpen(true); }} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {paginatedComponents.length === 0 && <tr><td colSpan={7} className="px-4 py-10 text-center text-gray-400">No se encontraron componentes</td></tr>}
              </tbody>
            </table>
          </div>
          <Pagination page={page} pageSize={PAGE_SIZE} total={filteredComponents.length} onChange={setPage} />
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">Componente</th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">Tipo</th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">Movimiento</th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">Cantidad</th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">Razón</th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">Fecha</th>
                </tr>
              </thead>
              <tbody>
                {paginatedMovements.map(m => (
                  <tr key={m.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-800">{(m.component as any)?.name}</td>
                    <td className="px-4 py-3 text-gray-600">{(m.component as any)?.component_type}</td>
                    <td className="px-4 py-3">
                      {m.movement_type === 'in'
                        ? <span className="flex items-center gap-1 text-emerald-600 font-medium"><TrendingUp size={13} /> Entrada</span>
                        : <span className="flex items-center gap-1 text-amber-600 font-medium"><TrendingDown size={13} /> Salida</span>}
                    </td>
                    <td className="px-4 py-3 font-semibold text-gray-800">{m.movement_type === 'in' ? '+' : '-'}{m.quantity}</td>
                    <td className="px-4 py-3 text-gray-500">{m.reason || '—'}</td>
                    <td className="px-4 py-3 text-gray-500">{new Date(m.moved_at).toLocaleDateString('es-ES')}</td>
                  </tr>
                ))}
                {paginatedMovements.length === 0 && <tr><td colSpan={6} className="px-4 py-10 text-center text-gray-400">Sin movimientos</td></tr>}
              </tbody>
            </table>
          </div>
          <Pagination page={page} pageSize={PAGE_SIZE} total={filteredMovements.length} onChange={setPage} />
        </div>
      )}

      {/* Create/Edit modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing.id ? 'Editar Componente' : 'Nuevo Componente'} size="md">
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="block text-xs font-medium text-gray-500 mb-1">Nombre *</label>
            <input value={editing.name ?? ''} onChange={e => setEditing(p => ({ ...p, name: e.target.value }))} className="input" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Tipo</label>
            <select value={editing.component_type ?? 'RAM'} onChange={e => setEditing(p => ({ ...p, component_type: e.target.value }))} className="input">
              {COMPONENT_TYPES.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Marca</label>
            <input value={editing.brand ?? ''} onChange={e => setEditing(p => ({ ...p, brand: e.target.value }))} className="input" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Modelo</label>
            <input value={editing.model ?? ''} onChange={e => setEditing(p => ({ ...p, model: e.target.value }))} className="input" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Ubicación</label>
            <input value={editing.location ?? ''} onChange={e => setEditing(p => ({ ...p, location: e.target.value }))} className="input" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Stock Actual</label>
            <input type="number" min="0" value={editing.stock ?? 0} onChange={e => setEditing(p => ({ ...p, stock: parseInt(e.target.value) || 0 }))} className="input" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Stock Mínimo</label>
            <input type="number" min="0" value={editing.min_stock ?? 1} onChange={e => setEditing(p => ({ ...p, min_stock: parseInt(e.target.value) || 1 }))} className="input" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Coste Unitario (€)</label>
            <input type="number" step="0.01" min="0" value={editing.unit_cost ?? ''} onChange={e => setEditing(p => ({ ...p, unit_cost: e.target.value ? parseFloat(e.target.value) : null }))} className="input" />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium text-gray-500 mb-1">Notas</label>
            <textarea rows={2} value={editing.notes ?? ''} onChange={e => setEditing(p => ({ ...p, notes: e.target.value }))} className="input resize-none" />
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-5">
          <button onClick={() => setModalOpen(false)} className="btn-secondary">Cancelar</button>
          <button onClick={save} className="btn-primary">Guardar</button>
        </div>
      </Modal>

      {/* Movement modal */}
      <Modal open={moveModalOpen} onClose={() => setMoveModalOpen(false)} title={`Movimiento de stock: ${selected?.name}`} size="sm">
        <div className="space-y-4">
          <div className="flex gap-2">
            <button onClick={() => setMoveType('in')} className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${moveType === 'in' ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              Entrada
            </button>
            <button onClick={() => setMoveType('out')} className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${moveType === 'out' ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              Salida
            </button>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Cantidad</label>
            <input type="number" min="1" value={moveQty} onChange={e => setMoveQty(Math.max(1, parseInt(e.target.value) || 1))} className="input" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Razón / Notas</label>
            <input value={moveReason} onChange={e => setMoveReason(e.target.value)} className="input" placeholder="Opcional" />
          </div>
          {selected && (
            <p className="text-xs text-gray-400">Stock actual: <span className="font-semibold text-gray-700">{selected.stock}</span></p>
          )}
        </div>
        <div className="flex justify-end gap-3 mt-5">
          <button onClick={() => setMoveModalOpen(false)} className="btn-secondary">Cancelar</button>
          <button onClick={registerMovement} className="btn-primary">Registrar</button>
        </div>
      </Modal>

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={deleteComponent}
        title="Eliminar Componente"
        message={`¿Eliminar "${selected?.name}"?`}
        confirmLabel="Eliminar"
        danger
      />
    </div>
  );
}
