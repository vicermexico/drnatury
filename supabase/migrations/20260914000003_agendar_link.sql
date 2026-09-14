-- Feature: link para que el paciente agende su propia cita.
--
-- Cuando el paciente usa el boton "Tomar mi ubicacion" en una cita a
-- domicilio, se guarda el pin exacto del GPS (coordenadas), en vez de
-- depender de un servicio externo de mapas para traducir la direccion.
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS domicilio_lat NUMERIC;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS domicilio_lng NUMERIC;
