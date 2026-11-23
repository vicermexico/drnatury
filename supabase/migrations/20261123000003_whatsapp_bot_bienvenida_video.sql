-- Agrega el tipo "video" a la serie de mensajes de bienvenida del
-- Asistente de WhatsApp (ver BienvenidaManager.tsx y
-- RecorteVerdeVideo.tsx) -- un video con el fondo verde ya quitado en
-- el navegador (mismo mecanismo que ya existia para fotos en
-- RecorteVerde.tsx, aplicado cuadro por cuadro a un video).
alter table whatsapp_bot_bienvenida
  add column if not exists video_url text;

alter table whatsapp_bot_bienvenida
  drop constraint if exists whatsapp_bot_bienvenida_tipo_check;
alter table whatsapp_bot_bienvenida
  add constraint whatsapp_bot_bienvenida_tipo_check
  check (tipo = any (array['texto', 'audio', 'video']));

alter table whatsapp_bot_bienvenida
  drop constraint if exists whatsapp_bot_bienvenida_contenido_check;
alter table whatsapp_bot_bienvenida
  add constraint whatsapp_bot_bienvenida_contenido_check
  check (
    (tipo = 'texto' and texto is not null) or
    (tipo = 'audio' and audio_url is not null) or
    (tipo = 'video' and video_url is not null)
  );
