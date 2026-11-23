-- Job de pg_cron+pg_net para el recordatorio de conversaciones del
-- chat publico que se quedan a medias (ver /api/cron/recordatorio-chat
-- y la estrategia de seguimiento/retencion). Vercel en este plan solo
-- deja correr un cron suyo una vez al dia, y aqui necesitamos revisar
-- cada 1-2 minutos -- por eso el "cronometro" vive aqui, dentro de
-- Supabase, y nada mas le toca la puerta (http_post) a la ruta de
-- Next.js cada minuto.
--
-- El secreto que autoriza la llamada NO va escrito en este archivo --
-- se guarda aparte en Supabase Vault (vault.create_secret, nombre
-- "chat_recordatorio_secret") y aqui solo se lee por nombre, para no
-- dejarlo expuesto en el repo de git.
select cron.schedule(
  'recordatorio_chat',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://www.drnatury.com/api/cron/recordatorio-chat',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (
        select decrypted_secret from vault.decrypted_secrets
        where name = 'chat_recordatorio_secret'
      ),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);
