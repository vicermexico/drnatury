-- Columnas nuevas para la estrategia de seguimiento/retencion de
-- clientes que se van sin agendar (ver /chat y
-- /api/public/asistente-whatsapp):
--
-- codigo_anuncio      -- de que anuncio de Facebook/Instagram vino la
--                         conversacion (?anuncio=B3 en el link de /chat).
-- estado              -- el EstadoAgendado completo (igual al que ya se
--                         manda de ida y vuelta con el chat) para poder
--                         "retomar" la conversacion exactamente donde se
--                         quedo (?retomar=<id>).
-- push_token          -- notificacion del propio VISITANTE (anonimo, sin
--                         login) -- distinto del push_token de "profiles"
--                         que ya tienen Master/pacientes logueados.
-- updated_at          -- se actualiza en cada mensaje del paciente; sirve
--                         para saber cuanto lleva "quieta" la conversacion.
-- recordatorio_enviado_at -- para no mandar el recordatorio dos veces.
alter table chat_leads
  add column if not exists codigo_anuncio text,
  add column if not exists estado jsonb,
  add column if not exists push_token text,
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists recordatorio_enviado_at timestamptz;

create index if not exists chat_leads_recordatorio_idx
  on chat_leads (updated_at)
  where cerrada_con_cita = false and recordatorio_enviado_at is null;
