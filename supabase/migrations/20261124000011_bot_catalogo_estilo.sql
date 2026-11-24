-- Vic pidio poder elegir, por bot, como se ve el catalogo dentro del
-- chat del cliente: como "libro" que se voltea (lo que ya habia, con
-- la libreria page-flip) o algo mas sencillo -- nada mas la foto, el
-- nombre, el precio y los botones de Ver mas/Compartir, uno debajo del
-- otro si hay varios productos. El switch vive en Master, junto a
-- Productos (ver ProductosPanel.tsx).
alter table whatsapp_bots
  add column if not exists catalogo_como_libro boolean not null default true;

notify pgrst, 'reload schema';
