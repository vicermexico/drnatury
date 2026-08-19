-- ============================================================
-- Migration 008 — Funciones de utilidad
-- ============================================================

-- ── Helpers de RLS ───────────────────────────────────────────

-- Devuelve los roles del usuario actual (cacheable en la sesión)
CREATE OR REPLACE FUNCTION get_my_roles()
RETURNS user_role[] AS $$
  SELECT roles FROM profiles WHERE id = auth.uid();
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- True si el usuario actual tiene el rol indicado
CREATE OR REPLACE FUNCTION has_role(r user_role)
RETURNS BOOLEAN AS $$
  SELECT r = ANY(get_my_roles());
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- True si el usuario actual tiene alguno de los roles indicados
CREATE OR REPLACE FUNCTION has_any_role(r user_role[])
RETURNS BOOLEAN AS $$
  SELECT get_my_roles() && r;
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- ── Disponibilidad de citas (PRD §9) ────────────────────────
-- Devuelve TRUE si todos los bloques de 30 min entre p_starts_at
-- y p_ends_at tienen capacidad disponible en la sucursal.
-- Llamar dentro de una transacción con FOR UPDATE para garantizar
-- consistencia ante concurrencia (CLAUDE.md regla 4).
CREATE OR REPLACE FUNCTION check_slot_available(
  p_branch_id UUID,
  p_starts_at TIMESTAMPTZ,
  p_ends_at   TIMESTAMPTZ
)
RETURNS BOOLEAN AS $$
DECLARE
  v_capacity    INTEGER;
  v_overlap_cnt INTEGER;
  v_slot        TIMESTAMPTZ;
BEGIN
  SELECT simultaneous_capacity INTO v_capacity
  FROM branches
  WHERE id = p_branch_id AND is_active = TRUE AND deleted_at IS NULL;

  IF v_capacity IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Verifica cada bloque de 30 min que ocupa el servicio
  v_slot := p_starts_at;
  WHILE v_slot < p_ends_at LOOP
    SELECT COUNT(*) INTO v_overlap_cnt
    FROM appointments
    WHERE branch_id   = p_branch_id
      AND deleted_at  IS NULL
      AND status      NOT IN ('CANCELADA', 'NO_ASISTIO')
      AND starts_at   < v_slot + INTERVAL '30 minutes'
      AND ends_at     > v_slot;

    IF v_overlap_cnt >= v_capacity THEN
      RETURN FALSE;
    END IF;

    v_slot := v_slot + INTERVAL '30 minutes';
  END LOOP;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ── Próximos horarios disponibles (sugerencia tras colisión) ─
-- Devuelve hasta p_limit slots disponibles a partir de p_from
-- en incrementos de 30 min (PRD §9: "sugerencia de horarios cercanos").
CREATE OR REPLACE FUNCTION next_available_slots(
  p_branch_id      UUID,
  p_service_id     UUID,
  p_from           TIMESTAMPTZ,
  p_limit          INTEGER DEFAULT 3
)
RETURNS TABLE (slot_start TIMESTAMPTZ, slot_end TIMESTAMPTZ) AS $$
DECLARE
  v_duration  INTERVAL;
  v_candidate TIMESTAMPTZ;
  v_found     INTEGER := 0;
BEGIN
  SELECT (duration_minutes || ' minutes')::INTERVAL INTO v_duration
  FROM services WHERE id = p_service_id;

  IF v_duration IS NULL THEN
    RETURN;
  END IF;

  v_candidate := p_from;

  WHILE v_found < p_limit LOOP
    IF check_slot_available(p_branch_id, v_candidate, v_candidate + v_duration) THEN
      slot_start := v_candidate;
      slot_end   := v_candidate + v_duration;
      RETURN NEXT;
      v_found := v_found + 1;
    END IF;
    v_candidate := v_candidate + INTERVAL '30 minutes';

    -- Evita loop infinito: no buscar más allá de 30 días
    IF v_candidate > p_from + INTERVAL '30 days' THEN
      EXIT;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;
