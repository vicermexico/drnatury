import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth";
import { AppointmentCard, type AppointmentData } from "@/components/agenda/AppointmentCard";
import { CancelAppointmentButton } from "@/components/layout/paciente/CancelAppointmentButton";
import { RescheduleButton } from "@/components/layout/paciente/RescheduleButton";
import { NotificacionesButton } from "@/components/layout/paciente/NotificacionesButton";

async function getMyAppointments(userId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("appointments")
    .select(`
      id, starts_at, ends_at, status, branch_id, service_id,
      services(name),
      branches(name, address, lat, lng),
      therapists:profiles!therapist_id(name)
    `)
    .eq("patient_id", userId)
    .is("deleted_at", null)
    .order("starts_at", { ascending: false })
    .limit(50);

  return (data ?? []).map((a) => {
    const branch = Array.isArray(a.branches) ? a.branches[0] : a.branches as { name: string; address: string; lat?: number; lng?: number } | null;
    return {
      id: a.id,
      starts_at: a.starts_at as string,
      ends_at: a.ends_at as string,
      status: a.status as AppointmentData["status"],
      branch_id: a.branch_id as string,
      service_id: a.service_id as string,
      service_name: (Array.isArray(a.services) ? a.services[0] : a.services as { name: string } | null)?.name,
      branch_name: branch?.name,
      branch_address: branch?.address,
      branch_lat: branch?.lat,
      branch_lng: branch?.lng,
      therapist_name: (Array.isArray(a.therapists) ? a.therapists[0] : a.therapists as { name: string } | null)?.name,
    };
  }) as (AppointmentData & { branch_address?: string; branch_lat?: number; branch_lng?: number })[];
}

function MapsButton({ address, lat, lng }: { address?: string; lat?: number; lng?: number }) {
  if (!address) return null;
  const url = lat && lng
    ? "https://www.google.com/maps?q=" + lat + "," + lng
    : "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(address ?? "");
  return (
    <a href={url} target="_blank" rel="noopener noreferrer"
      className="flex flex-col items-center justify-center gap-2 bg-green-50 border border-green-200 rounded-2xl p-4 shadow-sm hover:shadow-md transition aspect-square">
      <span className="text-3xl">📍</span>
      <span className="text-xs font-semibold text-gray-700 text-center leading-tight">Ir al consultorio</span>
    </a>
  );
}

export default async function MisCitasPage({
  searchParams,
}: {
  searchParams: Promise<{ booked?: string }>;
}) {
  const user = await requireAuth();
  const appointments = await getMyAppointments(user.id);
  const { booked } = await searchParams;
  const now = new Date();

  const upcoming = appointments.filter(
    (a) => (a.status === "PENDIENTE" || a.status === "CONFIRMADA") && new Date(a.starts_at) >= now
  );
  const past = appointments.filter((a) => !upcoming.includes(a));

  return (
    <div className="max-w-md mx-auto py-6 px-4 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Mis citas</h1>
        <Link href="/paciente/agendar"
          className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition">
          + Agendar
        </Link>
      </div>

      <NotificacionesButton />

      {booked === "1" && (
        <div className="rounded-xl bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
          ¡Cita agendada! Revisa tu WhatsApp para los detalles y el link de confirmación.
        </div>
      )}

      {appointments.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500 text-sm mb-3">No tienes citas registradas</p>
          <Link href="/paciente/agendar" className="text-blue-600 text-sm underline">
            Agendar mi primera cita
          </Link>
        </div>
      ) : (
        <>
          {upcoming.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Próximas
              </h2>
              {upcoming.map((a) => (
                <div key={a.id} className="rounded-2xl border border-green-200 bg-green-50 p-4 space-y-4">
                  <AppointmentCard appt={a} showPatient={false} showTherapist showBranch variant="patient" />
                  <div className="grid grid-cols-3 gap-3">
                    <MapsButton address={a.branch_address} lat={a.branch_lat} lng={a.branch_lng} />
                    <div className="flex flex-col items-center justify-center gap-2 bg-yellow-50 border border-yellow-200 rounded-2xl p-4 shadow-sm aspect-square">
                      <span className="text-3xl">🗓️</span>
                      <RescheduleButton
                        appointmentId={a.id}
                        branchId={a.branch_id!}
                        serviceId={a.service_id!}
                        currentStartsAt={a.starts_at}
                      />
                    </div>
                    <div className="flex flex-col items-center justify-center gap-2 bg-red-50 border border-red-200 rounded-2xl p-4 shadow-sm aspect-square">
                      <span className="text-3xl">❌</span>
                      <CancelAppointmentButton appointmentId={a.id} />
                    </div>
                  </div>
                </div>
              ))}
            </section>
          )}

          {past.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Historial
              </h2>
              {past.map((a) => (
                <AppointmentCard key={a.id} appt={a} showPatient={false} showTherapist showBranch />
              ))}
            </section>
          )}
        </>
      )}
    </div>
  );
}
