import { getDomicilioExtraMinutes } from "@/lib/appointments/domicilioConfig";
import { TiempoExtraForm } from "./TiempoExtraForm";

export default async function ServiciosDomicilioPage() {
  const extraMinutes = await getDomicilioExtraMinutes();

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Servicios a Domicilio</h1>
        <p className="text-sm text-gray-500 mt-1">
          Ajustes que solo aplican cuando la cita es a domicilio
        </p>
      </div>

      <div className="rounded-2xl bg-white border border-gray-200 p-5 space-y-3">
        <h2 className="text-sm font-semibold text-gray-700">Tiempo extra por traslado</h2>
        <p className="text-xs text-gray-400">
          Cuando una cita es a domicilio, se le suma este tiempo extra a la
          duración del servicio (para contar el traslado y la instalación).
          Antes estaba fijo en 1:30 hrs — aquí lo puedes cambiar.
        </p>
        <TiempoExtraForm valorInicial={extraMinutes} />
      </div>
    </div>
  );
}
