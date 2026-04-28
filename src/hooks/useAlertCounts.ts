import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

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
        supabase.from('incidents').select('id', { count: 'exact', head: true }).neq('status', 'closed'),
        supabase.from('licenses').select('expiry_date').not('expiry_date', 'is', null).gte('expiry_date', today).lte('expiry_date', in30str),
        supabase.from('components').select('stock, min_stock'),
      ]);

      setCounts({
        openIncidents: incidents ?? 0,
        expiringLicenses: (licenses ?? []).length,
        lowStock: (components ?? []).filter(c => c.stock <= c.min_stock).length,
      });
    }
    load();

    const channel = supabase.channel('alert-counts')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'incidents' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'licenses' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'components' }, load)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  return counts;
}
