-- Nueva feature: "Revision de PH" — pantalla que el terapeuta usa durante
-- la revision fisica del paciente. Master sube 2 videos (uno de fondo
-- tenue para la pantalla de espera, y otro que se muestra del lado
-- derecho mientras se hace el analisis). Sigue el mismo patron que
-- agua_energetica_config: una sola fila de configuracion.

CREATE TABLE IF NOT EXISTS ph_revision_config (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_fondo_url    TEXT,
  video_resultado_url TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO ph_revision_config (id)
SELECT gen_random_uuid()
WHERE NOT EXISTS (SELECT 1 FROM ph_revision_config);

-- Bucket publico para los videos, mismo patron que "agua-energetica"
-- (subida via signed URL desde el servidor con service role, asi que no
-- se necesitan policies de INSERT — solo se deja el bucket publico para
-- que el navegador pueda reproducir el video con la URL publica).
INSERT INTO storage.buckets (id, name, public)
VALUES ('ph-revision', 'ph-revision', true)
ON CONFLICT (id) DO NOTHING;
