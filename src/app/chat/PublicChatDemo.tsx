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

type FaseLlamada = "inactivo" | "escuchando" | "pensando" | "hablando";

// Lo primero que se escucha al activar la llamada de voz -- el bot
// saluda primero, como si de verdad contestara una llamada, y hasta
// que termina de decirlo se pone a escuchar al paciente.
const SALUDO_LLAMADA = "Hola, ¿quieres agendar una cita?";

// Para que la llamada de voz no se sienta tan robot, mientras el bot
// "piensa" la respuesta (la misma pausa de 1 a 2 segundos de siempre)
// dice una de estas muletillas en vez de quedarse callado -- cambia
// cual le toca cada vez, para que no suene repetido.
const FRASES_PENSANDO = ["Mmm", "Ehh", "Pues"];
function elegirFrasePensando(): string {
  return FRASES_PENSANDO[Math.floor(Math.random() * FRASES_PENSANDO.length)];
}

// Busca una voz en español que suene a mujer entre las que ya trae el
// navegador (sin ningun servicio de pago) -- si no encuentra ninguna
// que calce con esos nombres, se queda con la primera voz en español
// que haya, y si ni eso hay, con la que sea.
function obtenerVozFemenina(): SpeechSynthesisVoice | undefined {
  if (typeof window === "undefined" || !window.speechSynthesis) return undefined;
  const voces = window.speechSynthesis.getVoices();
  const esVoces = voces.filter((v) => v.lang?.toLowerCase().startsWith("es"));
  const femenina = esVoces.find((v) =>
    /female|mujer|helena|sabina|m[oó]nica|lucia|luc[ií]a|paulina|elena|laura|camila|esperanza|isabela/i.test(v.name)
  );
  return femenina ?? esVoces[0] ?? voces[0];
}

// Lee un texto en voz alta con la voz del navegador (Web Speech API /
// SpeechSynthesis) -- igual que el dictado, no tiene ningun costo ni
// servicio externo.
//
// Importante: nunca se queda esperando a que carguen las voces (en
// varios celulares Android ese aviso nunca llega y la llamada se
// quedaba pegada sin decir nada) -- si todavia no hay voces cargadas,
// habla de una vez con la voz que el navegador use por default. Y por
// si la propia voz nunca avisa que termino (tambien pasa en algunos
// celulares), hay un tiempo maximo de espera para que la llamada
// siempre pueda seguir aunque no se escuche nada.
function hablar(texto: string, opts?: { alTerminar?: () => void }) {
  if (typeof window === "undefined" || !window.speechSynthesis || !texto.trim()) {
    opts?.alTerminar?.();
    return;
  }
  const utter = new SpeechSynthesisUtterance(texto);
  utter.lang = "es-MX";
  const voz = obtenerVozFemenina();
  if (voz) utter.voice = voz;

  let yaTermino = false;
  const terminar = () => {
    if (yaTermino) return;
    yaTermino = true;
    opts?.alTerminar?.();
  };
  utter.onend = terminar;
  utter.onerror = terminar;
  // Tiempo maximo: lo que tardaria una persona leyendolo despacio, con
  // un minimo de 4 segundos y un tope de 20.
  const tiempoMaximo = Math.min(20000, Math.max(4000, texto.length * 90));
  setTimeout(terminar, tiempoMaximo);

  try {
    window.speechSynthesis.speak(utter);
  } catch {
    terminar();
  }
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

function obtenerOrigen(): "inicio" | "anuncio" {
  if (typeof window === "undefined") return "anuncio";
  const params = new URLSearchParams(window.location.search);
  return params.get("origen") === "inicio" ? "inicio" : "anuncio";
}

// Un id por conversacion (se genera una sola vez al abrir el chat) para
// que Master pueda ver en su panel cuantos mensajes llegaron y cuantos
// se cerraron con cita -- ver tabla chat_leads y
// /master/asistente-whatsapp/mensajes.
function nuevoIdConversacion(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
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

// Icono de microfono igual al que usa WhatsApp (en vez del emoji 🎤,
// que se ve distinto segun el celular).
function IconoMicrofono({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M12 15a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v6a3 3 0 0 0 3 3Z" />
      <path d="M19 11a1 1 0 0 0-2 0 5 5 0 0 1-10 0 1 1 0 0 0-2 0 7 7 0 0 0 6 6.92V20H9a1 1 0 1 0 0 2h6a1 1 0 1 0 0-2h-2v-2.08A7 7 0 0 0 19 11Z" />
    </svg>
  );
}

let siguienteId = 1;

// Para que no se vea tan rapido (como si fuera un robot contestando al
// instante), el bot siempre se tarda al menos esto en contestar -- si
// la respuesta de verdad llega mas rapido, se espera lo que falte; si
// ya se tardo mas que esto (por ejemplo por internet lento), no se le
// suma nada extra.
const RESPUESTA_DEMORA_MIN_MS = 1500;

interface PublicChatDemoProps {
  perfilNombre?: string;
  perfilFoto?: string | null;
  facebookUrl?: string | null;
}

export function PublicChatDemo({
  perfilNombre = "DrNatury",
  perfilFoto = null,
  facebookUrl = null,
}: PublicChatDemoProps) {
  const [mensajes, setMensajes] = useState<MensajeUI[]>([]);
  const [estado, setEstado] = useState<EstadoAgendado>(ESTADO_INICIAL);
  const [input, setInput] = useState("");
  const [primerMensajeEnviado, setPrimerMensajeEnviado] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [mostrarOpciones, setMostrarOpciones] = useState(false);
  // Llamada de voz: mientras esta activa, no se escribe ni se ve nada
  // en pantalla -- el paciente habla, se le manda al bot por detras
  // igual que un mensaje normal, y la respuesta se lee en voz alta.
  const [modoLlamada, setModoLlamada] = useState(false);
  const [faseLlamada, setFaseLlamada] = useState<FaseLlamada>("inactivo");
  const modoLlamadaRef = useRef(false);
  // Se calcula una sola vez, al montar en el navegador: si viene del
  // boton "Agenda tu cita" de la pagina de inicio (?origen=inicio) o
  // del link normal de anuncio (sin ese query param).
  const [mensajeInicial] = useState<string>(obtenerMensajeInicial);
  const [origen] = useState<"inicio" | "anuncio">(obtenerOrigen);
  const [conversacionId] = useState<string>(nuevoIdConversacion);
  const finDeMensajesRef = useRef<HTMLDivElement>(null);
  // Guarda siempre el estado mas reciente de la conversacion para que
  // la llamada de voz (que se vuelve a llamar sola, sin que la persona
  // le de clic a nada) nunca use un estado viejo.
  const estadoRef = useRef(estado);
  useEffect(() => {
    estadoRef.current = estado;
  }, [estado]);

  // Cada vez que llega un mensaje nuevo (o mientras el bot esta
  // "escribiendo"), bajamos solos hasta el final -- asi no hay que
  // hacerle scroll a mano para ver que contesto el bot.
  useEffect(() => {
    finDeMensajesRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [mensajes, enviando]);

  // Dictado por voz: cuando la persona termina de hablar, el texto que
  // dijo se escribe en el campo de abajo (no se manda solo, para que
  // pueda revisarlo antes de enviarlo, igual que si lo hubiera escrito).
  // En llamada de voz (modoLlamada) ese mismo dictado se usa distinto:
  // el texto no se ve, se manda derecho al bot (ver manejarTextoDeLlamada).
  const { soportado: dictadoSoportado, escuchando, iniciar: iniciarDictado, detener: detenerDictado } = useDictado(
    (texto) => {
      if (modoLlamadaRef.current) {
        manejarTextoDeLlamada(texto);
      } else {
        setInput((prev) => (prev ? `${prev} ${texto}` : texto));
      }
    }
  );

  async function enviarMensaje() {
    const esPrimero = !primerMensajeEnviado;
    const mensaje = (esPrimero ? mensajeInicial : input.trim());
    if (!mensaje || enviando) return;
    setInput("");
    if (esPrimero) setPrimerMensajeEnviado(true);
    setEnviando(true);

    setMensajes((prev) => [...prev, { id: siguienteId++, rol: "paciente", texto: mensaje }]);
    const inicio = Date.now();

    try {
      const res = await fetch("/api/public/asistente-whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mensaje, estado, conversacionId, origen }),
      });
      const data = await res.json().catch(() => null);

      const demoraRestante = RESPUESTA_DEMORA_MIN_MS - (Date.now() - inicio);
      if (demoraRestante > 0) await esperar(demoraRestante);

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

  // Manda lo que el paciente dijo (ya convertido a texto por el
  // dictado) al mismo endpoint de siempre, pero sin mostrar nada en
  // pantalla: mientras espera la respuesta dice una muletilla en voz
  // alta ("Mmm...", "Ehh...", "Pues...") y, en cuanto llega la
  // respuesta de verdad, la lee completa con voz de mujer. Al
  // terminar de hablar, se vuelve a poner a escuchar solo.
  async function manejarTextoDeLlamada(texto: string) {
    if (!modoLlamadaRef.current) return;
    const esPrimero = !primerMensajeEnviado;
    if (esPrimero) setPrimerMensajeEnviado(true);

    setFaseLlamada("pensando");
    hablar(elegirFrasePensando());

    const inicio = Date.now();
    try {
      const res = await fetch("/api/public/asistente-whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mensaje: texto, estado: estadoRef.current, conversacionId, origen }),
      });
      const data = await res.json().catch(() => null);

      const demoraRestante = RESPUESTA_DEMORA_MIN_MS - (Date.now() - inicio);
      if (demoraRestante > 0) await esperar(demoraRestante);

      if (!modoLlamadaRef.current) return;

      if (!res.ok || !data) {
        setFaseLlamada("hablando");
        hablar("Perdón, hubo un error, ¿puedes repetir?", { alTerminar: reanudarEscuchaLlamada });
        return;
      }

      setEstado(data.nuevoEstado);
      estadoRef.current = data.nuevoEstado;

      const serieBienvenida = data.mensajesBienvenida as MensajeBienvenidaUI[] | undefined;
      const textoRespuesta =
        serieBienvenida && serieBienvenida.length > 0
          ? serieBienvenida
              .filter((item) => item.tipo === "texto")
              .map((item) => item.contenido)
              .join(". ")
          : data.respuesta;

      setFaseLlamada("hablando");
      hablar(textoRespuesta, { alTerminar: reanudarEscuchaLlamada });
    } catch {
      if (!modoLlamadaRef.current) return;
      setFaseLlamada("hablando");
      hablar("Perdón, hubo un error, ¿puedes repetir?", { alTerminar: reanudarEscuchaLlamada });
    }
  }

  function reanudarEscuchaLlamada() {
    if (!modoLlamadaRef.current) return;
    setFaseLlamada("escuchando");
    iniciarDictado();
  }

  function activarLlamada() {
    setModoLlamada(true);
    modoLlamadaRef.current = true;
    setFaseLlamada("hablando");
    hablar(SALUDO_LLAMADA, {
      alTerminar: () => {
        if (!modoLlamadaRef.current) return;
        if (!primerMensajeEnviado) {
          manejarTextoDeLlamada(MENSAJE_INICIAL_AGENDAR);
        } else {
          reanudarEscuchaLlamada();
        }
      },
    });
  }

  function colgarLlamada() {
    modoLlamadaRef.current = false;
    setModoLlamada(false);
    setFaseLlamada("inactivo");
    detenerDictado();
    window.speechSynthesis?.cancel();
  }

  return (
    <div className="relative bg-white overflow-hidden flex flex-col flex-1 min-h-0">
      <div className="shrink-0 flex items-center gap-1 px-2 py-2 bg-white border-b border-gray-200">
        <button
          onClick={() => setMostrarOpciones(true)}
          className="flex items-center gap-3 flex-1 min-w-0 text-left px-2 py-1 rounded-xl hover:bg-gray-50 transition"
        >
          <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-lg shrink-0 overflow-hidden">
            {perfilFoto ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={perfilFoto} alt={perfilNombre} className="w-full h-full object-cover" />
            ) : (
              "🌿"
            )}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900 leading-tight truncate">{perfilNombre}</p>
            <p className="text-[11px] text-gray-500 leading-tight">{enviando ? "escribiendo..." : "en línea"}</p>
          </div>
        </button>
        {dictadoSoportado && (
          <button
            onClick={activarLlamada}
            title="Llamada de voz"
            className="w-10 h-10 rounded-full flex items-center justify-center text-emerald-700 hover:bg-gray-100 shrink-0 text-lg"
          >
            📞
          </button>
        )}
        <button
          onClick={() => setMostrarOpciones(true)}
          title="Más opciones"
          className="w-10 h-10 rounded-full flex items-center justify-center text-gray-600 hover:bg-gray-100 shrink-0 text-xl leading-none"
        >
          ⋮
        </button>
      </div>

      {modoLlamada && (
        <div className="absolute inset-0 z-30 bg-gray-900 flex flex-col items-center justify-between py-10 px-6">
          <div className="text-center">
            <p className="text-white text-base font-semibold">{perfilNombre}</p>
            <p className="text-gray-300 text-xs mt-1">
              {faseLlamada === "escuchando"
                ? "Escuchando..."
                : faseLlamada === "pensando"
                  ? "Pensando..."
                  : faseLlamada === "hablando"
                    ? "Hablando..."
                    : "Llamada de voz"}
            </p>
          </div>

          <div
            className={`relative w-40 h-40 rounded-full flex items-center justify-center overflow-hidden ${
              faseLlamada === "escuchando"
                ? "bg-emerald-500"
                : faseLlamada === "pensando"
                  ? "bg-amber-500"
                  : faseLlamada === "hablando"
                    ? "bg-sky-500"
                    : "bg-gray-500"
            } animate-pulse`}
          />

          <button
            onClick={colgarLlamada}
            title="Colgar"
            className="w-14 h-14 rounded-full bg-red-600 flex items-center justify-center text-white text-2xl shadow-lg rotate-[135deg]"
          >
            📞
          </button>
        </div>
      )}

      {mostrarOpciones && (
        <div className="absolute inset-0 z-20 bg-white flex flex-col">
          <div className="shrink-0 flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-200">
            <button
              onClick={() => setMostrarOpciones(false)}
              className="text-gray-700 text-xl leading-none px-1 -ml-1"
              aria-label="Cerrar"
            >
              ←
            </button>
            <p className="text-sm font-semibold text-gray-900">Info. del contacto</p>
          </div>
          <div className="flex-1 overflow-y-auto overscroll-contain flex flex-col items-center">
            <div className="relative w-full shrink-0">
              <div className="h-32 w-full overflow-hidden bg-gradient-to-br from-emerald-500 to-emerald-700">
                {perfilFoto && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={perfilFoto}
                    alt=""
                    aria-hidden="true"
                    className="w-full h-full object-cover scale-125 blur-md opacity-70"
                  />
                )}
              </div>
              <div className="absolute left-1/2 -translate-x-1/2 -bottom-11 w-24 h-24 rounded-full border-4 border-white bg-emerald-100 flex items-center justify-center text-4xl overflow-hidden shadow-lg">
                {perfilFoto ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={perfilFoto} alt={perfilNombre} className="w-full h-full object-cover" />
                ) : (
                  "🌿"
                )}
              </div>
            </div>
            <p className="text-lg font-semibold text-gray-900 mt-14">{perfilNombre}</p>
            <div className="w-full mt-6 px-6 pb-8 space-y-2">
              <a
                href="https://www.drnatury.com"
                target="_blank"
                rel="noopener noreferrer"
                className="block rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-800 hover:bg-gray-50"
              >
                🌐 Visitar www.drnatury.com
              </a>
              {facebookUrl && (
                <a
                  href={facebookUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-800 hover:bg-gray-50"
                >
                  📘 Ver nuestro anuncio de Facebook
                </a>
              )}
              <a
                href={`https://wa.me/${VIC_WHATSAPP_NUMERO}`}
                target="_blank"
                rel="noopener noreferrer"
                className="block rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-800 hover:bg-gray-50"
              >
                📲 Escribir por WhatsApp
              </a>
            </div>
          </div>
        </div>
      )}

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
                // Se resalta bien este bloque (fondo y borde propios) y el
                // boton lleva una flechita que rebota y un brillo detras
                // que pulsa de tenue a fuerte, para que no se le pase a la
                // persona darle clic y de verdad se confirme la cita.
                <div className="mt-3 rounded-2xl border-2 border-emerald-300 bg-emerald-50 p-3">
                  <p className="text-center text-sm font-semibold text-emerald-900">
                    Para confirmar y recordar tu cita por WhatsApp, da clic aquí
                  </p>
                  <div className="flex justify-center text-xl leading-none text-emerald-500 animate-bounce" aria-hidden="true">
                    ⬇️
                  </div>
                  <div className="flex justify-center">
                    <a
                      href={`https://wa.me/${VIC_WHATSAPP_NUMERO}?text=${encodeURIComponent(
                        construirMensajeWhatsapp(m.agendado)
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="relative flex items-center justify-center gap-2 rounded-full bg-[#25D366] text-white text-sm font-semibold px-5 py-2.5 shadow-lg hover:brightness-95"
                    >
                      <span
                        className="absolute inset-0 -z-10 rounded-full bg-emerald-400 opacity-75 animate-ping pointer-events-none"
                        aria-hidden="true"
                      />
                      📲 Confirmar por WhatsApp
                    </a>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
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
          placeholder="Mensaje"
          style={{ color: "#fff", WebkitTextFillColor: "#fff", colorScheme: "dark" }}
          className="flex-1 rounded-full border border-gray-700 bg-[#2a3942] caret-white placeholder-gray-400 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
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
            <IconoMicrofono className="w-5 h-5" />
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
