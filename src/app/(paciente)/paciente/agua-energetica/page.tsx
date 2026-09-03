import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/auth";
import { AguaEnergeticaPanel } from "./AguaEnergeticaPanel";
import { SolicitarActivacion } from "./SolicitarActivacion";
import { PhoneGlassIntro } from "@/components/agua/PhoneGlassIntro";
async function getData(patientId: string) {
  const admin = createAdminClient();
  const now = new Date().toISOString();
  const [configRes, activacionRes, solicitudRes, branchesRes] = await Promise.all([
    admin.from("agua_energetica_config").select("*").single(),
    admin.from("agua_energetica_activaciones")
      .select("id, fecha_inicio, fecha_fin")
      .eq("patient_id", patientId)
      .gte("fecha_fin", now)
      .order("fecha_fin", { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin.from("agua_energetica_solicitudes")
      .select("id, estado, branch:branches!branch_id(name)")
      .eq("patient_id", patientId)
      .eq("estado", "pendiente")
      .maybeSingle(),
    admin.from("branches")
      .select("id, name")
      .eq("is_active", true)
      .is("deleted_at", null)
      .order("name"),
  ]);
  return {
    config: configRes.data,
    activacion: activacionRes.data,
    solicitud: solicitudRes.data,
    branches: branchesRes.data ?? [],
  };
}
export default async function PacienteAguaEnergeticaPage() {
  const user = await requireAuth();
  const { config, activacion, solicitud, branches } = await getData(user.id);
  const activo = activacion !== null && new Date(activacion.fecha_fin) > new Date();
  if (!activo) {
    return (
      <div className="fixed inset-0 z-30 bg-gradient-to-b from-blue-950 to-blue-900 flex flex-col pb-24 overflow-hidden">
        <PhoneGlassIntro />
        <div className="shrink-0 px-6 pb-4 pt-2 space-y-2">
          <div className="text-center">
            <h1 className="text-lg font-bold text-white">Agua Energética</h1>
            <p className="text-blue-300 text-xs">Activa este servicio para comenzar</p>
          </div>
          <SolicitarActivacion
            branches={branches}
            solicitud={solicitud}
            requisitos={config?.requisitos ?? ""}
          />
        </div>
      </div>
    );
  }
  return (
    <AguaEnergeticaPanel
      config={config}
      activacion={activacion}
      patientId={user.id}
    />
  );
}
