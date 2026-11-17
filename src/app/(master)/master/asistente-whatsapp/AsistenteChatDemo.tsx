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
  nota?: string;
  mensajePacienteQueLaOrigino?: string; // para poder "ensenar" esta respuesta de bot
}

const ESTADO_INICIAL: EstadoAgendado = { fase: "inicio" };

let siguienteId = 1;

export function AsistenteChatDemo() {
  const [mensajes, setMensajes] = useState<MensajeUI[]>([]);
  const [estado, setEstado] = useState<EstadoAgendado>(ESTADO_INICIAL);
  const [input, setInput] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [corrigiendoId, setCorrigiendoId] = useState<number | null>(null);
  const [textoCorreccion, setTextoCorreccion] = useState("");
  const [guardandoCorreccion, setGuardandoCorreccion] = useState(false);

  async function enviarMensaje() {
    const mensaje = input.trim();
    if (!mensaje || enviando) return;
    setInput("");
    setEnviando(true);

    const idPaciente = siguienteId++;
    setMensajes((prev) => [...prev, { id: idPaciente, rol: "paciente", texto: mensaje }]);

    try {
      const res = await fetch("/api/master/bot-demo/responder", {
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
      setMensajes((prev) => [
        ...prev,
        {
          id: siguienteId++,
          rol: "bot",
          texto: data.respuesta,
          nota: data.nota,
          mensajePacienteQueLaOrigino: mensaje,
        },
      ]);
    } finally {
      setEnviando(false);
    }
  }

  function reiniciar() {
    setMensajes([]);
    setEstado(ESTADO_INICIAL);
    setCorrigiendoId(null);
  }

  function abrirCorreccion(m: MensajeUI) {
    setCorrigiendoId(m.id);
    setTextoCorreccion(m.texto);
  }

  async function guardarCorreccion(m: MensajeUI) {
    if (!m.mensajePacienteQueLaOrigino || !textoCorreccion.trim()) return;
    setGuardandoCorreccion(true);
    try {
      const res = await fetch("/api/master/bot-demo/ensenar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mensaje_paciente: m.mensajePacienteQueLaOrigino,
          respuesta_correcta: textoCorreccion.trim(),
        }),
      });
      if (res.ok) {
        setMensajes((prev) =>
          prev.map((msg) => (msg.id === m.id ? { ...msg, texto: textoCorreccion.trim(), nota: "Respuesta aprendida" } : msg))
        );
        setCorrigiendoId(null);
      }
    } finally {
      setGuardandoCorreccion(false);
    }
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden flex flex-col h-[70vh]">
      <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50">
        <p className="text-sm font-medium text-gray-700">
          Escribe tú aquí como si fueras un paciente nuevo escribiendo por primera vez
        </p>
        <button
          onClick={reiniciar}
          className="text-xs font-medium text-gray-500 hover:text-gray-800 px-2 py-1 rounded-lg hover:bg-gray-100"
        >
          🔄 Reiniciar conversación
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-[#eae6df]">
        {mensajes.length === 0 && (
          <p className="text-sm text-gray-500 text-center mt-10">
            Escribe algo abajo como si fueras un paciente (por ejemplo lo que pondría al dar clic a tu anuncio) para empezar.
          </p>
        )}
        {mensajes.map((m) => (
          <div key={m.id} className={`flex ${m.rol === "bot" ? "justify-end" : "justify-start"}`}>
            <div className="max-w-[80%]">
              <div
                className={`rounded-xl px-3 py-2 text-sm whitespace-pre-wrap shadow-sm ${
                  m.rol === "bot" ? "bg-emerald-100 text-emerald-950" : "bg-white text-gray-800"
                }`}
              >
                {m.texto}
              </div>
              {m.rol === "bot" && m.nota && (
                <p className={`text-[11px] mt-0.5 px-1 ${m.nota === "sin_entrenar" ? "text-amber-600" : "text-gray-400"}`}>
                  {m.nota === "sin_entrenar" ? "⚠️ No supo qué contestar" : m.nota}
                </p>
              )}
              {m.rol === "bot" && corrigiendoId !== m.id && (
                <button
                  onClick={() => abrirCorreccion(m)}
                  className="text-[11px] text-blue-600 hover:text-blue-800 mt-0.5 px-1"
                >
                  ✏️ Enseñar respuesta correcta
                </button>
              )}
              {m.rol === "bot" && corrigiendoId === m.id && (
                <div className="mt-1 rounded-xl border border-blue-200 bg-blue-50 p-2 space-y-2">
                  <p className="text-[11px] text-blue-700">¿Qué debió haber contestado el bot aquí?</p>
                  <textarea
                    value={textoCorreccion}
                    onChange={(e) => setTextoCorreccion(e.target.value)}
                    rows={3}
                    className="w-full rounded-lg border border-blue-200 px-2 py-1.5 text-sm"
                  />
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={() => setCorrigiendoId(null)}
                      className="text-xs px-2 py-1 text-gray-500 hover:text-gray-700"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={() => guardarCorreccion(m)}
                      disabled={guardandoCorreccion}
                      className="text-xs px-3 py-1 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
                    >
                      {guardandoCorreccion ? "Guardando..." : "Guardar"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
        {enviando && <p className="text-xs text-gray-400 text-center">El bot está pensando…</p>}
      </div>

      <div className="shrink-0 flex items-center gap-2 px-3 py-3 border-t border-gray-100 bg-white">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") enviarMensaje();
          }}
          placeholder="Escribe el mensaje del paciente..."
          className="flex-1 rounded-full border border-gray-200 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
        />
        <button
          onClick={enviarMensaje}
          disabled={enviando || !input.trim()}
          className="rounded-full bg-emerald-600 text-white w-10 h-10 flex items-center justify-center hover:bg-emerald-700 disabled:opacity-50"
        >
          ➤
        </button>
      </div>
    </div>
  );
}
