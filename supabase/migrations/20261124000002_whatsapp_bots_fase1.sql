-- Fase 1 del bot de venta de productos (pedido de Vic): ahora el panel
-- de /master/asistente-whatsapp puede tener mas de un bot -- cada uno
-- con su propia serie de bienvenida, anuncios, correcciones enseñadas,
-- ubicaciones y conversaciones, totalmente separados entre si. Por
-- ahora son dos: "consultas" (el que ya existia, para agendar citas) y
-- "pomada" (nuevo, para vender la Pomada Barak Plus).

create table if not exists whatsapp_bots (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  nombre text not null,
  -- Perfil del chat publico de este bot (antes vivian en landing_config,
  -- compartidas por todos -- ahora cada bot trae las suyas).
  chat_perfil_nombre text not null default 'DrNatury',
  chat_perfil_foto text,
  anuncio_facebook_url text,
  created_at timestamptz not null default now()
);

-- Se crea el bot "consultas" trayendose el perfil que ya tenia
-- configurado en landing_config (si existe), para no perder nada de lo
-- que Vic ya habia puesto.
insert into whatsapp_bots (slug, nombre, chat_perfil_nombre, chat_perfil_foto, anuncio_facebook_url)
select 'consultas', 'Bot Consultas', coalesce(chat_perfil_nombre, 'DrNatury'), chat_perfil_foto, anuncio_facebook_url
from landing_config
limit 1
on conflict (slug) do nothing;

-- Por si landing_config estuviera vacia.
insert into whatsapp_bots (slug, nombre)
values ('consultas', 'Bot Consultas')
on conflict (slug) do nothing;

insert into whatsapp_bots (slug, nombre)
values ('pomada', 'Pomada Barak Plus')
on conflict (slug) do nothing;

-- bot_id en cada tabla del bot -- todo lo que ya existia se le asigna
-- al bot "consultas", para que lo que Vic ya habia entrenado/configurado
-- se quede exactamente igual que antes.
alter table whatsapp_bot_correcciones add column if not exists bot_id uuid references whatsapp_bots(id);
alter table whatsapp_bot_anuncios add column if not exists bot_id uuid references whatsapp_bots(id);
alter table whatsapp_bot_bienvenida add column if not exists bot_id uuid references whatsapp_bots(id);
alter table whatsapp_bot_ubicaciones add column if not exists bot_id uuid references whatsapp_bots(id);
alter table chat_leads add column if not exists bot_id uuid references whatsapp_bots(id);

update whatsapp_bot_correcciones set bot_id = (select id from whatsapp_bots where slug = 'consultas') where bot_id is null;
update whatsapp_bot_anuncios set bot_id = (select id from whatsapp_bots where slug = 'consultas') where bot_id is null;
update whatsapp_bot_bienvenida set bot_id = (select id from whatsapp_bots where slug = 'consultas') where bot_id is null;
update whatsapp_bot_ubicaciones set bot_id = (select id from whatsapp_bots where slug = 'consultas') where bot_id is null;
update chat_leads set bot_id = (select id from whatsapp_bots where slug = 'consultas') where bot_id is null;

alter table whatsapp_bot_correcciones alter column bot_id set not null;
alter table whatsapp_bot_anuncios alter column bot_id set not null;
alter table whatsapp_bot_bienvenida alter column bot_id set not null;
alter table whatsapp_bot_ubicaciones alter column bot_id set not null;
alter table chat_leads alter column bot_id set not null;

-- Lo que antes era "unico" en toda la tabla ahora es unico POR BOT --
-- dos bots distintos pueden tener el mismo escrito de anuncio, la
-- misma correccion enseñada, o un lugar con el mismo nombre, sin
-- chocar entre si.
alter table whatsapp_bot_correcciones drop constraint if exists whatsapp_bot_correcciones_disparador_key;
alter table whatsapp_bot_correcciones add constraint whatsapp_bot_correcciones_bot_disparador_key unique (bot_id, disparador);

alter table whatsapp_bot_anuncios drop constraint if exists whatsapp_bot_anuncios_texto_normalizado_key;
alter table whatsapp_bot_anuncios add constraint whatsapp_bot_anuncios_bot_texto_normalizado_key unique (bot_id, texto_normalizado);

alter table whatsapp_bot_ubicaciones drop constraint if exists whatsapp_bot_ubicaciones_nombre_normalizado_key;
alter table whatsapp_bot_ubicaciones add constraint whatsapp_bot_ubicaciones_bot_nombre_normalizado_key unique (bot_id, nombre_normalizado);

-- Para que PostgREST reconozca de inmediato las nuevas relaciones por
-- bot_id (ej. chat_leads -> whatsapp_bots) sin esperar a que se
-- refresque solo -- ya hubo un bug grande antes por esto mismo (ver
-- "Bug grande ya resuelto" en el doc de setup del proyecto).
notify pgrst, 'reload schema';
