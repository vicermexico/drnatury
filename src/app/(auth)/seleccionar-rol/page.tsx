import { redirect } from "next/navigation";
import { getServerProfile, getRedirectPath } from "@/lib/auth";
import { RoleSelector } from "@/components/forms/RoleSelector";
import type { Role } from "@/types";

export default async function SeleccionarRolPage() {
  const profile = await getServerProfile();
  if (!profile) redirect("/login");

  const roles = profile.roles as Role[];

  // Si solo tiene un rol, ya debería estar en su panel
  if (roles.length === 1) redirect(getRedirectPath(roles));
  if (roles.length === 0) redirect("/login");

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-gray-900">Hola, {profile.name}</h1>
          <p className="mt-1 text-sm text-gray-500">DrBioescaner</p>
        </div>
        <RoleSelector roles={roles} />
      </div>
    </main>
  );
}
