"use client";
import { useState, useTransition } from "react";
import Link from "next/link";

interface Padecimiento {
  id: string;
  nombre: string;
  recomendacion: string;
}

function lineasDe(recomendacion: string): string[] {
  return recomendacion.split("\n").map(l => l.trim()).filter(Boolean);
}

export function RecetaForm({
  padecimientos,
  whatsappNumber,
}: {
  padecimientos: Padecimiento[];
  whatsappNumber: string | null;
}) {
  const [patientName, setPatientName] = useState("");
  const [patientPhone, setPatientPhone] = useState("");
  const [fechaNacimiento, setFechaNacimiento] = useState("");
  const [estatura, setEstatura] = useState("");
  const [peso, setPeso] = useState("");
  // seleccion[padecimientoId] = lista de lineas de recomendacion marcadas
  const [seleccion, setSeleccion] = useState<Record<string, string[]>>({});
  const [productos, setProductos] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const [generada, setGenerada] = useState(false);

  function togglePadecimiento(p: Padecimiento) {
    setSeleccion(prev => {
      const next = { ...prev };
      if (p.id in next) {
        delete next[p.id];
      } else {
        next[p.id] = lineasDe(p.recomendacion);
      }
      return next;
    });
    setGenerada(false);
  }

  function toggleLinea(padecimientoId: string, linea: string) {
    setSeleccion(prev => {
      const actuales = prev[padecimientoId] ?? [];
      const marcada = actuales.includes(linea);
      return {
        ...prev,
        [padecimientoId]: marcada ? actuales.filter(l => l !== linea) : [...actuales, linea],
      };
    });
    setGenerada(false);
  }

  const padecimientosSeleccionados = padecimientos
    .filter(p => p.id in seleccion)
    .map(p => ({ id: p.id, nombre: p.nombre, recomendaciones_marcadas: seleccion[p.id] }));

  function buildMensaje() {
    const partes: string[] = [`Hola ${patientName}, aquí tu receta de DrNatury:`];
    for (const p of padecimientosSeleccionados) {
      partes.push("");
      partes.push(`*${p.nombre}*`);
      for (const linea of p.recomendaciones_marcadas) {
        partes.push(`- ${linea}`);
      }
    }
    if (productos.trim()) {
      partes.push("");
      partes.push("*Productos a necesitar:*");
      partes.push(productos.trim());
    }
    if (observaciones.trim()) {
      partes.push("");
      partes.push("*Observaciones:*");
      partes.push(observaciones.trim());
    }
    return partes.join("\n");
  }

  function handleGenerar() {
    setError("");
    if (!patientName.trim() || !patientPhone.trim()) {
      setError("Falta el nombre o el celular del paciente");
      return;
    }
    startTransition(async () => {
      const res = await fetch("/api/recetas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patient_name: patientName.trim(),
          patient_phone: patientPhone.trim(),
          fecha_nacimiento: fechaNacimiento || null,
          estatura_cm: estatura ? parseFloat(estatura) : null,
          peso_kg: peso ? parseFloat(peso) : null,
          padecimientos: padecimientosSeleccionados,
          productos_necesarios: productos.trim() || null,
          observaciones: observaciones.trim() || null,
        }),
      });
      if (!res.ok) { setError("No se pudo guardar la receta"); return; }
      setGenerada(true);
    });
  }

  function handleWhatsApp() {
    const phone = patientPhone.replace(/\D/g, "");
    const waPhone = phone.length === 10 ? `52${phone}` : phone;
    const msg = encodeURIComponent(buildMensaje());
    window.open(`https://wa.me/${waPhone}?text=${msg}`, "_blank");
  }

  return (
    <div className="space-y-6">
      {/* Datos del paciente */}
      <div className="rounded-2xl bg-white border border-gray-200 p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-800">Datos del paciente</h2>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Nombre del paciente</label>
          <input value={patientName} onChange={e => { setPatientName(e.target.value); setGenerada(false); }}
            style={{ color: "black" }}
            className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm focus:outline-none" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Celular</label>
          <input type="tel" value={patientPhone} onChange={e => { setPatientPhone(e.target.value); setGenerada(false); }}
            placeholder="10 dígitos"
            style={{ color: "black" }}
            className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm focus:outline-none" />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Fecha nac.</label>
            <input type="date" value={fechaNacimiento} onChange={e => { setFechaNacimiento(e.target.value); setGenerada(false); }}
              style={{ color: "black" }}
              className="w-full rounded-xl border border-gray-300 px-2 py-2.5 text-xs focus:outline-none" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Estatura (cm)</label>
            <input type="number" min="0" value={estatura} onChange={e => { setEstatura(e.target.value); setGenerada(false); }}
              style={{ color: "black" }}
              className="w-full rounded-xl border border-gray-300 px-2 py-2.5 text-xs focus:outline-none" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Peso (kg)</label>
            <input type="number" min="0" value={peso} onChange={e => { setPeso(e.target.value); setGenerada(false); }}
              style={{ color: "black" }}
              className="w-full rounded-xl border border-gray-300 px-2 py-2.5 text-xs focus:outline-none" />
          </div>
        </div>
      </div>

      {/* Padecimientos prioritarios y tendencias */}
      <div className="rounded-2xl bg-white border border-gray-200 p-5 space-y-3">
        <h2 className="text-sm font-semibold text-gray-800">Padecimientos prioritarios y tendencias</h2>
        {padecimientos.length === 0 && (
          <p className="text-sm text-gray-400">
            Master aún no da de alta padecimientos en la sección de Recetas.
          </p>
        )}
        <div className="space-y-3">
          {padecimientos.map(p => {
            const lineas = lineasDe(p.recomendacion);
            const activo = p.id in seleccion;
            return (
              <div key={p.id} className={activo ? "rounded-xl border border-blue-200 bg-blue-50/50 p-3" : "rounded-xl border border-gray-200 p-3"}>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-800">
                  <input type="checkbox" checked={activo} onChange={() => togglePadecimiento(p)} className="rounded" />
                  {p.nombre}
                </label>
                {activo && lineas.length > 0 && (
                  <div className="mt-2 ml-6 space-y-1.5">
                    <p className="text-[11px] text-gray-400">Marca las recomendaciones que aplican:</p>
                    {lineas.map(linea => (
                      <label key={linea} className="flex items-start gap-2 text-xs text-gray-700">
                        <input type="checkbox"
                          checked={(seleccion[p.id] ?? []).includes(linea)}
                          onChange={() => toggleLinea(p.id, linea)}
                          className="rounded mt-0.5" />
                        <span>{linea}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Productos a necesitar */}
      <div className="rounded-2xl bg-white border border-gray-200 p-5 space-y-2">
        <h2 className="text-sm font-semibold text-gray-800">Productos a necesitar</h2>
        <textarea value={productos} onChange={e => { setProductos(e.target.value); setGenerada(false); }} rows={3}
          placeholder="Ej: Té de cola de caballo, cápsulas de..."
          style={{ color: "black" }}
          className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:outline-none resize-y" />
      </div>

      {/* Observaciones */}
      <div className="rounded-2xl bg-white border border-gray-200 p-5 space-y-2">
        <h2 className="text-sm font-semibold text-gray-800">Observaciones</h2>
        <p className="text-xs text-gray-400">Si hay algo más que recomendar, escríbelo aquí</p>
        <textarea value={observaciones} onChange={e => { setObservaciones(e.target.value); setGenerada(false); }} rows={3}
          style={{ color: "black" }}
          className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:outline-none resize-y" />
      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3">{error}</p>}

      {!generada && (
        <button onClick={handleGenerar} disabled={isPending}
          className="w-full rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white hover:bg-blue-700 transition disabled:opacity-60">
          {isPending ? "Generando..." : "Generar receta"}
        </button>
      )}

      {generada && (
        <div className="rounded-2xl bg-white border border-gray-200 p-5 space-y-4">
          <h2 className="text-sm font-semibold text-gray-800">✓ Receta generada</h2>
          <pre className="text-xs text-gray-700 whitespace-pre-wrap bg-gray-50 rounded-xl p-4">{buildMensaje()}</pre>
          {whatsappNumber ? (
            <p className="text-xs text-gray-400">
              Recuerda tener sesión iniciada en WhatsApp con tu número ({whatsappNumber}) antes de enviar.
            </p>
          ) : (
            <p className="text-xs text-amber-600">
              No tienes un número de WhatsApp configurado.{" "}
              <Link href="/terapeuta/perfil" className="underline font-medium">Configúralo en Mi perfil</Link>.
            </p>
          )}
          <button onClick={handleWhatsApp}
            className="w-full rounded-xl bg-green-500 hover:bg-green-600 transition py-3 text-sm font-semibold text-white">
            💬 Enviar por WhatsApp
          </button>
        </div>
      )}
    </div>
  );
}
