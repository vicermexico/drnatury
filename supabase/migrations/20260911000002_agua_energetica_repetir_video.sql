-- Master quiere poder decidir si el "Video de sesion" (el que se
-- reproduce al dar clic en Iniciar) se repite en loop o no. Antes de esta
-- migracion siempre se repetia hasta cumplir duracion_sesion_segundos
-- (ver 20260911000001). Ahora eso es opcional: si Master no activa el
-- loop, el video se reproduce una sola vez de principio a fin, igual que
-- se comportaba originalmente.
ALTER TABLE agua_energetica_config
  ADD COLUMN IF NOT EXISTS repetir_video_sesion BOOLEAN NOT NULL DEFAULT false;
