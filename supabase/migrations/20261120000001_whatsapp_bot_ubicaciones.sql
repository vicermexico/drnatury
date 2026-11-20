-- Ubicaciones (pines de GPS) que Master guarda parado en cada
-- consultorio desde el panel (ver /master/asistente-whatsapp/ubicaciones),
-- para que el Asistente de WhatsApp pueda mandar el link de Google Maps
-- exacto cuando un paciente pida "la ubicación"/"la dirección" de algun
-- lugar (ej. "San Blas", "Mitras"). Sin RLS porque solo se usa desde
-- endpoints de servidor con el cliente admin (service role), igual que
-- el resto de las tablas whatsapp_bot_*.
create table if not exists whatsapp_bot_ubicaciones (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  nombre_normalizado text not null unique,
  lat double precision not null,
  lng double precision not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
