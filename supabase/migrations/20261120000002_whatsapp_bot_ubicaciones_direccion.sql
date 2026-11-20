-- Master pidio poder escribir la direccion a mano (no solo pararse
-- fisicamente con el GPS) -- esta pantalla es independiente de la
-- plataforma (sucursales/branches), asi que su propia direccion escrita
-- aqui es la que usa el bot, no la de otra pantalla. lat/lng ya no son
-- obligatorios porque ahora se puede guardar un lugar solo con la
-- direccion de texto, sin GPS.
alter table whatsapp_bot_ubicaciones
  add column if not exists direccion text,
  alter column lat drop not null,
  alter column lng drop not null;
