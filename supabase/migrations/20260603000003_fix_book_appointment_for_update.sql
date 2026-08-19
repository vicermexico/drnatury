-- ============================================================
-- Migration 014 — Fix book_appointment: FOR UPDATE con COUNT()
--
-- PostgreSQL no permite FOR UPDATE junto a funciones agregadas
-- en el mismo SELECT. La solución es envolver el FOR UPDATE en
-- una subquery que bloquea las filas individualmente, y luego
-- contar el resultado en la query exterior.
-- ============================================================

CREATE OR REPLACE FUNCTION book_appointment(
  p_patient_id   UUID,
  p_branch_id    UUID,
  p_service_id   UUID,
  p_starts_at    TIMESTAMPTZ,
  p_ends_at      TIMESTAMPTZ,
  p_created_by   UUID,
  p_therapist_id UUID DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_capacity    INTEGER;
  v_slot        TIMESTAMPTZ;
  v_overlap_cnt INTEGER;
  v_appt_id     UUID;
BEGIN
  -- Bloquea la sucursal durante esta transacción para evitar lecturas sucias
  SELECT simultaneous_capacity INTO v_capacity
  FROM   branches
  WHERE  id         = p_branch_id
    AND  is_active  = TRUE
    AND  deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('error', 'BRANCH_NOT_FOUND');
  END IF;

  -- Auto-asignación de terapeuta si no se especificó una
  IF p_therapist_id IS NULL THEN
    SELECT id INTO p_therapist_id
    FROM   profiles
    WHERE  branch_id  = p_branch_id
      AND  'TERAPEUTA' = ANY(roles)
      AND  is_active  = TRUE
      AND  deleted_at IS NULL
    ORDER BY created_at
    LIMIT 1;

    IF p_therapist_id IS NULL THEN
      RETURN json_build_object('error', 'NO_THERAPIST');
    END IF;
  END IF;

  -- Verifica capacidad bloque a bloque (30 min cada uno).
  -- FOR UPDATE va en la subquery (bloquea filas individuales);
  -- COUNT(*) va en la query exterior para evitar el error
  -- "FOR UPDATE is not allowed with aggregate functions".
  v_slot := p_starts_at;
  WHILE v_slot < p_ends_at LOOP
    SELECT COUNT(*) INTO v_overlap_cnt
    FROM (
      SELECT 1
      FROM   appointments
      WHERE  branch_id  = p_branch_id
        AND  deleted_at IS NULL
        AND  status     NOT IN ('CANCELADA', 'NO_ASISTIO')
        AND  starts_at  < v_slot + INTERVAL '30 minutes'
        AND  ends_at    > v_slot
      FOR UPDATE
    ) locked_rows;

    IF v_overlap_cnt >= v_capacity THEN
      RETURN json_build_object('error', 'SLOT_TAKEN');
    END IF;

    v_slot := v_slot + INTERVAL '30 minutes';
  END LOOP;

  -- Inserta la cita
  INSERT INTO appointments (
    patient_id, branch_id, service_id, therapist_id,
    starts_at, ends_at, status, created_by
  ) VALUES (
    p_patient_id, p_branch_id, p_service_id, p_therapist_id,
    p_starts_at, p_ends_at, 'PENDIENTE', p_created_by
  )
  RETURNING id INTO v_appt_id;

  RETURN json_build_object(
    'id',           v_appt_id,
    'therapist_id', p_therapist_id,
    'starts_at',    p_starts_at,
    'ends_at',      p_ends_at,
    'status',       'PENDIENTE'
  );
END;
$$;
