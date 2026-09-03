-- Fix: book_appointment RPC was missing the p_notes parameter, which the
-- app's API route always sends. Because CREATE OR REPLACE FUNCTION with a
-- different parameter list creates a NEW overload instead of replacing the
-- old one, PostgREST ended up unable to resolve the named-parameter call
-- against either overload, and booking failed with:
--   "Could not find the function public.book_appointment(...) in the
--    schema cache"
--
-- Fix: drop both prior signatures, then create a single consolidated
-- function (with p_notes restored) so exactly one overload exists and it
-- matches the API route's RPC call.

DROP FUNCTION IF EXISTS book_appointment(uuid, uuid, uuid, timestamptz, timestamptz, uuid, uuid, text);
DROP FUNCTION IF EXISTS book_appointment(uuid, uuid, uuid, timestamptz, timestamptz, uuid, uuid, text, text);

CREATE OR REPLACE FUNCTION public.book_appointment(
  p_patient_id          uuid,
  p_branch_id           uuid,
  p_service_id          uuid,
  p_starts_at           timestamp with time zone,
  p_ends_at             timestamp with time zone,
  p_created_by          uuid,
  p_therapist_id        uuid DEFAULT NULL::uuid,
  p_notes               text DEFAULT NULL::text,
  p_modalidad           text DEFAULT 'CONSULTORIO'::text,
  p_domicilio_direccion text DEFAULT NULL::text
)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_capacity    INTEGER;
  v_slot        TIMESTAMPTZ;
  v_overlap_cnt INTEGER;
  v_appt_id     UUID;
BEGIN
  IF p_modalidad = 'DOMICILIO' THEN
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
      starts_at, ends_at, status, created_by, notes,
      modalidad, domicilio_direccion
    ) VALUES (
      p_patient_id, p_branch_id, p_service_id, p_therapist_id,
      p_starts_at, p_ends_at, 'PENDIENTE', p_created_by, p_notes,
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
    starts_at, ends_at, status, created_by, notes,
    modalidad, domicilio_direccion
  ) VALUES (
    p_patient_id, p_branch_id, p_service_id, p_therapist_id,
    p_starts_at, p_ends_at, 'PENDIENTE', p_created_by, p_notes,
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
$function$
;
