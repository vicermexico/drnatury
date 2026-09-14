import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyConfirmToken } from "@/lib/appointments/tokens";
import { formatCSTDate, formatCSTTime } from "@/lib/appointments/availability";
import { ConfirmActions } from "./ConfirmActions";

async function getAppointment(id: string) {
  const admin = createAdminClient();
  const { data } = await admin
    .from("appointments")
    .select(`
      id, starts_at, ends_at, status, modalidad, domicilio_direccion, domicilio_lat, domicilio_lng,
      branch_id, service_id, therapist_id,
      profiles!patient_id(name),
      services(name, duration_minutes),
      branches(name, address, schedule),
      therapists:profiles!therapist_id(id, name, whatsapp_number)
    `)
    .eq("id", id)
    .is("deleted_at", null)
    .single();
  return data;
}

export default async function CitaPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { id } = await params;
  const { token } = await searchParams;

  if (!token || !verifyConfirmToken(id, token)) {
    return (
      <main className="flex min-h-screen items-center justify-center p-4">
        <div className="max-w-sm w-full text-center space-y-3">
          <p className="text-2xl">🔒</p>
          <p className="text-gray-700 font-medium">Link inválido o expirado</p>
          <p className="text-sm text-gray-400">
            Si necesitas confirmar o cancelar tu cita, contacta a la clínica.
          </p>
        </div>
      </main>
    );
  }

  const appt = await getAppointment(id);
  if (!appt) notFound();

  const patient  = Array.isArray(appt.profiles) ? appt.profiles[0] : appt.profiles as { name: string } | null;
  const service  = Array.isArray(appt.services) ? appt.services[0] : appt.services as { name: string; duration_minutes: number } | null;
  const branch   = Array.isArray(appt.branches) ? appt.branches[0] : appt.branches as { name: string; address: string; schedule: Record<string, { open: boolean }> | null } | null;
  const therapist = Array.isArray(appt.therapists) ? appt.therapists[0] : appt.therapists as { id: string; name: string; whatsapp_number: string | null } | null;
  const status = appt.status as string;
  const esDomicilio = (appt as unknown as { modalidad?: string }).modalidad === "DOMICILIO";
  const domicilioDireccion = (appt as unknown as { domicilio_direccion?: string | null }).domicilio_direccion;
  const domicilioLat = (appt as unknown as { domicilio_lat?: number | null }).domicilio_lat;
  const domicilioLng = (appt as unknown as { domicilio_lng?: number | null }).domicilio_lng;
  const domicilioMapsUrl = esDomicilio
    ? (domicilioLat != null && domicilioLng != null
        ? `https://www.google.com/maps/search/?api=1&query=${domicilioLat},${domicilioLng}`
        : domicilioDireccion
          ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(domicilioDireccion)}`
          : null)
    : null;

  return (
    <main className="flex min-h-screen items-center justify-center p-4 bg-gray-50">
      <div className="max-w-sm w-full space-y-6">
        <div className="text-center">
          <p className="text-sm text-gray-500">DrNatury</p>
          <h1 className="text-xl font-bold text-gray-900 mt-1">Tu cita</h1>
        </div>

        <div className="rounded-2xl bg-white border border-gray-200 p-5 space-y-3">
          <Row label="Paciente"    value={patient?.name ?? ""} />
          <Row label="Servicio"    value={service?.name ?? ""} />
          <Row label="Fecha"       value={formatCSTDate(appt.starts_at as string)} />
          <Row label="Hora"        value={formatCSTTime(appt.starts_at as string)} />
          <Row label="Terapeuta"   value={therapist?.name ?? ""} />
          {esDomicilio ? (
            <Row label="Modalidad" value={`🏠 A domicilio${domicilioDireccion ? `: ${domicilioDireccion}` : ""}`} />
          ) : (
            <Row label="Dirección" value={branch?.address ?? ""} />
          )}
        </div>

        {domicilioMapsUrl && (
          <div className="text-center">
            <a href={domicilioMapsUrl} target="_blank" rel="noopener noreferrer"
              className="text-sm font-semibold text-blue-600 underline">
              🗺️ Ver ubicación en el mapa
            </a>
          </div>
        )}

        {status === "CANCELADA" ? (
          <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 text-center">
            Esta cita fue cancelada.
          </div>
        ) : status === "COMPLETADA" ? (
          <div className="rounded-xl bg-gray-50 border border-gray-200 px-4 py-3 text-sm text-gray-600 text-center">
            Esta cita ya fue realizada.
          </div>
        ) : (
          <ConfirmActions
            appointmentId={id}
            token={token}
            currentStatus={status}
            branchId={(appt as unknown as { branch_id: string }).branch_id}
            serviceId={(appt as unknown as { service_id: string }).service_id}
            serviceName={service?.name ?? ""}
            durationMinutes={service?.duration_minutes ?? 60}
            branchSchedule={branch?.schedule ?? null}
            branchName={branch?.name ?? ""}
            branchAddress={branch?.address ?? ""}
            modalidad={esDomicilio ? "DOMICILIO" : "CONSULTORIO"}
            therapistId={therapist?.id ?? null}
            therapistWhatsapp={therapist?.whatsapp_number ?? null}
          />
        )}
      </div>
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-gray-500">{label}</span>
      <span className="font-medium text-gray-900 text-right max-w-[60%]">{value}</span>
    </div>
  );
}
