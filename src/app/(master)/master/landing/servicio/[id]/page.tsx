import { createAdminClient } from "@/lib/supabase/admin";
import { ServicioEditForm } from "@/components/landing/ServicioEditForm";
import { notFound } from "next/navigation";

async function getServicio(id: string) {
  const admin = createAdminClient();
  const { data } = await admin
    .from("landing_services")
    .select("*")
    .eq("id", id)
    .single();
  return data;
}

export default async function EditarServicioPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const servicio = await getServicio(id);
  if (!servicio) notFound();

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Editar servicio</h1>
        <p className="text-sm text-gray-500 mt-1">Modifica o elimina este servicio</p>
      </div>
      <ServicioEditForm servicio={servicio} />
    </div>
  );
}