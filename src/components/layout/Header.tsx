import { useState, useRef, useEffect } from 'react';
import { Bell, User, Search, Monitor, Users, AlertTriangle, X, LogOut, BookOpen, Package, CheckCircle } from 'lucide-react';
import { useApp } from '../../contexts/AppContext';
import { supabase } from '../../lib/supabase';
import { useAlertCounts } from '../../hooks/useAlertCounts';

const pageTitles: Record<string, string> = {
  dashboard: 'Dashboard',
  assets: 'Gestión de Activos',
  employees: 'Empleados',
  incidents: 'Incidencias',
  software: 'Software & Licencias',
  components: 'Componentes',
  audit: 'Registro de Auditoría',
};

interface SearchResult {
  id: string;
  label: string;
  sublabel: string;
  type: 'asset' | 'employee' | 'incident';
  page: 'assets' | 'employees' | 'incidents';
}

interface Notification {
  id: string;
  type: 'incident' | 'license' | 'stock';
  title: string;
  body: string;
  page: 'incidents' | 'software' | 'components';
}

export function Header() {
  const { currentPage, setCurrentPage } = useApp();
  const alertCounts = useAlertCounts();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [bellOpen, setBellOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const bellRef = useRef<HTMLDivElement>(null);

  const [userEmail, setUserEmail] = useState('');

  const totalAlerts = alertCounts.openIncidents + alertCounts.expiringLicenses + alertCounts.lowStock;

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUserEmail(user?.email ?? '');
    });
  }, []);

  // Build notification list from alert counts
  useEffect(() => {
    const list: Notification[] = [];
    if (alertCounts.openIncidents > 0) {
      list.push({
        id: 'incidents',
        type: 'incident',
        title: 'Incidencias abiertas',
        body: `${alertCounts.openIncidents} incidencia${alertCounts.openIncidents > 1 ? 's' : ''} pendiente${alertCounts.openIncidents > 1 ? 's' : ''} de resolución`,
        page: 'incidents',
      });
    }
    if (alertCounts.expiringLicenses > 0) {
      list.push({
        id: 'licenses',
        type: 'license',
        title: 'Licencias por vencer',
        body: `${alertCounts.expiringLicenses} licencia${alertCounts.expiringLicenses > 1 ? 's vencen' : ' vence'} en los próximos 30 días`,
        page: 'software',
      });
    }
    if (alertCounts.lowStock > 0) {
      list.push({
        id: 'stock',
        type: 'stock',
        title: 'Stock bajo',
        body: `${alertCounts.lowStock} componente${alertCounts.lowStock > 1 ? 's' : ''} por debajo del mínimo`,
        page: 'components',
      });
    }
    setNotifications(list);
  }, [alertCounts]);

  // Search debounce
  useEffect(() => {
    if (!query.trim()) { setResults([]); setSearchOpen(false); return; }
    const timer = setTimeout(() => doSearch(query.trim()), 250);
    return () => clearTimeout(timer);
  }, [query]);

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setSearchOpen(false);
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) setBellOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  async function doSearch(q: string) {
    setSearchLoading(true);
    const pattern = `%${q}%`;
    const [{ data: assets }, { data: employees }, { data: incidents }] = await Promise.all([
      supabase.from('assets').select('id,serial_number,brand,model,asset_type').or(`serial_number.ilike.${pattern},brand.ilike.${pattern},model.ilike.${pattern}`).limit(4),
      supabase.from('employees').select('id,name,department').ilike('name', pattern).limit(4),
      supabase.from('incidents').select('id,title,status').ilike('title', pattern).limit(4),
    ]);

    const r: SearchResult[] = [
      ...(assets ?? []).map(a => ({
        id: a.id, label: a.serial_number, sublabel: `${a.asset_type} · ${a.brand} ${a.model}`,
        type: 'asset' as const, page: 'assets' as const,
      })),
      ...(employees ?? []).map(e => ({
        id: e.id, label: e.name, sublabel: e.department || 'Empleado',
        type: 'employee' as const, page: 'employees' as const,
      })),
      ...(incidents ?? []).map(i => ({
        id: i.id, label: i.title, sublabel: `Incidencia · ${i.status}`,
        type: 'incident' as const, page: 'incidents' as const,
      })),
    ];

    setResults(r);
    setSearchOpen(r.length > 0);
    setSearchLoading(false);
  }

  function pickResult(r: SearchResult) {
    setCurrentPage(r.page);
    setQuery('');
    setSearchOpen(false);
  }

  function pickNotification(n: Notification) {
    setCurrentPage(n.page);
    setBellOpen(false);
  }

  const searchIconMap = { asset: Monitor, employee: Users, incident: AlertTriangle };

  const notifIconMap = {
    incident: { icon: AlertTriangle, bg: 'bg-red-50', color: 'text-red-500' },
    license: { icon: BookOpen, bg: 'bg-amber-50', color: 'text-amber-500' },
    stock: { icon: Package, bg: 'bg-orange-50', color: 'text-orange-500' },
  };

  const displayName = userEmail ? userEmail.split('@')[0] : 'Admin';

  return (
    <header className="h-14 bg-white border-b border-gray-100 flex items-center justify-between px-6 flex-shrink-0 gap-4">
      <h1 className="text-lg font-semibold text-gray-800 flex-shrink-0">{pageTitles[currentPage] ?? ''}</h1>

      {/* Global search */}
      <div ref={searchRef} className="relative flex-1 max-w-md">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onFocus={() => results.length > 0 && setSearchOpen(true)}
            placeholder="Buscar activos, empleados, incidencias..."
            className="w-full pl-8 pr-8 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 bg-gray-50 transition-colors"
          />
          {query && (
            <button onClick={() => { setQuery(''); setSearchOpen(false); }} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X size={14} />
            </button>
          )}
        </div>

        {searchOpen && (
          <div className="absolute top-full mt-1.5 left-0 right-0 bg-white rounded-xl border border-gray-200 shadow-xl z-50 overflow-hidden">
            {searchLoading ? (
              <div className="px-4 py-3 text-sm text-gray-400">Buscando...</div>
            ) : results.length > 0 ? (
              <ul>
                {results.map(r => {
                  const Icon = searchIconMap[r.type];
                  return (
                    <li key={r.id}>
                      <button
                        onClick={() => pickResult(r)}
                        className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors text-left"
                      >
                        <div className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                          <Icon size={14} className="text-gray-500" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-800 truncate">{r.label}</p>
                          <p className="text-xs text-gray-400 truncate">{r.sublabel}</p>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="px-4 py-3 text-sm text-gray-400">Sin resultados</div>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        {/* Notifications bell */}
        <div ref={bellRef} className="relative">
          <button
            onClick={() => setBellOpen(o => !o)}
            className="relative p-2 rounded-xl hover:bg-gray-100 text-gray-500 transition-colors"
          >
            <Bell size={18} />
            {totalAlerts > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none">
                {totalAlerts > 9 ? '9+' : totalAlerts}
              </span>
            )}
          </button>

          {bellOpen && (
            <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-2xl border border-gray-200 shadow-2xl z-50 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                <span className="font-semibold text-gray-800 text-sm">Notificaciones</span>
                {totalAlerts > 0 && (
                  <span className="text-xs font-medium bg-red-50 text-red-600 px-2 py-0.5 rounded-full">
                    {totalAlerts} alerta{totalAlerts > 1 ? 's' : ''}
                  </span>
                )}
              </div>
              {notifications.length === 0 ? (
                <div className="px-4 py-8 text-center">
                  <CheckCircle size={28} className="text-emerald-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">Todo en orden</p>
                  <p className="text-xs text-gray-400 mt-0.5">No hay alertas pendientes</p>
                </div>
              ) : (
                <ul className="divide-y divide-gray-50">
                  {notifications.map(n => {
                    const { icon: Icon, bg, color } = notifIconMap[n.type];
                    return (
                      <li key={n.id}>
                        <button
                          onClick={() => pickNotification(n)}
                          className="w-full flex items-start gap-3 px-4 py-3.5 hover:bg-gray-50 transition-colors text-left"
                        >
                          <div className={`w-8 h-8 rounded-xl ${bg} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                            <Icon size={15} className={color} />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-800">{n.title}</p>
                            <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{n.body}</p>
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}
        </div>

        {/* User */}
        <button className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-xl hover:bg-gray-100 transition-colors">
          <div className="w-7 h-7 bg-blue-600 rounded-full flex items-center justify-center">
            <User size={14} className="text-white" />
          </div>
          <span className="text-sm font-medium text-gray-700 max-w-[120px] truncate">{displayName}</span>
        </button>

        <button
          onClick={() => supabase.auth.signOut()}
          className="p-2 rounded-xl hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors"
          title="Cerrar sesión"
        >
          <LogOut size={17} />
        </button>
      </div>
    </header>
  );
}
