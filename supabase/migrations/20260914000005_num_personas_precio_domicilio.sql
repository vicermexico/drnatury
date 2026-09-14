-- Cuantas personas se van a atender en la misma cita (por defecto 1), y el
-- precio por persona para citas a domicilio (fijo, independiente del
-- precio del servicio en consultorio). Configurable por sucursal.
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS num_personas INTEGER NOT NULL DEFAULT 1;
ALTER TABLE branches ADD COLUMN IF NOT EXISTS domicilio_precio_persona NUMERIC NOT NULL DEFAULT 299;
