-- Catalogo de productos (pedido de Vic, 2026-11-24): hasta ahora el bot
-- "pomada" solo vendia un producto fijo (Pomada Barak Flex, precio
-- hardcoded en engine-pomada.ts). Esto le da a Master un catalogo de
-- verdad: puede subir varios productos (nombre, descripcion, precio y
-- varias fotos cada uno) desde el panel. La Pomada Barak Flex va a
-- quedar como uno mas de estos productos (eso se resuelve en un paso
-- aparte al conectar esto con el chat/bot).
--
-- "products" esta en la lista de CLAUDE.md de tablas con soft-delete
-- obligatorio -- por eso "deleted_at" en vez de permitir borrado real.
create table if not exists productos (
  id uuid primary key default gen_random_uuid(),
  bot_id uuid not null references whatsapp_bots(id),
  nombre text not null,
  descripcion text,
  precio numeric not null check (precio >= 0),
  orden integer not null default 0,
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists productos_bot_idx on productos (bot_id) where deleted_at is null;

-- Varias fotos por producto (bucket de Storage "products", ya existia
-- sin usar). Se guarda tambien el "path" exacto dentro del bucket
-- (no solo la url publica) para poder borrar el archivo del Storage
-- cuando Master quite la foto.
create table if not exists producto_fotos (
  id uuid primary key default gen_random_uuid(),
  producto_id uuid not null references productos(id) on delete cascade,
  path text not null,
  url text not null,
  orden integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists producto_fotos_producto_idx on producto_fotos (producto_id);

notify pgrst, 'reload schema';
