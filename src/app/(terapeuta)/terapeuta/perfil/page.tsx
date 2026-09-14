import { requireAuth } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { PerfilForm } from "./PerfilForm";

export default async function TerapeutaPerfilPage() {
  const user = await requireAuth();
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("name, phone, whatsapp_number")
    .eq("id", user.id)
    .single();

  return (
    <div className="max-w-md space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Mi perfil</h1>
        <p className="text-sm text-gray-500 mt-1">
          Configura el número de WhatsApp con el que mandas recetas a tus pacientes.
        </p>
      </div>
      <PerfilForm
        name={profile?.name ?? ""}
        loginPhone={profile?.phone ?? ""}
        whatsappNumber={profile?.whatsapp_number ?? ""}
      />
    </div>
  );
}
