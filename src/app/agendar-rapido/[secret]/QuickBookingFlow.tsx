"use client";
import { useState, useTransition } from "react";

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
type Resultado = { ok: true; icsUrl: string; detalle: string } | { ok: false; mensaje: string } | null;

export function QuickBookingFlow({ secret }: { secret: string }) {
  const [tab, setTab] = useState<Tab>("agendar");
  const [isPending, startTransition] = useTransition();

  // --- Agendar ---
  const [nombre, setNombre] = useState("");
  const [fecha, setFecha] = useState("");
  const [hora, setHora] = useState("");
  const [modalidad, setModalidad] = useState<"CONSULTORIO" | "DOMICILIO">("CONSULTORIO");
  const [domicilioDireccion, setDomicilioDireccion] = useState("");
  const [numPersonas, setNumPersonas] = useState("1");
  const [costoTotal, setCostoTotal] = useState("");
  const [resultadoAgendar, setResultadoAgendar] = useState<Resultado>(null);

  // --- Personal ---
  const [pFecha, setPFecha] = useState("");
  const [pDesde, setPDesde] = useState("");
  const [pHasta, setPHasta] = useState("");
  const [pMotivo, setPMotivo] = useState("");
  const [resultadoPersonal, setResultadoPersonal] = useState<Resultado>(null);

  function limpiarAgendar() {
    setNombre(""); setFecha(""); setHora(""); setModalidad("CONSULTORIO");
    setDomicilioDireccion(""); setNumPersonas("1"); setCostoTotal("");
  }

  function handleAgendar() {
    if (!nombre.trim() || !fecha || !hora) {
      setResultadoAgendar({ ok: false, mensaje: "Falta nombre, dia u hora." });
      return;
    }
    setResultadoAgendar(null);
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
      const icsUrl = `/api/quick/ics?secret=${encodeURIComponent(secret)}&uid=${encodeURIComponent(data.id)}&start=${encodeURIComponent(data.starts_at)}&end=${encodeURIComponent(data.ends_at)}&summary=${encodeURIComponent(nombre)}&location=${encodeURIComponent(modalidad === "DOMICILIO" ? (domicilioDireccion || "A domicilio") : "Consultorio")}`;
      setResultadoAgendar({ ok: true, icsUrl, detalle: formatLindo(fecha, hora) });
      limpiarAgendar();
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
      setResultadoPersonal({ ok: true, icsUrl, detalle: `${formatLindo(pFecha, pDesde)} a ${new Date(endISO).toLocaleTimeString("es-MX", { hour: "numeric", minute: "2-digit", timeZone: "America/Monterrey", hour12: true })}` });
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
            <label className="block text-sm font-semibold text-gray-700 mb-1">Nombre</label>
            <textarea value={nombre} onChange={e => setNombre(e.target.value)} rows={2}
              placeholder="Ej. Miguel Angel Aguilar y Luis Gerardo Aguilar"
              style={{ color: "black" }}
              className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm bg-white focus:border-red-500 focus:outline-none" />
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-sm font-semibold text-gray-700 mb-1">Dia</label>
              <input type="date" value={fecha} onChange={e => setFecha(e.target.value)}
                style={{ color: "black" }}
                className="w-full rounded-xl border border-gray-300 px-3 py-3 text-sm bg-white focus:border-red-500 focus:outline-none" />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-semibold text-gray-700 mb-1">Hora</label>
              <input type="time" value={hora} onChange={e => setHora(e.target.value)}
                style={{ color: "black" }}
                className="w-full rounded-xl border border-gray-300 px-3 py-3 text-sm bg-white focus:border-red-500 focus:outline-none" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Lugar</label>
            <div className="flex gap-2">
              <button type="button" onClick={() => setModalidad("CONSULTORIO")}
                className={`flex-1 rounded-xl border py-2.5 text-sm font-medium ${modalidad === "CONSULTORIO" ? "bg-red-600 border-red-600 text-white" : "border-gray-300 text-gray-600"}`}>
                Consultorio
              </button>
              <button type="button" onClick={() => setModalidad("DOMICILIO")}
                className={`flex-1 rounded-xl border py-2.5 text-sm font-medium ${modalidad === "DOMICILIO" ? "bg-red-600 border-red-600 text-white" : "border-gray-300 text-gray-600"}`}>
                Domicilio
              </button>
            </div>
            {modalidad === "DOMICILIO" && (
              <input type="text" value={domicilioDireccion} onChange={e => setDomicilioDireccion(e.target.value)}
                placeholder="Direccion"
                style={{ color: "black" }}
                className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm bg-white focus:outline-none" />
            )}
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-sm font-semibold text-gray-700 mb-1"># Personas</label>
              <input type="number" min="1" value={numPersonas} onChange={e => setNumPersonas(e.target.value)}
                style={{ color: "black" }}
                className="w-full rounded-xl border border-gray-300 px-3 py-3 text-sm bg-white focus:outline-none" />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-semibold text-gray-700 mb-1">Costo total $</label>
              <input type="number" min="0" value={costoTotal} onChange={e => setCostoTotal(e.target.value)}
                placeholder="0"
                style={{ color: "black" }}
                className="w-full rounded-xl border border-gray-300 px-3 py-3 text-sm bg-white focus:outline-none" />
            </div>
          </div>

          <button onClick={handleAgendar} disabled={isPending}
            className="w-full rounded-xl bg-red-600 py-3 text-sm font-semibold text-white hover:bg-red-700 transition disabled:opacity-60">
            {isPending ? "Agendando..." : "Agendar"}
          </button>

          {resultadoAgendar && (
            resultadoAgendar.ok ? (
              <div className="rounded-xl bg-green-50 border border-green-200 p-4 space-y-2">
                <p className="text-sm font-semibold text-green-700">✅ Agendado exitoso</p>
                <p className="text-xs text-green-600">{resultadoAgendar.detalle}</p>
                <a href={resultadoAgendar.icsUrl}
                  className="inline-block rounded-xl bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 transition">
                  Agregar a mi calendario
                </a>
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
                <a href={resultadoPersonal.icsUrl}
                  className="inline-block rounded-xl bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 transition">
                  Agregar a mi calendario
                </a>
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
