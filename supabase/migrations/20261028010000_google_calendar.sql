-- Conexion con Google Calendar de Master, para que las citas agendadas
-- desde el link rapido (y los bloqueos personales) se creen solas en su
-- calendario, sin tener que descargar/abrir un .ics a mano.
--
-- Fila unica (singleton) con un id fijo -- solo hay un Master, asi que
-- solo se necesita una conexion guardada a la vez.

CREATE TABLE IF NOT EXISTS google_calendar_connection (
  id                       uuid PRIMARY KEY DEFAULT '00000000-0000-0000-0000-000000000001',
  refresh_token            text NOT NULL,
  access_token             text,
  access_token_expires_at  timestamptz,
  connected_by             uuid REFERENCES profiles(id),
  connected_at             timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE appointments  ADD COLUMN IF NOT EXISTS google_event_id text;
ALTER TABLE blocked_slots ADD COLUMN IF NOT EXISTS google_event_id text;
