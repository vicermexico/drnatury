import { notFound } from "next/navigation";
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { AppointmentActions } from "@/components/agenda/AppointmentActions";
import { CitaWhatsappPdf } from "@/components/agenda/CitaWhatsappPdf";
import { formatCSTDate, formatCSTTime } from "@/lib/appointments/availability";
import type { AppointmentStatus } from "@/types";

import { createHmac } from "crypto";

function buildConfirmUrl(id: string): string {
  const secret = process.env.APPOINTMENT_TOKEN_SECRET ?? "";
  const token = createHmac("sha256", secret).update(id).digest("hex").slice(0, 32);
  return `https://drnatury.com/cita/${id}?token=${token}`;
}

async function getAppointment(id: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("appointments")
    .select(`
      id, starts_at, ends_at, status, notes, created_at, pdf_url,
      branch_id, service_id,
      patient:profiles!patient_id(id, name, phone),
      services(name, duration_minutes),
      branches(name, address),
      therapist:profiles!therapist_id(id, name)
    `)
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (error || !data) return null;
  return data;
}

async function getTemplates() {
  const admin = createAdminClient();
  const { data } = await admin.from("whatsapp_templates").select("key, body").in("key", ["cita_con_pdf", "cita_sin_pdf"]);
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
  PENDIENTE:  "bg-amber-100 text-amber-700",
  CONFIRMADA: "bg-blue-100 text-blue-700",
  CANCELADA:  "bg-gray-100 text-gray-500",
  NO_ASISTIO: "bg-orange-100 text-orange-700",
  COMPLETADA: "bg-green-100 text-green-700",
};

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-start text-sm gap-4">
      <span className="text-gray-500 shrink-0">{label}</span>
      <span className="font-medium text-gray-900 text-right">{value}</span>
    </div>
  );
}

export default async function AppointmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [appt, templates] = await Promise.all([getAppointment(id), getTemplates()]);
  const confirmUrl = buildConfirmUrl(id);
  if (!appt) notFound();

  type Joined = {
    patient: { id: string; name: string; phone: string } | null;
    services: { name: string; duration_minutes: number } | null;
    branches: { name: string; address: string } | null;
    therapist: { id: string; name: string } | null;
  };

  const j = appt as typeof appt & Joined;
  const patient   = Array.isArray(j.patient)   ? j.patient[0]   : j.patient;
  const service   = Array.isArray(j.services)  ? j.services[0]  : j.services;
  const branch    = Array.isArray(j.branches)  ? j.branches[0]  : j.branches;
  const therapist = Array.isArray(j.therapist) ? j.therapist[0] : j.therapist;

  const status    = appt.status as AppointmentStatus;
  const dateLabel = formatCSTDate(appt.starts_at as string);
  const startTime = formatCSTTime(appt.starts_at as string);
  const endTime   = formatCSTTime(appt.ends_at as string);

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <div className="flex items-center gap-2 text-sm mb-3">
          <Link href="/asistente/citas" className="text-gray-400 hover:text-gray-600">Citas</Link>
          <span className="text-gray-300">/</span>
          <span className="text-gray-700 font-medium capitalize">{dateLabel}</span>
        </div>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{service?.name ?? "Cita"}</h1>
            <p className="text-sm text-gray-500 mt-0.5 capitalize">{dateLabel}</p>
          </div>
          <span className={`text-xs font-medium px-3 py-1.5 rounded-full shrink-0 ${STATUS_CLASS[status]}`}>
            {STATUS_LABEL[status]}
          </span>
        </div>
      </div>

      <section className="rounded-2xl bg-white border border-gray-200 p-5 space-y-3">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Detalles</h2>
        <Row label="Horario" value={`${startTime} - ${endTime}`} />
        {service && <Row label="Servicio" value={`${service.name} (${service.duration_minutes} min)`} />}
        {branch && <Row label="Sucursal" value={branch.name} />}
        {branch?.address && <Row label="Direccion" value={branch.address} />}
        {therapist && <Row label="Terapeuta" value={therapist.name} />}
      </section>

      {patient && (
        <section className="rounded-2xl bg-white border border-gray-200 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Paciente</h2>
            <Link href={`/asistente/pacientes/${patient.id}`} className="text-xs text-blue-600 hover:underline">
              Ver perfil
            </Link>
          </div>
          <Row label="Nombre" value={patient.name} />
          <Row label="Telefono" value={patient.phone} />
          <CitaWhatsappPdf
            appointmentId={appt.id}
            patientPhone={patient.phone}
            patientName={patient.name}
            pdfUrl={(appt as {pdf_url?: string | null}).pdf_url ?? null}
            templateConPdf={templates.conPdf}
            templateSinPdf={templates.sinPdf}
            confirmUrl={confirmUrl}
          />
        </section>
      )}

      {appt.notes && (
        <section className="rounded-2xl bg-white border border-gray-200 p-5">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Notas</h2>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{appt.notes}</p>
        </section>
      )}

      <AppointmentActions
        appointmentId={appt.id}
        currentStatus={status}
        branchId={appt.branch_id as string}
        serviceId={appt.service_id as string}
      />
    </div>
  );
}




