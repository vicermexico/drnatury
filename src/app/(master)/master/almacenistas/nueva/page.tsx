import Link from "next/link";
import { AlmacenistaForm } from "@/components/forms/AlmacenistaForm";

export default function NuevoAlmacenistaPage() {
  return (
    <div className="max-w-lg space-y-6">
      <div>
        <div className="flex items-center gap-2 text-sm mb-3">
          <Link href="/master/almacenistas" className="text-gray-400 hover:text-gray-600">Almacenistas</Link>
          <span className="text-gray-300">/</span>
          <span className="text-gray-700 font-medium">Nuevo</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Nuevo almacenista</h1>
        <p className="text-sm text-gray-500 mt-1">
          El almacenista puede gestionar el inventario de productos.
        </p>
      </div>

      <div className="rounded-2xl bg-white border border-gray-200 p-5">
        <AlmacenistaForm />
      </div>
    </div>
  );
}
