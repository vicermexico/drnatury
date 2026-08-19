import { notFound } from "next/navigation";
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { AlmacenistaActions } from "./AlmacenistaActions";

async function getAlmacenista(id: string) {
  const admin = createAdminClient();
  const { data } = await admin
    .from("profiles")
    .select("id, name, phone, email, is_active")
    .eq("id", id)
    .contains("roles", ["ALMACENISTA"])
    .is("deleted_at", null)
    .maybeSingle();
  return data;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center text-sm">
      <span className="text-gray-500">{label}</span>
      <span className="font-medium text-gray-900">{value}</span>
    </div>
  );
}

export default async function AlmacenistaDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const almacenista = await getAlmacenista(id);
  if (!almacenista) notFound();

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <div className="flex items-center gap-2 text-sm mb-3">
          <Link href="/master/almacenistas" className="text-gray-400 hover:text-gray-600">Almacenistas</Link>
          <span className="text-gray-300">/</span>
          <span className="text-gray-700 font-medium">{almacenista.name}</span>
        </div>
        <div className="flex items-start justify-between">
          <h1 className="text-2xl font-bold text-gray-900">{almacenista.name}</h1>
          {!almacenista.is_active && (
            <span className="text-xs bg-amber-100 text-amber-700 px-2.5 py-1 rounded-full">Inactivo</span>
          )}
        </div>
      </div>

      <section className="rounded-2xl bg-white border border-gray-200 p-5 space-y-3">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Información</h2>
        <Row label="Teléfono" value={almacenista.phone} />
        {almacenista.email && <Row label="Correo" value={almacenista.email} />}
        <Row label="Acceso" value="Panel de inventario" />
        <Row label="Permisos" value="Ver y gestionar inventario · Registrar movimientos" />
      </section>

      <AlmacenistaActions
        almacenista={{
          id:        almacenista.id,
          name:      almacenista.name,
          phone:     almacenista.phone,
          email:     almacenista.email ?? null,
          is_active: almacenista.is_active,
        }}
      />
    </div>
  );
}
