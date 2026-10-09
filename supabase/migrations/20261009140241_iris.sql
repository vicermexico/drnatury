-- Nueva feature: "Iris" — herramienta EXPERIMENTAL y privada, solo para
-- Master. La terapeuta sube fotos de los ojos del paciente durante la
-- consulta (sin ver ningun resultado). Master mantiene un banco de
-- imagenes de referencia de iridologia (imagen + que indica) y puede
-- pedirle a una IA que compare la foto de un paciente contra ese banco.
--
-- IMPORTANTE: la iridologia NO esta comprobada cientificamente. Esto es
-- solo para uso y estudio personal de Master, nunca para diagnosticar o
-- tratar pacientes. El resultado nunca se muestra a la terapeuta ni al
-- paciente, y siempre debe ir acompanado de un disclaimer.

CREATE TABLE IF NOT EXISTS iris_reference_images (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label       TEXT NOT NULL,
  meaning     TEXT NOT NULL,
  zone        TEXT,
  image_path  TEXT NOT NULL,
  created_by  UUID REFERENCES profiles(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at  TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS iris_patient_photos (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id   UUID NOT NULL REFERENCES profiles(id),
  eye          TEXT NOT NULL CHECK (eye IN ('IZQUIERDO', 'DERECHO')),
  image_path   TEXT NOT NULL,
  uploaded_by  UUID REFERENCES profiles(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at   TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_iris_patient_photos_patient
  ON iris_patient_photos (patient_id) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS iris_findings (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_photo_id  UUID NOT NULL REFERENCES iris_patient_photos(id),
  summary           TEXT NOT NULL,
  matches           JSONB NOT NULL DEFAULT '[]'::jsonb,
  disclaimer        TEXT NOT NULL,
  created_by        UUID REFERENCES profiles(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_iris_findings_photo
  ON iris_findings (patient_photo_id);

-- Buckets privados: el acceso de lectura real se controla siempre desde
-- el servidor con createSignedUrl() usando el service role (Master), no
-- por URL publica.
INSERT INTO storage.buckets (id, name, public)
VALUES ('iris-reference', 'iris-reference', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('iris-photos', 'iris-photos', false)
ON CONFLICT (id) DO NOTHING;

-- iris-reference: solo Master sube/lee/borra (banco de referencia)
CREATE POLICY "iris reference upload master"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'iris-reference'
    AND (
      SELECT TRUE FROM public.profiles
      WHERE id = auth.uid() AND 'MASTER' = ANY(roles) AND deleted_at IS NULL
    )
  );

CREATE POLICY "iris reference read master"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'iris-reference'
    AND (
      SELECT TRUE FROM public.profiles
      WHERE id = auth.uid() AND 'MASTER' = ANY(roles) AND deleted_at IS NULL
    )
  );

CREATE POLICY "iris reference delete master"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'iris-reference'
    AND (
      SELECT TRUE FROM public.profiles
      WHERE id = auth.uid() AND 'MASTER' = ANY(roles) AND deleted_at IS NULL
    )
  );

-- iris-photos: Master/Terapeuta/Asistente pueden subir (se toma la foto
-- en consulta); solo Master puede leer o borrar (nadie mas ve nada).
CREATE POLICY "iris photos upload staff"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'iris-photos'
    AND (
      SELECT TRUE FROM public.profiles
      WHERE id = auth.uid()
        AND (roles && ARRAY['MASTER','TERAPEUTA','ASISTENTE']::user_role[])
        AND deleted_at IS NULL
    )
  );

CREATE POLICY "iris photos read master"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'iris-photos'
    AND (
      SELECT TRUE FROM public.profiles
      WHERE id = auth.uid() AND 'MASTER' = ANY(roles) AND deleted_at IS NULL
    )
  );

CREATE POLICY "iris photos delete master"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'iris-photos'
    AND (
      SELECT TRUE FROM public.profiles
      WHERE id = auth.uid() AND 'MASTER' = ANY(roles) AND deleted_at IS NULL
    )
  );
