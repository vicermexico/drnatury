-- ============================================================
-- Migration 012 — Liberar teléfono al hacer soft delete
--
-- El constraint UNIQUE en profiles.phone bloqueaba reutilizar
-- un número después de eliminar (soft delete) a un terapeuta.
-- Se reemplaza por un índice parcial que solo aplica sobre
-- registros activos (deleted_at IS NULL).
-- ============================================================

-- 1. Eliminar el constraint UNIQUE de la columna
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_phone_key;

-- 2. Índice parcial: unicidad solo entre registros no eliminados
CREATE UNIQUE INDEX profiles_phone_active_unique
  ON profiles(phone)
  WHERE deleted_at IS NULL;
