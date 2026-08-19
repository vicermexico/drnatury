-- Marca cuándo un envío del almacén fue recibido por la sucursal.
-- NULL = pendiente de recibir. Non-null = ya recibido.
ALTER TABLE inventory_movements
  ADD COLUMN IF NOT EXISTS received_at TIMESTAMPTZ;
