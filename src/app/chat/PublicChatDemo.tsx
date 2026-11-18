"use client";
import { useEffect, useRef, useState } from "react";
import { useDictado } from "@/hooks/useDictado";

type EstadoAgendado = {
  fase: "inicio" | "conversando" | "agendando";
  [key: string]: unknown;
};

interface ResumenAgendado {
  nombre: string;
  celular: string;
  dia: string;
  hora: string;
  modalidad: string;
  lugar?: string;
  personas: number;
  costoTotal: number;
}

interface MensajeBienvenidaUI {
  tipo: "texto" | "audio";
  contenido: string;
}

interface MensajeUI {
  id: number;
  rol: "paciente" | "bot";
  texto: string;
  audioUrl?: string;
  agendado?: ResumenAgendado;
}

function esperar(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const ESTADO_INICIAL: EstadoAgendado = { fase: "inicio" };

// Mensaje pre-llenado del anuncio -- fijo, no se puede editar ni
// borrar, solo mandar, para que la persona vea exactamente lo mismo
// que le llegaria a Vic al hacerle clic a su anuncio de verdad.
const MENSAJE_INICIAL_ANUNCIO = "B3 - ¡Hola! ¿Podrían darme más información?";

// Cuando entran por el boton "Agenda tu cita" de la pagina de inicio
// (/chat?origen=inicio), en vez del mensaje de anuncio se manda este
// otro, directo a agendar -- asi el bot se salta el saludo de
// bienvenida y va directo a la pregunta de consultorio/domicilio.
const MENSAJE_INICIAL_AGENDAR = "Quisiera agendar mi cita";

function obtenerMensajeInicial(): string {
  if (typeof window === "undefined") return MENSAJE_INICIAL_ANUNCIO;
  const params = new URLSearchParams(window.location.search);
  return params.get("origen") === "inicio" ? MENSAJE_INICIAL_AGENDAR : MENSAJE_INICIAL_ANUNCIO;
}

// Numero de WhatsApp de Vic -- a donde se manda la confirmacion final de
// la cita (todavia no hay WhatsApp real conectado al bot, asi que el
// paciente le da clic y el mismo manda el mensaje ya escrito).
const VIC_WHATSAPP_NUMERO = "528117105018";

function construirMensajeWhatsapp(a: ResumenAgendado): string {
  return (
    `Hola, ya agendé mi cita con el asistente de DrNatury:\n\n` +
    `• Nombre: ${a.nombre}\n` +
    `• Celular: ${a.celular}\n` +
    `• Día: ${a.dia}\n` +
    `• Hora: ${a.hora}\n` +
    `• Modalidad: ${a.modalidad}${a.lugar ? ` (${a.lugar})` : ""}\n` +
    `• # Personas: ${a.personas}\n` +
    `• Costo total: $${a.costoTotal}\n\n` +
    `¿Me pueden confirmar y recordar mi cita por este medio (WhatsApp)?`
  );
}

let siguienteId = 1;

export function PublicChatDemo() {
  const [mensajes, setMensajes] = useState<MensajeUI[]>([]);
  const [estado, setEstado] = useState<EstadoAgendado>(ESTADO_INICIAL);
  const [input, setInput] = useState("");
  const [primerMensajeEnviado, setPrimerMensajeEnviado] = useState(false);
  const [enviando, setEnviando] = useState(false);
  // Se calcula una sola vez, al montar en el navegador: si viene del
  // boton "Agenda tu cita" de la pagina de inicio (?origen=inicio) o
  // del link normal de anuncio (sin ese query param).
  const [mensajeInicial] = useState<string>(obtenerMensajeInicial);
  const finDeMensajesRef = useRef<HTMLDivElement>(null);

  // Cada vez que llega un mensaje nuevo (o mientras el bot esta
  // "escribiendo"), bajamos solos hasta el final -- asi no hay que
  // hacerle scroll a mano para ver que contesto el bot.
  useEffect(() => {
    finDeMensajesRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [mensajes, enviando]);

  // Dictado por voz: cuando la persona termina de hablar, el texto que
  // dijo se escribe en el campo de abajo (no se manda solo, para que
  // pueda revisarlo antes de enviarlo, igual que si lo hubiera escrito).
  const { soportado: dictadoSoportado, escuchando, iniciar: iniciarDictado, detener: detenerDictado } = useDictado(
    (texto) => setInput((prev) => (prev ? `${prev} ${texto}` : texto))
  );

  async function enviarMensaje() {
    const esPrimero = !primerMensajeEnviado;
    const mensaje = (esPrimero ? mensajeInicial : input.trim());
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

      // El saludo de bienvenida llega como varios mensajes (texto y/o
      // audio, en el orden que Master armo) -- se mandan uno por uno,
      // con una pequena pausa entre cada uno, como llegarian de verdad
      // por WhatsApp.
      const serieBienvenida = data.mensajesBienvenida as MensajeBienvenidaUI[] | undefined;
      if (serieBienvenida && serieBienvenida.length > 0) {
        for (const item of serieBienvenida) {
          setMensajes((prev) => [
            ...prev,
            item.tipo === "audio"
              ? { id: siguienteId++, rol: "bot", texto: "", audioUrl: item.contenido }
              : { id: siguienteId++, rol: "bot", texto: item.contenido },
          ]);
          await esperar(700);
        }
      } else {
        setMensajes((prev) => [
          ...prev,
          { id: siguienteId++, rol: "bot", texto: data.respuesta, audioUrl: data.audioUrl, agendado: data.agendado },
        ]);
      }
    } finally {
      setEnviando(false);
    }
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
      </div>

      <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-4 space-y-3 bg-gradient-to-b from-emerald-50/40 to-white">
        {mensajes.length === 0 && (
          <p className="text-sm text-gray-500 text-center mt-10">
            Da clic en el botón de abajo para mandar el mensaje y empezar la conversación.
          </p>
        )}
        {mensajes.map((m) => (
          <div key={m.id} className={`flex ${m.rol === "bot" ? "justify-start" : "justify-end"}`}>
            <div
              className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm whitespace-pre-wrap shadow-sm ${
                m.audioUrl && !m.texto ? "w-64" : ""
              } ${
                m.rol === "bot"
                  ? "bg-white text-gray-800 border border-gray-100 rounded-bl-sm"
                  : "bg-emerald-600 text-white rounded-br-sm"
              }`}
            >
              {m.audioUrl && (
                <audio controls preload="none" className="w-full mb-2 h-10">
                  <source src={m.audioUrl} />
                </audio>
              )}
              {m.texto}
              {m.agendado && (
                <>
                  <p className="mt-3 text-sm text-gray-700">
                    Para confirmar tu cita y que te recordemos por este medio, da clic aquí:
                  </p>
                  <a
                    href={`https://wa.me/${VIC_WHATSAPP_NUMERO}?text=${encodeURIComponent(
                      construirMensajeWhatsapp(m.agendado)
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 flex items-center justify-center gap-2 rounded-full bg-[#25D366] text-white text-sm font-medium px-4 py-2 hover:brightness-95"
                  >
                    📲 Confirmar por WhatsApp
                  </a>
                </>
              )}
            </div>
          </div>
        ))}
        {enviando && <p className="text-xs text-gray-400 text-center">Escribiendo…</p>}
        <div ref={finDeMensajesRef} />
      </div>

      <div className="shrink-0 flex items-center gap-2 px-3 py-3 border-t border-gray-100 bg-white">
        <input
          value={primerMensajeEnviado ? input : mensajeInicial}
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
        {primerMensajeEnviado && dictadoSoportado && (
          <button
            onClick={() => (escuchando ? detenerDictado() : iniciarDictado())}
            disabled={enviando}
            title={escuchando ? "Detener" : "Hablar en vez de escribir"}
            className={`rounded-full w-10 h-10 flex items-center justify-center shrink-0 shadow-sm disabled:opacity-50 ${
              escuchando ? "bg-red-500 text-white animate-pulse" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            🎤
          </button>
        )}
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
