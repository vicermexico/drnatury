import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth";

async function getPaciente(id: string, branchId: string) {
  const admin = createAdminClient();

  const [profileRes, citasRes] = await Promise.all([
    admin.from("profiles")
      .select("id, name, phone, birth_date, age, address, city, sex, email, consultation_reason, created_at")
      .eq("id", id)
      .eq("branch_id", branchId)
      .contains("roles", ["PACIENTE"])
      .is("deleted_at", null)
      .single(),
    admin.from("appointments")
      .select("id, starts_at, ends_at, status, services(name)")
      .eq("patient_id", id)
      .is("deleted_at", null)
      .order("starts_at", { ascending: false })
      .limit(20),
  ]);

  if (!profileRes.data) return null;

  return {
    profile: profileRes.data,
    citas: citasRes.data ?? [],
  };
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-MX", {
    day: "numeric", month: "long", year: "numeric",
    timeZone: "America/Monterrey",
  });
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleDateString("es-MX", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
    timeZone: "America/Monterrey",
  });
}

const STATUS_COLOR: Record<string, string> = {
  PENDIENTE:   "bg-amber-100 text-amber-700",
  CONFIRMADA:  "bg-green-100 text-green-700",
  CANCELADA:   "bg-red-100 text-red-700",
  COMPLETADA:  "bg-blue-100 text-blue-700",
};

export default async function TerapeutaPacienteDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const profile = await requireRole("TERAPEUTA");
  const branchId = profile.branch_id ?? "";
  const data = await getPaciente(id, branchId);
  if (!data) notFound();

  const { profile: paciente, citas } = data;

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/terapeuta/pacientes" className="text-gray-400 hover:text-gray-600 text-sm">
          ← Pacientes
        </Link>
      </div>

      {/* Info del paciente */}
      <div className="rounded-2xl bg-white border border-gray-200 p-5 space-y-3">
        <h1 className="text-xl font-bold text-gray-900">{paciente.name}</h1>
        
        <div className="space-y-2">
          {paciente.phone && (
            <p className="text-sm text-gray-600">📱 {paciente.phone}</p>
          )}
          {paciente.email && (
            <p className="text-sm text-gray-600">✉️ {paciente.email}</p>
          )}
          {paciente.birth_date && (
            <p className="text-sm text-gray-600">🎂 {formatDate(paciente.birth_date)}</p>
          )}
          {paciente.age && !paciente.birth_date && (
            <p className="text-sm text-gray-600">🎂 {paciente.age} años</p>
          )}
          {paciente.address && (
            <p className="text-sm text-gray-600">📍 {paciente.address}{paciente.city ? `, ${paciente.city}` : ""}</p>
          )}
          {paciente.sex && (
            <p className="text-sm text-gray-600">👤 {paciente.sex === "M" ? "Masculino" : paciente.sex === "F" ? "Femenino" : "Otro"}</p>
          )}
          <p className="text-xs text-gray-400">Registrado el {formatDate(paciente.created_at)}</p>
        </div>

        {paciente.consultation_reason && (
          <div className="pt-3 border-t border-gray-100">
            <p className="text-xs font-semibold text-gray-400 mb-1">Motivo de consulta</p>
            <p className="text-sm text-gray-700">{paciente.consultation_reason}</p>
          </div>
        )}
      </div>

      {/* Historial de citas */}
      <div>
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
          Historial de citas
        </h2>
        {citas.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-300 p-8 text-center">
            <p className="text-gray-400 text-sm">Sin citas registradas</p>
          </div>
        ) : (
          <div className="space-y-2">
            {citas.map((c) => {
              const service = Array.isArray(c.services) ? c.services[0] : c.services as { name: string } | null;
              return (
                <div key={c.id} className="flex items-center justify-between rounded-xl bg-white border border-gray-200 px-5 py-3">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{service?.name ?? "Servicio"}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{formatDateTime(c.starts_at)}</p>
                  </div>
                  <span className={`text-xs font-semibold px-2 py-1 rounded-full ${STATUS_COLOR[c.status] ?? "bg-gray-100 text-gray-600"}`}>
                    {c.status}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}