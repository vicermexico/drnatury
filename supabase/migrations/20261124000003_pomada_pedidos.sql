-- Fase 2 del bot de venta de productos (bot "pomada" / Pomada Barak
-- Flex, ver engine-pomada.ts): tabla de pedidos cerrados por el chat
-- publico (drnatury.com/barak-flex). Es su propia tabla, separada de
-- "appointments" (citas de consultorio/domicilio), porque un pedido de
-- producto no es una cita -- en la Fase 3 (choferes y mapa de
-- entregas) el panel de choferes y el mapa van a trabajar sobre esta
-- misma tabla.

create table if not exists pomada_pedidos (
  id uuid primary key default gen_random_uuid(),
  chat_lead_id uuid references chat_leads(id),
  nombre text not null,
  celular text not null,
  cantidad integer not null check (cantidad > 0),
  precio_unitario numeric not null default 590,
  precio_total numeric not null,
  direccion text not null,
  -- Ubicacion de GPS (opcional) -- se llena si el cliente le da clic al
  -- pin de "mandar mi ubicacion actual" dentro del chat, igual que ya
  -- pasa con las citas a domicilio (ver /api/pedidos/[id]/ubicacion).
  lat double precision,
  lng double precision,
  -- Texto ya resuelto del horario de entrega que el bot acordo con el
  -- cliente, ej. "Mañana (8:00am a 2:00pm)" o "Tarde (2:00pm a 5:00pm)".
  horario text not null,
  -- Para la Fase 3 (panel de choferes): pendiente -> entregado/rechazado.
  estado text not null default 'pendiente' check (estado in ('pendiente', 'entregado', 'rechazado')),
  created_at timestamptz not null default now()
);

create index if not exists pomada_pedidos_estado_idx on pomada_pedidos (estado);

-- chat_leads.appointment_id tiene FK estricta a appointments(id) -- no
-- se puede reusar para guardar el id de un pedido de producto (violaria
-- esa FK). Se usa esta columna aparte, nada mas para los bots de
-- productos (ver Fase 2), para marcar con que pedido se cerro el chat.
alter table chat_leads add column if not exists pedido_id uuid references pomada_pedidos(id) on delete set null;

notify pgrst, 'reload schema';
