import { createContext, useContext, useState, ReactNode } from 'react';
import type { AppUser } from '../lib/api';

export type Page = 'dashboard' | 'ai4feval' | 'assets' | 'employees' | 'incidents' | 'software' | 'components' | 'audit' | 'administration' | 'recycle';

interface AppContextValue {
  currentPage: Page;
  setCurrentPage: (page: Page) => void;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  currentUser: AppUser;
}

const AppContext = createContext<AppContextValue>({
  currentPage: 'dashboard',
  setCurrentPage: () => {},
  sidebarOpen: true,
  setSidebarOpen: () => {},
  currentUser: { id: '', email: '', name: '', role: 'viewer' },
});

export function AppProvider({ children, user }: { children: ReactNode; user: AppUser }) {
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <AppContext.Provider value={{ currentPage, setCurrentPage, sidebarOpen, setSidebarOpen, currentUser: user }}>
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => useContext(AppContext);
