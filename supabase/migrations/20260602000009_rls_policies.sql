-- ============================================================
-- Migration 009 — Row Level Security
-- Toda tabla tiene RLS habilitado. Las políticas usan has_role()
-- definido en migration 008.
-- ============================================================

-- ── Habilitar RLS en todas las tablas ───────────────────────
ALTER TABLE profiles           ENABLE ROW LEVEL SECURITY;
ALTER TABLE branches           ENABLE ROW LEVEL SECURITY;
ALTER TABLE services           ENABLE ROW LEVEL SECURITY;
ALTER TABLE branch_services    ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments       ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_numbers   ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings           ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs         ENABLE ROW LEVEL SECURITY;

-- ── profiles ─────────────────────────────────────────────────
-- SELECT: propio perfil o Master ve todos los activos
CREATE POLICY "profiles_select"
  ON profiles FOR SELECT
  USING (
    id = auth.uid()
    OR has_role('MASTER')
  );

-- INSERT: registro público (paciente nuevo) o Master alta staff
CREATE POLICY "profiles_insert"
  ON profiles FOR INSERT
  WITH CHECK (
    id = auth.uid()
    OR has_role('MASTER')
  );

-- UPDATE: propio perfil o Master (soft delete incluido)
CREATE POLICY "profiles_update"
  ON profiles FOR UPDATE
  USING (id = auth.uid() OR has_role('MASTER'))
  WITH CHECK (id = auth.uid() OR has_role('MASTER'));

-- ── branches ─────────────────────────────────────────────────
CREATE POLICY "branches_select"
  ON branches FOR SELECT
  USING (
    (is_active = TRUE AND deleted_at IS NULL)
    OR has_role('MASTER')
  );

CREATE POLICY "branches_write"
  ON branches FOR ALL
  USING (has_role('MASTER'))
  WITH CHECK (has_role('MASTER'));

-- ── services ─────────────────────────────────────────────────
CREATE POLICY "services_select"
  ON services FOR SELECT
  USING (
    (is_active = TRUE AND deleted_at IS NULL)
    OR has_role('MASTER')
  );

CREATE POLICY "services_write"
  ON services FOR ALL
  USING (has_role('MASTER'))
  WITH CHECK (has_role('MASTER'));

-- ── branch_services ──────────────────────────────────────────
CREATE POLICY "branch_services_select"
  ON branch_services FOR SELECT
  USING (TRUE);  -- Todos los autenticados pueden ver el catálogo

CREATE POLICY "branch_services_write"
  ON branch_services FOR ALL
  USING (has_role('MASTER'))
  WITH CHECK (has_role('MASTER'));

-- ── appointments ─────────────────────────────────────────────
CREATE POLICY "appointments_select"
  ON appointments FOR SELECT
  USING (
    patient_id   = auth.uid()   -- paciente ve sus propias citas
    OR has_role('MASTER')
    OR has_role('ASISTENTE')
    OR (has_role('TERAPEUTA') AND therapist_id = auth.uid())
  );

CREATE POLICY "appointments_insert"
  ON appointments FOR INSERT
  WITH CHECK (
    has_any_role(ARRAY['MASTER','ASISTENTE','TERAPEUTA','PACIENTE']::user_role[])
  );

CREATE POLICY "appointments_update"
  ON appointments FOR UPDATE
  USING (
    has_role('MASTER')
    OR has_role('ASISTENTE')
    OR (has_role('TERAPEUTA') AND therapist_id = auth.uid())
    OR (has_role('PACIENTE')  AND patient_id   = auth.uid())
  )
  WITH CHECK (
    has_role('MASTER')
    OR has_role('ASISTENTE')
    OR (has_role('TERAPEUTA') AND therapist_id = auth.uid())
    OR (has_role('PACIENTE')  AND patient_id   = auth.uid())
  );

-- ── whatsapp_templates ───────────────────────────────────────
-- Lectura: todos los autenticados (necesitan los templates para enviar)
-- Escritura: solo Master
CREATE POLICY "wt_select"
  ON whatsapp_templates FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "wt_write"
  ON whatsapp_templates FOR ALL
  USING (has_role('MASTER'))
  WITH CHECK (has_role('MASTER'));

-- ── whatsapp_numbers ─────────────────────────────────────────
CREATE POLICY "wn_master_only"
  ON whatsapp_numbers FOR ALL
  USING (has_role('MASTER'))
  WITH CHECK (has_role('MASTER'));

-- ── settings ─────────────────────────────────────────────────
CREATE POLICY "settings_select"
  ON settings FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "settings_write"
  ON settings FOR ALL
  USING (has_role('MASTER'))
  WITH CHECK (has_role('MASTER'));

-- ── audit_logs ───────────────────────────────────────────────
-- Solo Master puede leer (PRD §16)
-- Escritura exclusiva vía triggers SECURITY DEFINER
CREATE POLICY "audit_select_master"
  ON audit_logs FOR SELECT
  USING (has_role('MASTER'));
