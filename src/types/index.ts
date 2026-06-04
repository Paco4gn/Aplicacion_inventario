export type AssetStatus = 'active' | 'storage' | 'repair' | 'retired';
export type AssetType = 'Laptop' | 'Torre' | 'Server' | 'Printer' | 'Monitor' | 'Keyboard' | 'Mouse' | 'Dock' | 'Webcam' | 'Headset' | 'Projector' | 'Scanner' | 'UPS' | 'Peripheral' | 'Other';
export type IncidentStatus = 'open' | 'in_progress' | 'resolved' | 'closed';
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
