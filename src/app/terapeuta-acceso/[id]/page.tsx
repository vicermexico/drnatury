import { createAdminClient } from "@/lib/supabase/admin";
import { TerapeutaAccesoForm } from "./TerapeutaAccesoForm";

async function getTherapistName(id: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("profiles")
    .select("name, roles, is_active, deleted_at")
    .eq("id", id)
    .contains("roles", ["TERAPEUTA"])
    .is("deleted_at", null)
    .maybeSingle();
  if (!data || !data.is_active) return null;
  return data.name;
}

export default async function TerapeutaAccesoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ next?: string }>;
}) {
  const { id } = await params;
  const { next } = await searchParams;
  const name = await getTherapistName(id);

  if (!name) {
    return (
      <main className="flex min-h-screen items-center justify-center p-4">
        <div className="max-w-sm w-full text-center space-y-2">
          <p className="text-2xl">⚠️</p>
          <p className="text-gray-700 font-medium">Este link ya no es válido</p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <p className="text-3xl mb-2">🔒</p>
          <h1 className="text-xl font-bold text-gray-900">Exclusivo terapeuta</h1>
          <p className="mt-2 text-gray-500 text-sm">Hola {name}, escribe tu contraseña para entrar directo a la cita</p>
        </div>
        <TerapeutaAccesoForm therapistId={id} next={next ?? null} />
      </div>
    </main>
  );
}
