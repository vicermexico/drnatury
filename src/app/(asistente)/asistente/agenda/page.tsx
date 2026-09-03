import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin"
import { AppointmentCard, type AppointmentData } from "@/components/agenda/AppointmentCard";

async function getTodayAppointments() {
  const admin = createAdminClient();
  const now = new Date();
  const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 6, 0, 0));
  const todayEnd   = new Date(todayStart.getTime() + 86_400_000);

  const { data } = await admin
    .from("appointments")
    .select(`
      id, starts_at, ends_at, status, modalidad, domicilio_direccion,
      patient:profiles!patient_id(name, phone),
      services(name),
      branches(id, name),
      therapists:profiles!therapist_id(id, name)
    `)
    .is("deleted_at", null)
    .gte("starts_at", todayStart.toISOString())
    .lt("starts_at", todayEnd.toISOString())
    .order("starts_at");
  return data ?? [];
}

export default async function AsistenteAgendaPage() {
  const appointments = await getTodayAppointments();

  const byBranch = new Map<string, { branchName: string; appts: AppointmentData[] }>();
  for (const a of appointments) {
    const branch    = Array.isArray(a.branches)   ? a.branches[0]   : a.branches   as { id: string; name: string } | null;
    const patient   = Array.isArray(a.patient)    ? a.patient[0]    : a.patient    as { name: string; phone: string } | null;
    const service   = Array.isArray(a.services)   ? a.services[0]   : a.services   as { name: string } | null;
    const therapist = Array.isArray(a.therapists) ? a.therapists[0] : a.therapists as { name: string } | null;
    if (!branch) continue;
    if (!byBranch.has(branch.id)) byBranch.set(branch.id, { branchName: branch.name, appts: [] });
    byBranch.get(branch.id)!.appts.push({
      id: a.id,
      starts_at: a.starts_at as string,
      ends_at: a.ends_at as string,
      status: a.status as AppointmentData["status"],
      patient_name: patient?.name,
      patient_phone: patient?.phone,
      service_name: service?.name,
      therapist_name: therapist?.name,
      modalidad: a.modalidad as AppointmentData["modalidad"],
      domicilio_direccion: a.domicilio_direccion as string | null,
    });
  }

  const today = new Date().toLocaleDateString("es-MX", {
    weekday: "long", day: "numeric", month: "long", timeZone: "America/Monterrey",
  });

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Agenda de hoy</h1>
        <p className="text-sm text-gray-500 mt-1 capitalize">{today}</p>
      </div>

      {appointments.length === 0 ? (
        <div className="rounded-2xl bg-white border border-dashed border-gray-300 p-10 text-center">
          <p className="text-gray-500 text-sm">No hay citas agendadas para hoy</p>
        </div>
      ) : (
        <div className="space-y-8">
          {Array.from(byBranch.entries()).map(([, { branchName, appts }]) => (
            <section key={branchName} className="space-y-3">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
                {branchName} — {appts.length} cita{appts.length !== 1 ? "s" : ""}
              </h2>
              {appts.map(appt => (
                <Link key={appt.id} href={`/asistente/citas/${appt.id}`} className="block rounded-2xl hover:shadow-sm transition">
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
