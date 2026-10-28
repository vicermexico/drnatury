"use client";
import { useState, useTransition } from "react";
import { parseAgendado } from "@/lib/quick-link/parse-agendado";

// Convierte "YYYY-MM-DD" + "HH:MM" (hora de Monterrey, siempre UTC-6, sin
// horario de verano) a un ISO en UTC, para construir el link del .ics.
function toUTCISO(dateStr: string, timeStr: string): string {
  return new Date(`${dateStr}T${timeStr}:00-06:00`).toISOString();
}

function formatLindo(dateStr: string, timeStr: string): string {
  const d = new Date(`${dateStr}T${timeStr}:00-06:00`);
  const dia = d.toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long", timeZone: "America/Monterrey" });
  const hora = d.toLocaleTimeString("es-MX", { hour: "numeric", minute: "2-digit", timeZone: "America/Monterrey", hour12: true });
  return `${dia}, ${hora}`;
}

type Tab = "agendar" | "personal";
type Resultado = { ok: true; icsUrl: string; detalle: string; calendarSynced: boolean } | { ok: false; mensaje: string } | null;

const PLANTILLA_EJEMPLO = `Agendado

- Nombre: Miguel Angel Aguilar y
Luis Gerardo Aguilar
- Dia: Sabado 31/10/26
- Hora: 3:30pm
CONSULTORIO: Si, San Blas
DOMICILIO: No
- # Personas: 2
- COSTO TOTAL: $400`;

export function QuickBookingFlow({ secret }: { secret: string }) {
  const [tab, setTab] = useState<Tab>("agendar");
  const [isPending, startTransition] = useTransition();

  // --- Agendar ---
  const [textoAgendado, setTextoAgendado] = useState("");
  const [erroresLectura, setErroresLectura] = useState<string[]>([]);
  const [resultadoAgendar, setResultadoAgendar] = useState<Resultado>(null);

  // --- Personal ---
  const [pFecha, setPFecha] = useState("");
  const [pDesde, setPDesde] = useState("");
  const [pHasta, setPHasta] = useState("");
  const [pMotivo, setPMotivo] = useState("");
  const [resultadoPersonal, setResultadoPersonal] = useState<Resultado>(null);

  function handleAgendar() {
    const parsed = parseAgendado(textoAgendado);
    if (parsed.errores.length > 0) {
      setErroresLectura(parsed.errores);
      setResultadoAgendar(null);
      return;
    }
    setErroresLectura([]);
    setResultadoAgendar(null);
    const { nombre, fecha, hora, modalidad, domicilioDireccion, numPersonas, costoTotal } = parsed;
    startTransition(async () => {
      const res = await fetch("/api/quick/book", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-quick-secret": secret },
        body: JSON.stringify({
          nombre, fecha, hora, modalidad,
          domicilio_direccion: modalidad === "DOMICILIO" ? domicilioDireccion : undefined,
          num_personas: numPersonas,
          costo_total: costoTotal || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setResultadoAgendar({ ok: false, mensaje: data.message ?? "No se pudo agendar." });
        return;
      }
      const descripcion = data.confirm_url ? `${nombre}\n${data.confirm_url}` : undefined;
      const icsUrl = `/api/quick/ics?secret=${encodeURIComponent(secret)}&uid=${encodeURIComponent(data.id)}&start=${encodeURIComponent(data.starts_at)}&end=${encodeURIComponent(data.ends_at)}&summary=${encodeURIComponent(nombre)}&location=${encodeURIComponent(modalidad === "DOMICILIO" ? (domicilioDireccion || "A domicilio") : "Consultorio")}${descripcion ? `&description=${encodeURIComponent(descripcion)}` : ""}`;
      setResultadoAgendar({ ok: true, icsUrl, detalle: `${nombre} — ${formatLindo(fecha, hora)}`, calendarSynced: !!data.calendar_synced });
      setTextoAgendado("");
    });
  }

  function limpiarPersonal() {
    setPFecha(""); setPDesde(""); setPHasta(""); setPMotivo("");
  }

  function handlePersonal() {
    if (!pFecha || !pDesde || !pHasta) {
      setResultadoPersonal({ ok: false, mensaje: "Falta dia, desde u hasta." });
      return;
    }
    setResultadoPersonal(null);
    startTransition(async () => {
      const res = await fetch("/api/quick/personal-block", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-quick-secret": secret },
        body: JSON.stringify({ fecha: pFecha, desde: pDesde, hasta: pHasta, motivo: pMotivo }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setResultadoPersonal({ ok: false, mensaje: data.message ?? "No se pudo bloquear." });
        return;
      }
      const startISO = toUTCISO(pFecha, pDesde);
      const endISO = toUTCISO(pFecha, pHasta);
      const icsUrl = `/api/quick/ics?secret=${encodeURIComponent(secret)}&uid=${encodeURIComponent(data.id)}&start=${encodeURIComponent(startISO)}&end=${encodeURIComponent(endISO)}&summary=${encodeURIComponent(pMotivo || "Bloqueado")}`;
      setResultadoPersonal({ ok: true, icsUrl, detalle: `${formatLindo(pFecha, pDesde)} a ${new Date(endISO).toLocaleTimeString("es-MX", { hour: "numeric", minute: "2-digit", timeZone: "America/Monterrey", hour12: true })}`, calendarSynced: !!data.calendar_synced });
      limpiarPersonal();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex rounded-xl bg-gray-200 p-1">
        <button
          onClick={() => setTab("agendar")}
          className={`flex-1 rounded-lg py-2 text-sm font-semibold transition ${tab === "agendar" ? "bg-white shadow text-gray-900" : "text-gray-500"}`}
        >
          Agendar
        </button>
        <button
          onClick={() => setTab("personal")}
          className={`flex-1 rounded-lg py-2 text-sm font-semibold transition ${tab === "personal" ? "bg-white shadow text-gray-900" : "text-gray-500"}`}
        >
          Personal
        </button>
      </div>

      {tab === "agendar" && (
        <div className="rounded-2xl bg-white border border-gray-200 p-5 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Pega aqui el texto de "Agendado" (igual que lo llenas en WhatsApp)</label>
            <textarea value={textoAgendado} onChange={e => setTextoAgendado(e.target.value)} rows={10}
              placeholder={PLANTILLA_EJEMPLO}
              style={{ color: "black" }}
              className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm bg-white focus:border-red-500 focus:outline-none font-mono" />
          </div>

          <button onClick={handleAgendar} disabled={isPending || !textoAgendado.trim()}
            className="w-full rounded-xl bg-red-600 py-3 text-sm font-semibold text-white hover:bg-red-700 transition disabled:opacity-60">
            {isPending ? "Agendando..." : "Agendar"}
          </button>

          {erroresLectura.length > 0 && (
            <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 space-y-1">
              <p className="text-sm font-semibold text-amber-800">No pude leer todo el texto:</p>
              {erroresLectura.map((e, i) => (
                <p key={i} className="text-xs text-amber-700">• {e}</p>
              ))}
              <p className="text-xs text-amber-600 pt-1">Revisa que el texto tenga ese mismo formato y vuelve a tocar Agendar.</p>
            </div>
          )}

          {resultadoAgendar && (
            resultadoAgendar.ok ? (
              <div className="rounded-xl bg-green-50 border border-green-200 p-4 space-y-2">
                <p className="text-sm font-semibold text-green-700">✅ Agendado exitoso</p>
                <p className="text-xs text-green-600">{resultadoAgendar.detalle}</p>
                {resultadoAgendar.calendarSynced ? (
                  <p className="text-xs text-green-700 font-medium">📅 Ya se agregó sola a tu Google Calendar (con link para confirmar y recordatorios de 2h y 1h antes).</p>
                ) : (
                  <a href={resultadoAgendar.icsUrl}
                    className="inline-block rounded-xl bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 transition">
                    Agregar a mi calendario
                  </a>
                )}
              </div>
            ) : (
              <p className="text-sm font-semibold text-red-600 bg-red-50 rounded-xl px-4 py-3">❌ No se puede agendar: {resultadoAgendar.mensaje}</p>
            )
          )}
        </div>
      )}

      {tab === "personal" && (
        <div className="rounded-2xl bg-white border border-gray-200 p-5 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Dia</label>
            <input type="date" value={pFecha} onChange={e => setPFecha(e.target.value)}
              style={{ color: "black" }}
              className="w-full rounded-xl border border-gray-300 px-3 py-3 text-sm bg-white focus:border-red-500 focus:outline-none" />
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-sm font-semibold text-gray-700 mb-1">Desde</label>
              <input type="time" value={pDesde} onChange={e => setPDesde(e.target.value)}
                style={{ color: "black" }}
                className="w-full rounded-xl border border-gray-300 px-3 py-3 text-sm bg-white focus:outline-none" />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-semibold text-gray-700 mb-1">Hasta</label>
              <input type="time" value={pHasta} onChange={e => setPHasta(e.target.value)}
                style={{ color: "black" }}
                className="w-full rounded-xl border border-gray-300 px-3 py-3 text-sm bg-white focus:outline-none" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Motivo</label>
            <input type="text" value={pMotivo} onChange={e => setPMotivo(e.target.value)}
              placeholder="Ej. Comida, junta, personal"
              style={{ color: "black" }}
              className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm bg-white focus:outline-none" />
          </div>

          <button onClick={handlePersonal} disabled={isPending}
            className="w-full rounded-xl bg-gray-800 py-3 text-sm font-semibold text-white hover:bg-gray-900 transition disabled:opacity-60">
            {isPending ? "Bloqueando..." : "Bloquear"}
          </button>

          {resultadoPersonal && (
            resultadoPersonal.ok ? (
              <div className="rounded-xl bg-green-50 border border-green-200 p-4 space-y-2">
                <p className="text-sm font-semibold text-green-700">✅ Horario bloqueado</p>
                <p className="text-xs text-green-600">{resultadoPersonal.detalle}</p>
                {resultadoPersonal.calendarSynced ? (
                  <p className="text-xs text-green-700 font-medium">📅 Ya se agregó solo a tu Google Calendar.</p>
                ) : (
                  <a href={resultadoPersonal.icsUrl}
                    className="inline-block rounded-xl bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 transition">
                    Agregar a mi calendario
                  </a>
                )}
              </div>
            ) : (
              <p className="text-sm font-semibold text-red-600 bg-red-50 rounded-xl px-4 py-3">❌ No se pudo bloquear: {resultadoPersonal.mensaje}</p>
            )
          )}
        </div>
      )}
    </div>
  );
}
