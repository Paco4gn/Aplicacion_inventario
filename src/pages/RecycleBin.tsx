import { useEffect, useState } from 'react';
import { RefreshCw, RotateCcw, Trash2 } from 'lucide-react';
import { apiRequest } from '../lib/api';
import { useToast } from '../contexts/ToastContext';
import { Badge } from '../components/ui/Badge';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';

type RecycleItem = { id: string; table_name: string; record_id: string; display_name: string; deleted_by: string; deleted_at: string };
const entityLabels: Record<string, string> = { assets: 'Activo', employees: 'Empleado', incidents: 'Incidencia', software: 'Software', licenses: 'Licencia', components: 'Componente', audit_logs: 'Auditoría', incident_notification_recipients: 'Destinatario' };

export function RecycleBin() {
  const { showToast } = useToast();
  const [items, setItems] = useState<RecycleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirm, setConfirm] = useState<{ action: 'restore' | 'delete' | 'empty'; item?: RecycleItem } | null>(null);

  async function load() {
    setLoading(true);
    try {
      const response = await apiRequest('/api/admin/recycle-bin');
      const data = await response.json() as { items?: RecycleItem[]; error?: string };
      if (!response.ok) throw new Error(data.error || 'No se pudo cargar la papelera');
      setItems(data.items ?? []);
    } catch (error) { showToast(error instanceof Error ? error.message : 'No se pudo cargar la papelera', 'error'); }
    finally { setLoading(false); }
  }

  // The initial request intentionally runs once; later refreshes are explicit.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, []);

  async function execute() {
    if (!confirm) return;
    try {
      const response = await apiRequest('/api/admin/recycle-bin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: confirm.action, id: confirm.item?.id }) });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || 'No se pudo completar la operación');
      showToast(confirm.action === 'restore' ? 'Registro y relaciones restaurados' : confirm.action === 'empty' ? 'Papelera vaciada' : 'Elemento eliminado definitivamente');
      setConfirm(null);
      await load();
    } catch (error) { showToast(error instanceof Error ? error.message : 'No se pudo completar la operación', 'error'); }
  }

  return <div className="p-6 space-y-4">
    <div className="flex items-center gap-3"><div><h2 className="font-semibold text-gray-900">Elementos eliminados</h2><p className="text-sm text-gray-500">Restaura registros junto con sus asignaciones y relaciones.</p></div><span className="ml-auto text-sm text-gray-500">{items.length} elementos</span><button onClick={load} className="btn-secondary flex items-center gap-2"><RefreshCw size={15} />Actualizar</button>{items.length > 0 && <button onClick={() => setConfirm({ action: 'empty' })} className="btn-secondary text-red-600 flex items-center gap-2"><Trash2 size={15} />Vaciar</button>}</div>
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden"><div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-gray-50"><tr><th className="text-left px-4 py-3 text-gray-500">Elemento</th><th className="text-left px-4 py-3 text-gray-500">Tipo</th><th className="text-left px-4 py-3 text-gray-500">Eliminado</th><th className="text-left px-4 py-3 text-gray-500">Usuario</th><th className="px-4 py-3" /></tr></thead><tbody>
      {items.map(item => <tr key={item.id} className="border-t border-gray-50"><td className="px-4 py-3 font-medium text-gray-900">{item.display_name}</td><td className="px-4 py-3"><Badge variant="neutral">{entityLabels[item.table_name] ?? item.table_name}</Badge></td><td className="px-4 py-3 text-gray-500">{new Date(item.deleted_at).toLocaleString('es-ES')}</td><td className="px-4 py-3 text-gray-500">{item.deleted_by}</td><td className="px-4 py-3"><div className="flex justify-end gap-2"><button onClick={() => setConfirm({ action: 'restore', item })} className="btn-secondary text-xs flex items-center gap-1"><RotateCcw size={13} />Restaurar</button><button onClick={() => setConfirm({ action: 'delete', item })} className="p-2 text-gray-400 hover:text-red-600"><Trash2 size={15} /></button></div></td></tr>)}
      {!loading && items.length === 0 && <tr><td colSpan={5} className="px-4 py-16 text-center text-gray-400">La papelera está vacía</td></tr>}
    </tbody></table></div></div>
    <ConfirmDialog open={Boolean(confirm)} onClose={() => setConfirm(null)} onConfirm={execute} title={confirm?.action === 'restore' ? 'Restaurar elemento' : confirm?.action === 'empty' ? 'Vaciar papelera' : 'Eliminar definitivamente'} message={confirm?.action === 'restore' ? 'Se restaurará el registro y las relaciones que tenía al eliminarse.' : 'Esta acción ya no se podrá deshacer.'} confirmLabel={confirm?.action === 'restore' ? 'Restaurar' : 'Eliminar'} danger={confirm?.action !== 'restore'} />
  </div>;
}
