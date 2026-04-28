import { supabase } from './supabase';

export async function logAction(
  action: string,
  entityType: string,
  entityId: string,
  entityName: string,
  details: Record<string, unknown> = {}
) {
  const { data: { user } } = await supabase.auth.getUser();
  await supabase.from('audit_logs').insert({
    action,
    entity_type: entityType,
    entity_id: entityId,
    entity_name: entityName,
    details,
    performed_by: user?.email ?? user?.id ?? 'unknown',
  });
}
