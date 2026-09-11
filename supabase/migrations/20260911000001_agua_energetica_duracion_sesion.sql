-- La tabla agua_energetica_config no tiene migracion propia en el repo
-- (se creo en algun momento directo desde el dashboard de Supabase, igual
-- que paso con profiles.push_token — viola la regla 9 de CLAUDE.md). No se
-- reconstruye aqui completa por no tener certeza del schema exacto en
-- produccion; esta migracion solo agrega, de forma segura con
-- IF NOT EXISTS, la columna nueva que necesita el feature de duracion de
-- sesion.
--
-- El video de sesion (video_sesion_url) dura lo que dure el archivo (ej.
-- 10 segundos), pero Master quiere que la sesion completa dure mas (ej.
-- 1 minuto) repitiendo el video en loop hasta cumplir ese tiempo total.
-- Esta columna guarda esa duracion total en segundos.
ALTER TABLE agua_energetica_config
  ADD COLUMN IF NOT EXISTS duracion_sesion_segundos INTEGER NOT NULL DEFAULT 60;
