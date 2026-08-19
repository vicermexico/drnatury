-- ============================================================
-- Migration 001 — Extensions, ENUMs y función set_updated_at
-- ============================================================

-- pgcrypto ya viene habilitado en Supabase; explicitamos por claridad
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Roles del sistema (PRD §5) ──────────────────────────────
CREATE TYPE user_role AS ENUM (
  'MASTER',
  'TERAPEUTA',
  'ASISTENTE',
  'ALMACENISTA',
  'PACIENTE'
);

-- ── Ciclo de vida de una cita (PRD §10) ─────────────────────
CREATE TYPE appointment_status AS ENUM (
  'PENDIENTE',
  'CONFIRMADA',
  'CANCELADA',
  'NO_ASISTIO',
  'COMPLETADA'
);

-- ── Tipos de movimiento de inventario (PRD §14) ─────────────
CREATE TYPE inventory_movement_type AS ENUM (
  'VENTA',
  'SURTIDO_ALMACEN',
  'RECIBO_SUCURSAL',
  'ENTRADA_PROVEEDOR'
);

-- ── Trigger reutilizable: mantiene updated_at al día ─────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
