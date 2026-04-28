import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  CheckCircle,
  Cpu,
  HardDrive,
  Key,
  Laptop,
  MapPin,
  Monitor,
  Package,
  Printer,
  Server,
  ShieldAlert,
  User,
  Wrench,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Badge } from '../components/ui/Badge';
import { SkeletonCard } from '../components/ui/SkeletonRow';
import { useApp } from '../contexts/AppContext';
import type { Asset, Incident, License } from '../types';

interface AssetWithEmployee extends Asset {
  employee_name?: string | null;
}

interface LocationSummary {
  location: string;
  total: number;
  available: number;
  occupied: number;
  repair: number;
}

interface TypeSummary {
  type: string;
  total: number;
  available: number;
  occupied: number;
  repair: number;
  retired: number;
}

interface LicenseAlert extends License {
  software_name?: string;
  daysLeft: number | null;
}

interface DashboardData {
  totalAssets: number;
  availableAssets: AssetWithEmployee[];
  occupiedAssets: AssetWithEmployee[];
  repairAssets: AssetWithEmployee[];
  retiredAssets: number;
  unlocatedAssets: AssetWithEmployee[];
  typeSummary: TypeSummary[];
  locationSummary: LocationSummary[];
  lifecycleAlerts: Array<AssetWithEmployee & { daysWarranty: number | null; daysEol: number | null }>;
  openIncidents: Incident[];
  lowStockComponents: number;
  licenseSummary: {
    totalLicenses: number;
    totalSeats: number;
    usedSeats: number;
    freeSeats: number;
    overused: number;
    expiring: number;
    expired: number;
  };
  licenseAlerts: LicenseAlert[];
}

const emptyData: DashboardData = {
  totalAssets: 0,
  availableAssets: [],
  occupiedAssets: [],
  repairAssets: [],
  retiredAssets: 0,
  unlocatedAssets: [],
  typeSummary: [],
  locationSummary: [],
  lifecycleAlerts: [],
  openIncidents: [],
  lowStockComponents: 0,
  licenseSummary: {
    totalLicenses: 0,
    totalSeats: 0,
    usedSeats: 0,
    freeSeats: 0,
    overused: 0,
    expiring: 0,
    expired: 0,
  },
  licenseAlerts: [],
};

function statusBadge(status: string) {
  if (status === 'active') return <Badge variant="success">Activo</Badge>;
  if (status === 'repair') return <Badge variant="warning">Reparacion</Badge>;
  return <Badge variant="danger">Retirado</Badge>;
}

function priorityBadge(priority: string) {
  if (priority === 'critical') return <Badge variant="danger">Critica</Badge>;
  if (priority === 'high') return <Badge variant="warning">Alta</Badge>;
  if (priority === 'medium') return <Badge variant="info">Media</Badge>;
  return <Badge variant="neutral">Baja</Badge>;
}

function assetTypeIcon(type: string) {
  const normalized = type.toLowerCase();
  if (normalized.includes('laptop')) return Laptop;
  if (normalized.includes('server')) return Server;
  if (normalized.includes('printer')) return Printer;
  if (normalized.includes('monitor')) return Monitor;
  if (normalized.includes('peripheral')) return Cpu;
  if (normalized.includes('torre')) return HardDrive;
  return Monitor;
}

function StatCard({
  label,
  value,
  icon: Icon,
  tone,
  subtitle,
  alert = false,
}: {
  label: string;
  value: number | string;
  icon: React.ElementType;
  tone: 'blue' | 'emerald' | 'amber' | 'red' | 'slate';
  subtitle?: string;
  alert?: boolean;
}) {
  const tones = {
    blue: 'bg-blue-50 border-blue-100 text-blue-700 bg-blue-600',
    emerald: 'bg-emerald-50 border-emerald-100 text-emerald-700 bg-emerald-600',
    amber: 'bg-amber-50 border-amber-100 text-amber-700 bg-amber-500',
    red: 'bg-red-50 border-red-100 text-red-700 bg-red-600',
    slate: 'bg-slate-50 border-slate-100 text-slate-700 bg-slate-600',
  };
  const [bg, border, valueColor, iconBg] = tones[tone].split(' ');

  return (
    <div className={`${bg} border ${border} rounded-xl p-4 flex items-start gap-3 relative`}>
      {alert && <span className="absolute top-3 right-3 w-2 h-2 rounded-full bg-red-500 animate-pulse" />}
      <div className={`${iconBg} p-2.5 rounded-lg flex-shrink-0`}>
        <Icon size={18} className="text-white" />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-semibold text-gray-500 uppercase mb-1">{label}</p>
        <p className={`text-3xl font-black leading-none ${valueColor}`}>{value}</p>
        {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
      </div>
    </div>
  );
}

function AssetList({ assets, emptyText }: { assets: AssetWithEmployee[]; emptyText: string }) {
  if (assets.length === 0) {
    return <p className="py-8 text-center text-sm text-gray-400">{emptyText}</p>;
  }

  return (
    <div className="divide-y divide-gray-50">
      {assets.slice(0, 8).map(asset => (
        <div key={asset.id} className="py-3 flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
            <Monitor size={14} className="text-blue-600" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold text-gray-800">{asset.serial_number}</span>
              <span className="text-xs text-gray-400">{asset.asset_type}</span>
            </div>
            <p className="text-xs text-gray-500 truncate">{asset.brand} {asset.model}</p>
            <div className="flex flex-wrap items-center gap-3 mt-1 text-[11px] text-gray-400">
              <span className="flex items-center gap-1"><MapPin size={10} />{asset.location || 'Sin ubicacion'}</span>
              {asset.employee_name && <span className="flex items-center gap-1"><User size={10} />{asset.employee_name}</span>}
            </div>
          </div>
          <div className="flex-shrink-0">{statusBadge(asset.status)}</div>
        </div>
      ))}
    </div>
  );
}

function daysUntil(date: string | null) {
  if (!date) return null;
  return Math.ceil((new Date(date).getTime() - Date.now()) / 86400000);
}

export function Dashboard() {
  const { setCurrentPage } = useApp();
  const [data, setData] = useState<DashboardData>(emptyData);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [
        { data: assets },
        { data: assignments },
        { data: incidents },
        { data: licenses },
        { data: components },
      ] = await Promise.all([
        supabase.from('assets').select('*').order('serial_number'),
        supabase.from('asset_assignments').select('asset_id, employee:employees(name)').is('returned_at', null),
        supabase.from('incidents').select('*, asset:assets(serial_number,location), employee:employees(name)').neq('status', 'closed').order('opened_at', { ascending: false }),
        supabase.from('licenses').select('*, software:software(name,vendor)').order('expiry_date'),
        supabase.from('components').select('stock, min_stock'),
      ]);

      const employeeByAsset: Record<string, string> = {};
      for (const assignment of (assignments ?? []) as Array<{ asset_id: string; employee: { name: string } | { name: string }[] | null }>) {
        const employee = Array.isArray(assignment.employee) ? assignment.employee[0] : assignment.employee;
        if (employee?.name) employeeByAsset[assignment.asset_id] = employee.name;
      }

      const enrichedAssets: AssetWithEmployee[] = ((assets ?? []) as Asset[]).map(asset => ({
        ...asset,
        employee_name: employeeByAsset[asset.id] ?? null,
      }));

      const availableAssets = enrichedAssets.filter(asset => asset.status === 'active' && !asset.employee_name);
      const occupiedAssets = enrichedAssets.filter(asset => Boolean(asset.employee_name));
      const repairAssets = enrichedAssets.filter(asset => asset.status === 'repair');
      const unlocatedAssets = enrichedAssets.filter(asset => asset.status !== 'retired' && !asset.location?.trim());

      const typeMap: Record<string, TypeSummary> = {};
      for (const asset of enrichedAssets) {
        const type = asset.asset_type || 'Other';
        if (!typeMap[type]) {
          typeMap[type] = { type, total: 0, available: 0, occupied: 0, repair: 0, retired: 0 };
        }
        typeMap[type].total += 1;
        if (asset.status === 'retired') typeMap[type].retired += 1;
        else if (asset.status === 'repair') typeMap[type].repair += 1;
        else if (asset.employee_name) typeMap[type].occupied += 1;
        else typeMap[type].available += 1;
      }

      const lifecycleAlerts = enrichedAssets
        .map(asset => ({
          ...asset,
          daysWarranty: daysUntil(asset.warranty_expiry),
          daysEol: daysUntil(asset.end_of_life),
        }))
        .filter(asset =>
          (asset.daysWarranty !== null && asset.daysWarranty <= 90)
          || (asset.daysEol !== null && asset.daysEol <= 180)
        )
        .sort((a, b) => {
          const scoreA = Math.min(a.daysWarranty ?? 999, a.daysEol ?? 999);
          const scoreB = Math.min(b.daysWarranty ?? 999, b.daysEol ?? 999);
          return scoreA - scoreB;
        });

      const locations: Record<string, LocationSummary> = {};
      for (const asset of enrichedAssets.filter(item => item.status !== 'retired')) {
        const location = asset.location?.trim() || 'Sin ubicacion';
        if (!locations[location]) {
          locations[location] = { location, total: 0, available: 0, occupied: 0, repair: 0 };
        }
        locations[location].total += 1;
        if (asset.status === 'repair') locations[location].repair += 1;
        else if (asset.employee_name) locations[location].occupied += 1;
        else if (asset.status === 'active') locations[location].available += 1;
      }

      const licenseRows = ((licenses ?? []) as License[]).map(license => {
        const software = license.software as { name?: string } | { name?: string }[] | null | undefined;
        const firstSoftware = Array.isArray(software) ? software[0] : software;
        return {
          ...license,
          software_name: firstSoftware?.name ?? 'Sin software',
          daysLeft: daysUntil(license.expiry_date),
        };
      });

      const totalSeats = licenseRows.reduce((sum, license) => sum + license.seats, 0);
      const usedSeats = licenseRows.reduce((sum, license) => sum + license.seats_used, 0);
      const licenseAlerts = licenseRows
        .filter(license => license.seats_used > license.seats || (license.daysLeft !== null && license.daysLeft <= 30))
        .sort((a, b) => {
          const scoreA = a.seats_used > a.seats ? -1000 : a.daysLeft ?? 999;
          const scoreB = b.seats_used > b.seats ? -1000 : b.daysLeft ?? 999;
          return scoreA - scoreB;
        });

      setData({
        totalAssets: enrichedAssets.length,
        availableAssets,
        occupiedAssets,
        repairAssets,
        retiredAssets: enrichedAssets.filter(asset => asset.status === 'retired').length,
        unlocatedAssets,
        typeSummary: Object.values(typeMap).sort((a, b) => b.total - a.total || a.type.localeCompare(b.type)),
        locationSummary: Object.values(locations).sort((a, b) => b.available - a.available || b.total - a.total),
        lifecycleAlerts: lifecycleAlerts.slice(0, 8),
        openIncidents: ((incidents ?? []) as unknown as Incident[]).slice(0, 6),
        lowStockComponents: (components ?? []).filter(component => component.stock <= component.min_stock).length,
        licenseSummary: {
          totalLicenses: licenseRows.length,
          totalSeats,
          usedSeats,
          freeSeats: Math.max(totalSeats - usedSeats, 0),
          overused: licenseRows.filter(license => license.seats_used > license.seats).length,
          expiring: licenseRows.filter(license => license.daysLeft !== null && license.daysLeft >= 0 && license.daysLeft <= 30).length,
          expired: licenseRows.filter(license => license.daysLeft !== null && license.daysLeft < 0).length,
        },
        licenseAlerts: licenseAlerts.slice(0, 6),
      });

      setLoading(false);
    }

    load();
  }, []);

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      </div>
    );
  }

  const occupiedPercent = data.totalAssets ? Math.round((data.occupiedAssets.length / data.totalAssets) * 100) : 0;
  const activeAssets = data.totalAssets - data.retiredAssets;

  return (
    <div className="p-6 space-y-5">
      <div className="grid grid-cols-2 xl:grid-cols-6 gap-4">
        <StatCard label="Total equipos" value={data.totalAssets} icon={Monitor} tone="slate" subtitle={`${activeAssets} en parque activo`} />
        <StatCard label="Disponibles" value={data.availableAssets.length} icon={CheckCircle} tone="emerald" subtitle="activos sin asignar" />
        <StatCard label="Ocupados" value={data.occupiedAssets.length} icon={User} tone="blue" subtitle={`${occupiedPercent}% del inventario`} />
        <StatCard label="En reparacion" value={data.repairAssets.length} icon={Wrench} tone="amber" subtitle="requieren seguimiento" alert={data.repairAssets.length > 0} />
        <StatCard label="Sin ubicacion" value={data.unlocatedAssets.length} icon={MapPin} tone="red" subtitle="activos por localizar" alert={data.unlocatedAssets.length > 0} />
        <StatCard label="Retirados" value={data.retiredAssets} icon={Package} tone="slate" subtitle="fuera de servicio" />
      </div>

      <section className="bg-white border border-gray-100 rounded-xl p-5">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="font-semibold text-gray-900">Inventario por tipo de dispositivo</h2>
            <p className="text-xs text-gray-400 mt-0.5">Total, disponibles, ocupados y en reparacion por familia</p>
          </div>
          <button onClick={() => setCurrentPage('assets')} className="text-sm font-medium text-blue-600 hover:text-blue-800">
            Gestionar activos
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-4 gap-3">
          {data.typeSummary.map(item => {
            const Icon = assetTypeIcon(item.type);
            const pct = data.totalAssets ? Math.round((item.total / data.totalAssets) * 100) : 0;
            return (
              <div key={item.type} className="border border-gray-100 rounded-xl p-4 bg-gray-50/50">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                    <Icon size={18} className="text-blue-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-semibold text-gray-900 truncate">{item.type}</h3>
                      <span className="text-xs font-medium text-gray-400">{pct}%</span>
                    </div>
                    <p className="text-3xl font-black text-gray-900 leading-none mt-1">{item.total}</p>
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-1 mt-4 text-[11px]">
                  <span className="bg-emerald-50 text-emerald-700 rounded px-2 py-1">Libres {item.available}</span>
                  <span className="bg-blue-50 text-blue-700 rounded px-2 py-1">Ocup. {item.occupied}</span>
                  <span className="bg-amber-50 text-amber-700 rounded px-2 py-1">Rep. {item.repair}</span>
                  <span className="bg-gray-100 text-gray-600 rounded px-2 py-1">Ret. {item.retired}</span>
                </div>
              </div>
            );
          })}
          {data.typeSummary.length === 0 && <p className="py-8 text-center text-sm text-gray-400 md:col-span-2 2xl:col-span-4">No hay activos registrados</p>}
        </div>
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <section className="xl:col-span-2 bg-white border border-gray-100 rounded-xl p-5">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="font-semibold text-gray-900">Equipos disponibles</h2>
              <p className="text-xs text-gray-400 mt-0.5">Activos, sin empleado asignado y listos para uso</p>
            </div>
            <button onClick={() => setCurrentPage('assets')} className="text-sm font-medium text-blue-600 hover:text-blue-800">
              Ver activos
            </button>
          </div>
          <AssetList assets={data.availableAssets} emptyText="No hay equipos disponibles ahora mismo" />
        </section>

        <section className="bg-white border border-gray-100 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <MapPin size={16} className="text-blue-500" />
            <h2 className="font-semibold text-gray-900">Disponibilidad por ubicacion</h2>
          </div>
          <div className="space-y-3">
            {data.locationSummary.slice(0, 8).map(location => (
              <div key={location.location}>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="font-medium text-gray-700 truncate">{location.location}</span>
                  <span className="text-xs text-gray-400">{location.total} total</span>
                </div>
                <div className="grid grid-cols-3 gap-1 text-[11px]">
                  <span className="bg-emerald-50 text-emerald-700 rounded px-2 py-1">Libres {location.available}</span>
                  <span className="bg-blue-50 text-blue-700 rounded px-2 py-1">Ocupados {location.occupied}</span>
                  <span className="bg-amber-50 text-amber-700 rounded px-2 py-1">Rep. {location.repair}</span>
                </div>
              </div>
            ))}
            {data.locationSummary.length === 0 && <p className="py-8 text-center text-sm text-gray-400">Sin ubicaciones registradas</p>}
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <section className="bg-white border border-gray-100 rounded-xl p-5">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2">
              <BookOpen size={16} className="text-amber-500" />
              <h2 className="font-semibold text-gray-900">Licencias</h2>
            </div>
            <button onClick={() => setCurrentPage('software')} className="text-sm font-medium text-blue-600 hover:text-blue-800">
              Ver licencias
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="rounded-lg bg-gray-50 p-3">
              <p className="text-xs text-gray-500">Asientos libres</p>
              <p className="text-2xl font-black text-emerald-700">{data.licenseSummary.freeSeats}</p>
            </div>
            <div className="rounded-lg bg-gray-50 p-3">
              <p className="text-xs text-gray-500">Uso</p>
              <p className="text-2xl font-black text-gray-900">{data.licenseSummary.usedSeats}/{data.licenseSummary.totalSeats}</p>
            </div>
            <div className="rounded-lg bg-red-50 p-3">
              <p className="text-xs text-red-600">Sobreuso</p>
              <p className="text-2xl font-black text-red-700">{data.licenseSummary.overused}</p>
            </div>
            <div className="rounded-lg bg-amber-50 p-3">
              <p className="text-xs text-amber-600">Vencen pronto</p>
              <p className="text-2xl font-black text-amber-700">{data.licenseSummary.expiring}</p>
            </div>
          </div>
          <div className="space-y-2">
            {data.licenseAlerts.map(license => (
              <div key={license.id} className="flex items-center gap-2 text-sm rounded-lg bg-gray-50 px-3 py-2">
                <Key size={13} className={license.seats_used > license.seats ? 'text-red-500' : 'text-amber-500'} />
                <span className="font-medium text-gray-800 truncate">{license.software_name}</span>
                <span className="ml-auto text-xs text-gray-500">
                  {license.seats_used > license.seats
                    ? `${license.seats_used}/${license.seats} asientos`
                    : license.daysLeft !== null && license.daysLeft < 0
                      ? `vencida ${Math.abs(license.daysLeft)}d`
                      : `vence ${license.daysLeft}d`}
                </span>
              </div>
            ))}
            {data.licenseAlerts.length === 0 && <p className="py-4 text-center text-sm text-gray-400">Sin alertas de licencias</p>}
          </div>
        </section>

        <section className="bg-white border border-gray-100 rounded-xl p-5">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2">
              <Package size={16} className={data.lowStockComponents > 0 ? 'text-red-500' : 'text-slate-500'} />
              <h2 className="font-semibold text-gray-900">Componentes</h2>
            </div>
            <button onClick={() => setCurrentPage('components')} className="text-sm font-medium text-blue-600 hover:text-blue-800">
              Ver stock
            </button>
          </div>
          <div className={`rounded-lg p-4 ${data.lowStockComponents > 0 ? 'bg-red-50' : 'bg-gray-50'}`}>
            <p className={`text-xs font-medium ${data.lowStockComponents > 0 ? 'text-red-600' : 'text-gray-500'}`}>Componentes bajo minimo</p>
            <p className={`text-4xl font-black leading-none mt-1 ${data.lowStockComponents > 0 ? 'text-red-700' : 'text-gray-900'}`}>{data.lowStockComponents}</p>
          </div>
          <p className="text-xs text-gray-400 mt-3">Control rapido para saber si falta RAM, discos, cargadores u otros repuestos criticos.</p>
        </section>

        <section className="bg-white border border-gray-100 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <ShieldAlert size={16} className="text-red-500" />
            <h2 className="font-semibold text-gray-900">Incidencias abiertas</h2>
          </div>
          <div className="space-y-2">
            {data.openIncidents.map(incident => {
              const asset = incident.asset as { serial_number?: string; location?: string } | null;
              return (
                <div key={incident.id} className="rounded-lg bg-gray-50 px-3 py-2">
                  <div className="flex items-start gap-2">
                    <AlertTriangle size={14} className="text-red-500 mt-0.5 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-800 truncate">{incident.title}</p>
                      <p className="text-xs text-gray-400 truncate">{asset?.serial_number ?? 'Sin activo'} {asset?.location ? `- ${asset.location}` : ''}</p>
                    </div>
                    {priorityBadge(incident.priority)}
                  </div>
                </div>
              );
            })}
            {data.openIncidents.length === 0 && <p className="py-8 text-center text-sm text-gray-400">Sin incidencias abiertas</p>}
          </div>
        </section>

        <section className="bg-white border border-gray-100 rounded-xl p-5">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="font-semibold text-gray-900">Ocupados recientemente</h2>
              <p className="text-xs text-gray-400 mt-0.5">Equipos con asignacion vigente</p>
            </div>
            <Badge variant="blue">{data.occupiedAssets.length}</Badge>
          </div>
          <AssetList assets={data.occupiedAssets} emptyText="No hay equipos asignados" />
        </section>
      </div>

      {data.lifecycleAlerts.length > 0 && (
        <section className="bg-white border border-amber-100 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <ShieldAlert size={16} className="text-amber-500" />
            <h2 className="font-semibold text-gray-900">Garantias y fin de vida</h2>
            <span className="ml-auto text-xs font-semibold text-amber-700 bg-amber-100 px-2.5 py-1 rounded-full">{data.lifecycleAlerts.length} avisos</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
            {data.lifecycleAlerts.map(asset => (
              <div key={asset.id} className="rounded-xl bg-gray-50 border border-gray-100 p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Monitor size={14} className="text-blue-500" />
                  <span className="font-mono text-xs font-bold text-gray-800 truncate">{asset.serial_number}</span>
                </div>
                <p className="text-xs text-gray-500 truncate">{asset.asset_type} - {asset.brand} {asset.model}</p>
                <div className="flex flex-wrap gap-1 mt-3">
                  {asset.daysWarranty !== null && asset.daysWarranty <= 90 && (
                    <Badge variant={asset.daysWarranty < 0 ? 'danger' : 'warning'}>
                      {asset.daysWarranty < 0 ? `Garantia vencida ${Math.abs(asset.daysWarranty)}d` : `Garantia ${asset.daysWarranty}d`}
                    </Badge>
                  )}
                  {asset.daysEol !== null && asset.daysEol <= 180 && (
                    <Badge variant={asset.daysEol < 0 ? 'danger' : 'warning'}>
                      {asset.daysEol < 0 ? `EOL pasado ${Math.abs(asset.daysEol)}d` : `EOL ${asset.daysEol}d`}
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {data.unlocatedAssets.length > 0 && (
        <section className="bg-white border border-red-100 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <MapPin size={16} className="text-red-500" />
            <h2 className="font-semibold text-gray-900">Activos sin ubicacion</h2>
            <span className="ml-auto text-xs font-semibold text-red-600 bg-red-50 px-2.5 py-1 rounded-full">{data.unlocatedAssets.length}</span>
          </div>
          <AssetList assets={data.unlocatedAssets} emptyText="Todos los activos tienen ubicacion" />
        </section>
      )}
    </div>
  );
}
