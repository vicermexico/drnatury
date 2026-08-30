"use client";
import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatCSTTime, formatCSTDateShort } from "@/lib/appointments/availability";
interface Patient { id: string; name: string; phone: string; }
interface Service { id: string; name: string; duration_minutes: number; price: number; }
interface Slot    { starts_at: string; ends_at: string; }
interface Props {
  patients:    Patient[];
  services:    Service[];
  branchId:    string;
  branchName:  string;
  therapistId: string;
}
type Step = 1 | 2 | 3 | 4 | 5;
const MONTHS = ["enero","febrero","marzo","abril","mayo","junio",
                "julio","agosto","septiembre","octubre","noviembre","diciembre"] as const;
const DAYS   = ["Do","Lu","Ma","Mi","Ju","Vi","Sa"] as const;
function todayCST() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Monterrey" });
}
function calDays(year: number, month: number) {
  const n = new Date(year, month + 1, 0).getDate();
  return Array.from({ length: n }, (_, i) =>
    `${year}-${String(month + 1).padStart(2,"0")}-${String(i + 1).padStart(2,"0")}`
  );
}
function CopiarHorariosButton({ slots, dateStr }: { slots: Slot[]; dateStr: string }) {
  const [copied, setCopied] = useState(false);
  function handleCopy() {
    const fecha = new Date(dateStr + "T12:00:00").toLocaleDateString("es-MX", {
      weekday: "long", day: "numeric", month: "long",
    });
    const text =
      `Horarios disponibles (${fecha}):\n` +
      slots.map(s => formatCSTTime(s.starts_at)).join("\n");
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }
  return (
    <button
      type="button"
      onClick={handleCopy}
      className="w-full flex items-center justify-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 py-2.5 text-sm font-semibold text-emerald-700 hover:bg-emerald-100 transition"
    >
      {copied ? "✅ Copiado — pégalo en WhatsApp" : "📋 Copiar horarios para WhatsApp"}
    </button>
  );
}
function QuickRegisterForm({ onSuccess, onCancel }: { onSuccess: (p: Patient) => void; onCancel: () => void; }) {
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    startTransition(async () => {
      const res = await fetch("/api/patients/quick", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), phone }),
      });
      const data = await res.json() as { id?: string; name?: string; phone?: string; message?: string; profile?: Patient };
      if (res.status === 409 && data.profile) { onSuccess(data.profile); return; }
      if (!res.ok) { setError(data.message ?? "Error al registrar."); return; }
      onSuccess({ id: data.id!, name: data.name!, phone: data.phone! });
    });
  }
  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-blue-200 bg-blue-50 p-4 space-y-3 mt-2">
      <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Registrar nuevo paciente</p>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Nombre completo *</label>
        <input required value={name} onChange={e => setName(e.target.value)} style={{ color: "black" }}
          className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm bg-white focus:border-blue-500 focus:outline-none" />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Telefono *</label>
        <input type="tel" inputMode="numeric" required value={phone}
          onChange={e => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
          placeholder="10 digitos" style={{ color: "black" }}
          className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm bg-white focus:border-blue-500 focus:outline-none" />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={onCancel} className="flex-1 rounded-xl border border-gray-300 py-2.5 text-sm text-gray-600 hover:bg-white transition">Cancelar</button>
        <button type="submit" disabled={isPending} className="flex-1 rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition disabled:opacity-60">
          {isPending ? "Registrando..." : "Registrar"}
        </button>
      </div>
    </form>
  );
}
// Step 1: Fecha
function Step1({ onSelect }: { onSelect: (d: string) => void }) {
  const today = todayCST();
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth());
  const days = calDays(year, month);
  const firstDay = new Date(year, month, 1).getDay();
  const maxDate = new Date();
  maxDate.setDate(maxDate.getDate() + 60);
  const maxStr = maxDate.toLocaleDateString("en-CA", { timeZone: "America/Monterrey" });
  return (
    <div className="space-y-4">
      <p className="text-sm font-medium text-gray-700">Selecciona una fecha</p>
      <div className="flex items-center justify-between">
        <button onClick={() => { if (month === 0) { setMonth(11); setYear(y => y-1); } else setMonth(m => m-1); }}
          className="p-2 text-gray-400 hover:text-gray-700 text-lg">&#8592;</button>
        <p className="text-sm font-semibold text-gray-800 capitalize">{MONTHS[month]} {year}</p>
        <button onClick={() => { if (month === 11) { setMonth(0); setYear(y => y+1); } else setMonth(m => m+1); }}
          className="p-2 text-gray-400 hover:text-gray-700 text-lg">&#8594;</button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center">
        {DAYS.map(d => <p key={d} className="text-[11px] text-gray-400 font-medium pb-1">{d}</p>)}
        {Array(firstDay).fill(null).map((_, i) => <div key={`e${i}`} />)}
        {days.map(dateStr => {
          const disabled = dateStr < today || dateStr > maxStr;
          const dayNum = parseInt(dateStr.split("-")[2], 10);
          return (
            <button key={dateStr} disabled={disabled} onClick={() => onSelect(dateStr)}
              className={["rounded-lg py-2 text-sm transition",
                disabled ? "text-gray-300 cursor-default" : "text-gray-900 font-medium hover:bg-blue-50 hover:text-blue-700",
              ].join(" ")}>
              {dayNum}
            </button>
          );
        })}
      </div>
    </div>
  );
}
// Step 2: Servicio
function Step2({ services, onSelect, onBack }: { services: Service[]; onSelect: (s: Service) => void; onBack: () => void; }) {
  return (
    <div className="space-y-4">
      <p className="text-sm font-medium text-gray-700">Selecciona el servicio</p>
      {services.length === 0 ? (
        <p className="text-sm text-gray-400 bg-gray-50 rounded-xl px-4 py-3">No hay servicios configurados.</p>
      ) : (
        <div className="space-y-2">
          {services.map(s => (
            <button key={s.id} type="button" onClick={() => onSelect(s)}
              className="w-full text-left rounded-xl border-2 border-gray-200 hover:border-blue-400 hover:bg-blue-50 px-4 py-3 transition">
              <p className="text-sm font-semibold text-gray-900">{s.name}</p>
              <p className="text-xs text-gray-500 mt-0.5">{s.duration_minutes} min{s.price > 0 ? ` · $${s.price.toLocaleString("es-MX")}` : ""}</p>
            </button>
          ))}
        </div>
      )}
      <button onClick={onBack} className="w-full text-sm text-gray-400 hover:text-gray-600 py-1.5 transition">&#8592; Cambiar fecha</button>
    </div>
  );
}
// Step 3: Horario
function Step3({ branchId, serviceId, dateStr, onSelect, onBack }: {
  branchId: string; serviceId: string; dateStr: string;
  onSelect: (s: Slot) => void; onBack: () => void;
}) {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  useEffect(() => {
    let cancelled = false;
    setLoading(true); setFetchError(false); setSlots([]);
    fetch(`/api/appointments/availability?branch_id=${branchId}&service_id=${serviceId}&date=${dateStr}`)
      .then(async r => {
        if (!r.ok) { if (!cancelled) setFetchError(true); return; }
        const d = await r.json() as unknown;
        if (!cancelled) setSlots(Array.isArray(d) ? d as Slot[] : []);
      })
      .catch(() => { if (!cancelled) setFetchError(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [branchId, serviceId, dateStr]);
  return (
    <div className="space-y-4">
      <p className="text-sm font-medium text-gray-700">Horario - {formatCSTDateShort(new Date(dateStr + "T12:00:00").toISOString())}</p>
      {loading && <p className="text-sm text-gray-400 text-center py-6">Cargando horarios...</p>}
      {fetchError && <p className="text-sm text-red-500 text-center py-6">Error cargando horarios.</p>}
      {!loading && !fetchError && slots.length === 0 && (
        <p className="text-sm text-gray-500 text-center py-6">No hay horarios disponibles este dia.</p>
      )}
      {!loading && !fetchError && slots.length > 0 && (
        <>
          <CopiarHorariosButton slots={slots} dateStr={dateStr} />
          <div className="grid grid-cols-3 gap-2">
            {slots.map(slot => (
              <button key={slot.starts_at} onClick={() => onSelect(slot)}
                className="rounded-xl border border-gray-200 py-3 text-sm font-medium text-gray-800 hover:border-blue-400 hover:bg-blue-50 hover:text-blue-700 transition">
                {formatCSTTime(slot.starts_at)}
              </button>
            ))}
          </div>
        </>
      )}
      <button onClick={onBack} className="w-full text-sm text-gray-400 hover:text-gray-600 py-1.5 transition">&#8592; Cambiar servicio</button>
    </div>
  );
}
// Step 4: Paciente
function Step4({ patients, onNext, onBack }: {
  patients: Patient[];
  onNext: (p: Patient) => void;
  onBack: () => void;
}) {
  const [query, setQuery] = useState("");
  const [selPatient, setSelPatient] = useState<Patient | null>(null);
  const [showRegister, setShowRegister] = useState(false);
  const [extraPatients, setExtraPatients] = useState<Patient[]>([]);
  const allPatients = [...extraPatients, ...patients];
  const filtered = query.trim().length >= 2
    ? allPatients.filter(p => p.name.toLowerCase().includes(query.toLowerCase()) || p.phone.includes(query.trim())).slice(0, 8)
    : [];
  const noResults = query.trim().length >= 2 && filtered.length === 0;
  return (
    <div className="space-y-4">
      <p className="text-sm font-medium text-gray-700">Buscar paciente</p>
      {selPatient && !showRegister ? (
        <div className="flex items-center justify-between rounded-xl border-2 border-blue-500 bg-blue-50 px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-gray-900">{selPatient.name}</p>
            <p className="text-xs text-gray-500">{selPatient.phone}</p>
          </div>
          <button type="button" onClick={() => { setSelPatient(null); setQuery(""); }}
            className="text-xs text-blue-600 hover:text-blue-800 underline transition">Cambiar</button>
        </div>
      ) : (
        <div className="space-y-1">
          <input type="search" value={query}
            onChange={e => { setQuery(e.target.value); setShowRegister(false); }}
            placeholder="Buscar por nombre o telefono..."
            style={{ color: "black" }}
            className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm bg-white focus:border-blue-500 focus:outline-none" />
          {filtered.length > 0 && (
            <div className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
              {filtered.map(p => (
                <button key={p.id} type="button"
                  onClick={() => { setSelPatient(p); setQuery(""); setShowRegister(false); }}
                  className="w-full text-left px-4 py-3 text-sm hover:bg-blue-50 transition border-b border-gray-100 last:border-0">
                  <p className="font-medium text-gray-900">{p.name}</p>
                  <p className="text-xs text-gray-500">{p.phone}</p>
                </button>
              ))}
            </div>
          )}
          {noResults && !showRegister && (
            <div className="rounded-xl border border-dashed border-gray-200 px-4 py-3 text-sm text-center space-y-2">
              <p className="text-gray-500">No encontrado</p>
              <button type="button" onClick={() => setShowRegister(true)}
                className="text-blue-600 hover:text-blue-800 font-medium underline transition">+ Registrar nuevo paciente</button>
            </div>
          )}
          {showRegister && (
            <QuickRegisterForm
              onSuccess={p => { setExtraPatients(prev => [p, ...prev]); setSelPatient(p); setShowRegister(false); setQuery(""); }}
              onCancel={() => setShowRegister(false)} />
          )}
        </div>
      )}
      <button disabled={!selPatient} onClick={() => { if (selPatient) onNext(selPatient); }}
        className="w-full rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white hover:bg-blue-700 transition disabled:opacity-50">
        Continuar
      </button>
      <button onClick={onBack} className="w-full text-sm text-gray-400 hover:text-gray-600 py-1.5 transition">&#8592; Cambiar horario</button>
    </div>
  );
}
// Step 5: Confirmacion
function Step5({ patient, service, branchName, dateStr, slot, onConfirm, onBack, isPending, error }: {
  patient: Patient; service: Service; branchName: string;
  dateStr: string; slot: Slot;
  onConfirm: (notes: string) => void; onBack: () => void;
  isPending: boolean; error: string;
}) {
  const [notes, setNotes] = useState("");
  const rows: [string, string][] = [
    ["Paciente", `${patient.name} · ${patient.phone}`],
    ["Servicio", `${service.name} (${service.duration_minutes} min)`],
    ["Sucursal", branchName],
    ["Fecha", new Date(`${dateStr}T12:00:00`).toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" })],
    ["Hora", formatCSTTime(slot.starts_at)],
  ];
  return (
    <div className="space-y-5">
      <p className="text-sm font-medium text-gray-700">Confirmar cita</p>
      <div className="rounded-2xl bg-gray-50 border border-gray-200 p-5 space-y-3">
        {rows.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-4 text-sm">
            <span className="text-gray-500 shrink-0">{label}</span>
            <span className="font-medium text-gray-900 text-right">{value}</span>
          </div>
        ))}
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Observaciones (opcional)</label>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
          placeholder="Notas internas sobre esta cita..."
          style={{ color: "black" }}
          className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm bg-white focus:border-blue-500 focus:outline-none" />
      </div>
      {error && <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3">{error}</p>}
      <button onClick={() => onConfirm(notes)} disabled={isPending}
        className="w-full rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white hover:bg-blue-700 transition disabled:opacity-60">
        {isPending ? "Agendando..." : "Confirmar cita"}
      </button>
      <button onClick={onBack} className="w-full text-sm text-gray-400 hover:text-gray-600 py-1.5 transition">&#8592; Cambiar paciente</button>
    </div>
  );
}
// Componente principal
export function TerapeutaBookingForm({ patients, services, branchId, branchName, therapistId }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [step, setStep] = useState<Step>(1);
  const [dateStr, setDateStr] = useState("");
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [error, setError] = useState("");
  const LABELS = ["Fecha", "Servicio", "Horario", "Paciente", "Confirmacion"];
  function handleConfirm(notes: string) {
    if (!slot || !selectedPatient || !selectedService) return;
    setError("");
    startTransition(async () => {
      const res = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patient_id:   selectedPatient.id,
          branch_id:    branchId,
          service_id:   selectedService.id,
          therapist_id: therapistId,
          starts_at:    slot.starts_at,
          ends_at:      slot.ends_at,
          notes:        notes || undefined,
        }),
      });
      const data = await res.json() as { error?: string; message?: string };
      if (res.status === 409) { setError("Ese horario acaba de ser tomado. Elige otro."); setStep(3); return; }
      if (!res.ok) { setError(data.message ?? "Error al agendar. Intenta de nuevo."); return; }
      window.location.href = "/terapeuta/agenda";
    });
  }
  return (
    <div className="space-y-6">
      <div className="flex gap-1">
        {LABELS.map((_, i) => (
          <div key={i} className={["flex-1 h-1 rounded-full transition-colors",
            i + 1 <= step ? "bg-blue-600" : "bg-gray-200"].join(" ")} />
        ))}
      </div>
      <p className="text-xs text-gray-500 font-medium">{LABELS[step - 1]}</p>
      {step === 1 && <Step1 onSelect={d => { setDateStr(d); setStep(2); }} />}
      {step === 2 && <Step2 services={services} onSelect={s => { setSelectedService(s); setStep(3); }} onBack={() => setStep(1)} />}
      {step === 3 && selectedService && (
        <Step3 branchId={branchId} serviceId={selectedService.id} dateStr={dateStr}
          onSelect={s => { setSlot(s); setError(""); setStep(4); }} onBack={() => setStep(2)} />
      )}
      {step === 4 && (
        <Step4 patients={patients} onNext={p => { setSelectedPatient(p); setStep(5); }} onBack={() => setStep(3)} />
      )}
      {step === 5 && selectedPatient && selectedService && slot && (
        <Step5 patient={selectedPatient} service={selectedService} branchName={branchName}
          dateStr={dateStr} slot={slot} onConfirm={handleConfirm} onBack={() => setStep(4)}
          isPending={isPending} error={error} />
      )}
    </div>
  );
}
