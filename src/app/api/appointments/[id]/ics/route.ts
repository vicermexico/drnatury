import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { guardAnyRole } from "@/lib/auth/api-guard";
import { buildIcsEvent, icsResponseHeaders } from "@/lib/calendar/ics";

// Genera un archivo .ics para que la terapeuta/master/asistente pueda
// agregar la cita a la agenda de su propio celular (Google Calendar,
// Apple Calendar, Outlook, etc). El titulo del evento usa el codigo del
// paciente (ej. P1277) en vez de su nombre completo, por privacidad.

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await guardAnyRole("TERAPEUTA", "MASTER", "ASISTENTE");
  if (guard.error) return guard.error;

  const { id } = await params;
  const admin = createAdminClient();

  const { data: appt } = await admin
    .from("appointments")
    .select(`
      id, starts_at, ends_at, modalidad, domicilio_direccion,
      patient:profiles!patient_id(name, phone, patient_code),
      services(name),
      branches(name, address)
    `)
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  if (!appt) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  type Patient = { name: string; phone: string; patient_code: string | null };
  type Service = { name: string };
  type Branch = { name: string; address: string };
  const patient = (Array.isArray(appt.patient) ? appt.patient[0] : appt.patient) as Patient | null;
  const service = (Array.isArray(appt.services) ? appt.services[0] : appt.services) as Service | null;
  const branch  = (Array.isArray(appt.branches) ? appt.branches[0] : appt.branches) as Branch | null;
  const esDomicilio = appt.modalidad === "DOMICILIO";

  const codigo = patient?.patient_code ?? patient?.name ?? "Paciente";
  const summary = `${codigo}${patient?.phone ? ` - ${patient.phone}` : ""}`;
  const location = esDomicilio
    ? `A domicilio${appt.domicilio_direccion ? `: ${appt.domicilio_direccion}` : ""}`
    : (branch?.address ?? branch?.name ?? "");
  const description = `${service?.name ?? "Cita"} · DrNatury`;

  const ics = buildIcsEvent({
    uid: `${appt.id}@drnatury.com`,
    startsAtISO: appt.starts_at as string,
    endsAtISO: appt.ends_at as string,
    summary,
    description,
    location,
    alarmMinutesBefore: 60,
  });

  return new NextResponse(ics, {
    status: 200,
    headers: icsResponseHeaders(`cita-${codigo}.ics`),
  });
}
