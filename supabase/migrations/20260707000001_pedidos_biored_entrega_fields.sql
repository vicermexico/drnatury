ALTER TABLE pedidos_biored
  ADD COLUMN IF NOT EXISTS terapeuta_nombre TEXT,
  ADD COLUMN IF NOT EXISTS entregado_at TIMESTAMPTZ;
