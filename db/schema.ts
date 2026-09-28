import { index, integer, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

const timestamps = {
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
};

export const employees = sqliteTable('employees', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email'),
  department: text('department').notNull().default(''),
  position: text('position').notNull().default(''),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
  ...timestamps,
}, (table) => [index('employees_name_idx').on(table.name), index('employees_active_idx').on(table.active)]);

export const assets = sqliteTable('assets', {
  id: text('id').primaryKey(),
  serialNumber: text('serial_number').notNull(),
  name: text('name').notNull().default(''),
  assetType: text('asset_type').notNull().default('Other'),
  brand: text('brand').notNull().default(''),
  model: text('model').notNull().default(''),
  status: text('status').notNull().default('active'),
  location: text('location').notNull().default(''),
  purchaseDate: text('purchase_date'),
  purchaseValue: real('purchase_value'),
  warrantyExpiry: text('warranty_expiry'),
  endOfLife: text('end_of_life'),
  operatingSystem: text('operating_system').notNull().default(''),
  ipAddress: text('ip_address').notNull().default(''),
  macAddress: text('mac_address').notNull().default(''),
  processor: text('processor').notNull().default(''),
  ramGb: real('ram_gb'),
  storageGb: real('storage_gb'),
  lastInventoryAt: text('last_inventory_at'),
  parentAssetId: text('parent_asset_id'),
  screenSize: text('screen_size').notNull().default(''),
  resolution: text('resolution').notNull().default(''),
  connectionType: text('connection_type').notNull().default(''),
  tonerModel: text('toner_model').notNull().default(''),
  imei: text('imei').notNull().default(''),
  simNumber: text('sim_number').notNull().default(''),
  assignedPosition: text('assigned_position').notNull().default(''),
  notes: text('notes').notNull().default(''),
  imageUrl: text('image_url').notNull().default(''),
  ...timestamps,
}, (table) => [
  uniqueIndex('assets_serial_number_uidx').on(table.serialNumber),
  index('assets_status_idx').on(table.status),
  index('assets_parent_asset_idx').on(table.parentAssetId),
]);

export const assetAssignments = sqliteTable('asset_assignments', {
  id: text('id').primaryKey(),
  assetId: text('asset_id').notNull(),
  employeeId: text('employee_id'),
  assignedAt: text('assigned_at').notNull(),
  returnedAt: text('returned_at'),
  notes: text('notes').notNull().default(''),
}, (table) => [index('asset_assignments_asset_idx').on(table.assetId), index('asset_assignments_employee_idx').on(table.employeeId)]);

export const incidents = sqliteTable('incidents', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  description: text('description').notNull().default(''),
  assetId: text('asset_id'),
  employeeId: text('employee_id'),
  assignedToId: text('assigned_to_id'),
  assignedToEmail: text('assigned_to_email'),
  assignedToName: text('assigned_to_name'),
  status: text('status').notNull().default('open'),
  priority: text('priority').notNull().default('medium'),
  resolution: text('resolution').notNull().default(''),
  dueAt: text('due_at'),
  startedAt: text('started_at'),
  resolvedAt: text('resolved_at'),
  openedAt: text('opened_at').notNull(),
  closedAt: text('closed_at'),
  ...timestamps,
}, (table) => [
  index('incidents_status_idx').on(table.status),
  index('incidents_asset_idx').on(table.assetId),
  index('incidents_due_at_idx').on(table.dueAt),
  index('incidents_assigned_email_idx').on(table.assignedToEmail),
]);

export const incidentNotificationRecipients = sqliteTable('incident_notification_recipients', {
  id: text('id').primaryKey(),
  email: text('email').notNull(),
  name: text('name').notNull().default(''),
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
  ...timestamps,
}, (table) => [uniqueIndex('incident_recipients_email_uidx').on(table.email)]);

export const incidentComments = sqliteTable('incident_comments', {
  id: text('id').primaryKey(),
  incidentId: text('incident_id').notNull(),
  authorName: text('author_name').notNull().default('informatica'),
  body: text('body').notNull(),
  internal: integer('internal', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').notNull(),
}, (table) => [index('incident_comments_incident_idx').on(table.incidentId, table.createdAt)]);

export const software = sqliteTable('software', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  vendor: text('vendor').notNull().default(''),
  category: text('category').notNull().default(''),
  version: text('version').notNull().default(''),
  notes: text('notes').notNull().default(''),
  ...timestamps,
}, (table) => [index('software_name_idx').on(table.name)]);

export const licenses = sqliteTable('licenses', {
  id: text('id').primaryKey(),
  softwareId: text('software_id').notNull(),
  licenseKey: text('license_key').notNull().default(''),
  licenseType: text('license_type').notNull().default('commercial'),
  seats: integer('seats').notNull().default(1),
  seatsUsed: integer('seats_used').notNull().default(0),
  purchaseDate: text('purchase_date'),
  expiryDate: text('expiry_date'),
  cost: real('cost'),
  vendorContact: text('vendor_contact').notNull().default(''),
  notes: text('notes').notNull().default(''),
  ...timestamps,
}, (table) => [index('licenses_software_idx').on(table.softwareId), index('licenses_expiry_idx').on(table.expiryDate)]);

export const licenseAssignments = sqliteTable('license_assignments', {
  id: text('id').primaryKey(),
  licenseId: text('license_id').notNull(),
  employeeId: text('employee_id'),
  assetId: text('asset_id'),
  assignedAt: text('assigned_at').notNull(),
  returnedAt: text('returned_at'),
  notes: text('notes').notNull().default(''),
}, (table) => [
  index('license_assignments_license_idx').on(table.licenseId),
  index('license_assignments_employee_idx').on(table.employeeId),
  index('license_assignments_asset_idx').on(table.assetId),
]);

export const components = sqliteTable('components', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  componentType: text('component_type').notNull().default(''),
  brand: text('brand').notNull().default(''),
  model: text('model').notNull().default(''),
  stock: integer('stock').notNull().default(0),
  minStock: integer('min_stock').notNull().default(1),
  location: text('location').notNull().default(''),
  unitCost: real('unit_cost'),
  notes: text('notes').notNull().default(''),
  ...timestamps,
}, (table) => [index('components_name_idx').on(table.name)]);

export const componentMovements = sqliteTable('component_movements', {
  id: text('id').primaryKey(),
  componentId: text('component_id').notNull(),
  movementType: text('movement_type').notNull(),
  quantity: integer('quantity').notNull(),
  reason: text('reason').notNull().default(''),
  assetId: text('asset_id'),
  movedAt: text('moved_at').notNull(),
}, (table) => [index('component_movements_component_idx').on(table.componentId)]);

export const auditLogs = sqliteTable('audit_logs', {
  id: text('id').primaryKey(),
  action: text('action').notNull(),
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id'),
  entityName: text('entity_name').notNull().default(''),
  details: text('details').notNull().default('{}'),
  performedBy: text('performed_by').notNull().default(''),
  createdAt: text('created_at').notNull(),
}, (table) => [index('audit_logs_entity_idx').on(table.entityType, table.entityId), index('audit_logs_created_idx').on(table.createdAt)]);

export const appUsers = sqliteTable('app_users', {
  id: text('id').primaryKey(), name: text('name').notNull(), email: text('email').notNull(), role: text('role').notNull().default('viewer'),
  tokenHash: text('token_hash').notNull(), tokenHint: text('token_hint').notNull().default(''), active: integer('active', { mode: 'boolean' }).notNull().default(true),
  ...timestamps, lastLoginAt: text('last_login_at'),
}, (table) => [uniqueIndex('app_users_email_uidx').on(table.email), uniqueIndex('app_users_token_hash_uidx').on(table.tokenHash), index('app_users_active_idx').on(table.active, table.role)]);

export const inventorySnapshots = sqliteTable('inventory_snapshots', {
  id: text('id').primaryKey(), label: text('label').notNull(), dataJson: text('data_json').notNull(), countsJson: text('counts_json').notNull().default('{}'),
  automatic: integer('automatic', { mode: 'boolean' }).notNull().default(false), createdBy: text('created_by').notNull().default(''), createdAt: text('created_at').notNull(),
}, (table) => [index('inventory_snapshots_created_idx').on(table.createdAt)]);

export const recycleBin = sqliteTable('recycle_bin', {
  id: text('id').primaryKey(), tableName: text('table_name').notNull(), recordId: text('record_id').notNull(), displayName: text('display_name').notNull().default(''),
  recordJson: text('record_json').notNull(), deletedBy: text('deleted_by').notNull().default(''), deletedAt: text('deleted_at').notNull(),
}, (table) => [index('recycle_bin_deleted_idx').on(table.deletedAt), index('recycle_bin_record_idx').on(table.tableName, table.recordId)]);

export const aiProcesses = sqliteTable('ai_processes', {
  id: text('id').primaryKey(), name: text('name').notNull(), department: text('department').notNull().default(''), owner: text('owner').notNull().default(''),
  description: text('description').notNull().default(''), currentPain: text('current_pain').notNull().default(''), frequency: text('frequency').notNull().default(''),
  monthlyVolume: real('monthly_volume').notNull().default(0), minutesPerCase: real('minutes_per_case').notNull().default(0), impactScore: integer('impact_score').notNull().default(3),
  viabilityScore: integer('viability_score').notNull().default(3), opportunityStatus: text('opportunity_status').notNull().default('discovered'), notes: text('notes').notNull().default(''), ...timestamps,
}, (table) => [index('ai_processes_department_idx').on(table.department)]);

export const aiUseCases = sqliteTable('ai_use_cases', {
  id: text('id').primaryKey(), code: text('code').notNull().default(''), title: text('title').notNull(), processId: text('process_id'), category: text('category').notNull().default('assistant'),
  objective: text('objective').notNull().default(''), impactScore: integer('impact_score').notNull().default(3), viabilityScore: integer('viability_score').notNull().default(3),
  priorityScore: real('priority_score').notNull().default(9), status: text('status').notNull().default('idea'), responsible: text('responsible').notNull().default(''),
  startDate: text('start_date'), endDate: text('end_date'), riskLevel: text('risk_level').notNull().default('medium'), dataSensitivity: text('data_sensitivity').notNull().default('internal'),
  ethicsReview: integer('ethics_review', { mode: 'boolean' }).notNull().default(false), notes: text('notes').notNull().default(''), ...timestamps,
}, (table) => [index('ai_use_cases_status_idx').on(table.status, table.priorityScore), index('ai_use_cases_process_idx').on(table.processId)]);

export const aiWorkItems = sqliteTable('ai_work_items', {
  id: text('id').primaryKey(), code: text('code').notNull(), title: text('title').notNull(), phase: text('phase').notNull(), subtasks: text('subtasks').notNull().default(''),
  durationDays: integer('duration_days').notNull().default(0), startDate: text('start_date').notNull(), endDate: text('end_date').notNull(), status: text('status').notNull().default('planned'),
  progress: integer('progress').notNull().default(0), owner: text('owner').notNull().default(''), dependsOn: text('depends_on').notNull().default(''), useCaseId: text('use_case_id'),
  notes: text('notes').notNull().default(''), ...timestamps,
}, (table) => [uniqueIndex('ai_work_items_code_uidx').on(table.code), index('ai_work_items_dates_idx').on(table.startDate, table.endDate)]);

export const aiPilots = sqliteTable('ai_pilots', {
  id: text('id').primaryKey(), useCaseId: text('use_case_id'), name: text('name').notNull(), hypothesis: text('hypothesis').notNull().default(''), architecture: text('architecture').notNull().default(''),
  modelName: text('model_name').notNull().default(''), tools: text('tools').notNull().default(''), status: text('status').notNull().default('design'), version: text('version').notNull().default('0.1'),
  repositoryUrl: text('repository_url').notNull().default(''), demoUrl: text('demo_url').notNull().default(''), baselineMinutes: real('baseline_minutes').notNull().default(0),
  currentMinutes: real('current_minutes').notNull().default(0), accuracy: real('accuracy').notNull().default(0), satisfaction: real('satisfaction').notNull().default(0),
  monthlyRuns: integer('monthly_runs').notNull().default(0), monthlyCost: real('monthly_cost').notNull().default(0), incidentsCount: integer('incidents_count').notNull().default(0),
  lastEvaluationAt: text('last_evaluation_at'), notes: text('notes').notNull().default(''), ...timestamps,
}, (table) => [index('ai_pilots_use_case_idx').on(table.useCaseId, table.status)]);

export const aiIntegrations = sqliteTable('ai_integrations', {
  id: text('id').primaryKey(), pilotId: text('pilot_id'), systemName: text('system_name').notNull(), integrationType: text('integration_type').notNull().default('api'),
  dataDirection: text('data_direction').notNull().default('bidirectional'), environment: text('environment').notNull().default('test'), status: text('status').notNull().default('planned'),
  owner: text('owner').notNull().default(''), lastTestedAt: text('last_tested_at'), notes: text('notes').notNull().default(''), ...timestamps,
}, (table) => [index('ai_integrations_pilot_idx').on(table.pilotId, table.status)]);

export const aiKpis = sqliteTable('ai_kpis', {
  id: text('id').primaryKey(), useCaseId: text('use_case_id'), pilotId: text('pilot_id'), name: text('name').notNull(), unit: text('unit').notNull().default('%'),
  baselineValue: real('baseline_value').notNull().default(0), targetValue: real('target_value').notNull().default(0), currentValue: real('current_value').notNull().default(0),
  measurementDate: text('measurement_date'), evidenceUrl: text('evidence_url').notNull().default(''), notes: text('notes').notNull().default(''), ...timestamps,
}, (table) => [index('ai_kpis_pilot_idx').on(table.pilotId, table.measurementDate)]);

export const aiDeliverables = sqliteTable('ai_deliverables', {
  id: text('id').primaryKey(), code: text('code').notNull().default(''), title: text('title').notNull(), phase: text('phase').notNull().default(''),
  deliverableType: text('deliverable_type').notNull().default('document'), status: text('status').notNull().default('planned'), dueDate: text('due_date'), completedAt: text('completed_at'),
  owner: text('owner').notNull().default(''), fileUrl: text('file_url').notNull().default(''), notes: text('notes').notNull().default(''), ...timestamps,
}, (table) => [index('ai_deliverables_due_idx').on(table.status, table.dueDate)]);
