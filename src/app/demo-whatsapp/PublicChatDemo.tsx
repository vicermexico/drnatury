"use client";
import { useState } from "react";

type EstadoAgendado = {
  fase: "inicio" | "conversando" | "agendando";
  [key: string]: unknown;
};

interface MensajeUI {
  id: number;
  rol: "paciente" | "bot";
  texto: string;
}

const ESTADO_INICIAL: EstadoAgendado = { fase: "inicio" };

// Mensaje pre-llenado del anuncio -- fijo, no se puede editar ni
// borrar, solo mandar, para que la persona vea exactamente lo mismo
// que le llegaria a Vic al hacerle clic a su anuncio de verdad.
const MENSAJE_INICIAL = "B3 - ¡Hola! ¿Podrían darme más información?";

let siguienteId = 1;

export function PublicChatDemo() {
  const [mensajes, setMensajes] = useState<MensajeUI[]>([]);
  const [estado, setEstado] = useState<EstadoAgendado>(ESTADO_INICIAL);
  const [input, setInput] = useState("");
  const [primerMensajeEnviado, setPrimerMensajeEnviado] = useState(false);
  const [enviando, setEnviando] = useState(false);

  async function enviarMensaje() {
    const esPrimero = !primerMensajeEnviado;
    const mensaje = (esPrimero ? MENSAJE_INICIAL : input.trim());
    if (!mensaje || enviando) return;
    setInput("");
    if (esPrimero) setPrimerMensajeEnviado(true);
    setEnviando(true);

    setMensajes((prev) => [...prev, { id: siguienteId++, rol: "paciente", texto: mensaje }]);

    try {
      const res = await fetch("/api/public/asistente-whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mensaje, estado }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data) {
        setMensajes((prev) => [
          ...prev,
          { id: siguienteId++, rol: "bot", texto: "⚠️ Hubo un error, intenta de nuevo." },
        ]);
        return;
      }
      setEstado(data.nuevoEstado);
      setMensajes((prev) => [...prev, { id: siguienteId++, rol: "bot", texto: data.respuesta }]);
    } finally {
      setEnviando(false);
    }
  }

  function reiniciar() {
    setMensajes([]);
    setEstado(ESTADO_INICIAL);
    setPrimerMensajeEnviado(false);
    setInput("");
  }

  return (
    <div className="rounded-3xl border border-emerald-100 bg-white shadow-xl overflow-hidden flex flex-col h-[78vh] max-h-[680px]">
      <div className="shrink-0 flex items-center justify-between px-4 py-3 bg-gradient-to-r from-emerald-600 to-emerald-500">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center text-lg">🌿</div>
          <div>
            <p className="text-sm font-semibold text-white leading-tight">DrNatury</p>
            <p className="text-[11px] text-emerald-50/80 leading-tight">Asistente en línea</p>
          </div>
        </div>
        {mensajes.length > 0 && (
          <button
            onClick={reiniciar}
            className="text-[11px] font-medium text-white/90 hover:text-white px-2 py-1 rounded-lg hover:bg-white/10"
          >
            🔄 Empezar de nuevo
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-gradient-to-b from-emerald-50/40 to-white">
        {mensajes.length === 0 && (
          <p className="text-sm text-gray-500 text-center mt-10">
            Da clic en el botón de abajo para mandar el mensaje y empezar la conversación.
          </p>
        )}
        {mensajes.map((m) => (
          <div key={m.id} className={`flex ${m.rol === "bot" ? "justify-start" : "justify-end"}`}>
            <div
              className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm whitespace-pre-wrap shadow-sm ${
                m.rol === "bot"
                  ? "bg-white text-gray-800 border border-gray-100 rounded-bl-sm"
                  : "bg-emerald-600 text-white rounded-br-sm"
              }`}
            >
              {m.texto}
            </div>
          </div>
        ))}
        {enviando && <p className="text-xs text-gray-400 text-center">Escribiendo…</p>}
      </div>

      <div className="shrink-0 flex items-center gap-2 px-3 py-3 border-t border-gray-100 bg-white">
        <input
          value={primerMensajeEnviado ? input : MENSAJE_INICIAL}
          onChange={(e) => primerMensajeEnviado && setInput(e.target.value)}
          readOnly={!primerMensajeEnviado}
          onKeyDown={(e) => {
            if (e.key === "Enter") enviarMensaje();
          }}
          placeholder="Escribe tu mensaje..."
          className={`flex-1 rounded-full border border-gray-200 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 ${
            !primerMensajeEnviado ? "bg-gray-50 text-gray-700" : ""
          }`}
        />
        <button
          onClick={enviarMensaje}
          disabled={enviando || (primerMensajeEnviado && !input.trim())}
          className="rounded-full bg-emerald-600 text-white w-10 h-10 flex items-center justify-center hover:bg-emerald-700 disabled:opacity-50 shrink-0 shadow-sm"
        >
          ➤
        </button>
      </div>
    </div>
  );
}
