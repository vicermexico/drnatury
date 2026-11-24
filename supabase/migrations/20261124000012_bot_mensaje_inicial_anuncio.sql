-- Vic pidio poder editar el, antes fijo en el codigo (ver
-- src/lib/whatsapp-bot/mensajes.ts), mensaje que se manda solo cuando
-- alguien entra al chat desde el anuncio de Facebook/Instagram
-- ("B3 - ¡Hola! ¿Podrían darme más información?") -- ahora cada bot
-- guarda el suyo y lo edita desde Master -> Perfil del chat.
alter table whatsapp_bots
  add column if not exists mensaje_inicial_anuncio text not null default 'B3 - ¡Hola! ¿Podrían darme más información?';

notify pgrst, 'reload schema';
