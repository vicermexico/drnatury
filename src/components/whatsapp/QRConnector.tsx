"use client";

import { useState, useEffect, useRef } from "react";
import type { QRStatus, QRResponse } from "@/app/api/whatsapp-numbers/[id]/qr/route";

interface Props {
  numberId:    string;
  phone:       string;
  onClose:     () => void;
  onConnected?: (phone: string) => void;
}

const STATUS_MSG: Partial<Record<QRStatus, string>> = {
  LOADING:      "Iniciando sesión…",
  RECONNECTING: "Reconectando automáticamente…",
  DISCONNECTED: "Sesión desconectada. Escanea para reconectar.",
  AUTH_FAILURE: "Autenticación fallida. Vuelve a escanear.",
};

export function QRConnector({ numberId, phone, onClose, onConnected }: Props) {
  const [status, setStatus] = useState<QRStatus>("LOADING");
  const [qr,     setQr]     = useState<string | null>(null);
  const [error,  setError]  = useState("");
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const connected = status === "CONNECTED";

  function stopPolling() {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }

  async function poll() {
    try {
      const res  = await fetch(`/api/whatsapp-numbers/${numberId}/qr`);
      const data = await res.json() as QRResponse;

      setStatus(data.status);
      // Limpiar QR anterior si la sesión ya no lo tiene (evita mostrar QR expirado)
      if (data.qr) setQr(data.qr);
      else if (["LOADING", "RECONNECTING", "DISCONNECTED"].includes(data.status)) setQr(null);
      if (data.error) setError(data.error);

      // Detener cuando ya no tiene sentido seguir sondeando
      if (["CONNECTED", "AUTH_FAILURE", "NO_SERVICE", "ERROR"].includes(data.status)) {
        stopPolling();
      }
      if (data.status === "CONNECTED") {
        onConnected?.(phone);
      }
    } catch {
      setStatus("ERROR");
      setError("No se pudo contactar con el servidor");
      stopPolling();
    }
  }

  useEffect(() => {
    poll();
    intervalRef.current = setInterval(poll, 3_000);
    return stopPolling;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [numberId]);

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 space-y-4">
      {/* Cabecera */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-gray-900">Conectar WhatsApp</p>
          <p className="text-xs text-gray-400 font-mono mt-0.5">{phone}</p>
        </div>
        <button onClick={onClose}
          className="h-7 w-7 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition text-lg leading-none">
          ×
        </button>
      </div>

      {/* Contenido según estado */}

      {status === "QR" && qr && (
        <div className="space-y-3">
          <div className="flex justify-center">
            <img
              src={qr}
              alt="Escanea con WhatsApp"
              className="w-56 h-56 rounded-xl border border-gray-100"
            />
          </div>
          <ol className="text-xs text-gray-500 space-y-1 list-decimal list-inside">
            <li>Abre WhatsApp en tu teléfono</li>
            <li>Ve a <span className="font-medium">Dispositivos vinculados</span></li>
            <li>Toca <span className="font-medium">Vincular un dispositivo</span></li>
            <li>Escanea este código</li>
          </ol>
          <p className="text-[11px] text-gray-300 text-center">El QR se actualiza automáticamente si expira</p>
        </div>
      )}

      {(status === "LOADING" || status === "RECONNECTING") && (
        <div className="flex flex-col items-center gap-3 py-6">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
          <p className="text-sm text-gray-400">{STATUS_MSG[status]}</p>
        </div>
      )}

      {connected && (
        <div className="flex flex-col items-center gap-2 py-4">
          <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
            <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="text-sm font-semibold text-green-700">¡Conectado!</p>
          <p className="text-xs text-gray-400">WhatsApp vinculado correctamente.</p>
          <button onClick={onClose}
            className="mt-2 rounded-xl bg-green-600 px-6 py-2 text-sm font-semibold text-white hover:bg-green-700 transition">
            Cerrar
          </button>
        </div>
      )}

      {(status === "DISCONNECTED" || status === "AUTH_FAILURE") && (
        <div className="space-y-3 text-center py-2">
          <p className="text-sm text-amber-700">{STATUS_MSG[status]}</p>
          {qr && (
            <img src={qr} alt="QR" className="w-48 h-48 mx-auto rounded-xl border border-gray-100" />
          )}
        </div>
      )}

      {status === "NO_SERVICE" && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 space-y-1">
          <p className="text-sm font-medium text-amber-800">Servicio WAWEB no configurado</p>
          <p className="text-xs text-amber-600">
            Agrega <code className="bg-amber-100 px-1 rounded font-mono">WHATSAPP_SERVICE_URL</code> en las variables de entorno para habilitar el escaneo de QR.
          </p>
        </div>
      )}

      {status === "ERROR" && (
        <div className="rounded-xl bg-red-50 border border-red-200 p-4 space-y-2">
          <p className="text-sm font-medium text-red-700">Error de conexión</p>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <button
            onClick={() => { setStatus("LOADING"); setError(""); setQr(null);
              intervalRef.current = setInterval(poll, 3_000); poll(); }}
            className="text-xs text-red-600 underline hover:no-underline">
            Reintentar
          </button>
        </div>
      )}
    </div>
  );
}
