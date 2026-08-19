import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerProfile } from "@/lib/auth";
import { NuevoProductoForm } from "@/components/almacen/NuevoProductoForm";

export default async function NuevoProductoPage() {
  const profile = await getServerProfile();
  const isMaster = (profile?.roles as string[] | undefined)?.includes("MASTER") ?? false;

  if (!isMaster) redirect("/almacen/inventario");

  return (
    <div className="space-y-6 max-w-lg">
      <div>
        <div className="flex items-center gap-2 text-sm mb-3">
          <Link href="/almacen/inventario" className="text-gray-400 hover:text-gray-600">Inventario</Link>
          <span className="text-gray-300">/</span>
          <span className="text-gray-700 font-medium">Nuevo producto</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Nuevo producto</h1>
      </div>

      <div className="rounded-2xl bg-white border border-gray-200 p-5">
        <NuevoProductoForm />
      </div>
    </div>
  );
}
