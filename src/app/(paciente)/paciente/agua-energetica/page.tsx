import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/auth";
import { AguaEnergeticaPanel } from "./AguaEnergeticaPanel";
import { SolicitarActivacion } from "./SolicitarActivacion";
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
function PhoneGlassIntro() {
  return (
    <div className="flex-1 min-h-0 flex items-center justify-center relative">
      <style>{`
        @keyframes waterScreenGlow {
          0%, 100% { opacity: 0.35; transform: scale(0.94); }
          50% { opacity: 0.9; transform: scale(1.05); }
        }
        @keyframes glassFloat {
          0%, 100% { transform: translate(-50%, 0); }
          50% { transform: translate(-50%, -6px); }
        }
        .water-screen-glow { animation: waterScreenGlow 2.4s ease-in-out infinite; }
        .water-glass-float { animation: glassFloat 3s ease-in-out infinite; }
      `}</style>
      <div className="relative w-28 sm:w-36">
        <svg viewBox="0 0 160 320" className="w-full h-auto drop-shadow-2xl">
          <rect x="4" y="4" width="152" height="312" rx="28" fill="#0a1930" stroke="#2b4a72" strokeWidth="3" />
          <rect x="16" y="22" width="128" height="276" rx="14" fill="#0e2340" />
          <rect x="62" y="11" width="36" height="5" rx="2.5" fill="#2b4a72" />
        </svg>
        <div className="water-screen-glow absolute left-[10%] right-[10%] top-[7%] bottom-[8%] rounded-2xl bg-cyan-400/40 blur-xl" />
        <div className="water-glass-float absolute -bottom-6 left-1/2 text-5xl sm:text-6xl drop-shadow-2xl">
          🥛
        </div>
      </div>
    </div>
  );
}
export default async function PacienteAguaEnergeticaPage() {
  const user = await requireAuth();
  const { config, activacion, solicitud, branches } = await getData(user.id);
  const activo = activacion !== null && new Date(activacion.fecha_fin) > new Date();
  if (!activo) {
    return (
      <div className="fixed inset-0 z-30 bg-gradient-to-b from-blue-950 to-blue-900 flex flex-col pb-20 overflow-hidden">
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
