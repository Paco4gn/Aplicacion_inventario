import { api } from './api';

export async function logAction(
  action: string,
  entityType: string,
  entityId: string,
  entityName: string,
  details: Record<string, unknown> = {}
) {
  const { data: { user } } = await api.auth.getUser();
  await api.from('audit_logs').insert({
    action,
    entity_type: entityType,
    entity_id: entityId,
    entity_name: entityName,
    details,
    performed_by: user?.email ?? user?.id ?? 'unknown',
  });
}
