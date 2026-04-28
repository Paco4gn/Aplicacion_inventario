import { useEffect, useState } from 'react';
import {
  Monitor, Users, AlertTriangle, Package, BookOpen, CheckCircle, Wrench,
  Archive, TrendingUp, ShieldAlert, Clock, MapPin, User,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Badge } from '../components/ui/Badge';
import { SkeletonCard } from '../components/ui/SkeletonRow';
import type { DashboardStats, Asset, Incident } from '../types';

interface CostSummary {
  totalAssetValue: number;
  totalLicenseCost: number;
  totalComponentValue: number;
}

interface WarningAsset {
  id: string;
  serial_number: string;
  name: string;
  asset_type: string;
  warranty_expiry: string | null;
  end_of_life: string | null;
  daysWarranty: number | null;
  daysEol: number | null;
}

interface MonthBucket {
  label: string;
  open: number;
  closed: number;
}

interface RecentAssetRow extends Asset {
  employee_name?: string | null;
  location?: string;
}

function statusBadge(status: string) {
  if (status === 'active') return <Badge variant="success">Activo</Badge>;
  if (status === 'repair') return <Badge variant="warning">Reparación</Badge>;
  return <Badge variant="danger">Retirado</Badge>;
}

function priorityBadge(p: string) {
  if (p === 'critical') return <Badge variant="danger">Crítica</Badge>;
  if (p === 'high') return <Badge variant="warning">Alta</Badge>;
  if (p === 'medium') return <Badge variant="info">Media</Badge>;
  return <Badge variant="neutral">Baja</Badge>;
}

function incidentStatusBadge(s: string) {
  if (s === 'open') return <Badge variant="danger">Abierta</Badge>;
  if (s === 'in_progress') return <Badge variant="warning">En Progreso</Badge>;
  return <Badge variant="success">Cerrada</Badge>;
}

function buildMonthBuckets(incidents: Incident[]): MonthBucket[] {
  const now = new Date();
  const buckets: Record<string, MonthBucket> = {};
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString('es-ES', { month: 'short', year: '2-digit' });
    buckets[key] = { label, open: 0, closed: 0 };
  }
  for (const inc of incidents) {
    const d = new Date(inc.opened_at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (buckets[key]) {
      if (inc.status === 'closed') buckets[key].closed++;
      else buckets[key].open++;
    }
  }
  return Object.values(buckets);
}

// ── Stat card ──────────────────────────────────────────────────────────────────
function StatCard({
  label, value, icon: Icon, color, subtitle, alert = false,
}: {
  label: string; value: number | string; icon: React.ElementType;
  color: string; subtitle?: string; alert?: boolean;
}) {
  const colors: Record<string, { bg: string; iconBg: string; val: string; border: string }> = {
    blue:    { bg: 'bg-blue-50',    iconBg: 'bg-blue-600',    val: 'text-blue-700',    border: 'border-blue-100' },
    emerald: { bg: 'bg-emerald-50', iconBg: 'bg-emerald-600', val: 'text-emerald-700', border: 'border-emerald-100' },
    amber:   { bg: 'bg-amber-50',   iconBg: 'bg-amber-500',   val: 'text-amber-700',   border: 'border-amber-100' },
    red:     { bg: 'bg-red-50',     iconBg: 'bg-red-600',     val: 'text-red-700',     border: 'border-red-100' },
    sky:     { bg: 'bg-sky-50',     iconBg: 'bg-sky-600',     val: 'text-sky-700',     border: 'border-sky-100' },
    slate:   { bg: 'bg-slate-50',   iconBg: 'bg-slate-600',   val: 'text-slate-700',   border: 'border-slate-100' },
  };
  const c = colors[color] ?? colors.blue;
  return (
    <div className={`${c.bg} border ${c.border} rounded-2xl p-5 flex items-start gap-4 relative overflow-hidden`}>
      {alert && (
        <span className="absolute top-3 right-3 w-2 h-2 rounded-full bg-red-500 animate-pulse" />
      )}
      <div className={`${c.iconBg} p-3 rounded-xl flex-shrink-0`}>
        <Icon size={20} className="text-white" />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide leading-none mb-1">{label}</p>
        <p className={`text-4xl font-black ${c.val} leading-none`}>{value}</p>
        {subtitle && <p className="text-xs text-gray-400 mt-1.5 leading-none">{subtitle}</p>}
      </div>
    </div>
  );
}

export function Dashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    totalAssets: 0, activeAssets: 0, repairAssets: 0, retiredAssets: 0,
    openIncidents: 0, criticalIncidents: 0, expiringLicenses: 0,
    lowStockComponents: 0, totalEmployees: 0,
  });
  const [recentAssets, setRecentAssets] = useState<RecentAssetRow[]>([]);
  const [openIncidents, setOpenIncidents] = useState<Incident[]>([]);
  const [monthBuckets, setMonthBuckets] = useState<MonthBucket[]>([]);
  const [assetTypeMap, setAssetTypeMap] = useState<{ label: string; count: number }[]>([]);
  const [costs, setCosts] = useState<CostSummary>({ totalAssetValue: 0, totalLicenseCost: 0, totalComponentValue: 0 });
  const [warningAssets, setWarningAssets] = useState<WarningAsset[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [
        { data: assets },
        { data: incidents },
        { data: employees },
        { data: licenses },
        { data: components },
        { data: allLicenses },
        { data: assignments },
      ] = await Promise.all([
        supabase.from('assets').select('*').order('created_at', { ascending: false }),
        supabase.from('incidents').select('*, asset:assets(name,serial_number,location), employee:employees(name)').order('opened_at', { ascending: false }),
        supabase.from('employees').select('id').eq('active', true),
        supabase.from('licenses').select('expiry_date').not('expiry_date', 'is', null),
        supabase.from('components').select('stock, min_stock, unit_cost'),
        supabase.from('licenses').select('cost'),
        supabase.from('asset_assignments')
          .select('asset_id, employee:employees(name)')
          .is('returned_at', null),
      ]);

      const now = new Date();
      const in30 = new Date(); in30.setDate(in30.getDate() + 30);

      // Build employee name lookup by asset_id
      const empByAsset: Record<string, string> = {};
      for (const a of (assignments ?? []) as Array<{ asset_id: string; employee: { name: string } | null }>) {
        if (a.employee?.name) empByAsset[a.asset_id] = a.employee.name;
      }

      setStats({
        totalAssets: assets?.length ?? 0,
        activeAssets: assets?.filter(a => a.status === 'active').length ?? 0,
        repairAssets: assets?.filter(a => a.status === 'repair').length ?? 0,
        retiredAssets: assets?.filter(a => a.status === 'retired').length ?? 0,
        openIncidents: incidents?.filter(i => i.status !== 'closed').length ?? 0,
        criticalIncidents: incidents?.filter(i => i.priority === 'critical' && i.status !== 'closed').length ?? 0,
        expiringLicenses: licenses?.filter(l => {
          const d = new Date(l.expiry_date);
          return d >= now && d <= in30;
        }).length ?? 0,
        lowStockComponents: components?.filter(c => c.stock <= c.min_stock).length ?? 0,
        totalEmployees: employees?.length ?? 0,
      });

      const enrichedAssets: RecentAssetRow[] = (assets ?? []).slice(0, 8).map(a => ({
        ...a,
        employee_name: empByAsset[a.id] ?? null,
      }));
      setRecentAssets(enrichedAssets);
      setOpenIncidents((incidents ?? []).filter(i => i.status !== 'closed').slice(0, 6));
      setMonthBuckets(buildMonthBuckets(incidents ?? []));

      const totalAssetValue = (assets ?? []).reduce((s, a) => s + (a.purchase_value ?? 0), 0);
      const totalLicenseCost = (allLicenses ?? []).reduce((s, l: { cost: number | null }) => s + (l.cost ?? 0), 0);
      const totalComponentValue = (components ?? []).reduce((s, c: { stock: number; unit_cost: number | null }) => s + (c.stock * (c.unit_cost ?? 0)), 0);
      setCosts({ totalAssetValue, totalLicenseCost, totalComponentValue });

      const warnings: WarningAsset[] = (assets ?? [])
        .map(a => {
          const daysWarranty = a.warranty_expiry
            ? Math.ceil((new Date(a.warranty_expiry).getTime() - Date.now()) / 86400000)
            : null;
          const daysEol = a.end_of_life
            ? Math.ceil((new Date(a.end_of_life).getTime() - Date.now()) / 86400000)
            : null;
          return { id: a.id, serial_number: a.serial_number, name: a.name, asset_type: a.asset_type, warranty_expiry: a.warranty_expiry, end_of_life: a.end_of_life, daysWarranty, daysEol };
        })
        .filter(a => (a.daysWarranty !== null && a.daysWarranty <= 90) || (a.daysEol !== null && a.daysEol <= 180))
        .sort((a, b) => {
          const da = Math.min(a.daysWarranty ?? 999, a.daysEol ?? 999);
          const db = Math.min(b.daysWarranty ?? 999, b.daysEol ?? 999);
          return da - db;
        })
        .slice(0, 8);
      setWarningAssets(warnings);

      const typeCounts: Record<string, number> = {};
      for (const a of assets ?? []) {
        typeCounts[a.asset_type] = (typeCounts[a.asset_type] ?? 0) + 1;
      }
      setAssetTypeMap(
        Object.entries(typeCounts).sort((a, b) => b[1] - a[1]).map(([label, count]) => ({ label, count }))
      );

      setLoading(false);
    }
    load();
  }, []);

  const maxMonth = Math.max(...monthBuckets.map(b => b.open + b.closed), 1);
  const totalIncidents6m = monthBuckets.reduce((s, b) => s + b.open + b.closed, 0);

  if (loading) return (
    <div className="p-6 space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)}
      </div>
    </div>
  );

  return (
    <div className="p-6 space-y-6">

      {/* ── Row 1: primary stats ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Activos" value={stats.totalAssets} icon={Monitor} color="blue" subtitle="equipos registrados" />
        <StatCard label="Activos en Uso" value={stats.activeAssets} icon={CheckCircle} color="emerald" subtitle={`${stats.totalAssets ? Math.round((stats.activeAssets / stats.totalAssets) * 100) : 0}% del inventario`} />
        <StatCard label="En Reparación" value={stats.repairAssets} icon={Wrench} color="amber" subtitle="necesitan atención" alert={stats.repairAssets > 0} />
        <StatCard label="Empleados" value={stats.totalEmployees} icon={Users} color="sky" subtitle="activos en plantilla" />
      </div>

      {/* ── Row 2: alert stats ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Incidencias Abiertas" value={stats.openIncidents} icon={AlertTriangle} color="red" subtitle="pendientes de resolver" alert={stats.openIncidents > 0} />
        <StatCard label="Críticas" value={stats.criticalIncidents} icon={AlertTriangle} color="red" subtitle="prioridad crítica" alert={stats.criticalIncidents > 0} />
        <StatCard label="Licencias por Vencer" value={stats.expiringLicenses} icon={BookOpen} color="amber" subtitle="próximos 30 días" alert={stats.expiringLicenses > 0} />
        <StatCard label="Stock Bajo" value={stats.lowStockComponents} icon={Package} color={stats.lowStockComponents > 0 ? 'red' : 'slate'} subtitle="componentes bajo mínimo" alert={stats.lowStockComponents > 0} />
      </div>

      {/* ── Row 3: charts ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Distribution */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <h3 className="font-semibold text-gray-800 mb-5">Distribución de Activos</h3>
          <div className="space-y-4">
            {[
              { label: 'Activos', value: stats.activeAssets, color: 'bg-emerald-500', textColor: 'text-emerald-700' },
              { label: 'En Reparación', value: stats.repairAssets, color: 'bg-amber-400', textColor: 'text-amber-700' },
              { label: 'Retirados', value: stats.retiredAssets, color: 'bg-gray-300', textColor: 'text-gray-600' },
            ].map(item => (
              <div key={item.label}>
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-sm text-gray-600 font-medium">{item.label}</span>
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-bold ${item.textColor}`}>{item.value}</span>
                    <span className="text-xs text-gray-400">{stats.totalAssets ? `${Math.round((item.value / stats.totalAssets) * 100)}%` : '0%'}</span>
                  </div>
                </div>
                <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${item.color} rounded-full transition-all duration-700`}
                    style={{ width: stats.totalAssets ? `${(item.value / stats.totalAssets) * 100}%` : '0%' }}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-5 pt-4 border-t border-gray-100 flex items-center gap-3 text-xs text-gray-500">
            <Archive size={13} className="text-gray-400" />
            <span>Retirados: <span className="font-semibold text-gray-700">{stats.retiredAssets}</span></span>
            <span className="ml-auto text-gray-400">Total: <span className="font-semibold text-gray-700">{stats.totalAssets}</span></span>
          </div>
        </div>

        {/* Incident trend */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-1">
            <h3 className="font-semibold text-gray-800">Incidencias (6 meses)</h3>
            <TrendingUp size={15} className="text-gray-400" />
          </div>
          <p className="text-xs text-gray-400 mb-4">{totalIncidents6m} incidencias en total</p>
          <div className="flex items-end gap-1.5 h-32">
            {monthBuckets.map(b => {
              const total = b.open + b.closed;
              const openH = maxMonth > 0 ? (b.open / maxMonth) * 100 : 0;
              const closedH = maxMonth > 0 ? (b.closed / maxMonth) * 100 : 0;
              return (
                <div
                  key={b.label}
                  className="flex-1 flex flex-col items-center gap-0 group cursor-default"
                  title={`${b.label}: ${b.open} abiertas, ${b.closed} cerradas`}
                >
                  <div className="w-full flex flex-col justify-end rounded-lg overflow-hidden" style={{ height: '100%' }}>
                    {total === 0 ? (
                      <div className="w-full bg-gray-100 rounded-lg" style={{ height: '4px' }} />
                    ) : (
                      <>
                        <div className="w-full bg-red-300 group-hover:bg-red-400 transition-all rounded-t-lg" style={{ height: `${openH}%`, minHeight: openH > 0 ? '4px' : '0' }} />
                        <div className="w-full bg-emerald-400 group-hover:bg-emerald-500 transition-all" style={{ height: `${closedH}%`, minHeight: closedH > 0 ? '4px' : '0' }} />
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex items-center justify-between mt-2">
            {monthBuckets.map(b => (
              <span key={b.label} className="text-[10px] text-gray-400 flex-1 text-center">{b.label}</span>
            ))}
          </div>
          <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-100">
            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-emerald-400" /><span className="text-xs text-gray-500">Cerradas</span></div>
            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-red-300" /><span className="text-xs text-gray-500">Abiertas</span></div>
          </div>
        </div>

        {/* Asset type breakdown */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <h3 className="font-semibold text-gray-800 mb-5">Tipos de Activo</h3>
          {assetTypeMap.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">Sin datos</p>
          ) : (
            <div className="space-y-3">
              {assetTypeMap.slice(0, 7).map((item, idx) => {
                const barColors = ['bg-blue-500', 'bg-sky-400', 'bg-cyan-400', 'bg-teal-400', 'bg-emerald-400', 'bg-green-400', 'bg-lime-400'];
                return (
                  <div key={item.label}>
                    <div className="flex justify-between items-center mb-1.5">
                      <span className="text-sm text-gray-600">{item.label}</span>
                      <span className="text-sm font-bold text-gray-800">{item.count}</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${barColors[idx % barColors.length]} rounded-full transition-all duration-700`}
                        style={{ width: stats.totalAssets ? `${(item.count / stats.totalAssets) * 100}%` : '0%' }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Costs row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {[
          { label: 'Valor del inventario', value: costs.totalAssetValue, icon: Monitor, desc: 'suma de activos con precio', color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100' },
          { label: 'Coste en licencias', value: costs.totalLicenseCost, icon: BookOpen, desc: 'licencias de software', color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-100' },
          { label: 'Valor en componentes', value: costs.totalComponentValue, icon: Package, desc: 'stock × coste unitario', color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100' },
        ].map(item => (
          <div key={item.label} className={`bg-white rounded-2xl border ${item.border} p-5 flex items-center gap-4`}>
            <div className={`w-14 h-14 rounded-2xl ${item.bg} flex items-center justify-center flex-shrink-0`}>
              <item.icon size={22} className={item.color} />
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium mb-0.5">{item.label}</p>
              <p className="text-3xl font-black text-gray-900 leading-none">
                {item.value.toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} €
              </p>
              <p className="text-xs text-gray-400 mt-1">{item.desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Warranty / EOL warnings ── */}
      {warningAssets.length > 0 && (
        <div className="bg-white rounded-2xl border border-amber-100 p-5">
          <div className="flex items-center gap-2 mb-4">
            <ShieldAlert size={16} className="text-amber-500" />
            <h3 className="font-semibold text-gray-800">Activos con garantía o fin de vida próximos</h3>
            <span className="ml-auto text-xs text-amber-700 font-semibold bg-amber-100 px-2.5 py-1 rounded-full">{warningAssets.length} alertas</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-2 px-1 text-gray-500 font-medium">Nº Serie</th>
                  <th className="text-left py-2 px-1 text-gray-500 font-medium">Tipo</th>
                  <th className="text-left py-2 px-1 text-gray-500 font-medium">Garantía</th>
                  <th className="text-left py-2 px-1 text-gray-500 font-medium">Fin de vida</th>
                </tr>
              </thead>
              <tbody>
                {warningAssets.map(a => (
                  <tr key={a.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                    <td className="py-2.5 px-1 font-mono text-xs font-semibold text-gray-800">{a.serial_number}</td>
                    <td className="py-2.5 px-1 text-gray-600">{a.asset_type}</td>
                    <td className="py-2.5 px-1">
                      {a.daysWarranty !== null && a.daysWarranty <= 90 ? (
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${a.daysWarranty < 0 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                          {a.daysWarranty < 0 ? `Vencida hace ${Math.abs(a.daysWarranty)}d` : `Vence en ${a.daysWarranty}d`}
                        </span>
                      ) : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="py-2.5 px-1">
                      {a.daysEol !== null && a.daysEol <= 180 ? (
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${a.daysEol < 0 ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'}`}>
                          {a.daysEol < 0 ? `Superado hace ${Math.abs(a.daysEol)}d` : `En ${a.daysEol}d`}
                        </span>
                      ) : <span className="text-gray-300">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Data tables ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Recent assets — enriched */}
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-semibold text-gray-800">Últimos Activos Registrados</h3>
            <span className="text-xs text-gray-400">{recentAssets.length} recientes</span>
          </div>
          <div className="divide-y divide-gray-50">
            {recentAssets.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-gray-400">Sin activos registrados</p>
            ) : recentAssets.map(a => (
              <div key={a.id} className="px-5 py-3.5 flex items-center gap-3 hover:bg-gray-50 transition-colors">
                <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
                  <Monitor size={15} className="text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-gray-800">{a.serial_number}</span>
                    <span className="text-xs text-gray-400">{a.asset_type}</span>
                  </div>
                  <p className="text-xs text-gray-500 truncate">{a.brand} {a.model}</p>
                  <div className="flex items-center gap-3 mt-0.5">
                    {a.location && (
                      <span className="flex items-center gap-1 text-[10px] text-gray-400">
                        <MapPin size={9} />{a.location}
                      </span>
                    )}
                    {a.employee_name && (
                      <span className="flex items-center gap-1 text-[10px] text-gray-400">
                        <User size={9} />{a.employee_name}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex-shrink-0">{statusBadge(a.status)}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Open incidents — enriched */}
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-semibold text-gray-800">Incidencias Abiertas Recientes</h3>
            {stats.openIncidents > 0 && (
              <span className="text-xs font-semibold text-red-600 bg-red-50 px-2.5 py-1 rounded-full">{stats.openIncidents} abiertas</span>
            )}
          </div>
          <div className="divide-y divide-gray-50">
            {openIncidents.length === 0 ? (
              <div className="px-5 py-8 text-center">
                <CheckCircle size={24} className="text-emerald-400 mx-auto mb-2" />
                <p className="text-sm text-gray-400">Sin incidencias abiertas</p>
              </div>
            ) : openIncidents.map(inc => {
              const asset = inc.asset as { name?: string; serial_number?: string; location?: string } | null;
              return (
                <div key={inc.id} className="px-5 py-3.5 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <AlertTriangle size={14} className="text-red-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 leading-tight truncate">{inc.title}</p>
                      {asset?.serial_number && (
                        <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                          <Monitor size={9} />{asset.serial_number}
                          {asset.location && <><span className="mx-1">·</span><MapPin size={9} />{asset.location}</>}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-1.5">
                        {priorityBadge(inc.priority)}
                        {incidentStatusBadge(inc.status)}
                        <span className="ml-auto flex items-center gap-1 text-[10px] text-gray-400">
                          <Clock size={9} />{new Date(inc.opened_at).toLocaleDateString('es-ES')}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}
