import { requireRole } from "@/lib/auth";
import { PerfilForm } from "@/components/layout/paciente/PerfilForm";
export default async function PerfilPage() {
  const profile = await requireRole("PACIENTE");
  return (
    <div className="max-w-md mx-auto px-4 py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Mi perfil</h1>
        <p className="text-sm text-gray-500 mt-1">Actualiza tu información personal</p>
      </div>
      <PerfilForm
        id={profile.id}
        name={profile.name ?? ""}
        phone={profile.phone ?? ""}
        city={profile.city ?? ""}
      />
    </div>
  );
}
