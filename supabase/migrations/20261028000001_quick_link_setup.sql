-- Soporte para el link rapido de agendado de Master (sin login, con
-- codigo secreto en la URL). Agrega las columnas que faltan para guardar
-- el nombre escrito a mano y el costo total, y crea un servicio generico
-- "Consulta rapida (link)" de 30 minutos para poder reusar el mismo
-- book_appointment() / chequeo de disponibilidad que ya usa el resto de
-- la app, sin necesitar un catalogo de servicios real todavia.

ALTER TABLE appointments ADD COLUMN IF NOT EXISTS quick_name text;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS costo_total numeric;

WITH nuevo_servicio AS (
  INSERT INTO services (name, duration_minutes, is_active)
  SELECT 'Consulta rapida (link)', 30, true
  WHERE NOT EXISTS (
    SELECT 1 FROM services WHERE name = 'Consulta rapida (link)'
  )
  RETURNING id
)
INSERT INTO branch_services (branch_id, service_id, simultaneous_capacity, price)
SELECT b.id, s.id, 1, 0
FROM branches b
JOIN nuevo_servicio s ON true
WHERE b.is_active = true AND b.deleted_at IS NULL;
