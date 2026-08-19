-- ============================================================
-- Migration 013 — Fecha de nacimiento en perfil de paciente
--
-- El campo age (INTEGER) existente pierde precisión con el tiempo.
-- Se añade birth_date DATE para almacenar la fecha exacta; age se
-- sigue calculando y guardando para compatibilidad con formularios
-- de auto-registro ya existentes.
-- ============================================================

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS birth_date DATE;
