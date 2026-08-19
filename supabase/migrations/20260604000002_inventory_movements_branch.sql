-- ============================================================
-- Migration — Agrega branch_id a inventory_movements
-- Para registrar a qué sucursal va cada salida de inventario
-- ============================================================

ALTER TABLE inventory_movements
  ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id);

-- Actualizar la función para aceptar branch_id opcional
CREATE OR REPLACE FUNCTION record_inventory_movement(
  p_product_id    UUID,
  p_type          inventory_movement_type,
  p_delta         INTEGER,
  p_performed_by  UUID,
  p_notes         TEXT DEFAULT NULL,
  p_branch_id     UUID DEFAULT NULL
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
  SELECT id, quantity INTO v_item_id, v_before
  FROM   inventory_items
  WHERE  product_id = p_product_id
  FOR UPDATE;

  IF NOT FOUND THEN
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
    (product_id, type, quantity_before, quantity_after, notes, performed_by, branch_id)
  VALUES
    (p_product_id, p_type, v_before, v_after, p_notes, p_performed_by, p_branch_id);

  RETURN json_build_object('quantity_before', v_before, 'quantity_after', v_after);
END;
$$;
