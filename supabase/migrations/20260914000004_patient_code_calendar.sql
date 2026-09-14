-- Codigo secuencial de paciente (ej. P1277), asignado automaticamente a
-- cada paciente nuevo que se registre de aqui en adelante. No se asignan
-- codigos retroactivos a pacientes que ya existian.
CREATE SEQUENCE IF NOT EXISTS patient_code_seq START WITH 1277;

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS patient_code TEXT;

CREATE OR REPLACE FUNCTION assign_patient_code() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.patient_code IS NULL AND NEW.roles @> ARRAY['PACIENTE']::user_role[] THEN
    NEW.patient_code := 'P' || nextval('patient_code_seq')::text;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_assign_patient_code ON profiles;
CREATE TRIGGER trg_assign_patient_code
BEFORE INSERT ON profiles
FOR EACH ROW EXECUTE FUNCTION assign_patient_code();
