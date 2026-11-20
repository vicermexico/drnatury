import Link from "next/link";
import { BienvenidaManager } from "../BienvenidaManager";

export default function BienvenidaPage() {
  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <Link href="/master/asistente-whatsapp" className="text-sm text-blue-600 hover:underline">
          ← Asistente de WhatsApp
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-1">Mensajes de bienvenida</h1>
        <p className="text-sm text-gray-500 mt-1">
          Arma aquí, en el orden que quieras, los audios y textos que se mandan al inicio.
        </p>
      </div>
      <BienvenidaManager />
    </div>
  );
}
