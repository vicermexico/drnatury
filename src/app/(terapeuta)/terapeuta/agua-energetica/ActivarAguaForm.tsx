"use client";
import { useState, useTransition } from "react";

interface Paciente {
  id: string;
  name: string;
  phone: string;
  activo: boolean;
  fecha_fin: string | null;
}

interface Solicitud {
  id: string;
  estado: string;
  created_at: string;
  patient: { id: string; name: string; phone: string } | null;
}

export function ActivarAguaForm({ pacientes, solicitudes }: {
  pacientes: Paciente[];
  solicitudes: Solicitud[];
}) {
  const [search, setSearch] = useState("");
  const [activando, setActivando] = useState<string | null>(null);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [, startTransition] = useTransition();
  const [localActivos, setLocalActivos] = useState<Set<string>>(
    new Set(pacientes.filter(p => p.activo).map(p => p.id))
  );
  const [localSolicitudes, setLocalSolicitudes] = useState(solicitudes);

  const filtered = pacientes.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.phone.includes(search)
  );

  function handleActivar(patientId: string, name: string) {
    setActivando(patientId);
    setError(""); setSuccess("");
    startTransition(async () => {
      const res = await fetch("/api/agua-energetica/activar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patient_id: patientId }),
      });
      const data = await res.json();
      setActivando(null);
      if (!res.ok) { setError(data.message ?? "Error al activar"); return; }
      setLocalActivos(prev => new Set([...prev, patientId]));
      setSuccess(`✓ ${name} activado correctamente`);
      setTimeout(() => setSuccess(""), 4000);
    });
  }

  function handleRechazar(solicitudId: string) {
    startTransition(async () => {
      await fetch("/api/agua-energetica/solicitudes", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: solicitudId, estado: "rechazada" }),
      });
      setLocalSolicitudes(prev => prev.filter(s => s.id !== solicitudId));
    });
  }

  function handleAprobarSolicitud(solicitud: Solicitud) {
    const patient = Array.isArray(solicitud.patient) ? solicitud.patient[0] : solicitud.patient;
    if (!patient) return;
    startTransition(async () => {
      // Activar al paciente
      const res = await fetch("/api/agua-energetica/activar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patient_id: patient.id }),
      });
      if (res.ok) {
        // Marcar solicitud como aprobada
        await fetch("/api/agua-energetica/solicitudes", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: solicitud.id, estado: "aprobada" }),
        });
        setLocalActivos(prev => new Set([...prev, patient.id]));
        setLocalSolicitudes(prev => prev.filter(s => s.id !== solicitud.id));
        setSuccess(`✓ ${patient.name} activado correctamente`);
        setTimeout(() => setSuccess(""), 4000);
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* Solicitudes pendientes */}
      {localSolicitudes.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">{localSolicitudes.length}</span>
            Solicitudes pendientes
          </h2>
          {localSolicitudes.map(s => {
            const patient = Array.isArray(s.patient) ? s.patient[0] : s.patient;
            return (
              <div key={s.id} className="rounded-2xl bg-blue-50 border border-blue-200 p-4 space-y-3">
                <div>
                  <p className="text-sm font-semibold text-gray-900">{patient?.name ?? "Paciente"}</p>
                  <p className="text-xs text-gray-400">{patient?.phone}</p>
                  <p className="text-xs text-gray-400">
                    {new Date(s.created_at).toLocaleDateString("es-MX", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: "America/Monterrey" })}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleRechazar(s.id)}
                    className="flex-1 rounded-xl border border-red-200 py-2 text-sm text-red-600 hover:bg-red-50 transition">
                    Rechazar
                  </button>
                  <button onClick={() => handleAprobarSolicitud(s)}
                    className="flex-1 rounded-xl bg-blue-600 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition">
                    Activar
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {error   && <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3">{error}</p>}
      {success && <p className="text-sm text-green-700 bg-green-50 rounded-xl px-4 py-3">{success}</p>}

      {/* Lista de pacientes */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-700">Activar paciente</h2>
        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Buscar paciente por nombre o celular..."
          style={{ color: "black" }}
          className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-blue-500 focus:outline-none" />

        <div className="space-y-2">
          {filtered.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-6">No se encontraron pacientes</p>
          )}
          {filtered.map(p => {
            const estaActivo = localActivos.has(p.id);
            return (
              <div key={p.id} className="rounded-2xl bg-white border border-gray-200 p-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-gray-900">{p.name}</p>
                  <p className="text-xs text-gray-400">{p.phone}</p>
                  {estaActivo && p.fecha_fin && (
                    <p className="text-xs text-blue-600 mt-0.5">
                      Activo hasta: {new Date(p.fecha_fin).toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric", timeZone: "America/Monterrey" })}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => !estaActivo && handleActivar(p.id, p.name)}
                  disabled={estaActivo || activando === p.id}
                  className={["rounded-xl px-4 py-2 text-sm font-semibold transition shrink-0",
                    estaActivo
                      ? "bg-green-100 text-green-700 cursor-default"
                      : activando === p.id
                      ? "bg-gray-100 text-gray-400 cursor-wait"
                      : "bg-blue-600 text-white hover:bg-blue-700"
                  ].join(" ")}
                >
                  {estaActivo ? "✓ Activo" : activando === p.id ? "Activando..." : "Activar"}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}