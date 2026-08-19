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
