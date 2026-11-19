-- Registro ligero de cada conversacion que entra por el chat publico
-- (/chat), para que Master pueda ver cuantos mensajes llegaron, cuantos
-- se cerraron con cita y cuantos no, filtrando por fecha. No se guarda
-- el contenido de la conversacion, solo si llego y si se cerro -- el
-- nombre/celular/lugar de las que si se cerraron se consultan via join
-- con appointments (appointment_id), para no duplicar esos datos.
create table if not exists chat_leads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  origen text not null default 'anuncio',
  appointment_id uuid references appointments(id) on delete set null,
  cerrada_con_cita boolean not null default false
);

create index if not exists chat_leads_created_at_idx on chat_leads (created_at);
create index if not exists chat_leads_cerrada_idx on chat_leads (cerrada_con_cita);
