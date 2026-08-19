-- Agrega columna image_url a products
-- La migración original (001) no la incluía
ALTER TABLE products ADD COLUMN IF NOT EXISTS image_url TEXT;
