-- Contador para los codigos de contacto "P-####" que se guardan solos en
-- el Directorio de contactos del celular de Master (via Google Contacts)
-- cuando agenda desde el link rapido con telefono. Empieza en 1334
-- porque Master ya tenia contactos manuales hasta el P-1333.
create table if not exists patient_contact_counter (
  id uuid primary key default '00000000-0000-0000-0000-000000000001',
  next_number integer not null default 1334
);
insert into patient_contact_counter (id, next_number)
  values ('00000000-0000-0000-0000-000000000001', 1334)
  on conflict (id) do nothing;

create or replace function next_patient_code()
returns text
language plpgsql
as $$
declare
  n integer;
begin
  update patient_contact_counter
    set next_number = next_number + 1
    where id = '00000000-0000-0000-0000-000000000001'
    returning next_number - 1 into n;
  return 'P-' || n;
end;
$$;

-- Un telefono -> un codigo, para no crear un contacto duplicado cada vez
-- que el mismo paciente vuelve a agendar.
create table if not exists patient_contacts (
  phone text primary key,
  code text not null,
  google_resource_name text,
  created_at timestamptz not null default now()
);
