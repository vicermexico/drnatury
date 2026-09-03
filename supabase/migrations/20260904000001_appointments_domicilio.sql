-- ============================================================
-- Migration — Citas a domicilio
-- Agrega modalidad (CONSULTORIO/DOMICILIO) y dirección de domicilio
-- a appointments. Para citas a domicilio no se usa la capacidad de
-- la sucursal: solo se evita que el terapeuta asignado quede con
-- dos citas encimadas (CLAUDE.md regla 4: FOR UPDATE).
-- ============================================================

ALTER TABLE appointments
  ADD COLUMN modalidad TEXT NOT NULL DEFAULT 'CONSULTORIO'
    CHECK (modalidad IN ('CONSULTORIO', 'DOMICILIO')),
  ADD COLUMN domicilio_direccion TEXT;

CREATE OR REPLACE FUNCTION book_appointment(
  p_patient_id          UUID,
  p_branch_id           UUID,
  p_service_id          UUID,
  p_starts_at           TIMESTAMPTZ,
  p_ends_at             TIMESTAMPTZ,
  p_created_by          UUID,
  p_therapist_id        UUID DEFAULT NULL,
  p_modalidad           TEXT DEFAULT 'CONSULTORIO',
  p_domicilio_direccion TEXT DEFAULT NULL
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
  IF p_modalidad = 'DOMICILIO' THEN
    -- No hay concepto de sucursal/capacidad para domicilio: solo
    -- evitamos que el terapeuta asignado quede con dos citas encimadas.
    IF p_therapist_id IS NOT NULL THEN
      SELECT COUNT(*) INTO v_overlap_cnt
      FROM (
        SELECT 1
        FROM   appointments
        WHERE  therapist_id = p_therapist_id
          AND  deleted_at   IS NULL
          AND  status       NOT IN ('CANCELADA', 'NO_ASISTIO')
          AND  starts_at    < p_ends_at
          AND  ends_at      > p_starts_at
        FOR UPDATE
      ) locked_rows;

      IF v_overlap_cnt > 0 THEN
        RETURN json_build_object('error', 'SLOT_TAKEN');
      END IF;
    END IF;

    INSERT INTO appointments (
      patient_id, branch_id, service_id, therapist_id,
      starts_at, ends_at, status, created_by,
      modalidad, domicilio_direccion
    ) VALUES (
      p_patient_id, p_branch_id, p_service_id, p_therapist_id,
      p_starts_at, p_ends_at, 'PENDIENTE', p_created_by,
      'DOMICILIO', p_domicilio_direccion
    )
    RETURNING id INTO v_appt_id;

    RETURN json_build_object(
      'id',           v_appt_id,
      'therapist_id', p_therapist_id,
      'starts_at',    p_starts_at,
      'ends_at',      p_ends_at,
      'status',       'PENDIENTE'
    );
  END IF;

  -- Modalidad CONSULTORIO: comportamiento existente, sin cambios.
  SELECT simultaneous_capacity INTO v_capacity
  FROM   branches
  WHERE  id         = p_branch_id
    AND  is_active  = TRUE
    AND  deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('error', 'BRANCH_NOT_FOUND');
  END IF;

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

  INSERT INTO appointments (
    patient_id, branch_id, service_id, therapist_id,
    starts_at, ends_at, status, created_by,
    modalidad, domicilio_direccion
  ) VALUES (
    p_patient_id, p_branch_id, p_service_id, p_therapist_id,
    p_starts_at, p_ends_at, 'PENDIENTE', p_created_by,
    'CONSULTORIO', NULL
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
