-- Pedido de Vic: poder generar varios links distintos para el mismo
-- bot (ej. uno por cada anuncio/campana), escribiendo el el mismo el
-- texto, para saber despues de cual vino cada cliente.
--
-- Reusa el mecanismo que YA EXISTIA de "?anuncio=<codigo>" en el link
-- del chat publico (ver PublicChatDemo.tsx, obtenerCodigoAnuncio, y
-- chat_leads.codigo_anuncio) -- antes solo se podia armar ese link a
-- mano sin que quedara registrado en ningun lado; esta tabla es nada
-- mas el catalogo de codigos que Master ha generado desde el panel,
-- para poder listarlos, copiarlos y ver cuantos leads trajo cada uno.
create table if not exists whatsapp_bot_links (
  id uuid primary key default gen_random_uuid(),
  bot_id uuid not null references whatsapp_bots(id),
  codigo text not null,
  nota text,
  created_at timestamptz not null default now(),
  unique (bot_id, codigo)
);

notify pgrst, 'reload schema';
