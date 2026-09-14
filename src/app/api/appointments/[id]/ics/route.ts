import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { guardAnyRole } from "@/lib/auth/api-guard";

// Genera un archivo .ics para que la terapeuta/master/asistente pueda
// agregar la cita a la agenda de su propio celular (Google Calendar,
// Apple Calendar, Outlook, etc). El titulo del evento usa el codigo del
// paciente (ej. P1277) en vez de su nombre completo, por privacidad.

function icsEscape(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

function toIcsDate(iso: string): string {
  // YYYYMMDDTHHMMSSZ
  return new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

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

  const now = toIcsDate(new Date().toISOString());
  const uid = `${appt.id}@drnatury.com`;

  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//DrNatury//Citas//ES",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${now}`,
    `DTSTART:${toIcsDate(appt.starts_at as string)}`,
    `DTEND:${toIcsDate(appt.ends_at as string)}`,
    `SUMMARY:${icsEscape(summary)}`,
    `DESCRIPTION:${icsEscape(description)}`,
    `LOCATION:${icsEscape(location)}`,
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    "DESCRIPTION:Recordatorio de cita",
    "TRIGGER:-PT1H",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");

  return new NextResponse(ics, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="cita-${codigo}.ics"`,
    },
  });
}
