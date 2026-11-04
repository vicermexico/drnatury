import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyConfirmToken } from "@/lib/appointments/tokens";
import { formatCSTDate, formatCSTTime } from "@/lib/appointments/availability";
import { UbicacionButton } from "./UbicacionButton";

async function getAppointment(id: string) {
  const admin = createAdminClient();
  const { data } = await admin
    .from("appointments")
    .select("id, starts_at, modalidad, quick_name, profiles!patient_id(name)")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  return data;
}

export default async function UbicacionPage({
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
        </div>
      </main>
    );
  }

  const appt = await getAppointment(id);
  if (!appt) notFound();
  if (appt.modalidad !== "DOMICILIO") notFound();

  const patient = Array.isArray(appt.profiles) ? appt.profiles[0] : appt.profiles as { name: string } | null;
  const quickName = (appt as unknown as { quick_name?: string | null }).quick_name;
  const nombreMostrar = quickName || patient?.name || "";

  return (
    <main className="flex min-h-screen items-center justify-center p-4 bg-gray-50">
      <div className="max-w-sm w-full space-y-6">
        <div className="text-center">
          <p className="text-sm text-gray-500">DrNatury</p>
          <h1 className="text-xl font-bold text-gray-900 mt-1">Comparte tu ubicación</h1>
          <p className="text-sm text-gray-500 mt-2">
            Hola{nombreMostrar ? ` ${nombreMostrar}` : ""}, para tu cita a domicilio del{" "}
            {formatCSTDate(appt.starts_at as string)} a las {formatCSTTime(appt.starts_at as string)}, ayúdanos
            compartiendo tu ubicación actual para llegar sin problema.
          </p>
        </div>

        <UbicacionButton appointmentId={id} token={token} />
      </div>
    </main>
  );
}
