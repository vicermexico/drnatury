"use client";
import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatCSTTime } from "@/lib/appointments/availability";
interface Patient   { id: string; name: string; phone: string }
interface Branch    { id: string; name: string }
interface Service   { id: string; name: string; duration_minutes: number }
interface Therapist { id: string; name: string; branch_id: string | null }
interface Slot      { starts_at: string; ends_at: string }
const MONTHS = ["enero","febrero","marzo","abril","mayo","junio",
                "julio","agosto","septiembre","octubre","noviembre","diciembre"] as const;
const DAYS = ["Do","Lu","Ma","Mi","Ju","Vi","Sa"] as const;
const COUNTRIES = [
  { code: "+52", flag: "🇲🇽", maxDigits: 10 },
  { code: "+1",  flag: "🇺🇸", maxDigits: 10 },
  { code: "+34", flag: "🇪🇸", maxDigits: 9 },
  { code: "+57", flag: "🇨🇴", maxDigits: 10 },
  { code: "+54", flag: "🇦🇷", maxDigits: 10 },
  { code: "+56", flag: "🇨🇱", maxDigits: 9 },
  { code: "+51", flag: "🇵🇪", maxDigits: 9 },
  { code: "+58", flag: "🇻🇪", maxDigits: 10 },
];
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
function StepFecha({ onSelect }: { onSelect: (d: string) => void }) {
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
        {days.map(d => {
          const isPast = d < today;
          const isFuture = d > maxStr;
          const disabled = isPast || isFuture;
          return (
            <button key={d} onClick={() => !disabled && onSelect(d)} disabled={disabled}
              className={["rounded-lg py-2 text-sm font-medium transition",
                disabled ? "text-gray-300 cursor-not-allowed" : "hover:bg-blue-50 text-gray-700 hover:text-blue-700"
              ].join(" ")}>
              {parseInt(d.split("-")[2])}
            </button>
          );
        })}
      </div>
    </div>
  );
}
function StepSucursalServicio({ branches, services, onSelect }: {
  branches: Branch[];
  services: Service[];
  onSelect: (b: string, s: string) => void;
}) {
  const [branchId, setBranchId] = useState("");
  const [serviceId, setServiceId] = useState("");
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Sucursal *</label>
        <select value={branchId} onChange={e => setBranchId(e.target.value)}
          style={{ color: "black" }}
          className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm bg-white focus:border-blue-500 focus:outline-none">
          <option value="">Selecciona sucursal</option>
          {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Servicio *</label>
        <select value={serviceId} onChange={e => setServiceId(e.target.value)}
          style={{ color: "black" }}
          className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm bg-white focus:border-blue-500 focus:outline-none">
          <option value="">Selecciona servicio</option>
          {services.map(s => <option key={s.id} value={s.id}>{s.name} ({s.duration_minutes} min)</option>)}
        </select>
      </div>
      <button onClick={() => branchId && serviceId && onSelect(branchId, serviceId)}
        disabled={!branchId || !serviceId}
        className="w-full rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white hover:bg-blue-700 transition disabled:opacity-40">
        Continuar
      </button>
    </div>
  );
}
function StepHorario({ branchId, serviceId, dateStr, onSelect }: {
  branchId: string; serviceId: string; dateStr: string; onSelect: (s: Slot) => void;
}) {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    setLoading(true);
    fetch(`/api/appointments/availability?branch_id=${branchId}&service_id=${serviceId}&date=${dateStr}`)
      .then(r => r.json())
      .then((data: Slot[]) => { setSlots(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [branchId, serviceId, dateStr]);
  if (loading) return <p className="text-sm text-gray-400 text-center py-6">Cargando horarios...</p>;
  if (!slots.length) return <p className="text-sm text-gray-500 text-center py-6">No hay horarios disponibles para este dia.</p>;
  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-gray-700">Selecciona un horario</p>
      <CopiarHorariosButton slots={slots} dateStr={dateStr} />
      <div className="grid grid-cols-3 gap-2">
        {slots.map(s => (
          <button key={s.starts_at} onClick={() => onSelect(s)}
            className="rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-700 hover:border-blue-400 hover:bg-blue-50 hover:text-blue-700 transition">
            {formatCSTTime(s.starts_at)}
          </button>
        ))}
      </div>
    </div>
  );
}
function StepPaciente({ patients, onSelect }: {
  patients: Patient[];
  onSelect: (p: Patient) => void;
}) {
  const [q, setQ] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newName, setNewName] = useState("");
  const [countryCode, setCountryCode] = useState("+52");
  const [registering, setRegistering] = useState(false);
  const [regError, setRegError] = useState("");
  const [, startTransition] = useTransition();
  const selectedCountry = COUNTRIES.find(c => c.code === countryCode) ?? COUNTRIES[0];
  const filtered = q.length >= 2
    ? patients.filter(p =>
        p.name.toLowerCase().includes(q.toLowerCase()) ||
        p.phone.includes(q) ||
        p.phone.includes(q.slice(-10))
      )
    : [];
  function handleRegistrar() {
    const fullPhone = countryCode.replace("+", "") + newPhone;
    if (!newName.trim()) { setRegError("Nombre requerido"); return; }
    if (newPhone.length < selectedCountry.maxDigits) { setRegError("Numero incompleto"); return; }
    setRegError("");
    startTransition(async () => {
      const res = await fetch("/api/patients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim(), phone: fullPhone }),
      });
      const data = await res.json();
      if (!res.ok) { setRegError(data.message ?? "Error al registrar"); return; }
      onSelect({ id: data.id, name: newName.trim(), phone: fullPhone });
    });
  }
  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-gray-700">Buscar paciente</p>
      <input type="text" value={q} onChange={e => setQ(e.target.value)}
        placeholder="Buscar por nombre o telefono..."
        style={{ color: "black" }}
        className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-blue-500 focus:outline-none" />
      {q.length >= 2 && filtered.length === 0 && !registering && (
        <div className="text-center space-y-2 py-2">
          <p className="text-sm text-gray-400">No se encontro ningun paciente</p>
          <button onClick={() => setRegistering(true)}
            className="text-sm text-blue-600 underline font-medium">
            + Registrar nuevo paciente
          </button>
        </div>
      )}
      {registering && (
        <div className="rounded-2xl bg-blue-50 border border-blue-200 p-4 space-y-3">
          <p className="text-sm font-semibold text-blue-800">Nuevo paciente</p>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Nombre completo *</label>
            <input type="text" value={newName} onChange={e => setNewName(e.target.value)}
              placeholder="Nombre del paciente" style={{ color: "black" }}
              className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm bg-white focus:outline-none" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Celular *</label>
            <div className="flex gap-2">
              <select value={countryCode} onChange={e => setCountryCode(e.target.value)}
                style={{ color: "black" }}
                className="rounded-xl border border-gray-300 px-2 py-2.5 text-sm bg-white focus:outline-none shrink-0">
                {COUNTRIES.map(c => (
                  <option key={c.code} value={c.code}>{c.flag} {c.code}</option>
                ))}
              </select>
              <input type="tel" value={newPhone}
                onChange={e => setNewPhone(e.target.value.replace(/\D/g, "").slice(0, selectedCountry.maxDigits))}
                placeholder={`${selectedCountry.maxDigits} digitos`}
                style={{ color: "black" }}
                className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm bg-white focus:outline-none" />
            </div>
          </div>
          {regError && <p className="text-xs text-red-600">{regError}</p>}
          <div className="flex gap-2">
            <button onClick={() => { setRegistering(false); setRegError(""); }}
              className="flex-1 rounded-xl border border-gray-300 py-2.5 text-sm text-gray-600 hover:bg-gray-50 transition">
              Cancelar
            </button>
            <button onClick={handleRegistrar}
              className="flex-1 rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition">
              Registrar y continuar
            </button>
          </div>
        </div>
      )}
      <div className="space-y-2 max-h-60 overflow-y-auto">
        {filtered.map(p => (
          <button key={p.id} onClick={() => onSelect(p)}
            className="w-full text-left rounded-xl border border-gray-200 px-4 py-3 hover:border-blue-300 hover:bg-blue-50 transition">
            <p className="text-sm font-medium text-gray-900">{p.name}</p>
            <p className="text-xs text-gray-400">{p.phone}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
function StepConfirmacion({ branch, service, dateStr, slot, patient, therapists, onConfirm, isPending }: {
  branch: Branch; service: Service; dateStr: string; slot: Slot;
  patient: Patient; therapists: Therapist[]; branchId: string;
  onConfirm: (therapistId: string | null, notes: string) => void;
  isPending: boolean;
}) {
  const [therapistId, setTherapistId] = useState("");
  const [notes, setNotes] = useState("");
  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-gray-50 border border-gray-200 p-4 space-y-2 text-sm">
        <Row label="Paciente"  value={patient.name} />
        <Row label="Sucursal"  value={branch.name} />
        <Row label="Servicio"  value={service.name} />
        <Row label="Fecha"     value={new Date(dateStr + "T12:00:00").toLocaleDateString("es-MX", { weekday:"long", day:"numeric", month:"long" })} />
        <Row label="Horario"   value={`${formatCSTTime(slot.starts_at)} - ${formatCSTTime(slot.ends_at)}`} />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Terapeuta (opcional)</label>
        <select value={therapistId} onChange={e => setTherapistId(e.target.value)}
          style={{ color: "black" }}
          className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm bg-white focus:border-blue-500 focus:outline-none">
          <option value="">Sin asignar</option>
          {therapists.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Notas (opcional)</label>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
          style={{ color: "black" }}
          className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-blue-500 focus:outline-none resize-none" />
      </div>
      <button onClick={() => onConfirm(therapistId || null, notes)}
        disabled={isPending}
        className="w-full rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white hover:bg-blue-700 transition disabled:opacity-60">
        {isPending ? "Agendando..." : "Confirmar cita"}
      </button>
    </div>
  );
}
function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-gray-500 shrink-0">{label}</span>
      <span className="font-medium text-gray-900 text-right">{value}</span>
    </div>
  );
}
const STEP_LABELS = ["Fecha", "Sucursal", "Horario", "Paciente", "Confirmacion"];
export function AppointmentForm({ patients, branches, services, therapists, redirectTo }: {
  patients: Patient[];
  branches: Branch[];
  services: Service[];
  therapists: Therapist[];
  redirectTo?: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [step, setStep] = useState(1);
  const [dateStr, setDateStr]     = useState("");
  const [branchId, setBranchId]   = useState("");
  const [serviceId, setServiceId] = useState("");
  const [slot, setSlot]           = useState<Slot | null>(null);
  const [patient, setPatient]     = useState<Patient | null>(null);
  const [error, setError]         = useState("");
  const branch  = branches.find(b => b.id === branchId) ?? null;
  const service = services.find(s => s.id === serviceId) ?? null;
  function handleConfirm(therapistId: string | null, notes: string) {
    if (!patient || !slot) return;
    setError("");
    startTransition(async () => {
      const res = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patient_id:   patient.id,
          branch_id:    branchId,
          service_id:   serviceId,
          starts_at:    slot.starts_at,
          ends_at:      slot.ends_at,
          therapist_id: therapistId,
          notes:        notes || null,
        }),
      });
      const data = await res.json();
      if (data.error === "SLOT_TAKEN") {
        setError("Este horario acaba de ser tomado. Elige otro.");
        setStep(3);
        return;
      }
      if (!res.ok) {
        setError(data.message ?? "Error al agendar. Intenta de nuevo.");
        return;
      }
      router.push(redirectTo ?? "/master/citas");
      router.refresh();
    });
  }
  return (
    <div className="space-y-6">
      <div className="flex gap-1">
        {STEP_LABELS.map((_, i) => (
          <div key={i} className={["flex-1 h-1 rounded-full transition-colors",
            i + 1 <= step ? "bg-blue-600" : "bg-gray-200"].join(" ")} />
        ))}
      </div>
      <p className="text-xs text-gray-500 font-medium">{STEP_LABELS[step - 1]}</p>
      {step === 1 && <StepFecha onSelect={(d) => { setDateStr(d); setStep(2); }} />}
      {step === 2 && (
        <>
          <StepSucursalServicio branches={branches} services={services}
            onSelect={(b, s) => { setBranchId(b); setServiceId(s); setStep(3); }} />
          <button onClick={() => setStep(1)} className="w-full text-sm text-gray-400 hover:text-gray-600 py-2">&#8592; Cambiar fecha</button>
        </>
      )}
      {step === 3 && (
        <>
          <StepHorario branchId={branchId} serviceId={serviceId} dateStr={dateStr}
            onSelect={(s) => { setSlot(s); setStep(4); }} />
          <button onClick={() => setStep(2)} className="w-full text-sm text-gray-400 hover:text-gray-600 py-2">&#8592; Cambiar sucursal</button>
        </>
      )}
      {step === 4 && (
        <>
          <StepPaciente patients={patients} onSelect={(p) => { setPatient(p); setStep(5); }} />
          <button onClick={() => setStep(3)} className="w-full text-sm text-gray-400 hover:text-gray-600 py-2">&#8592; Cambiar horario</button>
        </>
      )}
      {step === 5 && branch && service && slot && patient && (
        <>
          <StepConfirmacion
            branch={branch} service={service} dateStr={dateStr}
            slot={slot} patient={patient} therapists={therapists}
            branchId={branchId}
            onConfirm={handleConfirm} isPending={isPending}
          />
          {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-4 py-3">{error}</p>}
          <button onClick={() => setStep(4)} className="w-full text-sm text-gray-400 hover:text-gray-600 py-2">&#8592; Cambiar paciente</button>
        </>
      )}
    </div>
  );
}
