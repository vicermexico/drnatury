"use client";
import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatCSTTime } from "@/lib/appointments/availability";

// ── Tipos ────────────────────────────────────────────────
interface ServiceData { id: string; name: string; duration_minutes: number }
interface BranchServiceItem {
  price: number;
  services: ServiceData | ServiceData[] | null;
}
interface Branch {
  id: string;
  name: string;
  address: string;
  schedule: Record<string, { open: boolean }> | null;
  branch_services: BranchServiceItem[];
}
interface Slot { starts_at: string; ends_at: string }
interface FlatService extends ServiceData { price: number }
type Modalidad = "CONSULTORIO" | "DOMICILIO";
type Step =
  | "phone" | "name" | "sucursal" | "modalidad" | "servicio"
  | "fecha" | "horario" | "ubicacion" | "confirmar" | "listo";

const DAY_KEYS = ["sunday","monday","tuesday","wednesday","thursday","friday","saturday"] as const;

function extractService(bs: BranchServiceItem): ServiceData | null {
  if (!bs.services) return null;
  return Array.isArray(bs.services) ? (bs.services[0] ?? null) : bs.services;
}
function getBranchServices(branch: Branch): FlatService[] {
  return branch.branch_services
    .map(bs => { const svc = extractService(bs); return svc ? { ...svc, price: bs.price } : null; })
    .filter((s): s is FlatService => s !== null);
}
function isBranchOpenOnDate(branch: Branch, dateStr: string): boolean {
  if (!branch.schedule) return false;
  const [y, mo, d] = dateStr.split("-").map(Number);
  const dayIdx = new Date(Date.UTC(y, mo - 1, d, 12, 0)).getUTCDay();
  return !!(branch.schedule[DAY_KEYS[dayIdx]]?.open);
}
function generateCalendarDays(year: number, month: number): string[] {
  const days: string[] = [];
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  for (let d = 1; d <= daysInMonth; d++) days.push(`${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
  return days;
}
function todayCST(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Monterrey" });
}

const card = (active: boolean) =>
  ["w-full text-left rounded-xl border-2 px-4 py-3 transition text-gray-900",
   active ? "border-emerald-500 bg-emerald-50" : "border-gray-200 hover:border-gray-300"].join(" ");
const btnPrimary = "w-full rounded-xl bg-emerald-400 py-3 text-sm font-semibold text-white hover:bg-emerald-500 transition disabled:opacity-60";
const inputCls = "w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:outline-none";

function BackButton({ onClick }: { onClick: () => void }) {
  return <button onClick={onClick} className="w-full text-sm text-gray-400 hover:text-gray-600 py-2 transition">← Volver</button>;
}
function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-gray-500">{label}</span>
      <span className="font-medium text-gray-900 text-right max-w-[60%]">{value}</span>
    </div>
  );
}

function buildTherapistWaUrl(waNumber: string, mensaje: string): string {
  const digits = waNumber.replace(/\D/g, "");
  const waPhone = digits.length === 10 ? `52${digits}` : digits;
  return `https://wa.me/${waPhone}?text=${encodeURIComponent(mensaje)}`;
}

export function AgendarLinkFlow({ therapistId, therapistWhatsapp, branches }: { therapistId?: string; therapistWhatsapp?: string | null; branches: Branch[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [step, setStep] = useState<Step>("phone");
  const [error, setError] = useState("");

  // Identificacion
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");

  // Reserva
  const [branchId, setBranchId] = useState(therapistId && branches[0] ? branches[0].id : "");
  const [modalidad, setModalidad] = useState<Modalidad | null>(null);
  const [serviceId, setServiceId] = useState("");
  const [dateStr, setDateStr] = useState("");
  const [slot, setSlot] = useState<Slot | null>(null);
  const [direccionRef, setDireccionRef] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [ubicando, setUbicando] = useState(false);
  const [appointmentId, setAppointmentId] = useState<string | null>(null);

  const branch = branches.find(b => b.id === branchId) ?? null;
  const service = branch ? getBranchServices(branch).find(s => s.id === serviceId) ?? null : null;

  // ── Paso: telefono ─────────────────────────────────────
  function handlePhoneSubmit() {
    const clean = phone.replace(/\D/g, "");
    if (clean.length < 10) { setError("Escribe un celular válido"); return; }
    setError("");
    startTransition(async () => {
      const res = await fetch("/api/auth/login", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: clean }),
      });
      if (res.ok) {
        // Ya registrado (y es solo paciente, no requiere password) → sesion iniciada.
        setStep(branchId ? "modalidad" : "sucursal");
        return;
      }
      const data = await res.json().catch(() => ({}));
      if (res.status === 200 && data.requirePassword) {
        setError("Este número pertenece a personal de DrNatury, no se puede agendar así.");
        return;
      }
      if (data.error === "NOT_FOUND") { setStep("name"); return; }
      if (data.error === "SUSPENDED") { setError("Esta cuenta está suspendida. Contacta a la clínica."); return; }
      setError("No se pudo verificar el número. Intenta de nuevo.");
    });
  }

  // ── Paso: nombre (paciente nuevo) ──────────────────────
  function handleNameSubmit() {
    if (!name.trim()) { setError("Escribe tu nombre"); return; }
    if (!branchId) { setError("Elige tu sucursal primero"); setStep("sucursal"); return; }
    setError("");
    startTransition(async () => {
      const res = await fetch("/api/auth/register", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phone.replace(/\D/g, ""), name: name.trim(), branch_id: branchId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.message ?? "No se pudo registrar. Intenta de nuevo.");
        return;
      }
      setStep("modalidad");
    });
  }

  // ── Ubicacion GPS ───────────────────────────────────────
  function handleTomarUbicacion() {
    if (!navigator.geolocation) { setError("Tu navegador no permite compartir ubicación."); return; }
    setUbicando(true);
    setError("");
    navigator.geolocation.getCurrentPosition(
      pos => { setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }); setUbicando(false); },
      () => { setError("No se pudo obtener tu ubicación. Revisa los permisos del navegador."); setUbicando(false); },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  // ── Confirmar ───────────────────────────────────────────
  function handleConfirmar() {
    if (!slot || !modalidad || !branchId || !serviceId) return;
    setError("");
    startTransition(async () => {
      const res = await fetch("/api/appointments", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branch_id: branchId,
          service_id: serviceId,
          starts_at: slot.starts_at,
          ends_at: slot.ends_at,
          modalidad,
          domicilio_direccion: modalidad === "DOMICILIO" ? (direccionRef.trim() || null) : null,
          domicilio_lat: coords?.lat ?? null,
          domicilio_lng: coords?.lng ?? null,
          therapist_id: therapistId ?? null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 409) { setError("Este horario acaba de ser tomado. Elige otro."); setStep("horario"); return; }
      if (!res.ok) { setError(data.message ?? "Error al agendar. Intenta de nuevo."); return; }
      setAppointmentId(data.id ?? null);
      setStep("listo");
    });
  }

  return (
    <div className="space-y-6">
      {error && <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3">{error}</p>}

      {step === "phone" && (
        <div className="space-y-4">
          <p className="text-sm text-gray-700">Escribe tu celular para comenzar</p>
          <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
            placeholder="10 dígitos" style={{ color: "black" }} className={inputCls} />
          <button onClick={handlePhoneSubmit} disabled={isPending} className={btnPrimary}>
            {isPending ? "Verificando…" : "Continuar"}
          </button>
        </div>
      )}

      {step === "name" && (
        <div className="space-y-4">
          <p className="text-sm text-gray-700">No te encontramos registrado — ¿cuál es tu nombre?</p>
          <input value={name} onChange={e => setName(e.target.value)}
            style={{ color: "black" }} className={inputCls} />
          {!therapistId && (
            <div>
              <p className="text-sm text-gray-700 mb-2">¿En qué sucursal te atendemos normalmente?</p>
              <div className="space-y-2">
                {branches.map(b => (
                  <button key={b.id} type="button" onClick={() => setBranchId(b.id)} className={card(branchId === b.id)}>
                    <p className="text-sm font-semibold">{b.name}</p>
                    <p className="text-xs text-gray-600 mt-0.5">{b.address}</p>
                  </button>
                ))}
              </div>
            </div>
          )}
          <button onClick={handleNameSubmit} disabled={isPending || (!therapistId && !branchId)} className={btnPrimary}>
            {isPending ? "Guardando…" : "Continuar"}
          </button>
          <BackButton onClick={() => setStep("phone")} />
        </div>
      )}

      {step === "sucursal" && (
        <div className="space-y-4">
          <p className="text-sm font-medium text-gray-700">¿En qué sucursal?</p>
          <div className="space-y-2">
            {branches.map(b => (
              <button key={b.id} type="button" onClick={() => { setBranchId(b.id); setStep("modalidad"); }} className={card(branchId === b.id)}>
                <p className="text-sm font-semibold">{b.name}</p>
                <p className="text-xs text-gray-600 mt-0.5">{b.address}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {step === "modalidad" && branch && (
        <div className="space-y-4">
          <p className="text-sm font-medium text-gray-700">¿Cómo prefieres tu cita?</p>
          <button onClick={() => { setModalidad("CONSULTORIO"); setStep("servicio"); }} className={card(false)}>
            <p className="text-sm font-semibold">📍 En consultorio</p>
            <p className="text-xs text-gray-600 mt-0.5">{branch.name} — {branch.address}</p>
          </button>
          <button onClick={() => { setModalidad("DOMICILIO"); setStep("servicio"); }} className={card(false)}>
            <p className="text-sm font-semibold">🏠 A domicilio</p>
            <p className="text-xs text-gray-600 mt-0.5">Vamos a tu casa</p>
          </button>
          {!therapistId && <BackButton onClick={() => setStep("sucursal")} />}
        </div>
      )}

      {step === "servicio" && branch && (
        <div className="space-y-4">
          <p className="text-sm font-medium text-gray-700">¿Qué servicio?</p>
          <div className="space-y-2">
            {getBranchServices(branch).map(s => (
              <button key={s.id} type="button" onClick={() => { setServiceId(s.id); setStep("fecha"); }} className={card(serviceId === s.id)}>
                <p className="text-sm font-semibold">{s.name}</p>
                <p className="text-xs text-gray-600 mt-0.5">
                  {s.duration_minutes} min{s.price > 0 && ` · $${s.price.toLocaleString("es-MX")}`}
                </p>
              </button>
            ))}
          </div>
          <BackButton onClick={() => setStep("modalidad")} />
        </div>
      )}

      {step === "fecha" && branch && (
        <FechaPicker branch={branch} onSelect={d => { setDateStr(d); setStep("horario"); }} onBack={() => setStep("servicio")} />
      )}

      {step === "horario" && (
        <HorarioPicker
          branchId={branchId} serviceId={serviceId} dateStr={dateStr} modalidad={modalidad!} therapistId={therapistId}
          onSelect={s => { setSlot(s); setStep(modalidad === "DOMICILIO" ? "ubicacion" : "confirmar"); }}
          onBack={() => setStep("fecha")}
        />
      )}

      {step === "ubicacion" && (
        <div className="space-y-4">
          <p className="text-sm font-medium text-gray-700">Tu ubicación</p>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Referencia de tu domicilio (opcional)</label>
            <textarea value={direccionRef} onChange={e => setDireccionRef(e.target.value)} rows={3}
              placeholder="Ej: casa azul con portón negro, entre calle X y Y"
              style={{ color: "black" }} className={inputCls + " resize-y"} />
          </div>
          <button onClick={handleTomarUbicacion} disabled={ubicando}
            className="w-full rounded-xl border-2 border-emerald-400 text-emerald-700 py-3 text-sm font-semibold hover:bg-emerald-50 transition disabled:opacity-60">
            {ubicando ? "Obteniendo ubicación…" : coords ? "✓ Ubicación tomada — volver a tomar" : "📍 Tomar mi ubicación"}
          </button>
          {coords && <p className="text-xs text-emerald-700 text-center">Tu ubicación exacta quedó guardada.</p>}
          <button onClick={() => setStep("confirmar")} disabled={!coords} className={btnPrimary}>
            Continuar
          </button>
          <BackButton onClick={() => setStep("horario")} />
        </div>
      )}

      {step === "confirmar" && branch && service && slot && (
        <div className="space-y-5">
          <div className="rounded-2xl bg-gray-50 border border-gray-200 p-5 space-y-3">
            <Row label="Modalidad" value={modalidad === "DOMICILIO" ? "A domicilio" : "En consultorio"} />
            <Row label={modalidad === "DOMICILIO" ? "Sucursal (referencia)" : "Sucursal"} value={branch.name} />
            <Row label="Servicio" value={`${service.name} (${service.duration_minutes} min)`} />
            {service.price > 0 && <Row label="Precio" value={`$${service.price.toLocaleString("es-MX")}`} />}
            <Row label="Fecha" value={new Date(`${dateStr}T12:00:00`).toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long", year: "numeric" })} />
            <Row label="Hora" value={formatCSTTime(slot.starts_at)} />
          </div>
          <p className="text-xs text-gray-500 text-center">Al confirmar recibirás un mensaje de WhatsApp con los detalles.</p>
          <button onClick={handleConfirmar} disabled={isPending} className={btnPrimary}>
            {isPending ? "Agendando…" : "Confirmar cita"}
          </button>
          <BackButton onClick={() => setStep(modalidad === "DOMICILIO" ? "ubicacion" : "horario")} />
        </div>
      )}

      {step === "listo" && (
        <div className="text-center space-y-4 py-8">
          <p className="text-5xl">✓</p>
          <p className="text-lg font-bold text-gray-900">¡Cita agendada!</p>
          <p className="text-sm text-gray-500">Te llegará un mensaje de WhatsApp con los detalles.</p>
          {therapistWhatsapp && branch && service && slot && (
            <a
              href={buildTherapistWaUrl(
                therapistWhatsapp,
                `Hola! Ya agendé mi cita ✅\n${service.name}\n${new Date(`${dateStr}T12:00:00`).toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" })} a las ${formatCSTTime(slot.starts_at)}\n${modalidad === "DOMICILIO" ? "🏠 A domicilio" : `📍 ${branch.name}`}`
                + (therapistId && appointmentId
                    ? `\n\n🔒 Exclusivo terapeuta (ver cita y guardarla en tu calendario):\n${typeof window !== "undefined" ? window.location.origin : ""}/terapeuta-acceso/${therapistId}?next=/terapeuta/citas/${appointmentId}`
                    : "")
              )}
              className="block w-full rounded-xl bg-green-500 py-3 text-sm font-semibold text-white hover:bg-green-600 transition"
            >
              💬 Volver a WhatsApp
            </a>
          )}
          <button onClick={() => router.push("/paciente/citas")} className={btnPrimary}>
            Ver mis citas
          </button>
        </div>
      )}
    </div>
  );
}

// ── Sub-componentes ──────────────────────────────────────
function FechaPicker({ branch, onSelect, onBack }: { branch: Branch; onSelect: (d: string) => void; onBack: () => void }) {
  const today = todayCST();
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth());
  const days = generateCalendarDays(year, month);
  const firstDay = new Date(year, month, 1).getDay();
  const maxDate = new Date(); maxDate.setDate(maxDate.getDate() + 30);
  const maxStr = maxDate.toLocaleDateString("en-CA", { timeZone: "America/Monterrey" });
  const monthName = new Date(year, month, 1).toLocaleDateString("es-MX", { month: "long", year: "numeric" });
  function prevMonth() { if (month === 0) { setMonth(11); setYear(y => y - 1); } else setMonth(m => m - 1); }
  function nextMonth() { if (month === 11) { setMonth(0); setYear(y => y + 1); } else setMonth(m => m + 1); }
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button onClick={prevMonth} className="p-2 text-gray-500 hover:text-gray-900">←</button>
        <p className="text-sm font-semibold capitalize">{monthName}</p>
        <button onClick={nextMonth} className="p-2 text-gray-500 hover:text-gray-900">→</button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center">
        {["Do","Lu","Ma","Mi","Ju","Vi","Sa"].map(d => <p key={d} className="text-[11px] text-gray-400 font-medium pb-1">{d}</p>)}
        {Array(firstDay).fill(null).map((_, i) => <div key={`e${i}`} />)}
        {days.map(dateStr => {
          const isPast = dateStr < today;
          const isFuture = dateStr > maxStr;
          const closed = !isBranchOpenOnDate(branch, dateStr);
          const disabled = isPast || isFuture || closed;
          const dayNum = parseInt(dateStr.split("-")[2], 10);
          return (
            <button key={dateStr} disabled={disabled} onClick={() => onSelect(dateStr)}
              className={["rounded-lg py-2 text-sm transition",
                disabled ? "text-gray-300 cursor-default" : "text-gray-900 hover:bg-emerald-50 hover:text-emerald-700 font-medium",
                dateStr === today && !disabled ? "ring-2 ring-emerald-500" : ""].join(" ")}>
              {dayNum}
            </button>
          );
        })}
      </div>
      <BackButton onClick={onBack} />
    </div>
  );
}

function HorarioPicker({
  branchId, serviceId, dateStr, modalidad, therapistId, onSelect, onBack,
}: {
  branchId: string; serviceId: string; dateStr: string; modalidad: Modalidad; therapistId?: string;
  onSelect: (s: Slot) => void; onBack: () => void;
}) {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(false);
  useEffect(() => {
    let cancelled = false;
    setLoading(true); setErr(false); setSlots([]);
    const qs = modalidad === "DOMICILIO"
      ? `service_id=${serviceId}&date=${dateStr}&modalidad=DOMICILIO${therapistId ? `&therapist_id=${therapistId}` : ""}`
      : `branch_id=${branchId}&service_id=${serviceId}&date=${dateStr}`;
    fetch(`/api/appointments/availability?${qs}`)
      .then(async res => {
        if (!res.ok) { if (!cancelled) setErr(true); return; }
        const data = await res.json();
        if (!cancelled) setSlots(Array.isArray(data) ? data : []);
      })
      .catch(() => { if (!cancelled) setErr(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [branchId, serviceId, dateStr, modalidad, therapistId]);
  if (loading) return <p className="text-sm text-gray-400 text-center py-8">Cargando horarios…</p>;
  if (err) return <p className="text-sm text-red-500 text-center py-8">Error cargando horarios. Intenta de nuevo.</p>;
  if (slots.length === 0) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-gray-500 text-center py-8">No hay horarios disponibles para este día.<br />Elige otra fecha.</p>
        <BackButton onClick={onBack} />
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        {slots.map((slot: Slot) => (
          <button key={slot.starts_at} onClick={() => onSelect(slot)}
            className="rounded-xl border border-gray-200 py-3 text-sm font-medium text-gray-700 hover:border-emerald-400 hover:bg-emerald-50 hover:text-emerald-700 transition">
            {formatCSTTime(slot.starts_at)}
          </button>
        ))}
      </div>
      <BackButton onClick={onBack} />
    </div>
  );
}
