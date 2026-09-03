import Link from "next/link";

export const revalidate = 0;
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/auth";
import { formatCSTTime } from "@/lib/appointments/availability";
import { MapsLink } from "@/components/agenda/MapsLink";
import type { AppointmentStatus } from "@/types";

async function getMisCitas(therapistId: string, branchId: string | null, dateStr: string) {
  const admin = createAdminClient();
  const dayStart = new Date(`${dateStr}T06:00:00Z`);
  const dayEnd   = new Date(dayStart.getTime() + 86_400_000);

  const { data: misCitas } = await admin
    .from("appointments")
    .select(`id, starts_at, ends_at, status, modalidad, domicilio_direccion,
      patient:profiles!patient_id(name, phone),
      services(name, duration_minutes),
      branches(name)`)
    .eq("therapist_id", therapistId)
    .is("deleted_at", null)
    .gte("starts_at", dayStart.toISOString())
    .lt("starts_at", dayEnd.toISOString())
    .order("starts_at");

  let sinTerapeuta: typeof misCitas = [];
  if (branchId) {
    const { data } = await admin
      .from("appointments")
      .select(`id, starts_at, ends_at, status, modalidad, domicilio_direccion,
        patient:profiles!patient_id(name, phone),
        services(name, duration_minutes),
        branches(name)`)
      .is("therapist_id", null)
      .eq("branch_id", branchId)
      .is("deleted_at", null)
      .gte("starts_at", dayStart.toISOString())
      .lt("starts_at", dayEnd.toISOString())
      .order("starts_at");
    sinTerapeuta = data ?? [];
  }

  const todas = [...(misCitas ?? []), ...sinTerapeuta];
  todas.sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
  return todas;
}

function cstDateStr(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toLocaleDateString("en-CA", { timeZone: "America/Monterrey" });
}

const STATUS_LABEL: Record<AppointmentStatus, string> = {
  PENDIENTE:  "Pendiente",
  CONFIRMADA: "Confirmada",
  CANCELADA:  "Cancelada",
  NO_ASISTIO: "No asistio",
  COMPLETADA: "Completada",
};

const STATUS_DOT: Record<AppointmentStatus, string> = {
  PENDIENTE:  "bg-yellow-400",
  CONFIRMADA: "bg-green-500",
  CANCELADA:  "bg-red-400",
  NO_ASISTIO: "bg-orange-400",
  COMPLETADA: "bg-gray-300",
};

const STATUS_CARD: Record<AppointmentStatus, string> = {
  PENDIENTE:  "bg-yellow-50  border-yellow-200",
  CONFIRMADA: "bg-green-50   border-green-200",
  CANCELADA:  "bg-gray-50    border-gray-200  opacity-60",
  NO_ASISTIO: "bg-orange-50  border-orange-200",
  COMPLETADA: "bg-gray-50    border-gray-200  opacity-60",
};

export default async function TerapeutaAgendaPage({
  searchParams,
}: {
  searchParams: Promise<{ dia?: string }>;
}) {
  const user = await requireAuth();
  const { dia } = await searchParams;

  const todayStr    = cstDateStr(0);
  const tomorrowStr = cstDateStr(1);
  const dateStr  = dia === "manana" ? tomorrowStr : todayStr;
  const isToday  = dateStr === todayStr;

  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("branch_id").eq("id", user.id).single();
  const branchId = profile?.branch_id ?? null;

  // Obtener mostrar_celular de la sucursal
  let mostrarCelular = true;
  if (branchId) {
    const { data: branchData } = await admin.from("branches").select("mostrar_celular").eq("id", branchId).single();
    mostrarCelular = (branchData as unknown as { mostrar_celular: boolean })?.mostrar_celular ?? true;
  }

  const appointments = await getMisCitas(user.id, branchId, dateStr);

  const dateLabel = new Date(`${dateStr}T12:00:00`).toLocaleDateString("es-MX", {
    weekday: "long", day: "numeric", month: "long",
    timeZone: "America/Monterrey",
  });

  const active   = appointments.filter(a => !["CANCELADA", "COMPLETADA", "NO_ASISTIO"].includes(a.status));
  const finished = appointments.filter(a =>  ["CANCELADA", "COMPLETADA", "NO_ASISTIO"].includes(a.status));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Mi agenda</h1>
        <p className="text-sm text-gray-500 mt-0.5 capitalize">{dateLabel}</p>
      </div>

      <div className="flex rounded-xl border border-gray-200 overflow-hidden bg-white p-1 gap-1">
        <Link href="/terapeuta/agenda"
          className={`flex-1 text-center py-2 text-sm font-medium rounded-lg transition ${
            isToday ? "bg-gray-900 text-white" : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
          }`}>
          Hoy
        </Link>
        <Link href="/terapeuta/agenda?dia=manana"
          className={`flex-1 text-center py-2 text-sm font-medium rounded-lg transition ${
            !isToday ? "bg-gray-900 text-white" : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
          }`}>
          Manana
        </Link>
      </div>

      {appointments.length === 0 ? (
        <div className="rounded-2xl bg-white border border-dashed border-gray-300 p-10 text-center">
          <p className="text-gray-500 text-sm">No tienes citas asignadas para {isToday ? "hoy" : "manana"}</p>
        </div>
      ) : (
        <div className="space-y-6">
          {active.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                {active.length} cita{active.length !== 1 ? "s" : ""} pendiente{active.length !== 1 ? "s" : ""}
              </h2>
              {active.map(a => <CitaCard key={a.id} appt={a} mostrarCelular={mostrarCelular} />)}
            </section>
          )}
          {finished.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Finalizadas / canceladas</h2>
              {finished.map(a => <CitaCard key={a.id} appt={a} mostrarCelular={mostrarCelular} />)}
            </section>
          )}
        </div>
      )}
    </div>
  );
}

type RawAppt = Awaited<ReturnType<typeof getMisCitas>>[number];

function buildMapsUrlFromAddress(address: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

function CitaCard({ appt, mostrarCelular }: { appt: RawAppt; mostrarCelular: boolean }) {
  const status  = appt.status as AppointmentStatus;
  const patient = Array.isArray(appt.patient)  ? appt.patient[0]  : appt.patient  as { name: string; phone: string } | null;
  const service = Array.isArray(appt.services) ? appt.services[0] : appt.services as { name: string; duration_minutes: number } | null;
  const branch  = Array.isArray(appt.branches) ? appt.branches[0] : appt.branches as { name: string } | null;
  const esDomicilio = (appt as unknown as { modalidad?: string }).modalidad === "DOMICILIO";
  const direccion = (appt as unknown as { domicilio_direccion?: string | null }).domicilio_direccion;

  return (
    <Link href={`/terapeuta/citas/${appt.id}`}
      className={`block rounded-2xl border p-4 space-y-2.5 hover:shadow-sm transition ${STATUS_CARD[status]}`}>
      <div className="flex items-start justify-between gap-2">
        <span className="text-2xl font-bold text-gray-900 leading-none">
          {formatCSTTime(appt.starts_at as string)}
        </span>
        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-white/80 border border-gray-200 shrink-0 text-gray-600">
          <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[status]}`} />
          {STATUS_LABEL[status]}
        </span>
      </div>
      {service && (
        <p className="text-sm font-semibold text-gray-900">
          {service.name}
          <span className="font-normal text-gray-500"> · {service.duration_minutes} min</span>
        </p>
      )}
      <div className="space-y-0.5">
        {patient && <p className="text-sm font-medium text-gray-800">{patient.name}</p>}
        {mostrarCelular && patient?.phone && <p className="text-xs text-gray-500">{patient.phone}</p>}
        {!esDomicilio && branch && <p className="text-xs text-gray-500">{branch.name}</p>}
        {esDomicilio && (
          <p className="text-xs text-gray-500">
            🏠 A domicilio{direccion ? `: ${direccion}` : ""}
            {direccion && (
              <>
                {" "}·{" "}
                <MapsLink href={buildMapsUrlFromAddress(direccion)} label="🗺️ Cómo llegar" />
              </>
            )}
          </p>
        )}
      </div>
    </Link>
  );
}




