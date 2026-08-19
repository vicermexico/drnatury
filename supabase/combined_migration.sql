-- ================================================================
-- FILE: 20260602000001_extensions_and_types.sql
-- ================================================================

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


-- ================================================================
-- FILE: 20260602000002_branches.sql
-- ================================================================

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


-- ================================================================
-- FILE: 20260602000003_profiles.sql
-- ================================================================

-- ============================================================
-- Migration 003 — Perfiles de usuario
-- Extiende auth.users con datos de dominio.
-- Cubre todos los roles: MASTER, TERAPEUTA, ASISTENTE,
-- ALMACENISTA y PACIENTE (campos de paciente son nullable para staff).
-- ============================================================

CREATE TABLE profiles (
  -- Clave primaria = mismo UUID que auth.users
  id          UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  phone       TEXT        UNIQUE NOT NULL,
  name        TEXT        NOT NULL,

  -- Campos del formulario de registro de paciente (PRD §19)
  address     TEXT,
  age         INTEGER     CHECK (age > 0 AND age < 150),
  sex         TEXT        CHECK (sex IN ('M', 'F', 'OTRO')),
  city        TEXT,
  email       TEXT,
  consultation_reason TEXT,

  -- Roles: un usuario puede tener hasta 2 roles (PRD §5.1)
  roles       user_role[] NOT NULL DEFAULT '{}',

  -- Sucursal asignada (aplica a TERAPEUTA; nullable para otros)
  branch_id   UUID        REFERENCES branches(id),

  -- Soft delete — LFPDPPP: suspensión, no borrado permanente (PRD §12, §20)
  is_active   BOOLEAN     NOT NULL DEFAULT TRUE,
  deleted_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_profiles_phone  ON profiles(phone);
CREATE INDEX idx_profiles_roles  ON profiles USING GIN(roles);
CREATE INDEX idx_profiles_branch ON profiles(branch_id) WHERE branch_id IS NOT NULL;

CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ================================================================
-- FILE: 20260602000004_services.sql
-- ================================================================

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


-- ================================================================
-- FILE: 20260602000005_appointments.sql
-- ================================================================

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


-- ================================================================
-- FILE: 20260602000006_whatsapp.sql
-- ================================================================

-- ============================================================
-- Migration 006 — WhatsApp: templates, números y configuración
-- CLAUDE.md regla 7: templates NUNCA hardcoded, siempre desde
-- esta tabla.
-- PRD §18: rotación circular de hasta 4 números (Modo A).
-- ============================================================

-- Templates de mensajes — Alejandro los edita desde el Master
CREATE TABLE whatsapp_templates (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Clave única que identifica el mensaje en el código
  key         TEXT        UNIQUE NOT NULL,
  body        TEXT        NOT NULL,
  description TEXT,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Hasta 4 números para rotación circular (PRD §18)
-- display_order determina el orden de rotación (0, 1, 2, 3)
CREATE TABLE whatsapp_numbers (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  phone         TEXT        UNIQUE NOT NULL,
  is_active     BOOLEAN     NOT NULL DEFAULT TRUE,
  last_used_at  TIMESTAMPTZ,
  display_order INTEGER     NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_whatsapp_numbers_active
  ON whatsapp_numbers(display_order)
  WHERE is_active = TRUE;

-- Configuración global de la aplicación (clave-valor)
CREATE TABLE settings (
  key        TEXT        PRIMARY KEY,
  value      TEXT        NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Valores iniciales
INSERT INTO settings (key, value) VALUES
  -- Modo activo de WhatsApp: WAWEB = whatsapp-web.js (Modo A)
  --                          CLOUD_API = WhatsApp Cloud API oficial (Modo B)
  ('whatsapp_mode',            'WAWEB'),
  -- Índice del último número usado en la rotación circular
  ('whatsapp_rotation_index',  '0');


-- ================================================================
-- FILE: 20260602000007_audit_logs.sql
-- ================================================================

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


-- ================================================================
-- FILE: 20260602000008_functions.sql
-- ================================================================

-- ============================================================
-- Migration 008 — Funciones de utilidad
-- ============================================================

-- ── Helpers de RLS ───────────────────────────────────────────

-- Devuelve los roles del usuario actual (cacheable en la sesión)
CREATE OR REPLACE FUNCTION get_my_roles()
RETURNS user_role[] AS $$
  SELECT roles FROM profiles WHERE id = auth.uid();
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- True si el usuario actual tiene el rol indicado
CREATE OR REPLACE FUNCTION has_role(r user_role)
RETURNS BOOLEAN AS $$
  SELECT r = ANY(get_my_roles());
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- True si el usuario actual tiene alguno de los roles indicados
CREATE OR REPLACE FUNCTION has_any_role(r user_role[])
RETURNS BOOLEAN AS $$
  SELECT get_my_roles() && r;
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- ── Disponibilidad de citas (PRD §9) ────────────────────────
-- Devuelve TRUE si todos los bloques de 30 min entre p_starts_at
-- y p_ends_at tienen capacidad disponible en la sucursal.
-- Llamar dentro de una transacción con FOR UPDATE para garantizar
-- consistencia ante concurrencia (CLAUDE.md regla 4).
CREATE OR REPLACE FUNCTION check_slot_available(
  p_branch_id UUID,
  p_starts_at TIMESTAMPTZ,
  p_ends_at   TIMESTAMPTZ
)
RETURNS BOOLEAN AS $$
DECLARE
  v_capacity    INTEGER;
  v_overlap_cnt INTEGER;
  v_slot        TIMESTAMPTZ;
BEGIN
  SELECT simultaneous_capacity INTO v_capacity
  FROM branches
  WHERE id = p_branch_id AND is_active = TRUE AND deleted_at IS NULL;

  IF v_capacity IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Verifica cada bloque de 30 min que ocupa el servicio
  v_slot := p_starts_at;
  WHILE v_slot < p_ends_at LOOP
    SELECT COUNT(*) INTO v_overlap_cnt
    FROM appointments
    WHERE branch_id   = p_branch_id
      AND deleted_at  IS NULL
      AND status      NOT IN ('CANCELADA', 'NO_ASISTIO')
      AND starts_at   < v_slot + INTERVAL '30 minutes'
      AND ends_at     > v_slot;

    IF v_overlap_cnt >= v_capacity THEN
      RETURN FALSE;
    END IF;

    v_slot := v_slot + INTERVAL '30 minutes';
  END LOOP;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ── Próximos horarios disponibles (sugerencia tras colisión) ─
-- Devuelve hasta p_limit slots disponibles a partir de p_from
-- en incrementos de 30 min (PRD §9: "sugerencia de horarios cercanos").
CREATE OR REPLACE FUNCTION next_available_slots(
  p_branch_id      UUID,
  p_service_id     UUID,
  p_from           TIMESTAMPTZ,
  p_limit          INTEGER DEFAULT 3
)
RETURNS TABLE (slot_start TIMESTAMPTZ, slot_end TIMESTAMPTZ) AS $$
DECLARE
  v_duration  INTERVAL;
  v_candidate TIMESTAMPTZ;
  v_found     INTEGER := 0;
BEGIN
  SELECT (duration_minutes || ' minutes')::INTERVAL INTO v_duration
  FROM services WHERE id = p_service_id;

  IF v_duration IS NULL THEN
    RETURN;
  END IF;

  v_candidate := p_from;

  WHILE v_found < p_limit LOOP
    IF check_slot_available(p_branch_id, v_candidate, v_candidate + v_duration) THEN
      slot_start := v_candidate;
      slot_end   := v_candidate + v_duration;
      RETURN NEXT;
      v_found := v_found + 1;
    END IF;
    v_candidate := v_candidate + INTERVAL '30 minutes';

    -- Evita loop infinito: no buscar más allá de 30 días
    IF v_candidate > p_from + INTERVAL '30 days' THEN
      EXIT;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;


-- ================================================================
-- FILE: 20260602000009_rls_policies.sql
-- ================================================================

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


-- ================================================================
-- FILE: 20260602000010_seed_templates.sql
-- ================================================================

-- ============================================================
-- Migration 010 — Seed: templates de WhatsApp
-- CLAUDE.md regla 7: templates siempre desde esta tabla.
-- Alejandro puede editarlos desde el Master; estos son los
-- valores iniciales con variables {{placeholder}}.
-- ============================================================

INSERT INTO whatsapp_templates (key, body, description) VALUES

(
  'appointment_booked',
  E'Hola {{patient_name}} 👋\n\nTu cita en *DrNatury {{branch_name}}* quedó agendada.\n\n📅 {{date}}\n⏰ {{time}}\n👩‍⚕️ {{therapist_name}}\n📍 {{address}}\n\nConfirma o cancela tu cita:\n{{confirm_url}}',
  'Mensaje al paciente al agendar una cita'
),

(
  'appointment_reminder',
  E'Hola {{patient_name}}, te recordamos tu cita mañana.\n\n📅 {{date}} a las {{time}}\n🏥 DrNatury {{branch_name}}\n👩‍⚕️ {{therapist_name}}\n\n¿Confirmas tu asistencia?\n{{confirm_url}}',
  'Recordatorio antes de la cita — tiempo configurable por Alejandro'
),

(
  'appointment_cancelled',
  E'Hola {{patient_name}},\n\nTu cita del {{date}} a las {{time}} en DrNatury *{{branch_name}}* ha sido cancelada.\n\nPara agendar una nueva cita entra a:\n{{app_url}}',
  'Se envía a paciente, Alejandro y terapeuta al cancelarse una cita'
),

(
  'appointment_confirmed_notify',
  E'Confirmación recibida ✅\n\n*{{patient_name}}* confirmó su cita del {{date}} a las {{time}} en {{branch_name}}.',
  'Notificación a Alejandro y terapeuta cuando el paciente confirma'
),

(
  'appointment_cancelled_by_patient',
  E'El paciente *{{patient_name}}* canceló su cita del {{date}} a las {{time}} en {{branch_name}}.',
  'Notificación a Alejandro y terapeuta cuando el paciente cancela'
),

(
  'appointment_auto_cancelled',
  E'Hola {{patient_name}},\n\nTu cita del {{date}} fue cancelada automáticamente porque no recibimos tu confirmación.\n\nPara reagendar: {{app_url}}',
  'Cancelación automática por no respuesta — configurable por recordatorio'
),

(
  'low_stock_alert',
  E'⚠️ *Alerta de inventario*\n\n*{{product_name}}* en sucursal *{{branch_name}}* tiene solo {{quantity}} unidades.\nMínimo semanal: {{min_quantity}}.',
  'Alerta a Alejandro cuando un producto baja del mínimo'
),

(
  'supply_request',
  E'📦 *Solicitud de mercancía*\n\nDe: {{therapist_name}} ({{branch_name}})\n\n{{products_list}}\n\nVer detalle:\n{{detail_url}}',
  'Solicitud de mercancía a Alejandro y Almacenista'
);


-- ================================================================
-- FILE: 20260602000011_book_appointment.sql
-- ================================================================

-- ============================================================
-- Migration 011 — Función transaccional de agendado
-- CLAUDE.md regla 4: toda operación sobre appointments corre
-- en transacción SQL con FOR UPDATE para garantizar que no
-- haya doble-booking ante concurrencia.
-- ============================================================

CREATE OR REPLACE FUNCTION book_appointment(
  p_patient_id   UUID,
  p_branch_id    UUID,
  p_service_id   UUID,
  p_starts_at    TIMESTAMPTZ,
  p_ends_at      TIMESTAMPTZ,
  p_created_by   UUID,
  -- Si es NULL el sistema auto-asigna la primera terapeuta disponible
  p_therapist_id UUID DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_capacity    INTEGER;
  v_slot        TIMESTAMPTZ;
  v_overlap_cnt INTEGER;
  v_appt_id     UUID;
BEGIN
  -- Bloquea la sucursal durante esta transacción para evitar lecturas sucias
  SELECT simultaneous_capacity INTO v_capacity
  FROM   branches
  WHERE  id         = p_branch_id
    AND  is_active  = TRUE
    AND  deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('error', 'BRANCH_NOT_FOUND');
  END IF;

  -- Auto-asignación de terapeuta si no se especificó una
  IF p_therapist_id IS NULL THEN
    SELECT id INTO p_therapist_id
    FROM   profiles
    WHERE  branch_id  = p_branch_id
      AND  'TERAPEUTA' = ANY(roles)
      AND  is_active  = TRUE
      AND  deleted_at IS NULL
    ORDER BY created_at
    LIMIT 1;

    IF p_therapist_id IS NULL THEN
      RETURN json_build_object('error', 'NO_THERAPIST');
    END IF;
  END IF;

  -- Verifica capacidad bloque a bloque (30 min cada uno) con FOR UPDATE
  v_slot := p_starts_at;
  WHILE v_slot < p_ends_at LOOP
    SELECT COUNT(*) INTO v_overlap_cnt
    FROM   appointments
    WHERE  branch_id  = p_branch_id
      AND  deleted_at IS NULL
      AND  status     NOT IN ('CANCELADA', 'NO_ASISTIO')
      AND  starts_at  < v_slot + INTERVAL '30 minutes'
      AND  ends_at    > v_slot
    FOR UPDATE;

    IF v_overlap_cnt >= v_capacity THEN
      RETURN json_build_object('error', 'SLOT_TAKEN');
    END IF;

    v_slot := v_slot + INTERVAL '30 minutes';
  END LOOP;

  -- Inserta la cita
  INSERT INTO appointments (
    patient_id, branch_id, service_id, therapist_id,
    starts_at, ends_at, status, created_by
  ) VALUES (
    p_patient_id, p_branch_id, p_service_id, p_therapist_id,
    p_starts_at, p_ends_at, 'PENDIENTE', p_created_by
  )
  RETURNING id INTO v_appt_id;

  RETURN json_build_object(
    'id',           v_appt_id,
    'therapist_id', p_therapist_id,
    'starts_at',    p_starts_at,
    'ends_at',      p_ends_at,
    'status',       'PENDIENTE'
  );
END;
$$;





-- ============================================================
-- Migration 012 -- Liberar telefono al hacer soft delete
-- ============================================================

ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_phone_key;

CREATE UNIQUE INDEX profiles_phone_active_unique
  ON profiles(phone)
  WHERE deleted_at IS NULL;


-- ============================================================
-- Migration 013 -- Fecha de nacimiento en perfil de paciente
-- ============================================================

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS birth_date DATE;


-- ============================================================
-- Migration 014 -- Fix book_appointment: FOR UPDATE con COUNT()
-- ============================================================

CREATE OR REPLACE FUNCTION book_appointment(
  p_patient_id   UUID,
  p_branch_id    UUID,
  p_service_id   UUID,
  p_starts_at    TIMESTAMPTZ,
  p_ends_at      TIMESTAMPTZ,
  p_created_by   UUID,
  p_therapist_id UUID DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_capacity    INTEGER;
  v_slot        TIMESTAMPTZ;
  v_overlap_cnt INTEGER;
  v_appt_id     UUID;
BEGIN
  SELECT simultaneous_capacity INTO v_capacity
  FROM   branches
  WHERE  id = p_branch_id AND is_active = TRUE AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('error', 'BRANCH_NOT_FOUND');
  END IF;

  IF p_therapist_id IS NULL THEN
    SELECT id INTO p_therapist_id
    FROM   profiles
    WHERE  branch_id = p_branch_id AND 'TERAPEUTA' = ANY(roles)
      AND  is_active = TRUE AND deleted_at IS NULL
    ORDER BY created_at LIMIT 1;

    IF p_therapist_id IS NULL THEN
      RETURN json_build_object('error', 'NO_THERAPIST');
    END IF;
  END IF;

  v_slot := p_starts_at;
  WHILE v_slot < p_ends_at LOOP
    SELECT COUNT(*) INTO v_overlap_cnt
    FROM (
      SELECT 1
      FROM   appointments
      WHERE  branch_id = p_branch_id AND deleted_at IS NULL
        AND  status NOT IN ('CANCELADA', 'NO_ASISTIO')
        AND  starts_at < v_slot + INTERVAL '30 minutes'
        AND  ends_at > v_slot
      FOR UPDATE
    ) locked_rows;

    IF v_overlap_cnt >= v_capacity THEN
      RETURN json_build_object('error', 'SLOT_TAKEN');
    END IF;

    v_slot := v_slot + INTERVAL '30 minutes';
  END LOOP;

  INSERT INTO appointments (
    patient_id, branch_id, service_id, therapist_id,
    starts_at, ends_at, status, created_by
  ) VALUES (
    p_patient_id, p_branch_id, p_service_id, p_therapist_id,
    p_starts_at, p_ends_at, 'PENDIENTE', p_created_by
  )
  RETURNING id INTO v_appt_id;

  RETURN json_build_object(
    'id', v_appt_id, 'therapist_id', p_therapist_id,
    'starts_at', p_starts_at, 'ends_at', p_ends_at, 'status', 'PENDIENTE'
  );
END;
$$;
