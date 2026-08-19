import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/auth";
import { ActivarAguaForm } from "./ActivarAguaForm";

async function getData(branchId: string) {
  const admin = createAdminClient();
  const now = new Date().toISOString();

  const [pacientesRes, activacionesRes, solicitudesRes] = await Promise.all([
    admin.from("profiles")
      .select("id, name, phone")
      .contains("roles", ["PACIENTE"])
      .eq("branch_id", branchId)
      .eq("is_active", true)
      .is("deleted_at", null)
      .order("name"),
    admin.from("agua_energetica_activaciones")
      .select("patient_id, fecha_fin")
      .gte("fecha_fin", now),
    admin.from("agua_energetica_solicitudes")
      .select("id, estado, created_at, patient:profiles!patient_id(id, name, phone)")
      .eq("branch_id", branchId)
      .eq("estado", "pendiente")
      .order("created_at", { ascending: false }),
  ]);

  const activosMap = new Map<string, string>();
  for (const a of activacionesRes.data ?? []) {
    activosMap.set(a.patient_id, a.fecha_fin);
  }

  const pacientes = (pacientesRes.data ?? []).map(p => ({
    ...p,
    activo: activosMap.has(p.id),
    fecha_fin: activosMap.get(p.id) ?? null,
  }));

  return { pacientes, solicitudes: solicitudesRes.data ?? [] };
}

export default async function AsistenteAguaEnergeticaPage() {
  const user = await requireAuth();
  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("branch_id").eq("id", user.id).single();

  if (!profile?.branch_id) {
    return <p className="text-gray-500 text-sm p-6">No tienes sucursal asignada.</p>;
  }

  const { pacientes, solicitudes } = await getData(profile.branch_id);

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Agua Energetica</h1>
        <p className="text-sm text-gray-500 mt-1">Gestiona solicitudes y activa pacientes</p>
      </div>
      <ActivarAguaForm pacientes={pacientes} solicitudes={solicitudes} />
    </div>
  );
}
