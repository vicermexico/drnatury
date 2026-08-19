-- ============================================================
-- Migration — Inventario de productos
-- CLAUDE.md regla 4: movimientos corren en transacción con FOR UPDATE
-- CLAUDE.md regla 6: audit log en cada ajuste de inventario
-- ============================================================

-- ── Tipo de movimiento (si no existe ya) ─────────────────
DO $$ BEGIN
  CREATE TYPE inventory_movement_type AS ENUM (
    'VENTA',
    'SURTIDO_ALMACEN',
    'RECIBO_SUCURSAL',
    'ENTRADA_PROVEEDOR'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── Catálogo de productos ─────────────────────────────────
CREATE TABLE products (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name                TEXT        NOT NULL,
  description         TEXT,
  min_weekly_quantity INTEGER     NOT NULL DEFAULT 0 CHECK (min_weekly_quantity >= 0),
  is_active           BOOLEAN     NOT NULL DEFAULT TRUE,
  deleted_at          TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── Stock actual (una fila por producto = almacén central) ─
CREATE TABLE inventory_items (
  id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id  UUID    NOT NULL REFERENCES products(id),
  quantity    INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (product_id)
);

-- Auto-crear inventory_item al registrar un producto
CREATE OR REPLACE FUNCTION fn_create_inventory_item()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO inventory_items (product_id, quantity) VALUES (NEW.id, 0);
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_product_inventory_item
  AFTER INSERT ON products
  FOR EACH ROW EXECUTE FUNCTION fn_create_inventory_item();

-- ── Historial de movimientos (audit, CLAUDE.md regla 6) ───
CREATE TABLE inventory_movements (
  id              UUID                    PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id      UUID                    NOT NULL REFERENCES products(id),
  type            inventory_movement_type NOT NULL,
  quantity_before INTEGER                 NOT NULL,
  quantity_after  INTEGER                 NOT NULL,
  notes           TEXT,
  performed_by    UUID                    NOT NULL REFERENCES profiles(id),
  performed_at    TIMESTAMPTZ             NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_inventory_movements_product ON inventory_movements(product_id, performed_at DESC);

-- ── RLS ───────────────────────────────────────────────────
ALTER TABLE products           ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_items    ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "products_select" ON products FOR SELECT
  USING ((is_active = TRUE AND deleted_at IS NULL) OR has_role('MASTER'));

CREATE POLICY "products_write" ON products FOR ALL
  USING (has_role('MASTER') OR has_role('ALMACENISTA'))
  WITH CHECK (has_role('MASTER') OR has_role('ALMACENISTA'));

CREATE POLICY "inventory_items_select" ON inventory_items FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "inventory_items_write" ON inventory_items FOR ALL
  USING (has_role('MASTER') OR has_role('ALMACENISTA'))
  WITH CHECK (has_role('MASTER') OR has_role('ALMACENISTA'));

CREATE POLICY "inventory_movements_select" ON inventory_movements FOR SELECT
  USING (has_role('MASTER') OR has_role('ALMACENISTA'));

CREATE POLICY "inventory_movements_insert" ON inventory_movements FOR INSERT
  WITH CHECK (has_role('MASTER') OR has_role('ALMACENISTA'));

-- ── Función transaccional de movimiento (CLAUDE.md regla 4) ─
CREATE OR REPLACE FUNCTION record_inventory_movement(
  p_product_id    UUID,
  p_type          inventory_movement_type,
  p_delta         INTEGER,   -- positivo = entrada, negativo = salida
  p_performed_by  UUID,
  p_notes         TEXT DEFAULT NULL
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
  -- Bloquear la fila de stock para evitar doble-ajuste concurrente
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
    (product_id, type, quantity_before, quantity_after, notes, performed_by)
  VALUES
    (p_product_id, p_type, v_before, v_after, p_notes, p_performed_by);

  RETURN json_build_object('quantity_before', v_before, 'quantity_after', v_after);
END;
$$;
