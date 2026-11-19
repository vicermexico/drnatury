"use client";
import { useState } from "react";

interface MensajeGuardado {
  id: string;
  rol: "paciente" | "bot";
  texto: string;
}

// Reusa el mismo endpoint que ya usa el entrenador del bot
// (/master/asistente-whatsapp, boton "Ensenar respuesta correcta"):
// se identifica la correccion por el mensaje del paciente que la
// origino, asi que buscamos aqui el mensaje de paciente inmediatamente
// anterior a la respuesta del bot que se esta corrigiendo.
export function RevisionConversacion({ mensajes }: { mensajes: MensajeGuardado[] }) {
  const [corrigiendoId, setCorrigiendoId] = useState<string | null>(null);
  const [textoCorreccion, setTextoCorreccion] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [aprendidas, setAprendidas] = useState<Record<string, string>>({});

  function mensajePacienteAnterior(indice: number): string | null {
    for (let i = indice - 1; i >= 0; i--) {
      if (mensajes[i].rol === "paciente") return mensajes[i].texto;
    }
    return null;
  }

  function abrirCorreccion(m: MensajeGuardado, texto: string) {
    setCorrigiendoId(m.id);
    setTextoCorreccion(texto);
  }

  async function guardarCorreccion(m: MensajeGuardado, mensajePaciente: string) {
    if (!textoCorreccion.trim()) return;
    setGuardando(true);
    try {
      const res = await fetch("/api/master/bot-demo/ensenar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mensaje_paciente: mensajePaciente,
          respuesta_correcta: textoCorreccion.trim(),
        }),
      });
      if (res.ok) {
        setAprendidas((prev) => ({ ...prev, [m.id]: textoCorreccion.trim() }));
        setCorrigiendoId(null);
      }
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-[#eae6df] shadow-sm overflow-hidden">
      <div className="p-4 space-y-3">
        {mensajes.map((m, i) => {
          const mensajePaciente = m.rol === "bot" ? mensajePacienteAnterior(i) : null;
          return (
            <div key={m.id} className={`flex ${m.rol === "bot" ? "justify-end" : "justify-start"}`}>
              <div className="max-w-[80%]">
                <div
                  className={`rounded-xl px-3 py-2 text-sm whitespace-pre-wrap shadow-sm ${
                    m.rol === "bot" ? "bg-emerald-100 text-emerald-950" : "bg-white text-gray-800"
                  }`}
                >
                  {m.texto}
                </div>

                {m.rol === "bot" && mensajePaciente && corrigiendoId !== m.id && (
                  <button
                    onClick={() => abrirCorreccion(m, aprendidas[m.id] ?? m.texto)}
                    className="text-[11px] text-blue-600 hover:text-blue-800 mt-0.5 px-1"
                  >
                    {aprendidas[m.id] ? "✅ Ya le enseñé -- ver / cambiar" : "✏️ Aquí se equivocó: enseñar respuesta correcta"}
                  </button>
                )}

                {m.rol === "bot" && mensajePaciente && corrigiendoId === m.id && (
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
                        onClick={() => guardarCorreccion(m, mensajePaciente)}
                        disabled={guardando}
                        className="text-xs px-3 py-1 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
                      >
                        {guardando ? "Guardando..." : "Guardar"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
