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
      <main className="flex min-h-screen items-center justify-center p-4 bg-gradient-to-b from-emerald-50 to-white">
        <div className="max-w-sm w-full text-center space-y-3">
          <p className="text-4xl">🔒</p>
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
    <main className="min-h-screen bg-gradient-to-b from-emerald-500 via-emerald-50 to-white flex items-center justify-center p-4">
      <div className="max-w-sm w-full">
        {/* Banner superior con patron de mapa y pin animado */}
        <div className="relative rounded-t-3xl bg-emerald-600 pt-8 pb-14 px-6 text-center overflow-hidden">
          <div
            className="absolute inset-0 opacity-20"
            style={{
              backgroundImage:
                "radial-gradient(circle, #ffffff 1.5px, transparent 1.5px)",
              backgroundSize: "18px 18px",
            }}
          />
          <p className="relative text-emerald-100 text-xs font-semibold tracking-widest uppercase">DrNatury · A domicilio</p>
          <div className="relative mt-3 text-5xl animate-bounce" style={{ animationDuration: "1.8s" }}>
            📍
          </div>
          <h1 className="relative text-white text-xl font-bold mt-2">¡Ayúdanos a llegar!</h1>
        </div>

        {/* Tarjeta blanca */}
        <div className="relative -mt-8 bg-white rounded-3xl shadow-lg border border-gray-100 p-6 space-y-5">
          <p className="text-sm text-gray-600 text-center leading-relaxed">
            Hola{nombreMostrar ? ` ${nombreMostrar}` : ""} 👋, tu cita a domicilio es el{" "}
            <span className="font-semibold text-gray-900">
              {formatCSTDate(appt.starts_at as string)}
            </span>{" "}
            a las{" "}
            <span className="font-semibold text-gray-900">
              {formatCSTTime(appt.starts_at as string)}
            </span>
            . Comparte tu ubicación actual con un toque y llegamos sin dar vueltas.
          </p>

          <UbicacionButton appointmentId={id} token={token} />

          <p className="text-[11px] text-gray-400 text-center">
            Tu ubicación solo se usa para esta cita. No se comparte con nadie más.
          </p>
        </div>
      </div>
    </main>
  );
}
