-- ============================================================
-- Migration — Políticas RLS para Supabase Storage
-- Bucket: product-images (público para lectura)
-- ============================================================

-- Lectura pública (imágenes en listas e inventario)
CREATE POLICY "product images public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'product-images');

-- Subida solo para MASTER y ALMACENISTA (autenticados)
CREATE POLICY "product images upload"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'product-images'
    AND (
      SELECT TRUE
      FROM   public.profiles
      WHERE  id    = auth.uid()
        AND  'MASTER' = ANY(roles)
        AND  deleted_at IS NULL
    )
  );

-- Eliminar solo para MASTER
CREATE POLICY "product images delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'product-images'
    AND (
      SELECT TRUE
      FROM   public.profiles
      WHERE  id    = auth.uid()
        AND  'MASTER' = ANY(roles)
        AND  deleted_at IS NULL
    )
  );
