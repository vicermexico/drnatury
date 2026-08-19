import Link from "next/link";
import { ServiceForm } from "@/components/forms/ServiceForm";

export default function NuevoServicioPage() {
  return (
    <div className="max-w-md">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/master/servicios" className="text-gray-400 hover:text-gray-600 text-sm">
          ← Servicios
        </Link>
      </div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Nuevo servicio</h1>
      <ServiceForm />
    </div>
  );
}
