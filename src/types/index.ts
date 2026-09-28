export type AssetStatus = 'active' | 'storage' | 'repair' | 'retired';
export type AssetType = 'Laptop' | 'Torre' | 'Server' | 'Printer' | 'Monitor' | 'Keyboard' | 'Mouse' | 'Dock' | 'Webcam' | 'Headset' | 'Projector' | 'Scanner' | 'UPS' | 'Peripheral' | 'Other';
export type IncidentStatus = 'open' | 'assigned' | 'in_progress' | 'waiting_user' | 'resolved' | 'closed';
export type IncidentPriority = 'low' | 'medium' | 'high' | 'critical';
export type MovementType = 'in' | 'out';
export type LicenseType = 'commercial' | 'oem' | 'volume' | 'freeware';

export interface Employee {
  id: string;
  name: string;
  email: string | null;
  department: string;
  position: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Asset {
  id: string;
  serial_number: string;
  name: string;
  asset_type: AssetType | string;
  brand: string;
  model: string;
  status: AssetStatus;
  location: string;
  purchase_date: string | null;
  purchase_value: number | null;
  warranty_expiry: string | null;
  end_of_life: string | null;
  operating_system: string;
  ip_address: string;
  mac_address: string;
  processor: string;
  ram_gb: number | null;
  storage_gb: number | null;
  last_inventory_at: string | null;
  parent_asset_id: string | null;
  screen_size: string;
  resolution: string;
  connection_type: string;
  toner_model: string;
  imei: string;
  sim_number: string;
  assigned_position: string;
  notes: string;
  image_url: string;
  created_at: string;
  updated_at: string;
  // joined
  current_employee?: Employee | null;
  parent_asset?: Asset | null;
}

export interface AssetAssignment {
  id: string;
  asset_id: string;
  employee_id: string | null;
  assigned_at: string;
  returned_at: string | null;
  notes: string;
  asset?: Asset;
  employee?: Employee;
}

export interface Incident {
  id: string;
  title: string;
  description: string;
  asset_id: string | null;
  employee_id: string | null;
  assigned_to_id: string | null;
  assigned_to_email?: string | null;
  assigned_to_name?: string | null;
  status: IncidentStatus;
  priority: IncidentPriority;
  resolution: string;
  due_at: string | null;
  started_at: string | null;
  resolved_at: string | null;
  opened_at: string;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
  asset?: Asset | null;
  employee?: Employee | null;
  assigned_to?: Employee | null;
}

export interface IncidentNotificationRecipient {
  id: string;
  email: string;
  name: string;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface IncidentComment {
  id: string;
  incident_id: string;
  author_name: string;
  body: string;
  internal: boolean;
  created_at: string;
}

export interface Software {
  id: string;
  name: string;
  vendor: string;
  category: string;
  version: string;
  notes: string;
  created_at: string;
  updated_at: string;
  licenses?: License[];
}

export interface License {
  id: string;
  software_id: string;
  license_key: string;
  license_type: LicenseType;
  seats: number;
  seats_used: number;
  purchase_date: string | null;
  expiry_date: string | null;
  cost: number | null;
  vendor_contact: string;
  notes: string;
  created_at: string;
  updated_at: string;
  software?: Software;
}

export interface LicenseAssignment {
  id: string;
  license_id: string;
  employee_id: string | null;
  asset_id: string | null;
  assigned_at: string;
  returned_at: string | null;
  notes: string;
  license?: License;
  employee?: Employee | null;
  asset?: Asset | null;
}

export interface Component {
  id: string;
  name: string;
  component_type: string;
  brand: string;
  model: string;
  stock: number;
  min_stock: number;
  location: string;
  unit_cost: number | null;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface ComponentMovement {
  id: string;
  component_id: string;
  movement_type: MovementType;
  quantity: number;
  reason: string;
  asset_id: string | null;
  moved_at: string;
  component?: Component;
  asset?: Asset | null;
}

export interface AuditLog {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  entity_name: string;
  details: Record<string, unknown>;
  performed_by: string;
  created_at: string;
}

export interface AIProcess {
  id: string; name: string; department: string; owner: string; description: string; current_pain: string;
  frequency: string; monthly_volume: number; minutes_per_case: number; impact_score: number; viability_score: number;
  opportunity_status: string; notes: string; created_at: string; updated_at: string;
}

export interface AIUseCase {
  id: string; code: string; title: string; process_id: string | null; category: string; objective: string;
  impact_score: number; viability_score: number; priority_score: number; status: string; responsible: string;
  start_date: string | null; end_date: string | null; risk_level: string; data_sensitivity: string;
  ethics_review: boolean; notes: string; created_at: string; updated_at: string;
}

export interface AIWorkItem {
  id: string; code: string; title: string; phase: string; subtasks: string; duration_days: number;
  start_date: string; end_date: string; status: string; progress: number; owner: string; depends_on: string;
  use_case_id: string | null; notes: string; created_at: string; updated_at: string;
}

export interface AIPilot {
  id: string; use_case_id: string | null; name: string; hypothesis: string; architecture: string; model_name: string;
  tools: string; status: string; version: string; repository_url: string; demo_url: string; baseline_minutes: number;
  current_minutes: number; accuracy: number; satisfaction: number; monthly_runs: number; monthly_cost: number;
  incidents_count: number; last_evaluation_at: string | null; notes: string; created_at: string; updated_at: string;
}

export interface AIIntegration {
  id: string; pilot_id: string | null; system_name: string; integration_type: string; data_direction: string;
  environment: string; status: string; owner: string; last_tested_at: string | null; notes: string;
  created_at: string; updated_at: string;
}

export interface AIKpi {
  id: string; use_case_id: string | null; pilot_id: string | null; name: string; unit: string;
  baseline_value: number; target_value: number; current_value: number; measurement_date: string | null;
  evidence_url: string; notes: string; created_at: string; updated_at: string;
}

export interface AIDeliverable {
  id: string; code: string; title: string; phase: string; deliverable_type: string; status: string;
  due_date: string | null; completed_at: string | null; owner: string; file_url: string; notes: string;
  created_at: string; updated_at: string;
}

export interface DashboardStats {
  totalAssets: number;
  activeAssets: number;
  repairAssets: number;
  retiredAssets: number;
  openIncidents: number;
  criticalIncidents: number;
  expiringLicenses: number;
  lowStockComponents: number;
  totalEmployees: number;
}
