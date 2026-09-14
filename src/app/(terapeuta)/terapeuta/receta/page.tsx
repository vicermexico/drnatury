import { requireAuth } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { RecetaForm } from "./RecetaForm";

async function getData(userId: string) {
  const admin = createAdminClient();
  const [padecimientosRes, profileRes] = await Promise.all([
    admin.from("padecimientos").select("id, nombre, recomendacion").order("orden").order("nombre"),
    admin.from("profiles").select("whatsapp_number").eq("id", userId).single(),
  ]);
  return {
    padecimientos: padecimientosRes.data ?? [],
    whatsappNumber: profileRes.data?.whatsapp_number ?? null,
  };
}

export default async function TerapeutaRecetaPage() {
  const user = await requireAuth();
  const { padecimientos, whatsappNumber } = await getData(user.id);

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Receta</h1>
        <p className="text-sm text-gray-500 mt-1">Llena los datos del paciente para generar su receta</p>
      </div>
      <RecetaForm padecimientos={padecimientos} whatsappNumber={whatsappNumber} />
    </div>
  );
}
