-- ============================================================
-- Migration — Stock multi-ubicación (almacén + sucursales)
-- Cada inventory_item identifica una ubicación: is_warehouse=true
-- para almacén central, is_warehouse=false + branch_id para sucursal.
-- ============================================================

-- ── Columnas de ubicación en inventory_items ──────────────
ALTER TABLE inventory_items
  ADD COLUMN IF NOT EXISTS is_warehouse BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS branch_id    UUID    REFERENCES branches(id);

-- Quitar el UNIQUE original (solo permitía un item por producto)
ALTER TABLE inventory_items
  DROP CONSTRAINT IF EXISTS inventory_items_product_id_key;

-- Nuevo UNIQUE: un registro por (producto, ubicación)
CREATE UNIQUE INDEX IF NOT EXISTS idx_inventory_items_location
  ON inventory_items(
    product_id,
    is_warehouse,
    COALESCE(branch_id, '00000000-0000-0000-0000-000000000000'::UUID)
  );

-- ── Número de celular del paciente (para salidas de terapeuta) ──
ALTER TABLE inventory_movements
  ADD COLUMN IF NOT EXISTS patient_phone TEXT;

-- ── Función actualizada: stock multi-ubicación ────────────
CREATE OR REPLACE FUNCTION record_inventory_movement(
  p_product_id      UUID,
  p_type            inventory_movement_type,
  p_delta           INTEGER,                      -- positivo = entrada, negativo = salida
  p_performed_by    UUID,
  p_notes           TEXT    DEFAULT NULL,
  p_dest_branch_id  UUID    DEFAULT NULL,         -- sucursal destino/origen del movimiento
  p_is_warehouse    BOOLEAN DEFAULT TRUE,         -- qué stock modificar
  p_location_branch UUID    DEFAULT NULL,         -- sucursal cuyo stock se modifica
  p_patient_phone   TEXT    DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_before  INTEGER;
  v_after   INTEGER;
  v_item_id UUID;
BEGIN
  -- Buscar o crear el item de inventario para esta ubicación
  IF p_is_warehouse THEN
    SELECT id, quantity INTO v_item_id, v_before
    FROM   inventory_items
    WHERE  product_id   = p_product_id
      AND  is_warehouse = TRUE
    FOR UPDATE;
  ELSE
    -- Intentar encontrar item de sucursal
    SELECT id, quantity INTO v_item_id, v_before
    FROM   inventory_items
    WHERE  product_id   = p_product_id
      AND  is_warehouse = FALSE
      AND  branch_id    = p_location_branch
    FOR UPDATE;

    -- Si no existe, crearlo con stock 0
    IF NOT FOUND THEN
      INSERT INTO inventory_items (product_id, is_warehouse, branch_id, quantity)
      VALUES (p_product_id, FALSE, p_location_branch, 0)
      RETURNING id, quantity INTO v_item_id, v_before;
    END IF;
  END IF;

  IF v_item_id IS NULL THEN
    RETURN json_build_object('error', 'PRODUCT_NOT_FOUND');
  END IF;

  v_after := v_before + p_delta;

  IF v_after < 0 THEN
    RETURN json_build_object('error', 'INSUFFICIENT_STOCK', 'available', v_before);
  END IF;

  UPDATE inventory_items
  SET    quantity = v_after, updated_at = NOW()
  WHERE  id = v_item_id;

  INSERT INTO inventory_movements
    (product_id, type, quantity_before, quantity_after, notes,
     performed_by, branch_id, patient_phone)
  VALUES
    (p_product_id, p_type, v_before, v_after, p_notes,
     p_performed_by, p_dest_branch_id, p_patient_phone);

  RETURN json_build_object('quantity_before', v_before, 'quantity_after', v_after);
END;
$$;
