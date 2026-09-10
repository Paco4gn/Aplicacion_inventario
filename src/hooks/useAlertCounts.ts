import { useEffect, useState } from 'react';
import { api } from '../lib/api';

interface AlertCounts {
  openIncidents: number;
  expiringLicenses: number;
  lowStock: number;
}

export function useAlertCounts() {
  const [counts, setCounts] = useState<AlertCounts>({ openIncidents: 0, expiringLicenses: 0, lowStock: 0 });

  useEffect(() => {
    async function load() {
      const in30 = new Date();
      in30.setDate(in30.getDate() + 30);

      const today = new Date().toISOString().slice(0, 10);
      const in30str = in30.toISOString().slice(0, 10);

      const [{ count: incidents }, { data: licenses }, { data: components }] = await Promise.all([
        api.from('incidents').select('id', { count: 'exact', head: true }).in('status', ['open', 'assigned', 'in_progress', 'waiting_user']),
        api.from('licenses').select('expiry_date').not('expiry_date', 'is', null).gte('expiry_date', today).lte('expiry_date', in30str),
        api.from('components').select('stock, min_stock'),
      ]);

      setCounts({
        openIncidents: incidents ?? 0,
        expiringLicenses: (licenses ?? []).length,
        lowStock: (components ?? []).filter((c: { stock: number; min_stock: number }) => c.stock <= c.min_stock).length,
      });
    }
    load();

    const interval = window.setInterval(load, 30_000);
    const refreshOnFocus = () => load();
    window.addEventListener('focus', refreshOnFocus);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', refreshOnFocus);
    };
  }, []);

  return counts;
}
