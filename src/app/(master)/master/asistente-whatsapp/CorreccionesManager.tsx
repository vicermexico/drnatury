"use client";
import { useEffect, useState } from "react";

// Lista todas las correcciones que Master le ha "enseñado" al bot (ver
// AsistenteChatDemo.tsx -- el botón "✏️ Enseñar respuesta correcta"),
// para que se puedan revisar y borrar las que ya no sirvan sin tener
// que volver a escribir el mensaje exacto que las disparó dentro de
// una conversación de prueba, que era la única forma de encontrarlas
// antes de este panel.
interface CorreccionUI {
  id: string;
  disparador_original: string;
  respuesta: string;
  updated_at: string;
}

export function CorreccionesManager({ bot }: { bot: string }) {
  const [correcciones, setCorrecciones] = useState<CorreccionUI[]>([]);
  const [cargando, setCargando] = useState(true);
  const [borrandoId, setBorrandoId] = useState<string | null>(null);
  // Ahora esta pantalla vive en su propia pagina (ver
  // /master/asistente-whatsapp/correcciones) -- empieza abierta de una vez.
  const [abierto, setAbierto] = useState(true);

  async function cargar() {
    setCargando(true);
    try {
      const res = await fetch(`/api/master/bot-demo/ensenar?bot=${bot}`);
      const data = await res.json().catch(() => null);
      setCorrecciones(data?.correcciones ?? []);
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    if (abierto) cargar();
  }, [abierto, bot]);

  async function borrar(id: string) {
    setBorrandoId(id);
    try {
      const res = await fetch("/api/master/bot-demo/ensenar", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        setCorrecciones((prev) => prev.filter((c) => c.id !== id));
      }
    } finally {
      setBorrandoId(null);
    }
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
      <button
        onClick={() => setAbierto((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div>
          <p className="text-sm font-medium text-gray-700">🎓 Correcciones que le has enseñado</p>
          <p className="text-xs text-gray-500 mt-0.5">
            Revisa aquí todo lo que le has enseñado al bot y borra lo que ya no haga falta
          </p>
        </div>
        <span className="text-gray-400">{abierto ? "▲" : "▼"}</span>
      </button>

      {abierto && (
        <div className="px-4 pb-4 space-y-2 border-t border-gray-100 pt-3">
          <p className="text-xs text-gray-500">
            Cada vez que le enseñas al bot una respuesta, eso solo le cambia las PALABRAS que dice
            para ese mensaje exacto -- no cambia lo que el bot trae guardado por dentro sobre en qué
            parte de la conversación va. Por eso, si mejoramos la lógica del bot más adelante,
            algunas de estas correcciones viejas pueden quedar de más (o hasta estorbar) -- revísalas
            de vez en cuando y borra las que ya no necesites.
          </p>
          {cargando && <p className="text-xs text-gray-400">Cargando...</p>}
          {!cargando && correcciones.length === 0 && (
            <p className="text-xs text-gray-400">Todavía no le has enseñado ninguna corrección.</p>
          )}
          {correcciones.map((c) => (
            <div key={c.id} className="rounded-lg bg-gray-50 px-3 py-2 space-y-1">
              <div className="flex items-start justify-between gap-2">
                <p className="text-[11px] text-gray-500">Cuando el paciente dice:</p>
                <button
                  onClick={() => borrar(c.id)}
                  disabled={borrandoId === c.id}
                  className="text-[11px] text-gray-400 hover:text-red-600 disabled:opacity-50 shrink-0"
                  title="Olvidar esta corrección"
                >
                  {borrandoId === c.id ? "..." : "🗑️"}
                </button>
              </div>
              <p className="text-xs text-gray-700 whitespace-pre-wrap">{c.disparador_original}</p>
              <p className="text-[11px] text-gray-500 mt-1">Ahora el bot contesta:</p>
              <p className="text-xs text-emerald-800 whitespace-pre-wrap">{c.respuesta}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
