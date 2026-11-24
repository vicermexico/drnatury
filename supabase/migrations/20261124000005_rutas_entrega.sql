-- Fase 3 del bot de venta de productos (sistema de choferes y entregas):
-- tabla de rutas del dia. Una "ruta" es nada mas un grupo de pedidos
-- pendientes (ver pomada_pedidos) agrupados por cercania y, ya
-- armada, asignados a un chofer -- el chofer la ve en su panel
-- (/chofer/dashboard, siguiente paso de la Fase 3).
create table if not exists rutas_entrega (
  id uuid primary key default gen_random_uuid(),
  etiqueta text not null,
  -- Se deja sin chofer al generarse (Master la arma primero viendo el
  -- mapa, y ya despues decide a quien se la asigna).
  chofer_id uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- A que ruta quedo asignado cada pedido, y en que orden dentro de esa
-- ruta (1, 2, 3... calculado por cercania al armar la ruta, para que el
-- chofer las vea ya en un orden logico de visita).
alter table pomada_pedidos add column if not exists ruta_id uuid references rutas_entrega(id) on delete set null;
alter table pomada_pedidos add column if not exists orden_en_ruta integer;

create index if not exists pomada_pedidos_ruta_id_idx on pomada_pedidos (ruta_id);

notify pgrst, 'reload schema';
