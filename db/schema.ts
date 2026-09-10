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
