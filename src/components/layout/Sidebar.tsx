import {
  LayoutDashboard,
  Monitor,
  Users,
  AlertTriangle,
  Package,
  BookOpen,
  ClipboardList,
  ChevronLeft,
  Cpu,
} from 'lucide-react';
import { useApp } from '../../contexts/AppContext';
import { useAlertCounts } from '../../hooks/useAlertCounts';

type Page = 'dashboard' | 'assets' | 'employees' | 'incidents' | 'software' | 'components' | 'audit';

interface NavItem {
  id: Page;
  label: string;
  icon: React.ElementType;
  badge?: number;
}

export function Sidebar() {
  const { currentPage, setCurrentPage, sidebarOpen, setSidebarOpen } = useApp();
  const alerts = useAlertCounts();

  const navItems: NavItem[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'assets', label: 'Activos', icon: Monitor },
    { id: 'employees', label: 'Empleados', icon: Users },
    { id: 'incidents', label: 'Incidencias', icon: AlertTriangle, badge: alerts.openIncidents },
    { id: 'software', label: 'Software & Licencias', icon: BookOpen, badge: alerts.expiringLicenses },
    { id: 'components', label: 'Componentes', icon: Package, badge: alerts.lowStock },
    { id: 'audit', label: 'Auditoría', icon: ClipboardList },
  ];

  return (
    <aside
      className={`${sidebarOpen ? 'w-60' : 'w-16'} flex-shrink-0 bg-gray-900 text-white flex flex-col transition-all duration-300 ease-in-out`}
    >
      {/* Logo */}
      <div className={`flex items-center gap-3 px-4 py-5 border-b border-white/10 ${!sidebarOpen && 'justify-center'}`}>
        <div className="bg-blue-500 p-2 rounded-xl flex-shrink-0">
          <Cpu size={20} className="text-white" />
        </div>
        {sidebarOpen && (
          <div>
            <p className="font-bold text-sm leading-tight">IT Inventario</p>
            <p className="text-xs text-gray-400">Sistema de Gestión</p>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 px-2 space-y-0.5 overflow-y-auto">
        {navItems.map(({ id, label, icon: Icon, badge }) => {
          const active = currentPage === id;
          return (
            <button
              key={id}
              onClick={() => setCurrentPage(id)}
              title={!sidebarOpen ? label : undefined}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150
                ${active
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40'
                  : 'text-gray-400 hover:text-white hover:bg-white/8'
                }
                ${!sidebarOpen ? 'justify-center' : ''}
              `}
            >
              <div className="relative flex-shrink-0">
                <Icon size={18} />
                {badge != null && badge > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-0.5 leading-none">
                    {badge > 99 ? '99+' : badge}
                  </span>
                )}
              </div>
              {sidebarOpen && <span className="truncate flex-1 text-left">{label}</span>}
              {sidebarOpen && badge != null && badge > 0 && (
                <span className="ml-auto bg-red-500 text-white text-xs font-bold rounded-full px-1.5 py-0.5 min-w-[20px] text-center leading-tight">
                  {badge > 99 ? '99+' : badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Collapse button */}
      <div className="px-2 pb-4">
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-gray-400 hover:text-white hover:bg-white/8 text-sm transition-all ${!sidebarOpen && 'justify-center'}`}
        >
          <ChevronLeft size={18} className={`flex-shrink-0 transition-transform duration-300 ${!sidebarOpen && 'rotate-180'}`} />
          {sidebarOpen && <span>Colapsar</span>}
        </button>
      </div>
    </aside>
  );
}
