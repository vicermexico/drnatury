-- ============================================================
-- Migration 005 — Citas
-- CLAUDE.md regla 4: toda operación sobre appointments corre
-- en transacción SQL con FOR UPDATE.
-- PRD §9: algoritmo de disponibilidad por bloques de 30 min.
-- ============================================================

CREATE TABLE appointments (
  id           UUID               PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id   UUID               NOT NULL REFERENCES profiles(id),
  branch_id    UUID               NOT NULL REFERENCES branches(id),
  service_id   UUID               NOT NULL REFERENCES services(id),
  therapist_id UUID               NOT NULL REFERENCES profiles(id),
  starts_at    TIMESTAMPTZ        NOT NULL,
  ends_at      TIMESTAMPTZ        NOT NULL,
  status       appointment_status NOT NULL DEFAULT 'PENDIENTE',
  -- Quién agendó la cita (paciente, terapeuta, asistente o master)
  created_by   UUID               NOT NULL REFERENCES profiles(id),
  notes        TEXT,
  -- Soft delete (CLAUDE.md regla 1)
  deleted_at   TIMESTAMPTZ,
  created_at   TIMESTAMPTZ        NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ        NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_ends_after_starts CHECK (ends_at > starts_at)
);

-- Índice principal para el algoritmo de disponibilidad (PRD §9):
-- busca citas activas en una sucursal dentro de un rango de tiempo.
CREATE INDEX idx_appointments_availability
  ON appointments(branch_id, starts_at, ends_at)
  WHERE status NOT IN ('CANCELADA', 'NO_ASISTIO') AND deleted_at IS NULL;

-- Índice para la vista del paciente
CREATE INDEX idx_appointments_patient
  ON appointments(patient_id, starts_at DESC)
  WHERE deleted_at IS NULL;

-- Índice para la agenda del terapeuta
CREATE INDEX idx_appointments_therapist
  ON appointments(therapist_id, starts_at DESC)
  WHERE deleted_at IS NULL;

CREATE TRIGGER trg_appointments_updated_at
  BEFORE UPDATE ON appointments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
