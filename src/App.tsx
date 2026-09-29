import { useEffect, useState } from 'react';
import { api, type AppSession } from './lib/api';
import { AppProvider, useApp } from './contexts/AppContext';
import { ToastProvider } from './contexts/ToastContext';
import { Sidebar } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Assets } from './pages/Assets';
import { Employees } from './pages/Employees';
import { Incidents } from './pages/Incidents';
import { Software } from './pages/Software';
import { Components } from './pages/Components';
import { AuditLog } from './pages/AuditLog';
import { Administration } from './pages/Administration';
import { RecycleBin } from './pages/RecycleBin';
import AssetPublic from './pages/AssetPublic';

function PageRouter() {
  const { currentPage } = useApp();
  switch (currentPage) {
    case 'dashboard':  return <Dashboard />;
    case 'assets':     return <Assets />;
    case 'employees':  return <Employees />;
    case 'incidents':  return <Incidents />;
    case 'software':   return <Software />;
    case 'components': return <Components />;
    case 'audit':      return <AuditLog />;
    case 'administration': return <Administration />;
    case 'recycle':    return <RecycleBin />;
    default:           return <Dashboard />;
  }
}

function AppLayout() {
  const { currentUser } = useApp();
  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Header />
        {currentUser.role === 'viewer' && (
          <div className="bg-amber-50 border-b border-amber-100 px-4 py-2 text-xs font-medium text-amber-800">
            Modo de solo consulta: puedes buscar, revisar y exportar, pero no modificar datos.
          </div>
        )}
        <main className="flex-1 overflow-y-auto">
          <PageRouter />
        </main>
      </div>
    </div>
  );
}

// Check for public asset route: ?asset=SERIAL_NUMBER
const publicSerial = new URLSearchParams(window.location.search).get('asset');

export default function App() {
  if (publicSerial) {
    return <AssetPublic serial={publicSerial} />;
  }
  return <AuthGate />;
}

function AuthGate() {
  const [session, setSession] = useState<AppSession | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    const timeout = window.setTimeout(() => {
      if (!cancelled) setSession(null);
    }, 8000);

    api.auth.getSession()
      .then(({ data: { session } }) => {
        if (!cancelled) setSession(session);
      })
      .catch(() => {
        if (!cancelled) setSession(null);
      })
      .finally(() => {
        window.clearTimeout(timeout);
      });

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, []);

  if (session === undefined) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!session) {
    return <Login />;
  }

  return (
    <AppProvider user={session.user}>
      <ToastProvider>
        <AppLayout />
      </ToastProvider>
    </AppProvider>
  );
}
