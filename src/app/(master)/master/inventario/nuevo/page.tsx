import Link from "next/link";
import { NuevoProductoForm } from "@/components/almacen/NuevoProductoForm";

export default function MasterNuevoProductoPage() {
  return (
    <div className="max-w-lg space-y-6">
      <div>
        <div className="flex items-center gap-2 text-sm mb-3">
          <Link href="/master/inventario" className="text-gray-400 hover:text-gray-600">Inventario</Link>
          <span className="text-gray-300">/</span>
          <span className="text-gray-700 font-medium">Nuevo producto</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Nuevo producto</h1>
      </div>
      <div className="rounded-2xl bg-white border border-gray-200 p-5">
        <NuevoProductoForm redirectTo="/master/inventario" appendProductId={false} />
      </div>
    </div>
  );
}
