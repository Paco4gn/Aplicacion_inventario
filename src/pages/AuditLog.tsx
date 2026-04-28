import { useEffect, useState } from 'react';
import { ClipboardList, Download, CalendarRange } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { exportCSV } from '../lib/csv';
import { SearchInput } from '../components/ui/SearchInput';
import { Badge } from '../components/ui/Badge';
import { Pagination } from '../components/ui/Pagination';
import { SkeletonRow } from '../components/ui/SkeletonRow';
import type { AuditLog as AuditLogType } from '../types';

const PAGE_SIZE = 20;

const ENTITY_COLORS: Record<string, 'blue' | 'sky' | 'red' | 'emerald' | 'amber' | 'neutral'> = {
  asset: 'blue', employee: 'sky', incident: 'red',
  software: 'emerald', license: 'amber', component: 'neutral',
};

const ACTION_COLORS: Record<string, 'success' | 'info' | 'danger' | 'warning' | 'blue' | 'neutral'> = {
  created: 'success', updated: 'info', deleted: 'danger',
  deactivated: 'warning', assigned: 'blue', closed: 'neutral',
  stock_in: 'success', stock_out: 'warning',
};

const ACTION_LABELS: Record<string, string> = {
  created: 'Creado', updated: 'Actualizado', deleted: 'Eliminado',
  deactivated: 'Desactivado', assigned: 'Asignado', closed: 'Cerrado',
  stock_in: 'Entrada', stock_out: 'Salida',
};

const ENTITY_LABELS: Record<string, string> = {
  asset: 'Activo', employee: 'Empleado', incident: 'Incidencia',
  software: 'Software', license: 'Licencia', component: 'Componente',
};

export function AuditLog() {
  const [logs, setLogs] = useState<AuditLogType[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterEntity, setFilterEntity] = useState('');
  const [filterAction, setFilterAction] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    supabase
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(2000)
      .then(({ data }) => { setLogs(data ?? []); setLoading(false); });
  }, []);

  useEffect(() => { setPage(1); }, [search, filterEntity, filterAction, dateFrom, dateTo]);

  const filtered = logs.filter(l => {
    const q = search.toLowerCase();
    const matchSearch = !q
      || l.entity_name.toLowerCase().includes(q)
      || l.action.toLowerCase().includes(q)
      || l.entity_type.toLowerCase().includes(q)
      || l.performed_by.toLowerCase().includes(q);
    const matchEntity = !filterEntity || l.entity_type === filterEntity;
    const matchAction = !filterAction || l.action === filterAction;
    const logDate = l.created_at.slice(0, 10);
    const matchFrom = !dateFrom || logDate >= dateFrom;
    const matchTo = !dateTo || logDate <= dateTo;
    return matchSearch && matchEntity && matchAction && matchFrom && matchTo;
  });

  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function clearDateFilters() { setDateFrom(''); setDateTo(''); }

  function handleExport() {
    exportCSV('auditoria.csv', filtered, [
      { key: 'created_at', label: 'Fecha' },
      { key: 'action', label: 'Acción' },
      { key: 'entity_type', label: 'Entidad' },
      { key: 'entity_name', label: 'Nombre' },
      { key: 'performed_by', label: 'Usuario' },
    ]);
  }

  return (
    <div className="p-6 space-y-4">
      {/* Toolbar row 1: search + entity + action filters */}
      <div className="flex flex-wrap items-center gap-3">
        <SearchInput value={search} onChange={setSearch} placeholder="Buscar en registros..." />
        <select
          value={filterEntity}
          onChange={e => setFilterEntity(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white text-gray-700"
        >
          <option value="">Todas las entidades</option>
          {Object.entries(ENTITY_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <select
          value={filterAction}
          onChange={e => setFilterAction(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white text-gray-700"
        >
          <option value="">Todas las acciones</option>
          {Object.entries(ACTION_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>

        {/* Date range */}
        <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-1.5">
          <CalendarRange size={14} className="text-gray-400 flex-shrink-0" />
          <input
            type="date"
            value={dateFrom}
            onChange={e => setDateFrom(e.target.value)}
            className="text-sm text-gray-700 focus:outline-none bg-transparent"
            title="Desde"
          />
          <span className="text-gray-300 text-xs">—</span>
          <input
            type="date"
            value={dateTo}
            onChange={e => setDateTo(e.target.value)}
            className="text-sm text-gray-700 focus:outline-none bg-transparent"
            title="Hasta"
          />
          {(dateFrom || dateTo) && (
            <button onClick={clearDateFilters} className="text-gray-400 hover:text-gray-600 ml-1 text-xs leading-none">✕</button>
          )}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <span className="text-sm text-gray-500">{filtered.length} registros</span>
          <button
            onClick={handleExport}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 bg-white border border-gray-200 hover:border-gray-300 text-sm font-medium px-3 py-2 rounded-lg transition-colors"
          >
            <Download size={15} /> CSV
          </button>
        </div>
      </div>

      {filtered.length === 0 && !loading ? (
        <div className="bg-white rounded-2xl border border-gray-100 flex flex-col items-center justify-center py-20 text-gray-400">
          <ClipboardList size={40} className="mb-3 opacity-30" />
          <p>No hay registros de auditoría</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">Fecha</th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">Acción</th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">Entidad</th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">Nombre</th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">Detalles</th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">Usuario</th>
                </tr>
              </thead>
              <tbody>
                {loading
                  ? Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} cols={6} />)
                  : paginated.map(log => (
                    <tr key={log.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap text-xs">
                        {new Date(log.created_at).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={ACTION_COLORS[log.action] ?? 'neutral'}>
                          {ACTION_LABELS[log.action] ?? log.action}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={ENTITY_COLORS[log.entity_type] ?? 'neutral'}>
                          {ENTITY_LABELS[log.entity_type] ?? log.entity_type}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-800">{log.entity_name || '—'}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs max-w-xs truncate">
                        {Object.keys(log.details ?? {}).length > 0 ? JSON.stringify(log.details) : '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-xs">{log.performed_by}</td>
                    </tr>
                  ))
                }
              </tbody>
            </table>
          </div>
          {!loading && <Pagination page={page} pageSize={PAGE_SIZE} total={filtered.length} onChange={setPage} />}
        </div>
      )}
    </div>
  );
}
