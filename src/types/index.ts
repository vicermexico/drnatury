export type Role = "MASTER" | "TERAPEUTA" | "ASISTENTE" | "ALMACENISTA" | "PACIENTE";

export type AppointmentStatus =
  | "PENDIENTE"
  | "CONFIRMADA"
  | "CANCELADA"
  | "NO_ASISTIO"
  | "COMPLETADA";

export type InventoryMovementType =
  | "VENTA"
  | "SURTIDO_ALMACEN"
  | "RECIBO_SUCURSAL"
  | "ENTRADA_PROVEEDOR";

export interface User {
  id: string;
  phone: string;
  name: string;
  roles: Role[];
  branch_id?: string;
  is_active: boolean;
  created_at: string;
}

export interface Branch {
  id: string;
  name: string;
  address: string;
  lat?: number;
  lng?: number;
  schedule: WeeklySchedule;
  simultaneous_capacity: number;
  is_active: boolean;
  created_at: string;
}

export interface WeeklySchedule {
  monday?: DaySchedule;
  tuesday?: DaySchedule;
  wednesday?: DaySchedule;
  thursday?: DaySchedule;
  friday?: DaySchedule;
  saturday?: DaySchedule;
  sunday?: DaySchedule;
}

export interface DaySchedule {
  open: boolean;
  morning_start?: string;
  morning_end?: string;
  afternoon_start?: string;
  afternoon_end?: string;
}

export interface Service {
  id: string;
  name: string;
  duration_minutes: number;
  is_active: boolean;
}

export interface BranchService {
  branch_id: string;
  service_id: string;
  price: number;
}

export interface Appointment {
  id: string;
  patient_id: string;
  branch_id: string;
  service_id: string;
  therapist_id: string;
  starts_at: string;
  ends_at: string;
  status: AppointmentStatus;
  created_by: string;
  created_at: string;
}

export interface Product {
  id: string;
  name: string;
  image_url?: string;
  min_weekly_quantity: number;
  is_active: boolean;
}

export interface InventoryItem {
  id: string;
  product_id: string;
  branch_id?: string;
  is_warehouse: boolean;
  quantity: number;
  updated_at: string;
}

export interface InventoryMovement {
  id: string;
  product_id: string;
  branch_id?: string;
  type: InventoryMovementType;
  quantity_before: number;
  quantity_after: number;
  performed_by: string;
  performed_at: string;
}

export interface WhatsAppTemplate {
  id: string;
  key: string;
  body: string;
  updated_at: string;
}

export interface AuditLog {
  id: string;
  user_id: string;
  action: string;
  branch_id?: string;
  metadata: Record<string, unknown>;
  created_at: string;
}
