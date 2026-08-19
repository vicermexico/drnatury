import { createAdminClient } from "@/lib/supabase/admin";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ServicioMedia } from "@/components/landing/ServicioMedia";

async function getServicio(id: string) {
  const admin = createAdminClient();
  const { data } = await admin
    .from("landing_services")
    .select("*")
    .eq("id", id)
    .single();
  return data;
}

export default async function ServicioPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const servicio = await getServicio(id);
  if (!servicio) notFound();

  return (
    <div className="min-h-screen bg-white">
      <ServicioMedia servicio={servicio} />
      <div className="max-w-2xl mx-auto px-6 py-8 space-y-4">
        <h1 className="text-2xl font-bold text-gray-900">{servicio.title}</h1>
        {servicio.description && (
          <p className="text-gray-600 text-base leading-relaxed">{servicio.description}</p>
        )}
        <div className="pt-4 space-y-3">
          <Link href="/login" className="w-full block bg-blue-600 text-white text-lg font-bold px-10 py-4 rounded-2xl shadow-lg hover:bg-blue-700 transition text-center">
            Agenda tu cita
          </Link>
          <Link href="/inicio" className="w-full block text-center text-sm text-blue-600 hover:underline py-2">
            Volver al inicio
          </Link>
        </div>
      </div>
    </div>
  );
}
