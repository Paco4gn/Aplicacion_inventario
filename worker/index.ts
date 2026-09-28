interface AppEnv extends Env {
  ASSETS: Fetcher;
  ASSET_PUBLIC_TECH_PIN?: string;
  INVENTORY_AGENT_TOKEN?: string;
  INVENTORY_WEB_TOKEN?: string;
  GITHUB_PAGES_ORIGIN?: string;
  APP_URL?: string;
  MAIL_PROVIDER?: string;
  INCIDENT_EMAIL_FROM?: string;
  RESEND_API_KEY?: string;
  SENDGRID_API_KEY?: string;
  BREVO_API_KEY?: string;
  GOOGLE_SCRIPT_MAIL_URL?: string;
  GOOGLE_SCRIPT_MAIL_SECRET?: string;
  MS_TENANT_ID?: string;
  MS_CLIENT_ID?: string;
  MS_CLIENT_SECRET?: string;
  MS_SENDER_EMAIL?: string;
}

type TableName = keyof typeof tableDefinitions;
type DataRecord = Record<string, unknown>;
type Filter = { type: string; column?: string; value: unknown };

const tableDefinitions = {
  employees: {
    columns: ['id', 'name', 'email', 'department', 'position', 'active', 'created_at', 'updated_at'],
    booleans: ['active'], json: [], created: true, updated: true,
  },
  assets: {
    columns: ['id', 'serial_number', 'name', 'asset_type', 'brand', 'model', 'status', 'location', 'purchase_date', 'purchase_value', 'warranty_expiry', 'end_of_life', 'operating_system', 'ip_address', 'mac_address', 'processor', 'ram_gb', 'storage_gb', 'last_inventory_at', 'parent_asset_id', 'screen_size', 'resolution', 'connection_type', 'toner_model', 'imei', 'sim_number', 'assigned_position', 'notes', 'image_url', 'created_at', 'updated_at'],
    booleans: [], json: [], created: true, updated: true,
  },
  asset_assignments: {
    columns: ['id', 'asset_id', 'employee_id', 'assigned_at', 'returned_at', 'notes'],
    booleans: [], json: [], created: false, updated: false,
  },
  incidents: {
    columns: ['id', 'title', 'description', 'asset_id', 'employee_id', 'assigned_to_id', 'assigned_to_email', 'assigned_to_name', 'status', 'priority', 'resolution', 'due_at', 'started_at', 'resolved_at', 'opened_at', 'closed_at', 'created_at', 'updated_at'],
    booleans: [], json: [], created: true, updated: true,
  },
  incident_notification_recipients: {
    columns: ['id', 'email', 'name', 'enabled', 'created_at', 'updated_at'],
    booleans: ['enabled'], json: [], created: true, updated: true,
  },
  incident_comments: {
    columns: ['id', 'incident_id', 'author_name', 'body', 'internal', 'created_at'],
    booleans: ['internal'], json: [], created: true, updated: false,
  },
  software: {
    columns: ['id', 'name', 'vendor', 'category', 'version', 'notes', 'created_at', 'updated_at'],
    booleans: [], json: [], created: true, updated: true,
  },
  licenses: {
    columns: ['id', 'software_id', 'license_key', 'license_type', 'seats', 'seats_used', 'purchase_date', 'expiry_date', 'cost', 'vendor_contact', 'notes', 'created_at', 'updated_at'],
    booleans: [], json: [], created: true, updated: true,
  },
  license_assignments: {
    columns: ['id', 'license_id', 'employee_id', 'asset_id', 'assigned_at', 'returned_at', 'notes'],
    booleans: [], json: [], created: false, updated: false,
  },
  components: {
    columns: ['id', 'name', 'component_type', 'brand', 'model', 'stock', 'min_stock', 'location', 'unit_cost', 'notes', 'created_at', 'updated_at'],
    booleans: [], json: [], created: true, updated: true,
  },
  component_movements: {
    columns: ['id', 'component_id', 'movement_type', 'quantity', 'reason', 'asset_id', 'moved_at'],
    booleans: [], json: [], created: false, updated: false,
  },
  audit_logs: {
    columns: ['id', 'action', 'entity_type', 'entity_id', 'entity_name', 'details', 'performed_by', 'created_at'],
    booleans: [], json: ['details'], created: true, updated: false,
  },
} as const;

const nullDefaults: Partial<Record<TableName, DataRecord>> = {
  employees: { department: '', position: '', active: 1 },
  assets: {
    name: '', asset_type: 'Other', brand: '', model: '', status: 'active', location: '',
    operating_system: '', ip_address: '', mac_address: '', processor: '', screen_size: '',
    resolution: '', connection_type: '', toner_model: '', imei: '', sim_number: '',
    assigned_position: '', notes: '', image_url: '',
  },
  asset_assignments: { notes: '' },
  incidents: { description: '', status: 'open', priority: 'medium', resolution: '' },
  incident_notification_recipients: { name: '', enabled: 1 },
  incident_comments: { author_name: 'informatica', internal: 1 },
  software: { vendor: '', category: '', version: '', notes: '' },
  licenses: { license_key: '', license_type: 'commercial', seats: 1, seats_used: 0, vendor_contact: '', notes: '' },
  license_assignments: { notes: '' },
  components: { component_type: '', brand: '', model: '', stock: 0, min_stock: 1, location: '', notes: '' },
  component_movements: { movement_type: 'in', quantity: 1, reason: '' },
  audit_logs: { entity_name: '', details: '{}', performed_by: 'system' },
};

function json(data: unknown, status = 200, headers: HeadersInit = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers },
  });
}

async function getUser(request: Request, env: AppEnv) {
  const url = new URL(request.url);
  if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
    return { id: 'local-development', email: 'desarrollo@local' };
  }
  const supplied = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '') ?? '';
  if (env.INVENTORY_WEB_TOKEN) {
    return supplied && await safeEqual(supplied, env.INVENTORY_WEB_TOKEN)
      ? { id: 'github-pages-user', email: 'inventario@github-pages' }
      : null;
  }
  const id = request.headers.get('oai-authenticated-user-id') ?? request.headers.get('x-openai-authenticated-user-id');
  const email = request.headers.get('oai-authenticated-user-email') ?? request.headers.get('x-openai-authenticated-user-email');
  if (id || email) return { id: id ?? email ?? 'user', email: email ?? '' };
  return null;
}

function corsHeaders(request: Request, env: AppEnv) {
  const origin = request.headers.get('Origin') ?? '';
  const allowedOrigin = env.GITHUB_PAGES_ORIGIN ?? 'https://paco4gn.github.io';
  if (origin !== allowedOrigin && !/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return {};
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'Authorization, Content-Type, Accept',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
}

function withCors(response: Response, request: Request, env: AppEnv) {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(corsHeaders(request, env))) headers.set(key, value);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

function isTableName(value: string): value is TableName {
  return Object.prototype.hasOwnProperty.call(tableDefinitions, value);
}

function cleanRecord(table: TableName, input: unknown, insert: boolean) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Datos no válidos');
  const definition = tableDefinitions[table];
  const source = input as DataRecord;
  const output: DataRecord = {};
  for (const column of definition.columns) {
    if (source[column] === undefined) continue;
    const value = source[column];
    if ((definition.booleans as readonly string[]).includes(column)) output[column] = value ? 1 : 0;
    else if ((definition.json as readonly string[]).includes(column)) output[column] = typeof value === 'string' ? value : JSON.stringify(value ?? {});
    else output[column] = value;
  }
  for (const [column, value] of Object.entries(nullDefaults[table] ?? {})) {
    if (output[column] === null) output[column] = value;
  }
  const now = new Date().toISOString();
  if (insert && !output.id) output.id = crypto.randomUUID();
  if (insert && definition.created && !output.created_at) output.created_at = now;
  if (definition.updated && !output.updated_at) output.updated_at = now;
  if (insert && table === 'asset_assignments' && !output.assigned_at) output.assigned_at = now;
  if (insert && table === 'license_assignments' && !output.assigned_at) output.assigned_at = now;
  if (insert && table === 'component_movements' && !output.moved_at) output.moved_at = now;
  if (insert && table === 'incidents' && !output.opened_at) output.opened_at = now;
  return output;
}

function decodeRecord(table: TableName, row: DataRecord) {
  const definition = tableDefinitions[table];
  const output = { ...row };
  for (const column of definition.booleans as readonly string[]) output[column] = Boolean(output[column]);
  for (const column of definition.json as readonly string[]) {
    try { output[column] = JSON.parse(String(output[column] ?? '{}')); } catch { output[column] = {}; }
  }
  return output;
}

function compileWhere(table: TableName, filters: Filter[]) {
  const allowed = new Set<string>(tableDefinitions[table].columns);
  const clauses: string[] = [];
  const bindings: unknown[] = [];
  const requireColumn = (filter: Filter) => {
    if (!filter.column || !allowed.has(filter.column)) throw new Error('Filtro no válido');
    return filter.column;
  };

  for (const filter of filters) {
    if (filter.type === 'or') {
      const expressions = String(filter.value).split(',').map((part) => {
        const match = part.match(/^([a-z_]+)\.ilike\.(.+)$/i);
        if (!match || !allowed.has(match[1])) throw new Error('Búsqueda no válida');
        bindings.push(match[2]);
        return `LOWER("${match[1]}") LIKE LOWER(?)`;
      });
      clauses.push(`(${expressions.join(' OR ')})`);
      continue;
    }
    const column = requireColumn(filter);
    if (filter.type === 'is' || filter.type === 'not_is') {
      if (filter.value !== null) throw new Error('Filtro IS no válido');
      clauses.push(`"${column}" IS ${filter.type === 'not_is' ? 'NOT ' : ''}NULL`);
    } else if (filter.type === 'in') {
      const values = Array.isArray(filter.value) ? filter.value : [];
      if (values.length === 0) clauses.push('0 = 1');
      else {
        clauses.push(`"${column}" IN (${values.map(() => '?').join(', ')})`);
        bindings.push(...values);
      }
    } else {
      const operators: Record<string, string> = { eq: '=', neq: '!=', gte: '>=', lte: '<=', ilike: 'LIKE' };
      const operator = operators[filter.type];
      if (!operator) throw new Error('Operador no válido');
      clauses.push(filter.type === 'ilike' ? `LOWER("${column}") LIKE LOWER(?)` : `"${column}" ${operator} ?`);
      bindings.push(filter.value);
    }
  }
  return { sql: clauses.length ? ` WHERE ${clauses.join(' AND ')}` : '', bindings };
}

async function rowsByIds(db: D1Database, table: TableName, ids: unknown[]) {
  const unique = [...new Set(ids.filter((id): id is string => typeof id === 'string' && id.length > 0))];
  if (unique.length === 0) return new Map<string, DataRecord>();
  const rows: DataRecord[] = [];
  for (let index = 0; index < unique.length; index += 50) {
    const chunk = unique.slice(index, index + 50);
    const result = await db.prepare(`SELECT * FROM "${table}" WHERE id IN (${chunk.map(() => '?').join(', ')})`).bind(...chunk).all<DataRecord>();
    rows.push(...(result.results ?? []));
  }
  return new Map(rows.map((row) => [String(row.id), decodeRecord(table, row)]));
}

async function expandRelations(db: D1Database, table: TableName, select: string, rows: DataRecord[]) {
  if (rows.length === 0) return rows;
  if (table === 'asset_assignments') {
    if (select.includes('employee:employees')) {
      const map = await rowsByIds(db, 'employees', rows.map((row) => row.employee_id));
      rows.forEach((row) => { row.employee = map.get(String(row.employee_id)) ?? null; });
    }
    if (select.includes('asset:assets')) {
      const map = await rowsByIds(db, 'assets', rows.map((row) => row.asset_id));
      rows.forEach((row) => { row.asset = map.get(String(row.asset_id)) ?? null; });
    }
  }
  if (table === 'incidents') {
    if (select.includes('asset:assets')) {
      const map = await rowsByIds(db, 'assets', rows.map((row) => row.asset_id));
      rows.forEach((row) => { row.asset = map.get(String(row.asset_id)) ?? null; });
    }
    if (select.includes('employee:employees')) {
      const map = await rowsByIds(db, 'employees', rows.map((row) => row.employee_id));
      rows.forEach((row) => { row.employee = map.get(String(row.employee_id)) ?? null; });
    }
  }
  if (table === 'licenses' && select.includes('software:software')) {
    const map = await rowsByIds(db, 'software', rows.map((row) => row.software_id));
    rows.forEach((row) => { row.software = map.get(String(row.software_id)) ?? null; });
  }
  if (table === 'license_assignments') {
    if (select.includes('license:licenses')) {
      const map = await rowsByIds(db, 'licenses', rows.map((row) => row.license_id));
      const licenses = [...map.values()];
      if (select.includes('software:software')) {
        const softwareMap = await rowsByIds(db, 'software', licenses.map((row) => row.software_id));
        licenses.forEach((row) => { row.software = softwareMap.get(String(row.software_id)) ?? null; });
      }
      rows.forEach((row) => { row.license = map.get(String(row.license_id)) ?? null; });
    }
    if (select.includes('employee:employees')) {
      const map = await rowsByIds(db, 'employees', rows.map((row) => row.employee_id));
      rows.forEach((row) => { row.employee = map.get(String(row.employee_id)) ?? null; });
    }
    if (select.includes('asset:assets')) {
      const map = await rowsByIds(db, 'assets', rows.map((row) => row.asset_id));
      rows.forEach((row) => { row.asset = map.get(String(row.asset_id)) ?? null; });
    }
  }
  if (table === 'component_movements') {
    if (select.includes('component:components')) {
      const map = await rowsByIds(db, 'components', rows.map((row) => row.component_id));
      rows.forEach((row) => { row.component = map.get(String(row.component_id)) ?? null; });
    }
    if (select.includes('asset:assets')) {
      const map = await rowsByIds(db, 'assets', rows.map((row) => row.asset_id));
      rows.forEach((row) => { row.asset = map.get(String(row.asset_id)) ?? null; });
    }
  }
  return rows;
}

async function selectRows(db: D1Database, table: TableName, payload: DataRecord) {
  const definition = tableDefinitions[table];
  const filters = Array.isArray(payload.filters) ? payload.filters as Filter[] : [];
  const where = compileWhere(table, filters);
  const orders = Array.isArray(payload.order) ? payload.order as Array<{ column?: string; ascending?: boolean }> : [];
  const validOrders = orders.filter((order) => order.column && (definition.columns as readonly string[]).includes(order.column));
  const orderSql = validOrders.length
    ? ` ORDER BY ${validOrders.map((order) => `"${order.column}" ${order.ascending === false ? 'DESC' : 'ASC'}`).join(', ')}`
    : '';
  const limitValue = Number(payload.limit);
  const limitSql = Number.isInteger(limitValue) && limitValue > 0 ? ' LIMIT ?' : '';
  const bindings = [...where.bindings, ...(limitSql ? [Math.min(limitValue, 5000)] : [])];

  let count: number | null = null;
  if (payload.count === true) {
    const countRow = await db.prepare(`SELECT COUNT(*) AS total FROM "${table}"${where.sql}`).bind(...where.bindings).first<{ total: number }>();
    count = Number(countRow?.total ?? 0);
  }
  if (payload.head === true) return { rows: [] as DataRecord[], count };

  const result = await db.prepare(`SELECT * FROM "${table}"${where.sql}${orderSql}${limitSql}`).bind(...bindings).all<DataRecord>();
  const rows = (result.results ?? []).map((row) => decodeRecord(table, row));
  await expandRelations(db, table, String(payload.select ?? '*'), rows);
  return { rows, count };
}

async function insertRows(db: D1Database, table: TableName, source: unknown, onConflict?: string) {
  const items = (Array.isArray(source) ? source : [source]).map((item) => cleanRecord(table, item, true));
  if (items.length === 0) throw new Error('No hay registros para guardar');
  const allowed = tableDefinitions[table].columns as readonly string[];
  if (onConflict && !allowed.includes(onConflict)) throw new Error('Conflicto no válido');
  const statements = items.map((item) => {
    const columns = Object.keys(item);
    if (columns.length === 0) throw new Error('Registro vacío');
    let sql = `INSERT INTO "${table}" (${columns.map((column) => `"${column}"`).join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`;
    if (onConflict) {
      const updateColumns = columns.filter((column) => column !== 'id' && column !== onConflict && column !== 'created_at');
      sql += ` ON CONFLICT("${onConflict}") DO UPDATE SET ${updateColumns.map((column) => `"${column}" = excluded."${column}"`).join(', ')}`;
    }
    return db.prepare(sql).bind(...columns.map((column) => item[column]));
  });
  for (let index = 0; index < statements.length; index += 50) {
    await db.batch(statements.slice(index, index + 50));
  }
  if (onConflict) {
    const values = items.map((item) => item[onConflict]).filter((value) => value !== undefined);
    if (onConflict === 'id') {
      return [...(await rowsByIds(db, table, values)).values()];
    }
    const rows: DataRecord[] = [];
    for (let index = 0; index < values.length; index += 50) {
      const chunk = values.slice(index, index + 50);
      const result = await db.prepare(`SELECT * FROM "${table}" WHERE "${onConflict}" IN (${chunk.map(() => '?').join(', ')})`).bind(...chunk).all<DataRecord>();
      rows.push(...(result.results ?? []).map((row) => decodeRecord(table, row)));
    }
    return rows;
  }
  return rowsByIds(db, table, items.map((item) => item.id)).then((map) => items.map((item) => map.get(String(item.id))!).filter(Boolean));
}

async function mutateRows(db: D1Database, table: TableName, payload: DataRecord) {
  const action = String(payload.action ?? 'select');
  if (action === 'insert' || action === 'upsert') {
    return insertRows(db, table, payload.values, action === 'upsert' ? String(payload.onConflict ?? '') : undefined);
  }
  const where = compileWhere(table, Array.isArray(payload.filters) ? payload.filters as Filter[] : []);
  if (!where.sql) throw new Error('La operación necesita un filtro');
  if (action === 'update') {
    const values = cleanRecord(table, payload.values, false);
    delete values.id;
    delete values.created_at;
    const columns = Object.keys(values);
    if (columns.length === 0) throw new Error('No hay cambios para guardar');
    await db.prepare(`UPDATE "${table}" SET ${columns.map((column) => `"${column}" = ?`).join(', ')}${where.sql}`).bind(...columns.map((column) => values[column]), ...where.bindings).run();
    return [];
  }
  if (action === 'delete') {
    const selected = await db.prepare(`SELECT id FROM "${table}"${where.sql}`).bind(...where.bindings).all<{ id: string }>();
    const ids = (selected.results ?? []).map((row) => row.id);
    if (ids.length === 0) return [];
    const placeholders = ids.map(() => '?').join(', ');
    const cleanup: D1PreparedStatement[] = [];
    if (table === 'assets') {
      cleanup.push(
        db.prepare(`DELETE FROM asset_assignments WHERE asset_id IN (${placeholders})`).bind(...ids),
        db.prepare(`UPDATE incidents SET asset_id = NULL WHERE asset_id IN (${placeholders})`).bind(...ids),
        db.prepare(`UPDATE license_assignments SET asset_id = NULL WHERE asset_id IN (${placeholders})`).bind(...ids),
        db.prepare(`UPDATE component_movements SET asset_id = NULL WHERE asset_id IN (${placeholders})`).bind(...ids),
        db.prepare(`UPDATE assets SET parent_asset_id = NULL WHERE parent_asset_id IN (${placeholders})`).bind(...ids),
      );
    } else if (table === 'employees') {
      cleanup.push(
        db.prepare(`UPDATE asset_assignments SET employee_id = NULL WHERE employee_id IN (${placeholders})`).bind(...ids),
        db.prepare(`UPDATE incidents SET employee_id = NULL WHERE employee_id IN (${placeholders})`).bind(...ids),
        db.prepare(`UPDATE incidents SET assigned_to_id = NULL WHERE assigned_to_id IN (${placeholders})`).bind(...ids),
        db.prepare(`UPDATE license_assignments SET employee_id = NULL WHERE employee_id IN (${placeholders})`).bind(...ids),
      );
    } else if (table === 'incidents') {
      cleanup.push(db.prepare(`DELETE FROM incident_comments WHERE incident_id IN (${placeholders})`).bind(...ids));
    } else if (table === 'software') {
      const licenses = await db.prepare(`SELECT id FROM licenses WHERE software_id IN (${placeholders})`).bind(...ids).all<{ id: string }>();
      const licenseIds = (licenses.results ?? []).map((row) => row.id);
      if (licenseIds.length) {
        const licensePlaceholders = licenseIds.map(() => '?').join(', ');
        cleanup.push(db.prepare(`DELETE FROM license_assignments WHERE license_id IN (${licensePlaceholders})`).bind(...licenseIds));
      }
      cleanup.push(db.prepare(`DELETE FROM licenses WHERE software_id IN (${placeholders})`).bind(...ids));
    } else if (table === 'licenses') {
      cleanup.push(db.prepare(`DELETE FROM license_assignments WHERE license_id IN (${placeholders})`).bind(...ids));
    } else if (table === 'components') {
      cleanup.push(db.prepare(`DELETE FROM component_movements WHERE component_id IN (${placeholders})`).bind(...ids));
    }
    cleanup.push(db.prepare(`DELETE FROM "${table}"${where.sql}`).bind(...where.bindings));
    await db.batch(cleanup);
    return [];
  }
  throw new Error('Operación no válida');
}

async function handleDataApi(request: Request, env: AppEnv, tableValue: string) {
  if (!await getUser(request, env)) return json({ error: { message: 'Inicia sesión para acceder al inventario' } }, 401);
  if (!isTableName(tableValue)) return json({ error: { message: 'Recurso no válido' } }, 404);
  if (request.method !== 'POST') return json({ error: { message: 'Método no permitido' } }, 405);
  const payload = await request.json<DataRecord>();
  const action = String(payload.action ?? 'select');
  if (action === 'select') {
    const { rows, count } = await selectRows(env.DB, tableValue, payload);
    return json({ data: payload.maybeSingle ? rows[0] ?? null : payload.head ? null : rows, count, error: null });
  }
  const rows = await mutateRows(env.DB, tableValue, payload);
  if (payload.returning === true && rows.length) {
    await expandRelations(env.DB, tableValue, String(payload.select ?? '*'), rows);
  }
  return json({ data: payload.returning ? (payload.maybeSingle ? rows[0] ?? null : rows) : null, count: null, error: null });
}

async function safeEqual(left: string, right: string) {
  const encoder = new TextEncoder();
  const [leftHash, rightHash] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(left)),
    crypto.subtle.digest('SHA-256', encoder.encode(right)),
  ]);
  const subtle = crypto.subtle as SubtleCrypto & { timingSafeEqual(a: ArrayBuffer, b: ArrayBuffer): boolean };
  return subtle.timingSafeEqual(leftHash, rightHash);
}

async function addAudit(db: D1Database, values: DataRecord) {
  await insertRows(db, 'audit_logs', values);
}

async function publicAsset(request: Request, env: AppEnv) {
  const url = new URL(request.url);
  const serial = url.searchParams.get('serial')?.trim();
  if (!serial) return json({ error: 'serial_required' }, 400);
  const asset = await env.DB.prepare('SELECT * FROM assets WHERE serial_number = ?').bind(serial).first<DataRecord>();
  if (!asset) return json({ error: 'not_found' }, 404);

  if (request.method === 'GET') {
    const suppliedPin = url.searchParams.get('tech_pin') ?? '';
    const techAccess = Boolean(env.ASSET_PUBLIC_TECH_PIN && suppliedPin && await safeEqual(suppliedPin, env.ASSET_PUBLIC_TECH_PIN));
    if (suppliedPin && !techAccess) return json({ error: 'invalid_pin' }, 403);
    const assignment = await env.DB.prepare('SELECT * FROM asset_assignments WHERE asset_id = ? AND returned_at IS NULL ORDER BY assigned_at DESC LIMIT 1').bind(asset.id).first<DataRecord>();
    let employee: DataRecord | null = null;
    let employees: DataRecord[] = [];
    if (techAccess) {
      if (assignment?.employee_id) employee = await env.DB.prepare('SELECT id, name, department, position FROM employees WHERE id = ?').bind(assignment.employee_id).first<DataRecord>();
      const result = await env.DB.prepare('SELECT id, name, department, position FROM employees WHERE active = 1 ORDER BY name').all<DataRecord>();
      employees = result.results ?? [];
    }
    const statuses = ['open', 'assigned', 'in_progress', 'waiting_user'];
    const open = await env.DB.prepare(`SELECT COUNT(*) AS total FROM incidents WHERE asset_id = ? AND status IN (${statuses.map(() => '?').join(', ')})`).bind(asset.id, ...statuses).first<{ total: number }>();
    const recent = await env.DB.prepare('SELECT id, title, status, priority, opened_at FROM incidents WHERE asset_id = ? ORDER BY opened_at DESC LIMIT 5').bind(asset.id).all<DataRecord>();
    const publicFields = ['id', 'serial_number', 'name', 'asset_type', 'brand', 'model', 'status', 'location', 'purchase_date', 'purchase_value', 'warranty_expiry', 'end_of_life', 'notes', 'image_url'];
    const publicRecord = Object.fromEntries(publicFields.map((field) => [field, asset[field]]));
    return json({
      asset: publicRecord,
      assignment: assignment ? { assigned_at: assignment.assigned_at, notes: assignment.notes, employee } : null,
      openIncidents: Number(open?.total ?? 0),
      recentIncidents: recent.results ?? [],
      employees,
    });
  }

  if (request.method === 'POST') {
    const body = await request.json<{ title?: string; description?: string; priority?: string }>();
    const title = body.title?.trim().slice(0, 160);
    if (!title) return json({ error: 'title_required' }, 400);
    const priority = ['low', 'medium', 'high', 'critical'].includes(body.priority ?? '') ? body.priority! : 'medium';
    const assignment = await env.DB.prepare('SELECT employee_id FROM asset_assignments WHERE asset_id = ? AND returned_at IS NULL ORDER BY assigned_at DESC LIMIT 1').bind(asset.id).first<{ employee_id: string | null }>();
    const [incident] = await insertRows(env.DB, 'incidents', {
      title,
      description: body.description?.trim().slice(0, 5000) ?? '',
      priority,
      status: 'open',
      asset_id: asset.id,
      employee_id: assignment?.employee_id ?? null,
    });
    await addAudit(env.DB, {
      action: 'reported_incident', entity_type: 'asset', entity_id: asset.id,
      entity_name: asset.serial_number, details: { title, priority, source: 'public_qr' }, performed_by: 'public',
    });
    const notifyResult = await notifyIncident(env, String(incident.id), 'created');
    if (!notifyResult.sent) {
      console.warn(JSON.stringify({ event: 'incident_notification_skipped', incidentId: incident.id, reason: notifyResult.reason }));
    }
    return json({ success: true, incident_id: incident.id }, 201);
  }

  if (request.method === 'PUT') {
    const body = await request.json<{ pin?: string; status?: string; location?: string; notes?: string; employee_id?: string | null }>();
    if (!env.ASSET_PUBLIC_TECH_PIN || !body.pin || !await safeEqual(body.pin, env.ASSET_PUBLIC_TECH_PIN)) return json({ error: 'invalid_pin' }, 403);
    const updates: DataRecord = {};
    if (body.status !== undefined && ['active', 'storage', 'repair', 'retired'].includes(body.status)) updates.status = body.status;
    if (body.location !== undefined) updates.location = body.location.trim().slice(0, 200);
    if (body.notes !== undefined) updates.notes = body.notes.trim().slice(0, 5000);
    if (Object.keys(updates).length) await mutateRows(env.DB, 'assets', { action: 'update', values: updates, filters: [{ type: 'eq', column: 'id', value: asset.id }] });
    if (body.employee_id !== undefined) {
      const now = new Date().toISOString();
      await env.DB.prepare('UPDATE asset_assignments SET returned_at = ? WHERE asset_id = ? AND returned_at IS NULL').bind(now, asset.id).run();
      if (body.employee_id) await insertRows(env.DB, 'asset_assignments', { asset_id: asset.id, employee_id: body.employee_id, notes: 'Asignado desde panel técnico (QR)' });
    }
    await addAudit(env.DB, {
      action: 'tech_update', entity_type: 'asset', entity_id: asset.id,
      entity_name: asset.serial_number, details: { ...updates, employee_id: body.employee_id, source: 'tech_pin_qr' }, performed_by: 'tech_pin',
    });
    return json({ success: true });
  }
  return json({ error: 'method_not_allowed' }, 405);
}

function escapeHtml(value: unknown) {
  return String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
}

async function notifyIncident(env: AppEnv, incidentId: string, event: string): Promise<{ sent: boolean; reason?: string; provider?: string }> {
  const incident = await env.DB.prepare('SELECT * FROM incidents WHERE id = ?').bind(incidentId).first<DataRecord>();
  if (!incident) return { sent: false, reason: 'incident_not_found' };
  const asset = incident.asset_id ? await env.DB.prepare('SELECT serial_number, brand, model, location FROM assets WHERE id = ?').bind(incident.asset_id).first<DataRecord>() : null;
  const employee = incident.employee_id ? await env.DB.prepare('SELECT name, email FROM employees WHERE id = ?').bind(incident.employee_id).first<DataRecord>() : null;
  const recipientsResult = await env.DB.prepare('SELECT email FROM incident_notification_recipients WHERE enabled = 1 ORDER BY email').all<{ email: string }>();
  const recipients = incident.assigned_to_email ? [String(incident.assigned_to_email)] : (recipientsResult.results ?? []).map((row) => row.email);
  const to = [...new Set(recipients.filter(Boolean))];
  if (to.length === 0) return { sent: false, reason: 'no_recipients' };

  const provider = (env.MAIL_PROVIDER ?? (env.MS_TENANT_ID ? 'graph' : env.RESEND_API_KEY ? 'resend' : '')).toLowerCase();
  if (!provider) return { sent: false, reason: 'email_not_configured' };
  const eventLabel = event === 'created' ? 'Nueva incidencia' : event === 'assigned' ? 'Incidencia asignada' : 'Incidencia actualizada';
  const appUrl = env.APP_URL ?? new URL('/', 'https://inventario.local').toString();
  const assetLabel = asset?.serial_number ? `${asset.serial_number} ${[asset.brand, asset.model].filter(Boolean).join(' ')}`.trim() : '';
  const subject = `[IT Inventario] ${eventLabel}: ${incident.title}`;
  const text = [`${eventLabel}: ${incident.title}`, `Prioridad: ${incident.priority}`, `Estado: ${incident.status}`, assetLabel && `Activo: ${assetLabel}`, employee?.name && `Empleado: ${employee.name}`, incident.description && `Descripción: ${incident.description}`, `Abrir: ${appUrl}`].filter(Boolean).join('\n');
  const html = `<!doctype html><html><body style="margin:0;background:#f1f5f9;font-family:Arial,sans-serif;color:#0f172a"><div style="max-width:640px;margin:auto;padding:28px 16px"><div style="background:#fff;border-radius:14px;overflow:hidden;border:1px solid #e2e8f0"><div style="background:#173b70;color:#fff;padding:20px"><strong>IT Inventario</strong><h1 style="font-size:22px;margin:6px 0 0">${escapeHtml(eventLabel)}</h1></div><div style="padding:22px"><h2>${escapeHtml(incident.title)}</h2><p><strong>Prioridad:</strong> ${escapeHtml(incident.priority)} · <strong>Estado:</strong> ${escapeHtml(incident.status)}</p>${assetLabel ? `<p><strong>Activo:</strong> ${escapeHtml(assetLabel)}</p>` : ''}${employee?.name ? `<p><strong>Empleado:</strong> ${escapeHtml(employee.name)}</p>` : ''}<p style="white-space:pre-wrap">${escapeHtml(incident.description)}</p><p><a href="${escapeHtml(appUrl)}" style="background:#2563eb;color:#fff;padding:10px 15px;border-radius:8px;text-decoration:none">Abrir aplicación</a></p></div></div></div></body></html>`;
  const from = env.INCIDENT_EMAIL_FROM ?? 'IT Inventario <onboarding@resend.dev>';
  let response: Response;

  if (provider === 'resend' && env.RESEND_API_KEY) {
    response = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from, to, subject, text, html }) });
  } else if (provider === 'sendgrid' && env.SENDGRID_API_KEY) {
    const fromEmail = from.match(/<([^>]+)>/)?.[1] ?? from;
    response = await fetch('https://api.sendgrid.com/v3/mail/send', { method: 'POST', headers: { Authorization: `Bearer ${env.SENDGRID_API_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ personalizations: [{ to: to.map((email) => ({ email })) }], from: { email: fromEmail, name: 'IT Inventario' }, subject, content: [{ type: 'text/plain', value: text }, { type: 'text/html', value: html }] }) });
  } else if (provider === 'brevo' && env.BREVO_API_KEY) {
    const fromEmail = from.match(/<([^>]+)>/)?.[1] ?? from;
    response = await fetch('https://api.brevo.com/v3/smtp/email', { method: 'POST', headers: { 'api-key': env.BREVO_API_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ sender: { email: fromEmail, name: 'IT Inventario' }, to: to.map((email) => ({ email })), subject, textContent: text, htmlContent: html }) });
  } else if (provider === 'google_script' && env.GOOGLE_SCRIPT_MAIL_URL && env.GOOGLE_SCRIPT_MAIL_SECRET) {
    response = await fetch(env.GOOGLE_SCRIPT_MAIL_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ secret: env.GOOGLE_SCRIPT_MAIL_SECRET, fromName: 'IT Inventario', to, subject, text, html }) });
  } else if (provider === 'graph' && env.MS_TENANT_ID && env.MS_CLIENT_ID && env.MS_CLIENT_SECRET) {
    const tokenResponse = await fetch(`https://login.microsoftonline.com/${env.MS_TENANT_ID}/oauth2/v2.0/token`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: env.MS_CLIENT_ID, client_secret: env.MS_CLIENT_SECRET, scope: 'https://graph.microsoft.com/.default', grant_type: 'client_credentials' }) });
    if (!tokenResponse.ok) return { sent: false, reason: 'graph_auth_failed', provider };
    const token = await tokenResponse.json<{ access_token: string }>();
    const sender = env.MS_SENDER_EMAIL ?? (from.match(/<([^>]+)>/)?.[1] ?? from);
    response = await fetch(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(sender)}/sendMail`, { method: 'POST', headers: { Authorization: `Bearer ${token.access_token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ message: { subject, body: { contentType: 'HTML', content: html }, toRecipients: to.map((address) => ({ emailAddress: { address } })) }, saveToSentItems: true }) });
  } else {
    return { sent: false, reason: `missing_${provider}_configuration`, provider };
  }
  if (!response.ok) {
    console.error(JSON.stringify({ event: 'email_failed', provider, incidentId, status: response.status }));
    await addAudit(env.DB, { action: 'email_failed', entity_type: 'incident', entity_id: incidentId, entity_name: incident.title, details: { to, provider, status: response.status }, performed_by: 'notify-incident' });
    return { sent: false, reason: 'provider_error', provider };
  }
  await addAudit(env.DB, { action: 'email_sent', entity_type: 'incident', entity_id: incidentId, entity_name: incident.title, details: { to, provider, event }, performed_by: 'notify-incident' });
  return { sent: true, provider };
}

async function handleAgentSync(request: Request, env: AppEnv) {
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  if (!env.INVENTORY_AGENT_TOKEN) return json({ error: 'agent_not_configured' }, 503);
  const supplied = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '') ?? '';
  if (!supplied || !await safeEqual(supplied, env.INVENTORY_AGENT_TOKEN)) return json({ error: 'unauthorized' }, 401);
  const body = await request.json<DataRecord>();
  const serial = String(body.serial_number ?? '').trim().slice(0, 120);
  if (!serial) return json({ error: 'serial_required' }, 400);
  const existing = await env.DB.prepare('SELECT id FROM assets WHERE serial_number = ?').bind(serial).first<{ id: string }>();
  const technicalFields = ['name', 'brand', 'model', 'operating_system', 'ip_address', 'mac_address', 'processor', 'ram_gb', 'storage_gb', 'last_inventory_at'];
  if (existing) {
    const values = Object.fromEntries(technicalFields.filter((field) => body[field] !== undefined).map((field) => [field, body[field]]));
    await mutateRows(env.DB, 'assets', { action: 'update', values, filters: [{ type: 'eq', column: 'id', value: existing.id }] });
    return json({ success: true, action: 'updated', serial_number: serial });
  }
  const allowedCreate = ['serial_number', 'name', 'asset_type', 'brand', 'model', 'status', 'location', ...technicalFields, 'notes'];
  const values = Object.fromEntries(allowedCreate.filter((field) => body[field] !== undefined).map((field) => [field, body[field]]));
  values.serial_number = serial;
  await insertRows(env.DB, 'assets', values);
  return json({ success: true, action: 'created', serial_number: serial }, 201);
}

const migrationOrder: TableName[] = [
  'employees', 'assets', 'asset_assignments', 'software', 'licenses',
  'license_assignments', 'components', 'component_movements', 'incidents',
  'incident_comments', 'incident_notification_recipients', 'audit_logs',
];

async function handleBackup(request: Request, env: AppEnv) {
  if (!await getUser(request, env)) return json({ error: 'unauthenticated' }, 401);
  if (request.method === 'GET') {
    const tables: Record<string, DataRecord[]> = {};
    for (const table of migrationOrder) {
      const result = await env.DB.prepare(`SELECT * FROM "${table}"`).all<DataRecord>();
      tables[table] = (result.results ?? []).map((row) => decodeRecord(table, row));
    }
    return json({ format: 'it-inventario-backup-v1', exported_at: new Date().toISOString(), tables }, 200, {
      'Content-Disposition': `attachment; filename="it-inventario-${new Date().toISOString().slice(0, 10)}.json"`,
    });
  }
  if (request.method === 'POST') {
    const body = await request.json<{ format?: string; tables?: Record<string, unknown> }>();
    if (!body.tables || typeof body.tables !== 'object') return json({ error: 'invalid_backup' }, 400);
    const imported: Record<string, number> = {};
    for (const table of migrationOrder) {
      const values = body.tables[table];
      if (!Array.isArray(values) || values.length === 0) {
        imported[table] = 0;
        continue;
      }
      await insertRows(env.DB, table, values, 'id');
      imported[table] = values.length;
    }
    console.log(JSON.stringify({ event: 'backup_imported', imported }));
    return json({ success: true, imported });
  }
  return json({ error: 'method_not_allowed' }, 405);
}

export default {
  async fetch(request: Request, env: AppEnv): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') {
      return withCors(new Response(null, { status: 204 }), request, env);
    }
    try {
      let response: Response;
      if (url.pathname === '/api/health') {
        const row = await env.DB.prepare('SELECT 1 AS ok').first<{ ok: number }>();
        response = json({ status: row?.ok === 1 ? 'ok' : 'degraded', service: 'IT Inventario', storage: 'D1' });
      } else if (url.pathname === '/api/session') {
        const user = await getUser(request, env);
        response = user ? json({ user }) : json({ error: 'unauthenticated' }, 401);
      } else if (url.pathname.startsWith('/api/data/')) {
        response = await handleDataApi(request, env, decodeURIComponent(url.pathname.slice('/api/data/'.length)));
      } else if (url.pathname === '/api/public/assets') {
        response = await publicAsset(request, env);
      } else if (url.pathname === '/api/agent/sync') {
        response = await handleAgentSync(request, env);
      } else if (url.pathname === '/api/admin/backup') {
        response = await handleBackup(request, env);
      } else if (url.pathname === '/api/functions/notify-incident') {
        if (!await getUser(request, env)) response = json({ error: 'unauthenticated' }, 401);
        else if (request.method !== 'POST') response = json({ error: 'method_not_allowed' }, 405);
        else {
          const body = await request.json<{ incident_id?: string; event?: string }>();
          response = body.incident_id
            ? json(await notifyIncident(env, body.incident_id, body.event ?? 'created'))
            : json({ error: 'incident_id_required' }, 400);
        }
      } else if (url.pathname.startsWith('/api/')) {
        response = json({ error: 'not_found' }, 404);
      } else {
        response = await env.ASSETS.fetch(request);
      }
      return withCors(response, request, env);
    } catch (error) {
      const requestId = crypto.randomUUID();
      console.error(JSON.stringify({ event: 'request_failed', requestId, path: url.pathname, method: request.method, message: error instanceof Error ? error.message : String(error) }));
      return withCors(json({ error: { message: 'No se pudo completar la operación', requestId } }, 500), request, env);
    }
  },
} satisfies ExportedHandler<AppEnv>;
