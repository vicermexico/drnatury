import Link from "next/link";
import { UbicacionesManager } from "../UbicacionesManager";

export default function UbicacionesPage() {
  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <Link href="/master/asistente-whatsapp" className="text-sm text-blue-600 hover:underline">
          ← Asistente de WhatsApp
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-1">Ubicaciones</h1>
        <p className="text-sm text-gray-500 mt-1">
          Guarda el pin de GPS de cada consultorio parado físicamente ahí, para que el bot lo mande cuando
          alguien pida la ubicación o la dirección.
        </p>
      </div>
      <UbicacionesManager />
    </div>
  );
}
