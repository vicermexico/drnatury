import { notFound } from "next/navigation";
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/auth";
import { TerapeutaActions } from "@/components/agenda/TerapeutaActions";
import { CitaWhatsappPdf } from "@/components/agenda/CitaWhatsappPdf";
import { formatCSTDate, formatCSTTime } from "@/lib/appointments/availability";
import type { AppointmentStatus } from "@/types";
import { createHmac } from "crypto";

function buildConfirmUrl(id: string): string {
  const secret = process.env.APPOINTMENT_TOKEN_SECRET ?? "";
  const token = createHmac("sha256", secret).update(id).digest("hex").slice(0, 32);
  return `https://drnatury.com/cita/${id}?token=${token}`;
}

async function getCita(id: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("appointments")
    .select(`
      id, starts_at, ends_at, status, notes, pdf_url,
      patient:profiles!patient_id(name, phone, age, city, consultation_reason),
      services(name, duration_minutes),
      branches(name, address)
    `)
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (error || !data) return null;
  return data;
}

async function getTemplates() {
  const admin = createAdminClient();
  const { data } = await admin
    .from("whatsapp_templates")
    .select("key, body")
    .in("key", ["cita_con_pdf", "cita_sin_pdf"]);
  const map: Record<string, string> = {};
  for (const t of data ?? []) map[t.key] = t.body;
  return {
    conPdf: map["cita_con_pdf"] ?? "Hola {nombre}, aqui esta tu resultado: {link}",
    sinPdf: map["cita_sin_pdf"] ?? "Hola {nombre}, gracias por tu visita en DrNatury.",
  };
}

const STATUS_LABEL: Record<AppointmentStatus, string> = {
  PENDIENTE:  "Pendiente",
  CONFIRMADA: "Confirmada",
  CANCELADA:  "Cancelada",
  NO_ASISTIO: "No asistio",
  COMPLETADA: "Completada",
};

const STATUS_CLASS: Record<AppointmentStatus, string> = {
  PENDIENTE:  "bg-yellow-100 text-yellow-700",
  CONFIRMADA: "bg-green-100  text-green-700",
  CANCELADA:  "bg-gray-100   text-gray-500",
  NO_ASISTIO: "bg-orange-100 text-orange-700",
  COMPLETADA: "bg-teal-100   text-teal-700",
};

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-start text-sm gap-4">
      <span className="text-gray-500 shrink-0">{label}</span>
      <span className="font-medium text-gray-900 text-right">{value}</span>
    </div>
  );
}

export default async function TerapeutaCitaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireAuth();
  const [appt, templates] = await Promise.all([getCita(id), getTemplates()]);
  if (!appt) notFound();

  const confirmUrl = buildConfirmUrl(id);

  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("branch_id").eq("id", user.id).single();
  let mostrarCelular = true;
  if (profile?.branch_id) {
    const { data: branchData } = await admin.from("branches").select("mostrar_celular").eq("id", profile.branch_id).single();
    mostrarCelular = (branchData as unknown as { mostrar_celular: boolean })?.mostrar_celular ?? true;
  }

  const citaStart = new Date(appt.starts_at as string);
  const diezMinDespues = new Date(citaStart.getTime() + 10 * 60 * 1000);
  const ahora = new Date();
  const puedeVerContacto = mostrarCelular || ahora >= diezMinDespues;

  type Joined = {
    patient: { name: string; phone: string; age: number | null; city: string | null; consultation_reason: string | null } | null;
    services: { name: string; duration_minutes: number } | null;
    branches: { name: string; address: string } | null;
  };
  const j = appt as typeof appt & Joined;
  const patient = Array.isArray(j.patient)  ? j.patient[0]  : j.patient;
  const service = Array.isArray(j.services) ? j.services[0] : j.services;
  const branch  = Array.isArray(j.branches) ? j.branches[0] : j.branches;

  const status    = appt.status as AppointmentStatus;
  const dateLabel = formatCSTDate(appt.starts_at as string);
  const startTime = formatCSTTime(appt.starts_at as string);
  const endTime   = formatCSTTime(appt.ends_at as string);

  return (
    <div className="space-y-5">
      <div>
        <Link href="/terapeuta/agenda" className="text-sm text-gray-400 hover:text-gray-600">
          &larr; Agenda
        </Link>
      </div>

      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">{service?.name ?? "Cita"}</h1>
          <p className="text-sm text-gray-500 mt-0.5 capitalize">{dateLabel}</p>
        </div>
        <span className={`text-xs font-semibold px-3 py-1.5 rounded-full shrink-0 ${STATUS_CLASS[status]}`}>
          {STATUS_LABEL[status]}
        </span>
      </div>

      <section className="rounded-2xl bg-white border border-gray-200 p-5 space-y-3">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Cita</h2>
        <Row label="Horario" value={`${startTime} - ${endTime}`} />
        {service && <Row label="Servicio" value={`${service.name} (${service.duration_minutes} min)`} />}
        {branch && <Row label="Sucursal" value={branch.name} />}
        {branch?.address && <Row label="Direccion" value={branch.address} />}
      </section>

      {patient && (
        <section className="rounded-2xl bg-white border border-gray-200 p-5 space-y-3">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Paciente</h2>
          <Row label="Nombre" value={patient.name} />
          {puedeVerContacto && <Row label="Telefono" value={patient.phone} />}
          {patient.age && <Row label="Edad" value={`${patient.age} anos`} />}
          {patient.city && <Row label="Ciudad" value={patient.city} />}
          {patient.consultation_reason && (
            <div className="pt-1">
              <p className="text-xs text-gray-400 mb-1">Motivo de consulta</p>
              <p className="text-sm text-gray-700">{patient.consultation_reason}</p>
            </div>
          )}
          {!puedeVerContacto && (
            <p className="text-xs text-amber-600 bg-amber-50 rounded-xl px-3 py-2">
              El telefono y opciones de contacto estaran disponibles 10 minutos despues de la hora de la cita.
            </p>
          )}
          {puedeVerContacto && (
            <CitaWhatsappPdf
              appointmentId={appt.id}
              patientPhone={patient.phone}
              patientName={patient.name}
              pdfUrl={(appt as {pdf_url?: string | null}).pdf_url ?? null}
              templateConPdf={templates.conPdf}
              templateSinPdf={templates.sinPdf}
              confirmUrl={confirmUrl}
            />
          )}
        </section>
      )}

      {appt.notes && (
        <section className="rounded-2xl bg-white border border-gray-200 p-5">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Notas</h2>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{appt.notes}</p>
        </section>
      )}

      <TerapeutaActions appointmentId={appt.id} currentStatus={status} />
    </div>
  );
}