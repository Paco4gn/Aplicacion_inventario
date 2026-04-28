import { createContext, useContext, useState, ReactNode } from 'react';

type Page = 'dashboard' | 'assets' | 'employees' | 'incidents' | 'software' | 'components' | 'audit';

interface AppContextValue {
  currentPage: Page;
  setCurrentPage: (page: Page) => void;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
}

const AppContext = createContext<AppContextValue>({
  currentPage: 'dashboard',
  setCurrentPage: () => {},
  sidebarOpen: true,
  setSidebarOpen: () => {},
});

export function AppProvider({ children }: { children: ReactNode }) {
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <AppContext.Provider value={{ currentPage, setCurrentPage, sidebarOpen, setSidebarOpen }}>
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => useContext(AppContext);
