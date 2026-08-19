-- ============================================================
-- Migration 002 — Sucursales
-- Se crea antes que profiles porque profiles tiene FK a branches.
-- ============================================================

CREATE TABLE branches (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name                  TEXT        NOT NULL,
  address               TEXT        NOT NULL,
  lat                   NUMERIC(10, 7),
  lng                   NUMERIC(10, 7),
  -- Horario semanal en JSON:
  -- { monday: { open: bool, morning_start: "HH:MM", morning_end: "HH:MM",
  --             afternoon_start: "HH:MM", afternoon_end: "HH:MM" }, ... }
  schedule              JSONB       NOT NULL DEFAULT '{}',
  -- Número de personas atendidas en simultáneo por bloque de 30 min (PRD §9)
  simultaneous_capacity INTEGER     NOT NULL DEFAULT 1 CHECK (simultaneous_capacity > 0),
  -- Soft delete (CLAUDE.md regla 1)
  is_active             BOOLEAN     NOT NULL DEFAULT TRUE,
  deleted_at            TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_branches_updated_at
  BEFORE UPDATE ON branches
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
