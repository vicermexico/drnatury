-- Datos del encabezado del chat publico (/chat), tipo WhatsApp: nombre
-- y foto de perfil que se ven arriba del chat, y el link del anuncio
-- de Facebook que se muestra en la pantalla de opciones al darle clic
-- al encabezado. Todo esto lo podra editar Master (ver
-- /master/asistente-whatsapp mas adelante); por ahora solo se agregan
-- las columnas.
alter table landing_config
  add column if not exists chat_perfil_nombre text not null default 'DrNatury',
  add column if not exists chat_perfil_foto text,
  add column if not exists anuncio_facebook_url text;
