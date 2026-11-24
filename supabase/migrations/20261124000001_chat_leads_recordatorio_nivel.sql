-- El seguimiento de conversaciones que se quedan a medias (ver
-- /api/cron/recordatorio-chat) ahora manda hasta 3 avisos en vez de
-- uno solo, cada vez mas espaciados (2 minutos, 2 horas, al dia
-- siguiente) -- se necesita saber en cual de los 3 va cada
-- conversacion para no repetirlo ni saltarse ninguno.
--
-- recordatorio_nivel -- cuantos avisos ya se le mandaron (0 = ninguno,
--                        1, 2 o 3). Al llegar a 3 ya no se le vuelve a
--                        insistir. Se reinicia a 0 cada vez que el
--                        visitante vuelve a escribir (ver
--                        /api/public/asistente-whatsapp).
alter table chat_leads
  add column if not exists recordatorio_nivel smallint not null default 0;

drop index if exists chat_leads_recordatorio_idx;

create index if not exists chat_leads_recordatorio_idx
  on chat_leads (updated_at)
  where cerrada_con_cita = false and recordatorio_nivel < 3;
