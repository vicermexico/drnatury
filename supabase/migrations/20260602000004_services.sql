-- ============================================================
-- Migration 004 — Catálogo de servicios y precios por sucursal
-- PRD §8: precio fijo por sucursal, duración en múltiplos de 30 min.
-- ============================================================

-- Catálogo global de servicios
CREATE TABLE services (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name             TEXT        NOT NULL,
  -- Duración debe ser múltiplo de 30 min (PRD §8)
  duration_minutes INTEGER     NOT NULL CHECK (
    duration_minutes > 0 AND duration_minutes % 30 = 0
  ),
  -- Soft delete (CLAUDE.md regla 1)
  is_active        BOOLEAN     NOT NULL DEFAULT TRUE,
  deleted_at       TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_services_updated_at
  BEFORE UPDATE ON services
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Relación: qué servicios ofrece cada sucursal y a qué precio (PRD §8)
-- Una sucursal puede tener todos los servicios o solo algunos.
CREATE TABLE branch_services (
  branch_id  UUID           NOT NULL REFERENCES branches(id),
  service_id UUID           NOT NULL REFERENCES services(id),
  price      NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
  PRIMARY KEY (branch_id, service_id)
);

CREATE INDEX idx_branch_services_branch  ON branch_services(branch_id);
CREATE INDEX idx_branch_services_service ON branch_services(service_id);
