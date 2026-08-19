import { PatientRegistrationForm } from "@/components/forms/PatientRegistrationForm";
import { createClient } from "@/lib/supabase/server";

export default async function RegistroPage({
  searchParams,
}: {
  searchParams: Promise<{ phone?: string }>;
}) {
  const { phone } = await searchParams;

  // Carga sucursales activas en el servidor para el selector del formulario
  const supabase = await createClient();
  const { data: branches } = await supabase
    .from("branches")
    .select("id, name, address")
    .eq("is_active", true)
    .is("deleted_at", null)
    .order("name");

  return (
    <main className="min-h-screen py-10 px-4">
      <div className="mx-auto max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-gray-900">Crear cuenta</h1>
          <p className="mt-1 text-sm text-gray-500">DrBioescaner</p>
        </div>
        <PatientRegistrationForm
          branches={branches ?? []}
          defaultPhone={phone ?? ""}
        />
      </div>
    </main>
  );
}
