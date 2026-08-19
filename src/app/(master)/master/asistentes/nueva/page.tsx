import Link from "next/link";
import { AsistenteForm } from "@/components/forms/AsistenteForm";

export default async function NuevoAsistentePage() {
  return (
    <div className="max-w-lg space-y-6">
      <div>
        <div className="flex items-center gap-2 text-sm mb-3">
          <Link href="/master/asistentes" className="text-gray-400 hover:text-gray-600">Asistentes</Link>
          <span className="text-gray-300">/</span>
          <span className="text-gray-700 font-medium">Nuevo</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Nuevo asistente</h1>
        <p className="text-sm text-gray-500 mt-1">
          Los asistentes tienen acceso a todas las sucursales.
        </p>
      </div>

      <div className="rounded-2xl bg-white border border-gray-200 p-5">
        <AsistenteForm />
      </div>
    </div>
  );
}
