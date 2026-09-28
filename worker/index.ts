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
type UserRole = 'admin' | 'technician' | 'viewer';
type AuthUser = { id: string; email: string; name: string; role: UserRole };

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
  const supplied = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '') ?? '';
  if ((url.hostname === 'localhost' || url.hostname === '127.0.0.1') && !supplied) {
    return { id: 'local-development', email: 'desarrollo@local', name: 'Desarrollo local', role: 'admin' } satisfies AuthUser;
  }
  if (!supplied || supplied.length > 300) return null;
  if (env.INVENTORY_WEB_TOKEN && await safeEqual(supplied, env.INVENTORY_WEB_TOKEN)) {
    return { id: 'system-admin', email: 'inventario@github-pages', name: 'Administrador principal', role: 'admin' } satisfies AuthUser;
  }
  const tokenHash = await hashToken(supplied);
  const user = await env.DB.prepare('SELECT id, email, name, role FROM app_users WHERE token_hash = ? AND active = 1 LIMIT 1')
    .bind(tokenHash)
    .first<{ id: string; email: string; name: string; role: string }>();
  if (user && ['admin', 'technician', 'viewer'].includes(user.role)) return user as AuthUser;
  const id = request.headers.get('oai-authenticated-user-id') ?? request.headers.get('x-openai-authenticated-user-id');
  const email = request.headers.get('oai-authenticated-user-email') ?? request.headers.get('x-openai-authenticated-user-email');
  if (id || email) return { id: id ?? email ?? 'user', email: email ?? '', name: email ?? 'Usuario', role: 'admin' } satisfies AuthUser;
  return null;
}

function actorLabel(user: AuthUser) {
  return user.email || user.name || user.id;
}

function requireRole(user: AuthUser | null, roles: UserRole[]) {
  return Boolean(user && roles.includes(user.role));
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

async function queryAll(db: D1Database, sql: string, ...bindings: unknown[]) {
  const result = await db.prepare(sql).bind(...bindings).all<DataRecord>();
  return result.results ?? [];
}

function recycleDisplayName(table: TableName, record: DataRecord) {
  if (table === 'assets') return String(record.serial_number ?? record.name ?? record.id);
  if (table === 'employees' || table === 'software' || table === 'components') return String(record.name ?? record.id);
  if (table === 'incidents') return String(record.title ?? record.id);
  if (table === 'licenses') return String(record.license_key ?? record.id);
  if (table === 'incident_notification_recipients') return String(record.email ?? record.id);
  return String(record.entity_name ?? record.id);
}

async function recycleRelatedRows(db: D1Database, table: TableName, id: string) {
  const related: Record<string, DataRecord[]> = {};
  if (table === 'assets') {
    related.asset_assignments = await queryAll(db, 'SELECT * FROM asset_assignments WHERE asset_id = ?', id);
    related.incidents = await queryAll(db, 'SELECT * FROM incidents WHERE asset_id = ?', id);
    related.license_assignments = await queryAll(db, 'SELECT * FROM license_assignments WHERE asset_id = ?', id);
    related.component_movements = await queryAll(db, 'SELECT * FROM component_movements WHERE asset_id = ?', id);
    related.assets = await queryAll(db, 'SELECT * FROM assets WHERE parent_asset_id = ?', id);
  } else if (table === 'employees') {
    related.asset_assignments = await queryAll(db, 'SELECT * FROM asset_assignments WHERE employee_id = ?', id);
    related.incidents = await queryAll(db, 'SELECT * FROM incidents WHERE employee_id = ? OR assigned_to_id = ?', id, id);
    related.license_assignments = await queryAll(db, 'SELECT * FROM license_assignments WHERE employee_id = ?', id);
  } else if (table === 'incidents') {
    related.incident_comments = await queryAll(db, 'SELECT * FROM incident_comments WHERE incident_id = ?', id);
  } else if (table === 'software') {
    related.licenses = await queryAll(db, 'SELECT * FROM licenses WHERE software_id = ?', id);
    const licenseIds = related.licenses.map((row) => String(row.id));
    if (licenseIds.length) {
      related.license_assignments = await queryAll(
        db,
        `SELECT * FROM license_assignments WHERE license_id IN (${licenseIds.map(() => '?').join(', ')})`,
        ...licenseIds,
      );
    }
  } else if (table === 'licenses') {
    related.license_assignments = await queryAll(db, 'SELECT * FROM license_assignments WHERE license_id = ?', id);
  } else if (table === 'components') {
    related.component_movements = await queryAll(db, 'SELECT * FROM component_movements WHERE component_id = ?', id);
  }
  return related;
}

async function archiveDeletedRows(db: D1Database, table: TableName, ids: string[], deletedBy: string) {
  for (const id of ids) {
    const record = await db.prepare(`SELECT * FROM "${table}" WHERE id = ?`).bind(id).first<DataRecord>();
    if (!record) continue;
    const related = await recycleRelatedRows(db, table, id);
    await db.prepare(`INSERT INTO recycle_bin (id, table_name, record_id, display_name, record_json, deleted_by, deleted_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .bind(
        crypto.randomUUID(),
        table,
        id,
        recycleDisplayName(table, record),
        JSON.stringify({ record, related }),
        deletedBy,
        new Date().toISOString(),
      )
      .run();
  }
}

async function mutateRows(db: D1Database, table: TableName, payload: DataRecord, deletedBy = 'system') {
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
    await archiveDeletedRows(db, table, ids, deletedBy);
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
  const user = await getUser(request, env);
  if (!user) return json({ error: { message: 'Inicia sesión para acceder al inventario' } }, 401);
  if (!isTableName(tableValue)) return json({ error: { message: 'Recurso no válido' } }, 404);
  if (request.method !== 'POST') return json({ error: { message: 'Método no permitido' } }, 405);
  const payload = await request.json<DataRecord>();
  const action = String(payload.action ?? 'select');
  if (action === 'select') {
    const { rows, count } = await selectRows(env.DB, tableValue, payload);
    return json({ data: payload.maybeSingle ? rows[0] ?? null : payload.head ? null : rows, count, error: null });
  }
  if (!requireRole(user, ['admin', 'technician'])) return json({ error: { message: 'Tu perfil es de solo lectura' } }, 403);
  const rows = await mutateRows(env.DB, tableValue, payload, actorLabel(user));
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

async function hashToken(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
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

async function createBackupPayload(db: D1Database) {
  const tables: Record<string, DataRecord[]> = {};
  for (const table of migrationOrder) {
    const result = await db.prepare(`SELECT * FROM "${table}"`).all<DataRecord>();
    tables[table] = (result.results ?? []).map((row) => decodeRecord(table, row));
  }
  return { format: 'it-inventario-backup-v1', exported_at: new Date().toISOString(), tables };
}

async function restoreBackupPayload(db: D1Database, tables: Record<string, unknown>) {
  const imported: Record<string, number> = {};
  for (const table of migrationOrder) {
    const values = tables[table];
    if (!Array.isArray(values) || values.length === 0) {
      imported[table] = 0;
      continue;
    }
    await insertRows(db, table, values, 'id');
    imported[table] = values.length;
  }
  return imported;
}

async function handleBackup(request: Request, env: AppEnv) {
  const user = await getUser(request, env);
  if (!user) return json({ error: 'unauthenticated' }, 401);
  if (user.role !== 'admin') return json({ error: 'forbidden' }, 403);
  if (request.method === 'GET') {
    const backup = await createBackupPayload(env.DB);
    return json(backup, 200, {
      'Content-Disposition': `attachment; filename="it-inventario-${new Date().toISOString().slice(0, 10)}.json"`,
    });
  }
  if (request.method === 'POST') {
    const body = await request.json<{ format?: string; tables?: Record<string, unknown> }>();
    if (!body.tables || typeof body.tables !== 'object') return json({ error: 'invalid_backup' }, 400);
    const imported = await restoreBackupPayload(env.DB, body.tables);
    await addAudit(env.DB, { action: 'backup_restored', entity_type: 'system', entity_name: 'Copia JSON', details: { imported }, performed_by: actorLabel(user) });
    console.log(JSON.stringify({ event: 'backup_imported', imported }));
    return json({ success: true, imported });
  }
  return json({ error: 'method_not_allowed' }, 405);
}

function createAccessToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return `INVU-${[...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('')}`;
}

async function handleUsers(request: Request, env: AppEnv) {
  const currentUser = await getUser(request, env);
  if (!currentUser) return json({ error: 'unauthenticated' }, 401);
  if (currentUser.role !== 'admin') return json({ error: 'forbidden' }, 403);

  if (request.method === 'GET') {
    const result = await env.DB.prepare(`SELECT id, name, email, role, token_hint, active, created_at, updated_at, last_login_at
      FROM app_users ORDER BY active DESC, name`).all<DataRecord>();
    return json({ users: (result.results ?? []).map((row) => ({ ...row, active: Boolean(row.active) })) });
  }
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const body = await request.json<{ action?: string; id?: string; name?: string; email?: string; role?: string; active?: boolean }>();
  const action = body.action ?? 'create';
  if (action === 'create') {
    const name = body.name?.trim().slice(0, 120) ?? '';
    const email = body.email?.trim().toLowerCase().slice(0, 200) ?? '';
    const role = ['admin', 'technician', 'viewer'].includes(body.role ?? '') ? body.role as UserRole : 'viewer';
    if (!name || !email || !email.includes('@')) return json({ error: 'invalid_user' }, 400);
    const exists = await env.DB.prepare('SELECT id FROM app_users WHERE email = ?').bind(email).first<{ id: string }>();
    if (exists) return json({ error: 'email_exists' }, 409);
    const accessToken = createAccessToken();
    const now = new Date().toISOString();
    const user = { id: crypto.randomUUID(), name, email, role, token_hint: accessToken.slice(-8), active: 1, created_at: now, updated_at: now };
    await env.DB.prepare(`INSERT INTO app_users (id, name, email, role, token_hash, token_hint, active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`)
      .bind(user.id, name, email, role, await hashToken(accessToken), user.token_hint, now, now)
      .run();
    await addAudit(env.DB, { action: 'created', entity_type: 'user', entity_id: user.id, entity_name: name, details: { email, role }, performed_by: actorLabel(currentUser) });
    return json({ user: { ...user, active: true }, access_token: accessToken }, 201);
  }

  if (!body.id) return json({ error: 'id_required' }, 400);
  const existing = await env.DB.prepare('SELECT id, name, email, role, active FROM app_users WHERE id = ?').bind(body.id).first<DataRecord>();
  if (!existing) return json({ error: 'user_not_found' }, 404);
  if (action === 'regenerate') {
    const accessToken = createAccessToken();
    await env.DB.prepare('UPDATE app_users SET token_hash = ?, token_hint = ?, updated_at = ? WHERE id = ?')
      .bind(await hashToken(accessToken), accessToken.slice(-8), new Date().toISOString(), body.id)
      .run();
    await addAudit(env.DB, { action: 'token_regenerated', entity_type: 'user', entity_id: body.id, entity_name: existing.name, details: {}, performed_by: actorLabel(currentUser) });
    return json({ success: true, access_token: accessToken, token_hint: accessToken.slice(-8) });
  }
  if (action === 'update') {
    const name = body.name?.trim().slice(0, 120) || String(existing.name);
    const email = body.email?.trim().toLowerCase().slice(0, 200) || String(existing.email);
    const role = ['admin', 'technician', 'viewer'].includes(body.role ?? '') ? body.role as UserRole : String(existing.role) as UserRole;
    const active = body.active === undefined ? Boolean(existing.active) : body.active;
    await env.DB.prepare('UPDATE app_users SET name = ?, email = ?, role = ?, active = ?, updated_at = ? WHERE id = ?')
      .bind(name, email, role, active ? 1 : 0, new Date().toISOString(), body.id)
      .run();
    await addAudit(env.DB, { action: 'updated', entity_type: 'user', entity_id: body.id, entity_name: name, details: { email, role, active }, performed_by: actorLabel(currentUser) });
    return json({ success: true });
  }
  return json({ error: 'invalid_action' }, 400);
}

async function createSnapshot(db: D1Database, label: string, automatic: boolean, createdBy: string) {
  const backup = await createBackupPayload(db);
  const counts = Object.fromEntries(Object.entries(backup.tables).map(([table, rows]) => [table, rows.length]));
  const snapshot = {
    id: crypto.randomUUID(),
    label: label.trim().slice(0, 160) || (automatic ? 'Copia automática' : 'Copia manual'),
    created_at: new Date().toISOString(),
  };
  await db.prepare(`INSERT INTO inventory_snapshots (id, label, data_json, counts_json, automatic, created_by, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .bind(snapshot.id, snapshot.label, JSON.stringify(backup), JSON.stringify(counts), automatic ? 1 : 0, createdBy, snapshot.created_at)
    .run();
  if (automatic) {
    await db.prepare(`DELETE FROM inventory_snapshots WHERE automatic = 1 AND id NOT IN (
      SELECT id FROM inventory_snapshots WHERE automatic = 1 ORDER BY created_at DESC LIMIT 30
    )`).run();
  }
  return { ...snapshot, counts, automatic, created_by: createdBy };
}

async function ensureDailySnapshot(env: AppEnv) {
  const today = new Date().toISOString().slice(0, 10);
  const existing = await env.DB.prepare('SELECT id FROM inventory_snapshots WHERE automatic = 1 AND substr(created_at, 1, 10) = ? LIMIT 1').bind(today).first();
  if (!existing) await createSnapshot(env.DB, `Copia automática ${today}`, true, 'scheduler');
}

async function handleSnapshots(request: Request, env: AppEnv) {
  const user = await getUser(request, env);
  if (!user) return json({ error: 'unauthenticated' }, 401);
  if (user.role !== 'admin') return json({ error: 'forbidden' }, 403);
  if (request.method === 'GET') {
    const result = await env.DB.prepare(`SELECT id, label, counts_json, automatic, created_by, created_at
      FROM inventory_snapshots ORDER BY created_at DESC LIMIT 100`).all<DataRecord>();
    return json({ snapshots: (result.results ?? []).map((row) => ({
      ...row,
      counts: JSON.parse(String(row.counts_json ?? '{}')),
      counts_json: undefined,
      automatic: Boolean(row.automatic),
    })) });
  }
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  const body = await request.json<{ action?: string; id?: string; label?: string }>();
  const action = body.action ?? 'create';
  if (action === 'create') {
    const snapshot = await createSnapshot(env.DB, body.label ?? 'Copia manual', false, actorLabel(user));
    await addAudit(env.DB, { action: 'backup_created', entity_type: 'system', entity_id: snapshot.id, entity_name: snapshot.label, details: { counts: snapshot.counts }, performed_by: actorLabel(user) });
    return json({ snapshot }, 201);
  }
  if (!body.id) return json({ error: 'id_required' }, 400);
  if (action === 'restore') {
    const row = await env.DB.prepare('SELECT label, data_json FROM inventory_snapshots WHERE id = ?').bind(body.id).first<{ label: string; data_json: string }>();
    if (!row) return json({ error: 'snapshot_not_found' }, 404);
    const backup = JSON.parse(row.data_json) as { tables?: Record<string, unknown> };
    if (!backup.tables) return json({ error: 'invalid_snapshot' }, 500);
    const imported = await restoreBackupPayload(env.DB, backup.tables);
    await addAudit(env.DB, { action: 'backup_restored', entity_type: 'system', entity_id: body.id, entity_name: row.label, details: { imported }, performed_by: actorLabel(user) });
    return json({ success: true, imported });
  }
  if (action === 'delete') {
    await env.DB.prepare('DELETE FROM inventory_snapshots WHERE id = ?').bind(body.id).run();
    return json({ success: true });
  }
  return json({ error: 'invalid_action' }, 400);
}

async function restoreRecycleEntry(db: D1Database, entry: { table_name: string; record_json: string }) {
  if (!isTableName(entry.table_name)) throw new Error('Entidad de papelera no válida');
  const payload = JSON.parse(entry.record_json) as { record?: DataRecord; related?: Record<string, DataRecord[]> };
  if (!payload.record) throw new Error('Registro de papelera no válido');
  await insertRows(db, entry.table_name, payload.record, 'id');
  for (const table of migrationOrder) {
    const rows = payload.related?.[table];
    if (rows?.length) await insertRows(db, table, rows, 'id');
  }
}

async function handleRecycleBin(request: Request, env: AppEnv) {
  const user = await getUser(request, env);
  if (!user) return json({ error: 'unauthenticated' }, 401);
  if (user.role !== 'admin') return json({ error: 'forbidden' }, 403);
  if (request.method === 'GET') {
    const result = await env.DB.prepare(`SELECT id, table_name, record_id, display_name, deleted_by, deleted_at
      FROM recycle_bin ORDER BY deleted_at DESC LIMIT 500`).all<DataRecord>();
    return json({ items: result.results ?? [] });
  }
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  const body = await request.json<{ action?: string; id?: string }>();
  if (body.action === 'empty') {
    await env.DB.prepare('DELETE FROM recycle_bin').run();
    await addAudit(env.DB, { action: 'recycle_emptied', entity_type: 'system', entity_name: 'Papelera', details: {}, performed_by: actorLabel(user) });
    return json({ success: true });
  }
  if (!body.id) return json({ error: 'id_required' }, 400);
  if (body.action === 'restore') {
    const entry = await env.DB.prepare('SELECT table_name, record_json, display_name FROM recycle_bin WHERE id = ?').bind(body.id).first<{ table_name: string; record_json: string; display_name: string }>();
    if (!entry) return json({ error: 'recycle_item_not_found' }, 404);
    await restoreRecycleEntry(env.DB, entry);
    await env.DB.prepare('DELETE FROM recycle_bin WHERE id = ?').bind(body.id).run();
    await addAudit(env.DB, { action: 'restored', entity_type: entry.table_name, entity_name: entry.display_name, details: { recycle_id: body.id }, performed_by: actorLabel(user) });
    return json({ success: true });
  }
  if (body.action === 'delete') {
    await env.DB.prepare('DELETE FROM recycle_bin WHERE id = ?').bind(body.id).run();
    return json({ success: true });
  }
  return json({ error: 'invalid_action' }, 400);
}

export default {
  async fetch(request: Request, env: AppEnv, ctx: ExecutionContext): Promise<Response> {
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
        if (user?.role === 'admin') ctx.waitUntil(ensureDailySnapshot(env));
        response = user ? json({ user }) : json({ error: 'unauthenticated' }, 401);
      } else if (url.pathname.startsWith('/api/data/')) {
        response = await handleDataApi(request, env, decodeURIComponent(url.pathname.slice('/api/data/'.length)));
      } else if (url.pathname === '/api/public/assets') {
        response = await publicAsset(request, env);
      } else if (url.pathname === '/api/agent/sync') {
        response = await handleAgentSync(request, env);
      } else if (url.pathname === '/api/admin/backup') {
        response = await handleBackup(request, env);
      } else if (url.pathname === '/api/admin/users') {
        response = await handleUsers(request, env);
      } else if (url.pathname === '/api/admin/snapshots') {
        response = await handleSnapshots(request, env);
      } else if (url.pathname === '/api/admin/recycle-bin') {
        response = await handleRecycleBin(request, env);
      } else if (url.pathname === '/api/functions/notify-incident') {
        const user = await getUser(request, env);
        if (!user) response = json({ error: 'unauthenticated' }, 401);
        else if (!requireRole(user, ['admin', 'technician'])) response = json({ error: 'forbidden' }, 403);
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
  async scheduled(_controller: ScheduledController, env: AppEnv, ctx: ExecutionContext) {
    ctx.waitUntil(ensureDailySnapshot(env));
  },
} satisfies ExportedHandler<AppEnv>;
