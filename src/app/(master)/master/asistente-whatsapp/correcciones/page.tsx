import Link from "next/link";
import { CorreccionesManager } from "../CorreccionesManager";

export default function CorreccionesPage() {
  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <Link href="/master/asistente-whatsapp" className="text-sm text-blue-600 hover:underline">
          ← Asistente de WhatsApp
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-1">Correcciones que le has enseñado</h1>
        <p className="text-sm text-gray-500 mt-1">
          Revisa aquí todo lo que le has enseñado al bot y borra lo que ya no haga falta.
        </p>
      </div>
      <CorreccionesManager />
    </div>
  );
}
