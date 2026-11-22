-- Vic pidio poder grabar un audio de orientacion por lugar (ej. "para
-- llegar a San Blas, de tal calle se mete..."), que el bot manda
-- cuando el paciente ya tiene la direccion pero pide que lo orienten
-- (ver ORIENTACION_KEYWORDS en engine.ts). Es un campo mas de la misma
-- fila de whatsapp_bot_ubicaciones, no una tabla aparte -- cada lugar
-- puede tener su propio audio (o ninguno todavia).
alter table whatsapp_bot_ubicaciones
  add column if not exists audio_url text;
