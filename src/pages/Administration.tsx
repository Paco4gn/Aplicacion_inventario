import { useEffect, useState } from 'react';
import { Copy, DatabaseBackup, KeyRound, Plus, RefreshCw, ShieldCheck, Trash2, Users } from 'lucide-react';
import { apiRequest } from '../lib/api';
import { useToast } from '../contexts/ToastContext';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';

type Role = 'admin' | 'technician' | 'viewer';
type ManagedUser = {
  id: string; name: string; email: string; role: Role; token_hint: string; active: boolean;
  created_at: string; updated_at: string; last_login_at: string | null;
};
type Snapshot = {
  id: string; label: string; counts: Record<string, number>; automatic: boolean;
  created_by: string; created_at: string;
};

async function responseData<T>(response: Response): Promise<T> {
  const data = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(data.error || 'No se pudo completar la operación');
  return data;
}

export function Administration() {
  const { showToast } = useToast();
  const [tab, setTab] = useState<'users' | 'backups'>('users');
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [userModal, setUserModal] = useState(false);
  const [userForm, setUserForm] = useState<{ name: string; email: string; role: Role }>({ name: '', email: '', role: 'technician' });
  const [newToken, setNewToken] = useState('');
  const [confirm, setConfirm] = useState<{ kind: 'restore' | 'delete'; snapshot: Snapshot } | null>(null);

  async function load() {
    setLoading(true);
    try {
      const [usersResult, snapshotsResult] = await Promise.all([
        responseData<{ users: ManagedUser[] }>(await apiRequest('/api/admin/users')),
        responseData<{ snapshots: Snapshot[] }>(await apiRequest('/api/admin/snapshots')),
      ]);
      setUsers(usersResult.users);
      setSnapshots(snapshotsResult.snapshots);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'No se pudo cargar la administración', 'error');
    } finally {
      setLoading(false);
    }
  }

  // The initial request intentionally runs once; later refreshes are explicit.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, []);

  async function createUser() {
    setBusy(true);
    try {
      const result = await responseData<{ access_token: string }>(await apiRequest('/api/admin/users', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create', ...userForm }),
      }));
      setNewToken(result.access_token);
      setUserModal(false);
      setUserForm({ name: '', email: '', role: 'technician' });
      await load();
      showToast('Usuario creado. Guarda su clave ahora');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'No se pudo crear el usuario', 'error');
    } finally { setBusy(false); }
  }

  async function updateUser(user: ManagedUser, changes: Partial<ManagedUser>) {
    setBusy(true);
    try {
      await responseData(await apiRequest('/api/admin/users', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update', id: user.id, name: user.name, email: user.email, role: user.role, active: user.active, ...changes }),
      }));
      await load();
      showToast('Usuario actualizado');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'No se pudo actualizar', 'error');
    } finally { setBusy(false); }
  }

  async function regenerate(user: ManagedUser) {
    setBusy(true);
    try {
      const result = await responseData<{ access_token: string }>(await apiRequest('/api/admin/users', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'regenerate', id: user.id }),
      }));
      setNewToken(result.access_token);
      await load();
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'No se pudo renovar la clave', 'error');
    } finally { setBusy(false); }
  }

  async function createSnapshot() {
    setBusy(true);
    try {
      await responseData(await apiRequest('/api/admin/snapshots', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create', label: `Copia manual ${new Date().toLocaleString('es-ES')}` }),
      }));
      await load();
      showToast('Copia de seguridad creada');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'No se pudo crear la copia', 'error');
    } finally { setBusy(false); }
  }

  async function runSnapshotAction() {
    if (!confirm) return;
    setBusy(true);
    try {
      await responseData(await apiRequest('/api/admin/snapshots', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: confirm.kind, id: confirm.snapshot.id }),
      }));
      showToast(confirm.kind === 'restore' ? 'Copia restaurada correctamente' : 'Copia eliminada');
      setConfirm(null);
      await load();
      if (confirm.kind === 'restore') window.setTimeout(() => window.location.reload(), 600);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'No se pudo completar la operación', 'error');
    } finally { setBusy(false); }
  }

  const snapshotTotal = (snapshot: Snapshot) => Object.values(snapshot.counts).reduce((total, count) => total + count, 0);

  return (
    <div className="p-6 space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl">
          <button onClick={() => setTab('users')} className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === 'users' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}><Users size={15} className="inline mr-2" />Usuarios</button>
          <button onClick={() => setTab('backups')} className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === 'backups' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}><DatabaseBackup size={15} className="inline mr-2" />Copias</button>
        </div>
        <button onClick={load} disabled={loading} className="ml-auto btn-secondary flex items-center gap-2"><RefreshCw size={15} />Actualizar</button>
        {tab === 'users' ? (
          <button onClick={() => setUserModal(true)} className="btn-primary flex items-center gap-2"><Plus size={16} />Nuevo usuario</button>
        ) : (
          <button onClick={createSnapshot} disabled={busy} className="btn-primary flex items-center gap-2"><DatabaseBackup size={16} />Crear copia ahora</button>
        )}
      </div>

      {tab === 'users' ? (
        <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100"><h2 className="font-semibold text-gray-900">Acceso individual y permisos</h2><p className="text-sm text-gray-500 mt-1">Cada persona usa su propia clave. Las claves solo se muestran al crearlas o renovarlas.</p></div>
          <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-gray-50"><tr>
            <th className="text-left px-4 py-3 text-gray-500">Usuario</th><th className="text-left px-4 py-3 text-gray-500">Permiso</th><th className="text-left px-4 py-3 text-gray-500">Clave</th><th className="text-left px-4 py-3 text-gray-500">Estado</th><th className="text-left px-4 py-3 text-gray-500">Acciones</th>
          </tr></thead><tbody>{users.map(user => <tr key={user.id} className="border-t border-gray-50">
            <td className="px-4 py-3"><p className="font-medium text-gray-900">{user.name}</p><p className="text-xs text-gray-400">{user.email}</p></td>
            <td className="px-4 py-3"><select value={user.role} disabled={busy} onChange={event => updateUser(user, { role: event.target.value as Role })} className="input py-1.5"><option value="admin">Administrador</option><option value="technician">Técnico</option><option value="viewer">Solo consulta</option></select></td>
            <td className="px-4 py-3 font-mono text-xs text-gray-500">••••{user.token_hint}</td>
            <td className="px-4 py-3"><Badge variant={user.active ? 'success' : 'neutral'}>{user.active ? 'Activo' : 'Desactivado'}</Badge></td>
            <td className="px-4 py-3"><div className="flex gap-2"><button onClick={() => regenerate(user)} disabled={busy} className="btn-secondary text-xs flex items-center gap-1"><KeyRound size={13} />Renovar clave</button><button onClick={() => updateUser(user, { active: !user.active })} disabled={busy} className="btn-secondary text-xs">{user.active ? 'Desactivar' : 'Activar'}</button></div></td>
          </tr>)}</tbody></table></div>
          {!loading && users.length === 0 && <p className="p-10 text-center text-gray-400">Aún no hay usuarios individuales. La clave principal sigue funcionando.</p>}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-800 flex gap-3"><ShieldCheck size={18} className="flex-shrink-0" /><span>Se crea una copia automática diaria y se conservan las 30 más recientes. También puedes crear puntos de restauración manuales.</span></div>
          {snapshots.map(snapshot => <div key={snapshot.id} className="bg-white border border-gray-100 rounded-xl p-4 flex flex-wrap items-center gap-4">
            <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center"><DatabaseBackup size={19} /></div>
            <div className="flex-1 min-w-[240px]"><div className="flex items-center gap-2"><p className="font-medium text-gray-900">{snapshot.label}</p><Badge variant={snapshot.automatic ? 'info' : 'neutral'}>{snapshot.automatic ? 'Automática' : 'Manual'}</Badge></div><p className="text-xs text-gray-400 mt-1">{new Date(snapshot.created_at).toLocaleString('es-ES')} · {snapshotTotal(snapshot)} registros · {snapshot.created_by}</p></div>
            <button onClick={() => setConfirm({ kind: 'restore', snapshot })} className="btn-secondary text-sm">Restaurar</button>
            <button onClick={() => setConfirm({ kind: 'delete', snapshot })} className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50"><Trash2 size={16} /></button>
          </div>)}
          {!loading && snapshots.length === 0 && <div className="bg-white rounded-xl border border-gray-100 p-12 text-center text-gray-400">No hay copias guardadas todavía</div>}
        </div>
      )}

      <Modal open={userModal} onClose={() => setUserModal(false)} title="Nuevo usuario" size="md"><div className="space-y-4">
        <label className="block text-sm font-medium text-gray-700">Nombre<input value={userForm.name} onChange={event => setUserForm(form => ({ ...form, name: event.target.value }))} className="input mt-1" /></label>
        <label className="block text-sm font-medium text-gray-700">Correo<input type="email" value={userForm.email} onChange={event => setUserForm(form => ({ ...form, email: event.target.value }))} className="input mt-1" /></label>
        <label className="block text-sm font-medium text-gray-700">Permiso<select value={userForm.role} onChange={event => setUserForm(form => ({ ...form, role: event.target.value as Role }))} className="input mt-1"><option value="admin">Administrador</option><option value="technician">Técnico</option><option value="viewer">Solo consulta</option></select></label>
        <button onClick={createUser} disabled={busy || !userForm.name || !userForm.email} className="btn-primary w-full">Crear usuario</button>
      </div></Modal>

      <Modal open={Boolean(newToken)} onClose={() => setNewToken('')} title="Clave de acceso" size="md"><div className="space-y-4"><p className="text-sm text-gray-600">Copia esta clave ahora. Por seguridad no volverá a mostrarse.</p><div className="bg-slate-950 text-emerald-300 rounded-xl p-4 font-mono text-sm break-all">{newToken}</div><button onClick={() => { navigator.clipboard.writeText(newToken); showToast('Clave copiada'); }} className="btn-primary w-full flex items-center justify-center gap-2"><Copy size={15} />Copiar clave</button></div></Modal>

      <ConfirmDialog open={Boolean(confirm)} onClose={() => setConfirm(null)} onConfirm={runSnapshotAction} title={confirm?.kind === 'restore' ? 'Restaurar copia' : 'Eliminar copia'} message={confirm?.kind === 'restore' ? 'Se repondrán los registros guardados en esta copia. Los registros nuevos no se borrarán.' : 'Esta copia dejará de estar disponible.'} confirmLabel={confirm?.kind === 'restore' ? 'Restaurar' : 'Eliminar'} danger={confirm?.kind === 'delete'} />
    </div>
  );
}
