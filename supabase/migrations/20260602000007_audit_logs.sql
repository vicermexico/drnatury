-- ============================================================
-- Migration 007 — Bitácora de acciones
-- CLAUDE.md regla 6: audit log obligatorio en cancelación de
-- cita, registro de venta, ajuste de inventario y cambio de rol.
-- PRD §16: exclusiva para Alejandro, filtrable por sucursal.
-- ============================================================

CREATE TABLE audit_logs (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Quién realizó la acción (NULL si el sistema lo hizo de forma automática)
  user_id    UUID        REFERENCES profiles(id),
  action     TEXT        NOT NULL,
  branch_id  UUID        REFERENCES branches(id),
  metadata   JSONB       NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índice para el filtro Master por sucursal + fecha (PRD §16)
CREATE INDEX idx_audit_logs_branch_date
  ON audit_logs(branch_id, created_at DESC);

CREATE INDEX idx_audit_logs_user_date
  ON audit_logs(user_id, created_at DESC);

-- ── Trigger: audita cambios de estado en citas ───────────────
-- Se dispara al cambiar status a CANCELADA, NO_ASISTIO o COMPLETADA.
-- Usa auth.uid() cuando hay sesión activa; para operaciones
-- server-side con service role, pasar SET LOCAL app.current_user_id.
CREATE OR REPLACE FUNCTION fn_audit_appointment_status()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id UUID;
BEGIN
  v_user_id := COALESCE(
    auth.uid(),
    NULLIF(current_setting('app.current_user_id', true), '')::UUID
  );

  IF OLD.status IS DISTINCT FROM NEW.status
     AND NEW.status IN ('CANCELADA', 'NO_ASISTIO', 'COMPLETADA')
  THEN
    INSERT INTO audit_logs (user_id, action, branch_id, metadata)
    VALUES (
      v_user_id,
      'APPOINTMENT_' || NEW.status::TEXT,
      NEW.branch_id,
      jsonb_build_object(
        'appointment_id',   NEW.id,
        'patient_id',       NEW.patient_id,
        'therapist_id',     NEW.therapist_id,
        'starts_at',        NEW.starts_at,
        'previous_status',  OLD.status::TEXT
      )
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_audit_appointment_status
  AFTER UPDATE OF status ON appointments
  FOR EACH ROW EXECUTE FUNCTION fn_audit_appointment_status();

-- ── Trigger: audita cambios de rol en perfiles ───────────────
CREATE OR REPLACE FUNCTION fn_audit_role_change()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id UUID;
BEGIN
  v_user_id := COALESCE(
    auth.uid(),
    NULLIF(current_setting('app.current_user_id', true), '')::UUID
  );

  IF OLD.roles IS DISTINCT FROM NEW.roles THEN
    INSERT INTO audit_logs (user_id, action, branch_id, metadata)
    VALUES (
      v_user_id,
      'ROLE_CHANGE',
      NEW.branch_id,
      jsonb_build_object(
        'target_user_id',  NEW.id,
        'previous_roles',  to_jsonb(OLD.roles),
        'new_roles',       to_jsonb(NEW.roles)
      )
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_audit_role_change
  AFTER UPDATE OF roles ON profiles
  FOR EACH ROW EXECUTE FUNCTION fn_audit_role_change();
