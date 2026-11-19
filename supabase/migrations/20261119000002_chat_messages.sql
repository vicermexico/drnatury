-- Texto completo de las conversaciones del chat publico (/chat), SOLO
-- para las que Master todavia puede necesitar revisar: mientras la
-- conversacion esta abierta se va guardando mensaje por mensaje, y en
-- cuanto se cierra con cita de verdad se borra (ver
-- /api/public/asistente-whatsapp) -- asi solo se queda guardado el
-- texto de las que NO se cerraron, para que Master pueda revisar en
-- donde se "rego" el bot y ensenarle la respuesta correcta desde
-- /master/asistente-whatsapp/revision.
create table if not exists chat_messages (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references chat_leads(id) on delete cascade,
  created_at timestamptz not null default now(),
  rol text not null check (rol in ('paciente', 'bot')),
  texto text not null
);

create index if not exists chat_messages_lead_id_idx on chat_messages (lead_id, created_at);
