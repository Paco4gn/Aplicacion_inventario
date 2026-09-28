import { useEffect, useState } from 'react';
import { api } from '../lib/api';

interface AlertCounts {
  openIncidents: number;
  overdueIncidents: number;
  expiringLicenses: number;
  expiringWarranties: number;
  lowStock: number;
  overdueProjectItems: number;
}

export function useAlertCounts() {
  const [counts, setCounts] = useState<AlertCounts>({ openIncidents: 0, overdueIncidents: 0, expiringLicenses: 0, expiringWarranties: 0, lowStock: 0, overdueProjectItems: 0 });

  useEffect(() => {
    async function load() {
      const in30 = new Date();
      in30.setDate(in30.getDate() + 30);

      const today = new Date().toISOString().slice(0, 10);
      const in30str = in30.toISOString().slice(0, 10);

      const [{ data: incidents }, { data: licenses }, { data: assets }, { data: components }, { data: projectItems }, { data: deliverables }] = await Promise.all([
        api.from('incidents').select('status,due_at').in('status', ['open', 'assigned', 'in_progress', 'waiting_user']),
        api.from('licenses').select('expiry_date').not('expiry_date', 'is', null).gte('expiry_date', today).lte('expiry_date', in30str),
        api.from('assets').select('warranty_expiry').not('warranty_expiry', 'is', null).gte('warranty_expiry', today).lte('warranty_expiry', in30str),
        api.from('components').select('stock, min_stock'),
        api.from('ai_work_items').select('status,end_date').lt('end_date', today).neq('status', 'completed'),
        api.from('ai_deliverables').select('status,due_date').not('due_date', 'is', null).lt('due_date', today).neq('status', 'completed'),
      ]);

      setCounts({
        openIncidents: (incidents ?? []).length,
        overdueIncidents: (incidents ?? []).filter((item: { due_at?: string | null }) => item.due_at && item.due_at.slice(0, 10) < today).length,
        expiringLicenses: (licenses ?? []).length,
        expiringWarranties: (assets ?? []).length,
        lowStock: (components ?? []).filter((c: { stock: number; min_stock: number }) => c.stock <= c.min_stock).length,
        overdueProjectItems: (projectItems ?? []).length + (deliverables ?? []).length,
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
