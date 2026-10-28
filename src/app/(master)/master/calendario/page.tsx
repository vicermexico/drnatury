import Link from "next/link";
import { isGoogleCalendarConnected } from "@/lib/calendar/google-auth";
import { DesconectarButton } from "./DesconectarButton";

export default async function CalendarioPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const params = await searchParams;
  const conectado = await isGoogleCalendarConnected();

  return (
    <div className="max-w-xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/master/configuracion" className="text-gray-400 hover:text-gray-600 text-sm">
          ← Configuración
        </Link>
      </div>
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Google Calendar</h1>
        <p className="text-sm text-gray-500 mt-1">Conecta tu cuenta para que las citas del link rápido y los bloqueos personales se agreguen solos a tu calendario.</p>
      </div>

      {params.conectado === "1" && (
        <p className="text-sm font-semibold text-green-700 bg-green-50 rounded-xl px-4 py-3">✅ Conectado correctamente.</p>
      )}
      {params.error === "cancelado" && (
        <p className="text-sm font-semibold text-amber-700 bg-amber-50 rounded-xl px-4 py-3">Cancelaste la conexión con Google.</p>
      )}
      {params.error && params.error !== "cancelado" && (
        <p className="text-sm font-semibold text-red-600 bg-red-50 rounded-xl px-4 py-3">Algo falló conectando con Google. Intenta de nuevo.</p>
      )}

      <div className="rounded-2xl bg-white border border-gray-200 p-5 space-y-4">
        {conectado ? (
          <>
            <p className="text-sm font-semibold text-green-700">✅ Tu Google Calendar está conectado</p>
            <p className="text-xs text-gray-500">Las citas nuevas del link rápido y los bloqueos personales se agregan solos, sin que tengas que tocar nada más.</p>
            <DesconectarButton />
          </>
        ) : (
          <>
            <p className="text-sm font-semibold text-gray-700">No conectado</p>
            <p className="text-xs text-gray-500">Vas a entrar a tu cuenta de Google y darle permiso para agregar eventos a tu calendario. Es un paso único.</p>
            <a href="/api/google-calendar/connect"
              className="inline-block rounded-xl bg-red-600 px-5 py-3 text-sm font-semibold text-white hover:bg-red-700 transition">
              Conectar Google Calendar
            </a>
          </>
        )}
      </div>
    </div>
  );
}
