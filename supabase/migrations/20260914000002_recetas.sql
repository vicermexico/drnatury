-- Feature: Recetas
--
-- 1. profiles.whatsapp_number — numero de WhatsApp propio del terapeuta
--    (distinto al celular que usa para entrar al sistema). Se usa para
--    que el terapeuta sepa con cual linea debe tener sesion abierta al
--    mandar la receta por WhatsApp (ver src/app/(terapeuta)/terapeuta/receta).
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS whatsapp_number TEXT;

-- 2. padecimientos — catalogo que llena Master: un "problema" (ej. Rinon)
--    y su recomendacion (ej. jugos a tomar). "recomendacion" es texto con
--    una sugerencia por linea — el terapeuta despues marca cuales de esas
--    lineas aplican para el paciente en turno.
CREATE TABLE IF NOT EXISTS padecimientos (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre       TEXT NOT NULL,
  recomendacion TEXT NOT NULL DEFAULT '',
  orden        INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. recetas — lo que llena el terapeuta por paciente. Guarda una "foto"
--    de los padecimientos elegidos y las recomendaciones marcadas (asi
--    si Master edita el catalogo despues, las recetas ya mandadas no
--    cambian).
CREATE TABLE IF NOT EXISTS recetas (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  therapist_id         UUID REFERENCES profiles(id),
  patient_name         TEXT NOT NULL,
  patient_phone        TEXT NOT NULL,
  fecha_nacimiento      DATE,
  estatura_cm          NUMERIC,
  peso_kg              NUMERIC,
  padecimientos        JSONB NOT NULL DEFAULT '[]',
  productos_necesarios TEXT,
  observaciones        TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_recetas_therapist ON recetas(therapist_id);
