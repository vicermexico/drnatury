"use client";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useDictado } from "@/hooks/useDictado";
import { MENSAJE_INICIAL_ANUNCIO } from "@/lib/whatsapp-bot/mensajes";
import { requestNotificationPermission } from "@/lib/firebase";
import { VideoTransparente } from "@/components/chat/VideoTransparente";
import { RevistaChatCard, type ProductoRevista } from "@/components/chat/RevistaChatCard";

type EstadoAgendado = {
  fase: "inicio" | "conversando" | "agendando";
  [key: string]: unknown;
};

interface ResumenAgendado {
  // "pedido" cuando es un pedido de producto (bot "pomada", ver Fase 2
  // del bot de venta de productos) en vez de una cita de consultorio/
  // domicilio -- cambia el texto del boton y el mensaje de WhatsApp.
  tipo?: "cita" | "pedido";
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
  tipo: "texto" | "audio" | "video";
  contenido: string;
}

interface MensajeUI {
  id: number;
  rol: "paciente" | "bot";
  texto: string;
  audioUrl?: string;
  videoUrl?: string;
  agendado?: ResumenAgendado;
  // true solo en los mensajes de la serie de bienvenida (el saludo de
  // entrada) -- el boton de "Compartir" solo sale ahi, no en cada
  // mensaje del bot (pedido explicito de Vic).
  esBienvenida?: boolean;
  // Cuando el cliente pide ver el catalogo (ver CATALOGO_KEYWORDS en
  // engine-pomada.ts), el bot manda un mensaje aparte nada mas con
  // esto -- se ve como la tarjeta de la revista, no como una burbuja
  // de texto normal (ver RevistaChatCard).
  catalogo?: ProductoRevista[];
  // "como libro" (se voltean paginas) o "solo imagen" (foto + nombre +
  // precio + botones, uno debajo del otro) -- switch de Vic en Master
  // -> Productos (ver ProductosPanel.tsx).
  catalogoComoLibro?: boolean;
}

// Datos para mandar la ubicacion actual de la cita a domicilio que se
// acaba de agendar en esta conversacion (ver UbicacionButton.tsx, que
// usa este mismo token para el link que se manda por WhatsApp -- aqui
// se reutiliza el mismo mecanismo pero dentro del chat).
interface UbicacionDatos {
  appointmentId: string;
  token: string;
}

function esperar(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type FaseLlamada = "inactivo" | "escuchando" | "pensando" | "hablando";

// Lo primero que se escucha al activar la llamada de voz -- el bot
// saluda primero, como si de verdad contestara una llamada, y hasta
// que termina de decirlo se pone a escuchar al paciente.
const SALUDO_LLAMADA = "Hola, ¿quieres agendar una cita?";

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

// EstadoAgendado solo tipa las fases genericas de citas ("inicio" /
// "conversando" / "agendando") -- el bot de la pomada (ver EstadoPedido
// en engine-pomada.ts) usa sus propias fases/pasos ("pidiendo" /
// "direccion") que viajan dentro del mismo objeto gracias al indice
// [key: string]: unknown. Este helper nada mas checa, de forma segura,
// si el paciente esta en el paso de "direccion" de un pedido.
function enPasoDeDireccionDePedido(estado: EstadoAgendado): boolean {
  const e = estado as { fase: string; paso?: string };
  return e.fase === "pidiendo" && e.paso === "direccion";
}

// Cuando entran por el boton "Agenda tu cita" de la pagina de inicio
// (/chat?origen=inicio), en vez del mensaje de anuncio se manda este
// otro, directo a agendar -- asi el bot se salta el saludo de
// bienvenida y va directo a la pregunta de consultorio/domicilio.
const MENSAJE_INICIAL_AGENDAR = "Quisiera agendar mi cita";

// mensajeAnuncio: lo que Vic haya configurado para este bot en Master
// -> Perfil del chat (mensaje_inicial_anuncio); si no ha configurado
// nada todavia, se usa el de siempre (MENSAJE_INICIAL_ANUNCIO).
function obtenerMensajeInicial(mensajeAnuncio: string): string {
  if (typeof window === "undefined") return mensajeAnuncio;
  const params = new URLSearchParams(window.location.search);
  return params.get("origen") === "inicio" ? MENSAJE_INICIAL_AGENDAR : mensajeAnuncio;
}

function obtenerOrigen(): "inicio" | "anuncio" {
  if (typeof window === "undefined") return "anuncio";
  const params = new URLSearchParams(window.location.search);
  return params.get("origen") === "inicio" ? "inicio" : "anuncio";
}

// De que anuncio de Facebook/Instagram vino el visitante
// (drnatury.com/chat?anuncio=B3) -- se manda una sola vez, al crear la
// conversacion, para que Master pueda ver despues de que anuncio vino
// cada lead (ver chat_leads.codigo_anuncio).
function obtenerCodigoAnuncio(): string | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  return params.get("anuncio")?.trim() || null;
}

// Cuando el visitante le da clic a un link de recordatorio
// (drnatury.com/chat?retomar=<id>), en vez de generar una conversacion
// nueva se retoma esa misma -- ver el useEffect "retomar" mas abajo.
function obtenerIdRetomar(): string | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  return params.get("retomar")?.trim() || null;
}

// Un id por conversacion (se genera una sola vez al abrir el chat) para
// que Master pueda ver en su panel cuantos mensajes llegaron y cuantos
// se cerraron con cita -- ver tabla chat_leads y
// /master/asistente-whatsapp/mensajes.
function nuevoIdConversacion(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

// Numero de WhatsApp de respaldo cuando el bot todavia no tiene uno
// propio configurado (ver "whatsappNumero" mas abajo, editable por bot
// en Master -> Perfil del chat) -- a donde se manda la confirmacion
// final de la cita/pedido (todavia no hay WhatsApp real conectado al
// bot, asi que el paciente le da clic y el mismo manda el mensaje ya
// escrito).
const VIC_WHATSAPP_NUMERO = "528117105018";

// Link que SIEMPRE se agrega al final de lo que se comparte por
// WhatsApp (texto, audio o video) -- asi quien lo reciba sabe de donde
// viene y puede entrar directo a la pagina.
const DRNATURY_LINK = "https://www.drnatury.com";

// Abre WhatsApp (sin numero fijo, para que elijan a quien mandarlo)
// con el contenido del mensaje ya escrito, mas el link de la pagina al
// final -- lo usa el boton de "Compartir" de cada mensaje del bot.
// "ventana" es opcional: si ya se habia abierto una pestana de antemano
// (ver compartirAudio, que la abre ANTES de cualquier "await" para que
// el navegador no la bloquee), se reutiliza esa en vez de abrir una
// nueva -- para el resto de los casos (texto, video), que son
// sincronos, no hace falta y se abre una nueva como siempre.
function compartirPorWhatsapp(contenido: string, ventana?: Window | null) {
  const mensaje = `${contenido}\n\n${DRNATURY_LINK}`;
  const url = `https://wa.me/?text=${encodeURIComponent(mensaje)}`;
  if (ventana) {
    ventana.location.href = url;
  } else {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}

// Para los mensajes de audio, en vez de nomas mandar el link, se
// intenta compartir el archivo de verdad -- asi a quien se lo manden
// le llega como nota de voz de WhatsApp (le dan play ahi mismo, sin
// tener que abrir nada) y, aparte, el link de la pagina. Esto solo
// funciona en celulares que soportan compartir archivos (la mayoria
// de los Android/iPhone modernos); en computadora, o si algo falla, se
// manda el link como antes.
async function compartirAudio(audioUrl: string, texto?: string) {
  const soportaCompartirArchivos =
    typeof navigator !== "undefined" && "share" in navigator && "canShare" in navigator;

  // Si de perdida vamos a necesitar abrir WhatsApp como respaldo (ej.
  // porque el celular no deja compartir el audio como archivo tal
  // cual), la pestana se abre DE UNA VEZ aqui, todavia dentro del mismo
  // clic del usuario -- varios navegadores (sobre todo en iPhone)
  // bloquean en silencio cualquier pestana nueva que se intente abrir
  // DESPUES de un "await" (como el fetch de abajo), porque para ese
  // momento ya no se considera algo que el usuario pidio directamente.
  // Sin esto, cuando fallaba el intentar compartir el archivo, ya era
  // demasiado tarde para abrir WhatsApp y "Compartir" no hacia nada --
  // Vic lo reporto (pasaba con el audio, no con el texto, que es
  // sincrono y nunca tuvo este problema).
  const pestanaRespaldo = soportaCompartirArchivos ? window.open("", "_blank") : null;

  if (soportaCompartirArchivos) {
    try {
      const respuesta = await fetch(audioUrl);
      const datos = await respuesta.blob();
      const archivo = new File([datos], "nota-de-voz-drnatury.ogg", {
        type: datos.type || "audio/ogg",
      });
      if (navigator.canShare({ files: [archivo] })) {
        pestanaRespaldo?.close();
        await navigator.share({ files: [archivo], text: DRNATURY_LINK });
        return;
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        pestanaRespaldo?.close();
        return; // el usuario cancelo, no insistir
      }
      console.error("No se pudo compartir el audio como nota de voz, se manda el link:", err);
    }
  }
  compartirPorWhatsapp(`🎤 Escucha este audio:\n${audioUrl}${texto ? `\n\n${texto}` : ""}`, pestanaRespaldo);
}

// Boton de "Compartir" -- se repite en cada mensaje del bot (texto,
// audio o video). Mas grande y visible (pedido explicito de Vic),
// estilo pill verde parecido al boton de WhatsApp de la app. Para
// audio manda el archivo de verdad cuando se puede (ver
// compartirAudio); para texto y video manda el link de siempre.
function BotonCompartir(props: { contenido: string } | { audioUrl: string; texto?: string }) {
  function manejarClic() {
    if ("audioUrl" in props) {
      void compartirAudio(props.audioUrl, props.texto);
    } else {
      compartirPorWhatsapp(props.contenido);
    }
  }
  return (
    <button
      type="button"
      onClick={manejarClic}
      className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3.5 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-100"
    >
      ↗️ Compartir
    </button>
  );
}

function construirMensajeWhatsapp(a: ResumenAgendado): string {
  if (a.tipo === "pedido") {
    return (
      `Hola, ya hice mi pedido de Pomada Barak Flex con el asistente:\n\n` +
      `• Nombre: ${a.nombre}\n` +
      `• Celular: ${a.celular}\n` +
      `• Cantidad: ${a.personas}\n` +
      `• Dirección: ${a.lugar}\n` +
      `• Entrega: ${a.hora}\n` +
      `• Total a pagar (contra entrega): $${a.costoTotal}\n\n` +
      `¿Me pueden confirmar mi pedido por este medio (WhatsApp)?`
    );
  }
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

// Icono real de WhatsApp (el "telefono dentro de un globo de texto"),
// para el boton de "mandame un WhatsApp" de la cabecera del chat --
// Vic pidio el icono de verdad, no un emoji generico.
function IconoWhatsApp({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M12 2C6.477 2 2 6.477 2 12c0 1.9.53 3.68 1.45 5.19L2 22l4.95-1.3A9.94 9.94 0 0 0 12 22c5.523 0 10-4.477 10-10S17.523 2 12 2zm0 18c-1.63 0-3.14-.44-4.44-1.2l-.32-.19-3.07.8.82-2.99-.2-.31A7.93 7.93 0 0 1 4 12c0-4.41 3.59-8 8-8s8 3.59 8 8-3.59 8-8 8zm4.29-5.71c-.23-.12-1.36-.67-1.57-.75-.21-.08-.36-.12-.51.12-.15.23-.59.75-.72.9-.13.15-.27.17-.5.06-.23-.12-.96-.35-1.83-1.12-.68-.6-1.14-1.34-1.27-1.57-.13-.23-.01-.36.1-.47.11-.11.23-.27.35-.4.12-.13.15-.23.23-.38.08-.15.04-.29-.02-.4-.06-.12-.51-1.23-.7-1.68-.18-.44-.37-.38-.51-.39h-.44c-.15 0-.4.06-.6.29-.21.23-.8.78-.8 1.9 0 1.12.82 2.21.94 2.36.12.15 1.62 2.48 3.93 3.48.55.24.98.38 1.31.49.55.17 1.05.15 1.45.09.44-.07 1.36-.56 1.55-1.1.19-.54.19-1 .13-1.1-.05-.1-.2-.16-.43-.27z" />
    </svg>
  );
}

// Icono de "pin" de ubicacion con la misma forma de gota que usan Google
// Maps y Waze (en vez del emoji 📍, que se ve distinto segun el celular)
// -- pedido explicitamente por Vic con un ejemplo de referencia.
// El bot menciona el icono de ubicacion dentro de su texto (ej.
// "también le puede dar clic al pin 📍 de abajo") usando el emoji 📍 --
// pero el boton de verdad usa este icono de gota con forma de Google
// Maps/Waze (ver IconoUbicacion abajo), que se ve distinto. Vic pidio
// que fueran el MISMO icono, asi que aqui se reemplaza el emoji por el
// icono real dentro del texto del mensaje.
function renderizarTextoConIconoUbicacion(texto: string): ReactNode {
  if (!texto.includes("📍")) return texto;
  return texto.split("📍").map((parte, i, arr) => (
    <span key={i}>
      {parte}
      {i < arr.length - 1 && <IconoUbicacion className="inline-block w-4 h-4 align-text-bottom mx-0.5" />}
    </span>
  ));
}

function IconoUbicacion({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        d="M12 2C7.58 2 4 5.58 4 10c0 5.25 6.72 11.19 7.01 11.44a1.5 1.5 0 0 0 1.98 0C13.28 21.19 20 15.25 20 10c0-4.42-3.58-8-8-8Z"
        fill="#ea4335"
      />
      <circle cx="12" cy="10" r="3.2" fill="#fff" />
    </svg>
  );
}

let siguienteId = 1;

// Para que no se vea tan rapido (como si fuera un robot contestando al
// instante), el bot siempre se tarda al menos esto en contestar -- si
// la respuesta de verdad llega mas rapido, se espera lo que falte; si
// ya se tardo mas que esto (por ejemplo por internet lento), no se le
// suma nada extra. Vic pidio que fuera mas rapido ("que conteste al
// segundo"), bajado de 1500ms.
const RESPUESTA_DEMORA_MIN_MS = 1000;

// Emojis rapidos junto al cuadro de mensaje, para que el paciente no
// tenga que salir al teclado de su celular a buscarlos.
const EMOJIS_RAPIDOS = [
  "😀", "😁", "😂", "🙂", "😊", "😍",
  "👍", "🙏", "👏", "❤️", "🙌", "😢",
  "😮", "🤔", "😅", "🎉", "📍", "📅",
];

interface PublicChatDemoProps {
  // A que bot pertenece esta conversacion ("consultas" o "pomada", ver
  // Fase 1 del bot de venta de productos) -- se manda en cada mensaje al
  // backend para que conteste con los datos de ese bot y no de otro.
  bot: string;
  perfilNombre?: string;
  perfilFoto?: string | null;
  facebookUrl?: string | null;
  // Mensaje editable en Master -> Perfil del chat (ver
  // ChatPerfilEditor.tsx); si no se manda, se usa el de siempre.
  mensajeInicialAnuncio?: string;
  // Numero de WhatsApp (solo digitos, con codigo de pais) al que se
  // manda la confirmacion final y el boton de la cabecera -- editable
  // por bot en Master -> Perfil del chat; si no se manda, se usa el
  // mismo de siempre (numero de prueba de Vic).
  whatsappNumero?: string;
}

export function PublicChatDemo({
  bot,
  perfilNombre = "DrNatury",
  perfilFoto = null,
  facebookUrl = null,
  mensajeInicialAnuncio = MENSAJE_INICIAL_ANUNCIO,
  whatsappNumero = VIC_WHATSAPP_NUMERO,
}: PublicChatDemoProps) {
  const [mensajes, setMensajes] = useState<MensajeUI[]>([]);
  const [estado, setEstado] = useState<EstadoAgendado>(ESTADO_INICIAL);
  const [input, setInput] = useState("");
  const [primerMensajeEnviado, setPrimerMensajeEnviado] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [mostrarOpciones, setMostrarOpciones] = useState(false);
  // Al escribir un mensaje, el cuadro de texto se amplia (se esconden
  // los demas iconos -- ubicacion, microfono, emoji) para que tenga
  // mas espacio; en cuanto el cuadro vuelve a quedar vacio, los iconos
  // regresan. "textareaRef" es para que el cuadro crezca de alto solo
  // conforme el mensaje tiene mas lineas (hasta un tope, luego hace
  // scroll adentro en vez de seguir creciendo).
  const [mostrarEmojis, setMostrarEmojis] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  // El icono de pin esta SIEMPRE disponible, desde que se abre el chat
  // (el paciente puede mandar su ubicacion en cualquier momento, no
  // solo despues de agendar). En cuanto se agenda una cita a domicilio
  // en esta conversacion, aqui se guarda el id + token real para
  // poder pegarle la ubicacion. Si el paciente manda su ubicacion
  // ANTES de que exista ese id (porque todavia no termina de agendar),
  // se guarda en ubicacionPendiente y se manda sola en cuanto
  // ubicacionDatos aparezca (ver el useEffect mas abajo).
  const [ubicacionDatos, setUbicacionDatos] = useState<UbicacionDatos | null>(null);
  const [ubicacionPendiente, setUbicacionPendiente] = useState<{ lat: number; lng: number } | null>(null);
  // El bot de la pomada (ver pedirUbicacion en engine-pomada.ts) marca
  // este mensaje cuando le acaba de pedir la direccion mencionando el
  // pin de ubicacion -- Vic pidio que ahi se vea una flechita señalando
  // el icono, para que no se le pase por alto. Se apaga en cuanto le da
  // clic al icono o en cuanto manda su siguiente mensaje (si no volvio
  // a usar el pin, de todos modos ya escribio la direccion a mano).
  const [destacarUbicacion, setDestacarUbicacion] = useState(false);
  // Igual que destacarUbicacion, pero para el botón de WhatsApp del
  // encabezado -- el bot lo marca (ver pedirWhatsapp en engine.ts /
  // engine-pomada.ts) cuando el paciente dijo que quiere hablar con una
  // persona real o prefiere seguir por WhatsApp, para señalarle con una
  // flechita el botón, igual que con el pin de ubicación.
  const [destacarWhatsapp, setDestacarWhatsapp] = useState(false);
  // Velocidad de reproduccion de las notas de voz del chat (1x, 2x,
  // 3x) -- Vic pidio que se pueda escuchar mas rapido, como en
  // WhatsApp. Cada audio guarda su propio elemento (por su id de
  // mensaje) para poder cambiarle la velocidad desde los botones de
  // abajo sin afectar a los demas audios de la conversacion.
  const audioRefs = useRef<Map<number, HTMLAudioElement>>(new Map());
  const [velocidadesAudio, setVelocidadesAudio] = useState<Record<number, number>>({});
  function cambiarVelocidadAudio(id: number, velocidad: number) {
    const el = audioRefs.current.get(id);
    if (el) el.playbackRate = velocidad;
    setVelocidadesAudio((prev) => ({ ...prev, [id]: velocidad }));
  }
  const [mostrarModalUbicacion, setMostrarModalUbicacion] = useState(false);
  const [estadoUbicacion, setEstadoUbicacion] = useState<"inicio" | "cargando" | "listo" | "guardada" | "error">("inicio");
  const [errorUbicacion, setErrorUbicacion] = useState("");
  // Llamada de voz: mientras esta activa, no se escribe ni se ve nada
  // en pantalla -- el paciente habla, se le manda al bot por detras
  // igual que un mensaje normal, y la respuesta se lee en voz alta.
  const [modoLlamada, setModoLlamada] = useState(false);
  const [faseLlamada, setFaseLlamada] = useState<FaseLlamada>("inactivo");
  const modoLlamadaRef = useRef(false);
  // Se calcula una sola vez, al montar en el navegador: si viene del
  // boton "Agenda tu cita" de la pagina de inicio (?origen=inicio) o
  // del link normal de anuncio (sin ese query param).
  const [mensajeInicial] = useState<string>(() => obtenerMensajeInicial(mensajeInicialAnuncio));
  const [origen] = useState<"inicio" | "anuncio">(obtenerOrigen);
  const [codigoAnuncio] = useState<string | null>(obtenerCodigoAnuncio);
  const [conversacionId, setConversacionId] = useState<string>(
    () => obtenerIdRetomar() ?? nuevoIdConversacion()
  );
  // Ofrecer notificaciones al visitante (para poder avisarle si se le
  // va el chat, ver estrategia de seguimiento/retencion): se muestra en
  // cuanto manda su primer mensaje y se oculta en cuanto decide algo.
  const [notifEstado, setNotifEstado] = useState<"oculto" | "ofrecer" | "pidiendo" | "activada" | "rechazada">("oculto");
  const finDeMensajesRef = useRef<HTMLDivElement>(null);

  // Si llego por un link de recordatorio (?retomar=<id>), se trae de
  // vuelta la conversacion exacta donde se quedo (estado + mensajes).
  // Si esa conversacion ya no existe o ya se cerro con una cita, se
  // arranca una nueva en su lugar, avisandole con un mensaje del bot.
  useEffect(() => {
    const idRetomar = obtenerIdRetomar();
    if (!idRetomar) return;
    (async () => {
      try {
        const res = await fetch(`/api/public/asistente-whatsapp/retomar?id=${encodeURIComponent(idRetomar)}`);
        const data = await res.json().catch(() => null);
        if (!data?.encontrada) {
          setConversacionId(nuevoIdConversacion());
          return;
        }
        if (data.cerrada) {
          setConversacionId(nuevoIdConversacion());
          setPrimerMensajeEnviado(true);
          setMensajes([{ id: siguienteId++, rol: "bot", texto: "Esa cita ya se había agendado. 😊 ¿Le ayudo con algo más?" }]);
          return;
        }
        setEstado(data.estado as EstadoAgendado);
        setMensajes(
          (data.mensajes as { rol: "paciente" | "bot"; texto: string }[]).map((m) => ({
            id: siguienteId++,
            rol: m.rol,
            texto: m.texto,
          }))
        );
        setPrimerMensajeEnviado(true);
      } catch {
        // Si falla, se queda con la conversacion nueva de siempre.
      }
    })();
    // Solo se checa una vez, al montar.
  }, []);

  // En cuanto manda su primer mensaje, se le ofrece activar
  // notificaciones -- pero solo si el navegador todavia no tiene una
  // respuesta guardada (ni "si" ni "no"). Si ya las activo antes (o ya
  // dijo que no) en este mismo navegador, Chrome ya se acuerda de eso
  // aunque sea una conversacion nueva -- asi que no se le vuelve a
  // preguntar ni se le vuelve a avisar "ya quedo activado".
  useEffect(() => {
    if (!primerMensajeEnviado || notifEstado !== "oculto") return;
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission !== "default") {
      return;
    }
    setNotifEstado("ofrecer");
  }, [primerMensajeEnviado, notifEstado]);

  async function activarNotificaciones() {
    setNotifEstado("pidiendo");
    try {
      const token = await requestNotificationPermission();
      if (!token) {
        setNotifEstado("rechazada");
        return;
      }
      await fetch("/api/public/asistente-whatsapp/notificaciones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversacionId, token }),
      });
      setNotifEstado("activada");
    } catch {
      setNotifEstado("rechazada");
    }
  }
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

  // El cuadro de texto crece de alto solo conforme el mensaje tiene mas
  // lineas (hasta un tope de 120px, despues hace scroll adentro).
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [input]);

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
        // Si todavia no habia mandado nada (el cuadro trae el mensaje
        // fijo del anuncio), hablar reemplaza ese mensaje fijo por lo
        // que dijo, igual que si lo hubiera escrito el mismo.
        setPrimerMensajeEnviado(true);
        setInput((prev) => (prev ? `${prev} ${texto}` : texto));
      }
    }
  );

  // Segun el bot, el id de "ubicacionDatos" es de una cita a domicilio
  // (bot "consultas") o de un pedido de producto (bot "pomada", ver
  // Fase 2 del bot de venta de productos) -- cada quien vive en su
  // propia tabla, asi que el endpoint para guardar el pin de GPS
  // tambien es distinto.
  const endpointUbicacion = useCallback(
    (id: string): string => (bot === "pomada" ? `/api/pedidos/${id}/ubicacion` : `/api/appointments/${id}/ubicacion`),
    [bot]
  );

  // En cuanto haya un id+token de verdad (ya se agendo la cita a
  // domicilio), manda sola la ubicacion que se habia quedado
  // esperando -- asi no importa en que momento el paciente le haya
  // dado clic al icono de pin.
  useEffect(() => {
    if (!ubicacionDatos || !ubicacionPendiente) return;
    fetch(endpointUbicacion(ubicacionDatos.appointmentId), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: ubicacionDatos.token, lat: ubicacionPendiente.lat, lng: ubicacionPendiente.lng }),
    }).catch(() => {});
    setUbicacionPendiente(null);
  }, [ubicacionDatos, ubicacionPendiente, endpointUbicacion]);

  // Usa el mismo endpoint que ya existe para el link de /ubicacion/[id]
  // que se manda por WhatsApp (ver UbicacionButton.tsx) -- aqui nada mas
  // se dispara desde el icono de pin dentro del chat en vez de un link
  // aparte. El icono esta disponible desde el inicio: si todavia no
  // existe una cita a domicilio de verdad (ubicacionDatos), la
  // ubicacion se guarda en ubicacionPendiente y se manda sola en
  // cuanto se agende (ver el useEffect de arriba).
  function mandarUbicacionActual() {
    if (!("geolocation" in navigator)) {
      setEstadoUbicacion("error");
      setErrorUbicacion("Tu celular no permite compartir ubicación desde aquí. Intenta desde Chrome o Safari.");
      return;
    }
    setEstadoUbicacion("cargando");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        if (!ubicacionDatos) {
          setUbicacionPendiente({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          setEstadoUbicacion("guardada");
          void continuarPedidoTrasUbicacion();
          return;
        }
        try {
          const res = await fetch(endpointUbicacion(ubicacionDatos.appointmentId), {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              token: ubicacionDatos.token,
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
            }),
          });
          if (!res.ok) {
            setEstadoUbicacion("error");
            setErrorUbicacion("No se pudo guardar. Intenta de nuevo.");
            return;
          }
          setEstadoUbicacion("listo");
        } catch {
          setEstadoUbicacion("error");
          setErrorUbicacion("No se pudo guardar. Intenta de nuevo.");
        }
      },
      () => {
        setEstadoUbicacion("error");
        setErrorUbicacion("No se pudo obtener tu ubicación. Revisa que le hayas dado permiso a tu navegador.");
      },
      { enableHighAccuracy: true, timeout: 15_000 }
    );
  }

  function abrirModalUbicacion() {
    setEstadoUbicacion("inicio");
    setErrorUbicacion("");
    setMostrarModalUbicacion(true);
    setDestacarUbicacion(false);
  }

  // Si el paciente abre la pantalla emergente del pin pero se regresa
  // al chat SIN mandar su ubicacion (ni exito ni error, nada mas se
  // sale), antes no pasaba nada -- Vic pidio que, si estaba en medio
  // del paso de direccion del pedido de la pomada, el bot le ofrezca
  // ayuda en vez de quedarse callado.
  function cerrarModalUbicacion() {
    const yaLaMando = estadoUbicacion === "listo" || estadoUbicacion === "guardada";
    setMostrarModalUbicacion(false);
    if (!yaLaMando && bot === "pomada" && enPasoDeDireccionDePedido(estado)) {
      setMensajes((prev) => [
        ...prev,
        {
          id: siguienteId++,
          rol: "bot",
          texto: "¿Le ayudo a mandar su ubicación o prefiere pasarme su dirección por escrito?",
        },
      ]);
    }
  }

  // Cuando comparte su ubicacion por el pin mientras el bot de la
  // pomada esta en el paso de direccion, se trata igual que si hubiera
  // escrito su direccion a mano -- se manda un mensaje al bot para que
  // siga la conversacion (la pregunta de "manana mismo?", etc.) en vez
  // de quedarse esperando a que tambien escriba algo (Vic lo reporto:
  // "si la mando, el bot debe de mandarle mensaje de continuacion...
  // porque ahi ya se freno").
  async function continuarPedidoTrasUbicacion() {
    if (bot !== "pomada" || !enPasoDeDireccionDePedido(estado)) return;
    const mensajeSintetico = "Ubicación compartida por GPS 📍";
    setEnviando(true);
    const inicio = Date.now();
    try {
      const res = await fetch("/api/public/asistente-whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mensaje: mensajeSintetico, estado, conversacionId, origen, codigoAnuncio, bot }),
      });
      const data = await res.json().catch(() => null);
      const demoraRestante = RESPUESTA_DEMORA_MIN_MS - (Date.now() - inicio);
      if (demoraRestante > 0) await esperar(demoraRestante);
      if (!res.ok || !data) return;
      setEstado(data.nuevoEstado);
      if (data.ubicacion) setUbicacionDatos(data.ubicacion as UbicacionDatos);
      setDestacarUbicacion(!!data.pedirUbicacion);
      setDestacarWhatsapp(!!data.pedirWhatsapp);
      setMensajes((prev) => [
        ...prev,
        { id: siguienteId++, rol: "paciente", texto: "📍 Ubicación compartida" },
        ...(data.respuesta || data.audioUrl
          ? [{ id: siguienteId++, rol: "bot" as const, texto: data.respuesta, audioUrl: data.audioUrl, agendado: data.agendado }]
          : []),
      ]);
    } finally {
      setEnviando(false);
    }
  }

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
        body: JSON.stringify({ mensaje, estado, conversacionId, origen, codigoAnuncio, bot }),
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
      if (data.ubicacion) setUbicacionDatos(data.ubicacion as UbicacionDatos);
      setDestacarUbicacion(!!data.pedirUbicacion);
      setDestacarWhatsapp(!!data.pedirWhatsapp);

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
              ? { id: siguienteId++, rol: "bot", texto: "", audioUrl: item.contenido, esBienvenida: true }
              : item.tipo === "video"
              ? { id: siguienteId++, rol: "bot", texto: "", videoUrl: item.contenido, esBienvenida: true }
              : { id: siguienteId++, rol: "bot", texto: item.contenido, esBienvenida: true },
          ]);
          await esperar(700);
        }
      } else if (data.respuesta || data.audioUrl) {
        setMensajes((prev) => [
          ...prev,
          { id: siguienteId++, rol: "bot", texto: data.respuesta, audioUrl: data.audioUrl, agendado: data.agendado },
        ]);
      }
      // Si pidio ver el catalogo, la tarjeta de la revista llega en un
      // mensaje aparte, despues del texto de arriba ("¡Claro! Aquí
      // tienes nuestro catálogo 👇").
      if (data.mostrarCatalogo && Array.isArray(data.productos) && data.productos.length > 0) {
        setMensajes((prev) => [...prev, { id: siguienteId++, rol: "bot", texto: "", catalogo: data.productos, catalogoComoLibro: data.catalogoComoLibro }]);
      }
      // Si no hay ni serie de bienvenida ni respuesta ni audio (bot sin
      // saludo configurado todavia), no se agrega ninguna burbuja vacia.
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

    // Aunque mientras se esta en la llamada no se ve nada en pantalla
    // (la tapa la pantalla de llamada), si se va guardando en el
    // historial normal del chat -- asi al colgar y regresar a la
    // vista de texto, la persona ve toda la conversacion que tuvo por
    // voz, incluyendo en donde se quedo.
    setMensajes((prev) => [...prev, { id: siguienteId++, rol: "paciente", texto }]);

    // Antes aqui decia una muletilla ("Mmm", "Ehh"...) en voz alta
    // mientras pensaba la respuesta, pero esas palabras sueltas no se
    // escuchan bien con la voz sintetizada del navegador -- ahora
    // nomas se queda en silencio ese segundo (igual se ve el estado de
    // "pensando" en la pantalla de la llamada).
    setFaseLlamada("pensando");

    const inicio = Date.now();
    try {
      const res = await fetch("/api/public/asistente-whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mensaje: texto, estado: estadoRef.current, conversacionId, origen, codigoAnuncio, bot }),
      });
      const data = await res.json().catch(() => null);

      const demoraRestante = RESPUESTA_DEMORA_MIN_MS - (Date.now() - inicio);
      if (demoraRestante > 0) await esperar(demoraRestante);

      if (!modoLlamadaRef.current) return;

      if (!res.ok || !data) {
        const textoError = "Perdón, hubo un error, ¿puedes repetir?";
        setMensajes((prev) => [...prev, { id: siguienteId++, rol: "bot", texto: textoError }]);
        setFaseLlamada("hablando");
        hablar(textoError, { alTerminar: reanudarEscuchaLlamada });
        return;
      }

      setEstado(data.nuevoEstado);
      estadoRef.current = data.nuevoEstado;
      if (data.ubicacion) setUbicacionDatos(data.ubicacion as UbicacionDatos);

      const serieBienvenida = data.mensajesBienvenida as MensajeBienvenidaUI[] | undefined;
      const esBienvenida = !!serieBienvenida && serieBienvenida.length > 0;
      const textoRespuesta = esBienvenida
        ? serieBienvenida!
            .filter((item) => item.tipo === "texto")
            .map((item) => item.contenido)
            .join(". ")
        : data.respuesta;

      setMensajes((prev) => [
        ...prev,
        { id: siguienteId++, rol: "bot", texto: textoRespuesta, agendado: data.agendado, esBienvenida },
      ]);
      setFaseLlamada("hablando");
      hablar(textoRespuesta, { alTerminar: reanudarEscuchaLlamada });
    } catch {
      if (!modoLlamadaRef.current) return;
      const textoError = "Perdón, hubo un error, ¿puedes repetir?";
      setMensajes((prev) => [...prev, { id: siguienteId++, rol: "bot", texto: textoError }]);
      setFaseLlamada("hablando");
      hablar(textoError, { alTerminar: reanudarEscuchaLlamada });
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
    setMensajes((prev) => [...prev, { id: siguienteId++, rol: "bot", texto: SALUDO_LLAMADA }]);
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

  function insertarEmoji(emoji: string) {
    if (!primerMensajeEnviado) return;
    setInput((prev) => prev + emoji);
    setMostrarEmojis(false);
  }

  // Mientras el cuadro tiene texto para mandar, se esconden los demas
  // iconos (ubicacion, microfono, emoji) para que se vea el boton de
  // enviar -- esto incluye el mensaje inicial que ya viene escrito
  // (antes de que el paciente mande su primer mensaje), que si no se
  // quedaba con el icono de nota de voz en vez del de enviar.
  const cuadroAmpliado = (primerMensajeEnviado ? input : mensajeInicial).trim().length > 0;

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
        {/* Por si no le interesa seguir platicando aqui, le manda el
            mismo mensaje inicial pero por WhatsApp de verdad -- pedido
            explicito de Vic, al lado del icono de llamada. Cuando el
            bot detecta que quiere hablar con una persona real (ver
            destacarWhatsapp/pedirWhatsapp), se le señala con una
            flechita, igual que con el pin de ubicación. */}
        <div className="relative shrink-0">
          {destacarWhatsapp && (
            <div className="absolute -bottom-7 left-1/2 -translate-x-1/2 flex flex-col items-center gap-0.5 animate-bounce pointer-events-none">
              <span className="text-emerald-600 text-base leading-none">↑</span>
              <span className="text-[10px] font-semibold text-emerald-700 bg-white px-1.5 py-0.5 rounded-full shadow whitespace-nowrap">
                Dé clic aquí
              </span>
            </div>
          )}
          <a
            href={`https://wa.me/${whatsappNumero}?text=${encodeURIComponent(mensajeInicial)}`}
            target="_blank"
            rel="noopener noreferrer"
            title="Mándanos un WhatsApp"
            onClick={() => setDestacarWhatsapp(false)}
            className={`w-10 h-10 rounded-full flex items-center justify-center text-[#25D366] hover:bg-gray-100 shrink-0 ${
              destacarWhatsapp ? "ring-2 ring-emerald-400" : ""
            }`}
          >
            <IconoWhatsApp className="w-5 h-5" />
          </a>
        </div>
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
                href={`https://wa.me/${whatsappNumero}`}
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
        {mensajes.map((m) =>
          m.catalogo ? (
            <RevistaChatCard key={m.id} productos={m.catalogo} comoLibro={m.catalogoComoLibro ?? true} />
          ) : m.videoUrl ? (
            // El video de bienvenida se ve grande, del ancho de todo
            // el chat -- no como una cajita chica igual que el audio o
            // el texto (asi lo pidio Vic).
            <div key={m.id}>
              <div className="overflow-hidden">
                <VideoTransparente src={m.videoUrl} flotante />
              </div>
              {m.rol === "bot" && m.esBienvenida && (
                <BotonCompartir contenido={`🎬 Mira este video:\n${m.videoUrl}`} />
              )}
            </div>
          ) : (
          <div key={m.id} className={`flex ${m.rol === "bot" ? "justify-start" : "justify-end"}`}>
            <div
              className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-base font-medium whitespace-pre-wrap shadow-sm ${
                m.audioUrl && !m.texto ? "w-72" : ""
              } ${
                m.rol === "bot"
                  ? "bg-white text-gray-800 border border-gray-100 rounded-bl-sm"
                  : "bg-emerald-600 text-white rounded-br-sm"
              }`}
            >
              {m.audioUrl && (
                <>
                  <audio
                    controls
                    preload="none"
                    className="w-full mb-1 h-12"
                    ref={(el) => {
                      if (el) {
                        audioRefs.current.set(m.id, el);
                        el.playbackRate = velocidadesAudio[m.id] ?? 1;
                      } else {
                        audioRefs.current.delete(m.id);
                      }
                    }}
                  >
                    <source src={m.audioUrl} />
                  </audio>
                  {/* Botones de velocidad (1x normal, 2x y 3x mas
                      rapido) -- igual que en WhatsApp, para que el
                      paciente no tenga que esperar oyendo todo el audio
                      si ya le urge seguir. */}
                  <div className="flex items-center gap-1.5 mb-2">
                    {[1, 2, 3].map((velocidad) => (
                      <button
                        key={velocidad}
                        type="button"
                        onClick={() => cambiarVelocidadAudio(m.id, velocidad)}
                        className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${
                          (velocidadesAudio[m.id] ?? 1) === velocidad
                            ? m.rol === "bot"
                              ? "bg-emerald-600 text-white border-emerald-600"
                              : "bg-white text-emerald-700 border-white"
                            : m.rol === "bot"
                            ? "bg-gray-50 text-gray-600 border-gray-200"
                            : "bg-emerald-700/40 text-white border-emerald-400/40"
                        }`}
                      >
                        {velocidad}x
                      </button>
                    ))}
                  </div>
                </>
              )}
              {renderizarTextoConIconoUbicacion(m.texto)}
              {m.rol === "bot" && m.esBienvenida && !m.agendado && (m.texto || m.audioUrl) && (
                <div>
                  {m.audioUrl ? (
                    <BotonCompartir audioUrl={m.audioUrl} texto={m.texto} />
                  ) : (
                    <BotonCompartir contenido={m.texto} />
                  )}
                </div>
              )}
              {m.agendado && (
                // Se resalta bien este bloque (fondo y borde propios) y el
                // boton lleva una flechita que rebota y un brillo detras
                // que pulsa de tenue a fuerte, para que no se le pase a la
                // persona darle clic y de verdad se confirme la cita.
                <div className="mt-3 rounded-2xl border-2 border-emerald-300 bg-emerald-50 p-3">
                  {/* Se agrando este texto y el boton (letra e icono) --
                      Vic pidio que se vieran mas grandes porque buena
                      parte de los clientes son personas mayores y se
                      les pasaba de chiquito. Aplica igual a los dos
                      bots (citas y pomada), es el mismo bloque. */}
                  <p className="text-center text-xl font-bold text-emerald-900">
                    {m.agendado.tipo === "pedido"
                      ? "Para confirmar tu pedido por WhatsApp, da clic aquí"
                      : "Para confirmar y recordar tu cita por WhatsApp, da clic aquí"}
                  </p>
                  <div className="flex justify-center text-3xl leading-none text-emerald-500 animate-bounce" aria-hidden="true">
                    ⬇️
                  </div>
                  <div className="flex justify-center">
                    <a
                      href={`https://wa.me/${whatsappNumero}?text=${encodeURIComponent(
                        construirMensajeWhatsapp(m.agendado)
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="relative flex items-center justify-center gap-2 rounded-full bg-[#25D366] text-white text-xl font-bold px-8 py-4 shadow-lg hover:brightness-95"
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
          )
        )}
        <div ref={finDeMensajesRef} />
      </div>

      {mostrarModalUbicacion && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-4 pb-4 sm:pb-0"
          onClick={cerrarModalUbicacion}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            {estadoUbicacion === "listo" || estadoUbicacion === "guardada" ? (
              <div className="text-center space-y-2 py-2">
                <div className="mx-auto w-14 h-14 rounded-full bg-emerald-500 flex items-center justify-center text-2xl text-white shadow-md">
                  ✓
                </div>
                <p className="text-sm font-bold text-emerald-700">¡Ubicación enviada!</p>
                <p className="text-xs text-gray-500">
                  {estadoUbicacion === "listo"
                    ? "Ya sabemos exactamente dónde llegar. Nos vemos pronto 🙌"
                    : bot === "pomada"
                      ? "En cuanto termine de hacer su pedido, se la agregamos a la entrega."
                      : "En cuanto termine de agendarse su cita a domicilio, se la agregamos a la agenda de DrNatury."}
                </p>
                <button
                  onClick={cerrarModalUbicacion}
                  className="mt-2 text-xs text-gray-500 underline"
                >
                  Cerrar
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <IconoUbicacion className="w-6 h-6 shrink-0" />
                  <p className="text-sm font-semibold text-gray-800">Mandar ubicación actual</p>
                </div>
                <p className="text-xs text-gray-500">
                  Si se encuentra en su domicilio ahorita, dele clic a &quot;Enviar&quot; para registrar su ubicación
                  en la agenda de DrNatury.
                </p>
                {estadoUbicacion === "error" && (
                  <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                    {errorUbicacion}
                  </p>
                )}
                <div className="flex justify-end gap-2 pt-1">
                  <button
                    onClick={cerrarModalUbicacion}
                    className="text-xs px-3 py-2 rounded-full text-gray-500 hover:bg-gray-100"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={mandarUbicacionActual}
                    disabled={estadoUbicacion === "cargando"}
                    className="text-xs font-semibold px-4 py-2 rounded-full bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60 flex items-center gap-1.5"
                  >
                    {estadoUbicacion === "cargando" ? (
                      <>
                        <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                        Obteniendo ubicación…
                      </>
                    ) : (
                      "Enviar"
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {notifEstado === "ofrecer" && (
        <div className="shrink-0 flex items-center gap-2 border-t border-amber-200 bg-amber-50 px-4 py-2">
          <span className="text-base">🔔</span>
          <p className="flex-1 min-w-0 text-xs text-amber-800">
            ¿Si se sale, le gustaría que le avisáramos para que pueda continuar?
          </p>
          <button
            onClick={activarNotificaciones}
            className="shrink-0 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-600"
          >
            Sí, avísenme
          </button>
          <button
            onClick={() => setNotifEstado("rechazada")}
            className="shrink-0 rounded-lg px-2 py-1.5 text-xs text-amber-700 hover:bg-amber-100"
          >
            No, gracias
          </button>
        </div>
      )}
      {notifEstado === "pidiendo" && (
        <div className="shrink-0 flex items-center gap-2 border-t border-amber-200 bg-amber-50 px-4 py-2">
          <p className="text-xs text-amber-700">Activando notificaciones...</p>
        </div>
      )}
      {notifEstado === "activada" && (
        <div className="shrink-0 flex items-center gap-2 border-t border-green-200 bg-green-50 px-4 py-2">
          <span className="text-base">🔔</span>
          <p className="text-xs text-green-700">Listo, le avisamos si se le va el chat.</p>
        </div>
      )}

      <div className="shrink-0 relative border-t border-gray-100 bg-white">
        {mostrarEmojis && (
          <div className="absolute bottom-full left-2 mb-2 grid grid-cols-6 gap-1 rounded-2xl border border-gray-200 bg-white p-2 shadow-lg z-10">
            {EMOJIS_RAPIDOS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => insertarEmoji(emoji)}
                className="text-xl w-9 h-9 flex items-center justify-center rounded-lg hover:bg-gray-100"
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
        <div className="flex items-end gap-2 px-3 py-3">
          <button
            onClick={() => setMostrarEmojis((v) => !v)}
            title="Emojis"
            className="rounded-full w-10 h-10 flex items-center justify-center shrink-0 shadow-sm bg-gray-100 hover:bg-gray-200 text-lg"
          >
            😊
          </button>
          <div className="flex-1 min-w-0 relative">
            <textarea
              ref={textareaRef}
              value={primerMensajeEnviado ? input : mensajeInicial}
              onChange={(e) => primerMensajeEnviado && setInput(e.target.value)}
              readOnly={!primerMensajeEnviado}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  enviarMensaje();
                }
              }}
              onFocus={() => setMostrarEmojis(false)}
              placeholder="Mensaje"
              rows={1}
              style={{ color: "#fff", WebkitTextFillColor: "#fff", colorScheme: "dark" }}
              className={`w-full resize-none rounded-2xl border border-gray-700 bg-[#2a3942] caret-white placeholder-gray-400 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 max-h-[120px] min-h-[48px] overflow-y-auto ${
                dictadoSoportado ? "pr-12" : ""
              }`}
            />
            {/* El boton de "dictar por voz" (convierte lo que dices en
                texto escrito aqui mismo) vive adentro del cuadro,
                pegado a la derecha, ocupando todo el alto del cuadro de
                texto y en blanco para que se vea bien -- solo aparece
                mientras el cuadro esta vacio, igual que en apps de
                mensajes normales. */}
            {dictadoSoportado && !cuadroAmpliado && (
              <button
                onClick={() => (escuchando ? detenerDictado() : iniciarDictado())}
                disabled={enviando}
                title={escuchando ? "Detener" : "Dictar por voz (se escribe aquí)"}
                className={`absolute right-0 top-0 bottom-0 w-11 flex items-center justify-center rounded-r-2xl disabled:opacity-50 ${
                  escuchando ? "text-red-400 animate-pulse" : "text-white hover:text-emerald-200"
                }`}
              >
                <IconoMicrofono className="w-6 h-6" />
              </button>
            )}
          </div>
          {!cuadroAmpliado && (
            // Cuando el bot acaba de pedir la direccion mencionando el
            // pin (ver destacarUbicacion), se le señala con una
            // flechita que rebota encima del boton, para que no se le
            // pase por alto -- pedido explicito de Vic.
            <div className="relative shrink-0">
              {destacarUbicacion && (
                <div className="absolute -top-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-0.5 animate-bounce pointer-events-none">
                  <span className="text-[10px] font-semibold text-emerald-700 bg-white px-1.5 py-0.5 rounded-full shadow whitespace-nowrap">
                    Dé clic aquí
                  </span>
                  <span className="text-emerald-600 text-base leading-none">↓</span>
                </div>
              )}
              <button
                onClick={abrirModalUbicacion}
                title="Mandar mi ubicación actual"
                className={`rounded-full w-10 h-10 flex items-center justify-center shadow-sm ${
                  destacarUbicacion ? "bg-emerald-100 ring-2 ring-emerald-400" : "bg-gray-100 hover:bg-gray-200"
                }`}
              >
                <IconoUbicacion className="w-5 h-5" />
              </button>
            </div>
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
    </div>
  );
}
