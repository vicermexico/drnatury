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
      <div className="relative flex flex-col items-center">
        {/* Vaso de agua flotando encima del celular */}
        <div className="water-glass-float relative z-10 -mb-3">
          <svg width="72" height="88" viewBox="0 0 72 88">
            <defs>
              <linearGradient id="waterGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#7fe3ff" />
                <stop offset="100%" stopColor="#0891b2" />
              </linearGradient>
            </defs>
            <path
              d="M9 6 L63 6 L55 80 Q54.3 84 50 84 L22 84 Q17.7 84 17 80 Z"
              fill="url(#waterGrad)"
              opacity="0.92"
            />
            <ellipse cx="36" cy="9" rx="27" ry="3.2" fill="#c9f6ff" opacity="0.9" />
            <path
              d="M9 6 L63 6 L55 80 Q54.3 84 50 84 L22 84 Q17.7 84 17 80 Z"
              fill="none"
              stroke="#eafcff"
              strokeWidth="2.2"
            />
            <path d="M17.5 13 L23 76" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" opacity="0.45" />
          </svg>
        </div>
        {/* Celular acostado */}
        <div className="relative">
          <svg width="196" height="98" viewBox="0 0 320 160" className="drop-shadow-2xl">
            <rect x="4" y="4" width="312" height="152" rx="28" fill="#0a1930" stroke="#2b4a72" strokeWidth="3" />
            <rect x="24" y="16" width="272" height="128" rx="14" fill="#0e2340" />
            <rect x="306" y="64" width="5" height="32" rx="2.5" fill="#2b4a72" />
          </svg>
          <div className="water-screen-glow absolute left-[9%] right-[9%] top-[14%] bottom-[14%] rounded-2xl bg-cyan-400/40 blur-xl" />
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
