import { createAdminClient } from "@/lib/supabase/admin";
import { PadecimientosConfig } from "./PadecimientosConfig";

async function getPadecimientos() {
  const admin = createAdminClient();
  const { data } = await admin
    .from("padecimientos")
    .select("id, nombre, recomendacion, orden")
    .order("orden")
    .order("nombre");
  return data ?? [];
}

export default async function MasterRecetasPage() {
  const padecimientos = await getPadecimientos();
  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Recetas</h1>
        <p className="text-sm text-gray-500 mt-1">
          Da de alta cada padecimiento (ej. Riñón) y sus recomendaciones (ej. jugos a
          tomar, una por línea). El terapeuta las va a ver al llenar la receta de un
          paciente.
        </p>
      </div>
      <PadecimientosConfig initialPadecimientos={padecimientos} />
    </div>
  );
}
