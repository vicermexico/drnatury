import { Suspense } from "react";
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { AppointmentCard, type AppointmentData } from "@/components/agenda/AppointmentCard";
import { DateNav } from "@/components/ui/DateNav";
import type { AppointmentStatus } from "@/types";

async function getBranches() {
  const admin = createAdminClient();
  const { data } = await admin
    .from("branches").select("id, name")
    .eq("is_active", true).is("deleted_at", null).order("name");
  return data ?? [];
}

async function getAppointments(date: string, branchId?: string) {
  const admin = createAdminClient();
  const dayStart = new Date(`${date}T06:00:00Z`);
  const dayEnd   = new Date(dayStart.getTime() + 86_400_000);

  let query = admin
    .from("appointments")
    .select(`
      id, starts_at, ends_at, status, modalidad, domicilio_direccion,
      patient:profiles!patient_id(name, phone),
      services(name),
      branches(id, name),
      therapist:profiles!therapist_id(id, name)
    `)
    .is("deleted_at", null)
    .gte("starts_at", dayStart.toISOString())
    .lt("starts_at", dayEnd.toISOString())
    .order("starts_at");

  if (branchId) query = query.eq("branch_id", branchId);
  const { data } = await query;
  return data ?? [];
}

const STATUS_LABEL: Record<AppointmentStatus, string> = {
  PENDIENTE: "Pendiente", CONFIRMADA: "Confirmada", CANCELADA: "Cancelada",
  NO_ASISTIO: "No asistió", COMPLETADA: "Completada",
};

export default async function AsistenteCitasPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; branch_id?: string }>;
}) {
  const { date: dateParam, branch_id } = await searchParams;
  const todayCst = new Date().toLocaleDateString("en-CA", { timeZone: "America/Monterrey" });
  const date = dateParam ?? todayCst;

  const [branches, rawAppts] = await Promise.all([getBranches(), getAppointments(date, branch_id)]);

  type ApptRow = {
    id: string; starts_at: string; ends_at: string; status: AppointmentStatus;
    modalidad?: "CONSULTORIO" | "DOMICILIO"; domicilio_direccion?: string | null;
    patient: { name: string; phone: string } | null;
    services: { name: string } | null;
    branches: { id: string; name: string } | null;
    therapist: { id: string; name: string } | null;
  };
  const appts = rawAppts as unknown as ApptRow[];

  const byBranch = new Map<string, { branchName: string; items: { appt: AppointmentData; id: string }[] }>();
  for (const a of appts) {
    const branch    = Array.isArray(a.branches)  ? a.branches[0]  : a.branches;
    const patient   = Array.isArray(a.patient)   ? a.patient[0]   : a.patient;
    const service   = Array.isArray(a.services)  ? a.services[0]  : a.services;
    const therapist = Array.isArray(a.therapist) ? a.therapist[0] : a.therapist;
    if (!branch) continue;
    if (!byBranch.has(branch.id)) byBranch.set(branch.id, { branchName: branch.name, items: [] });
    byBranch.get(branch.id)!.items.push({
      id: a.id,
      appt: {
        id: a.id, starts_at: a.starts_at, ends_at: a.ends_at, status: a.status,
        patient_name: patient?.name, patient_phone: patient?.phone,
        service_name: service?.name, therapist_name: therapist?.name,
        modalidad: a.modalidad, domicilio_direccion: a.domicilio_direccion,
      },
    });
  }

  const statCounts = appts.reduce<Partial<Record<AppointmentStatus, number>>>((acc, a) => {
    acc[a.status] = (acc[a.status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="max-w-3xl space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Citas</h1>
        <Link href="/asistente/citas/nueva"
          className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition shrink-0">
          + Nueva cita
        </Link>
      </div>

      <Suspense>
        <DateNav branches={branches} />
      </Suspense>

      {appts.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <span className="text-xs bg-gray-100 text-gray-600 px-3 py-1.5 rounded-full font-medium">
            {appts.length} total
          </span>
          {(Object.entries(statCounts) as [AppointmentStatus, number][]).map(([status, count]) => (
            <span key={status} className="text-xs bg-gray-100 text-gray-600 px-3 py-1.5 rounded-full">
              {STATUS_LABEL[status]}: {count}
            </span>
          ))}
        </div>
      )}

      {appts.length === 0 ? (
        <div className="rounded-2xl bg-white border border-dashed border-gray-300 p-10 text-center">
          <p className="text-gray-500 text-sm mb-2">Sin citas para este día</p>
          <Link href="/asistente/citas/nueva" className="text-blue-600 text-sm underline">
            Agendar una cita
          </Link>
        </div>
      ) : (
        <div className="space-y-8">
          {Array.from(byBranch.entries()).map(([, { branchName, items }]) => (
            <section key={branchName} className="space-y-2">
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                {branchName} — {items.length} cita{items.length !== 1 ? "s" : ""}
              </h2>
              {items.map(({ appt, id }) => (
                <Link key={id} href={`/asistente/citas/${id}`}
                  className="block rounded-2xl hover:shadow-sm transition">
                  <AppointmentCard appt={appt} showPatient showTherapist />
                </Link>
              ))}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
