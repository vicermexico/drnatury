-- Pedido de Vic: los botones de "Choferes" y "Rutas" se mueven adentro
-- del menu de cada bot de WhatsApp (junto con "Bienvenida",
-- "Correcciones", etc.), porque cada bot que venda productos va a
-- tener sus propios choferes y rutas -- hoy nada mas la Pomada Barak
-- Flex ("pomada") vende productos, pero esto deja listo el terreno
-- para cuando haya otro bot que tambien venda algo.

-- A que bot pertenece cada chofer (solo aplica a perfiles con el rol
-- CHOFER -- en los demas roles se queda vacio).
alter table profiles add column if not exists chofer_bot_slug text references whatsapp_bots(slug) on delete set null;

-- A que bot pertenece cada ruta armada. Las que ya existian son todas
-- de la pomada (unico bot que vende productos hasta ahora), por eso el
-- default -- las que se creen de aqui en adelante van a mandar su
-- propio bot_slug (ver /api/master/rutas/generar).
alter table rutas_entrega add column if not exists bot_slug text references whatsapp_bots(slug);
update rutas_entrega set bot_slug = 'pomada' where bot_slug is null;
alter table rutas_entrega alter column bot_slug set not null;

notify pgrst, 'reload schema';
