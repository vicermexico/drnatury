"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatCSTTime } from "@/lib/appointments/availability";

// ── Tipos ──────────────────────────────────────────────────
interface ServiceData {
  id: string;
  name: string;
  duration_minutes: number;
}

interface BranchServiceItem {
  price: number;
  // Supabase puede devolver el join como objeto o array según la versión
  services: ServiceData | ServiceData[] | null;
}

interface Branch {
  id: string;
  name: string;
  address: string;
  schedule: Record<string, {
    open: boolean;
    morning_start?: string;
    morning_end?: string;
    afternoon_start?: string;
    afternoon_end?: string;
  }> | null;
  branch_services: BranchServiceItem[];
}

interface Slot {
  starts_at: string;
  ends_at: string;
}

// Servicio aplanado para usar dentro del componente (incluye precio)
interface FlatService extends ServiceData {
  price: number;
}

interface Props {
  branches: Branch[];
}

type Step = 1 | 2 | 3 | 4;

// ── Helpers ────────────────────────────────────────────────
const DAY_KEYS = ["sunday","monday","tuesday","wednesday","thursday","friday","saturday"] as const;

/** Normaliza el join de Supabase (objeto o array) a un solo ServiceData */
function extractService(bs: BranchServiceItem): ServiceData | null {
  if (!bs.services) return null;
  return Array.isArray(bs.services) ? (bs.services[0] ?? null) : bs.services;
}

/** Obtiene los servicios disponibles de una sucursal en formato aplanado */
function getBranchServices(branch: Branch): FlatService[] {
  return branch.branch_services
    .map((bs) => {
      const svc = extractService(bs);
      return svc ? { ...svc, price: bs.price } : null;
    })
    .filter((s): s is FlatService => s !== null);
}

function isBranchOpenOnDate(branch: Branch, dateStr: string): boolean {
  if (!branch.schedule) return false;
  const [y, mo, d] = dateStr.split("-").map(Number);
  const dayIdx = new Date(Date.UTC(y, mo - 1, d, 12, 0)).getUTCDay();
  const dayKey = DAY_KEYS[dayIdx];
  return !!(branch.schedule[dayKey]?.open);
}

function generateCalendarDays(year: number, month: number): string[] {
  const days: string[] = [];
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  for (let d = 1; d <= daysInMonth; d++) {
    days.push(
      `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`
    );
  }
  return days;
}

function todayCST(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Monterrey" });
}

// ── Step 1: Sucursal + Servicio ────────────────────────────
function Step1({
  branches,
  branchId,
  serviceId,
  onSelect,
}: {
  branches: Branch[];
  branchId: string;
  serviceId: string;
  onSelect: (branchId: string, serviceId: string) => void;
}) {
  const [selBranch, setSelBranch] = useState(branchId);
  const [selService, setSelService] = useState(serviceId);

  const availableServices = selBranch
    ? getBranchServices(branches.find((b) => b.id === selBranch)!)
    : [];

  if (branches.length === 0) {
    return (
      <p className="text-sm text-gray-500 text-center py-8">
        No hay sucursales disponibles en este momento.
      </p>
    );
  }

  return (
    <div className="space-y-5">
      {/* Sucursal */}
      <div>
        <p className="text-sm font-medium text-gray-700 mb-2">¿En qué sucursal?</p>
        <div className="space-y-2">
          {branches.map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => { setSelBranch(b.id); setSelService(""); }}
              className={card(selBranch === b.id)}
            >
              <p className="text-sm font-semibold">{b.name}</p>
              <p className="text-xs text-gray-600 mt-0.5">{b.address}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Servicios de la sucursal seleccionada */}
      {selBranch && (
        <div>
          <p className="text-sm font-medium text-gray-700 mb-2">¿Qué servicio?</p>
          {availableServices.length === 0 ? (
            <p className="text-sm text-gray-400 bg-gray-50 rounded-xl px-4 py-3">
              Esta sucursal aún no tiene servicios configurados.
            </p>
          ) : (
            <div className="space-y-2">
              {availableServices.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSelService(s.id)}
                  className={card(selService === s.id)}
                >
                  <p className="text-sm font-semibold">{s.name}</p>
                  <p className="text-xs text-gray-600 mt-0.5">
                    {s.duration_minutes} min
                    {s.price > 0 && ` · $${s.price.toLocaleString("es-MX")}`}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <button
        disabled={!selBranch || !selService}
        onClick={() => onSelect(selBranch, selService)}
        className={btnPrimary}
      >
        Continuar
      </button>
    </div>
  );
}

// ── Step 2: Fecha ──────────────────────────────────────────
function Step2({
  branch,
  onSelect,
}: {
  branch: Branch;
  onSelect: (date: string) => void;
}) {
  const today = todayCST();
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth());
  const days = generateCalendarDays(year, month);

  const firstDay = new Date(year, month, 1).getDay();
  const maxDate = new Date();
  maxDate.setDate(maxDate.getDate() + 30);
  const maxStr = maxDate.toLocaleDateString("en-CA", { timeZone: "America/Monterrey" });

  const monthName = new Date(year, month, 1).toLocaleDateString("es-MX", { month: "long", year: "numeric" });

  const hasAnyOpenDay = !branch.schedule ||
    Object.values(branch.schedule).some((d) => d.open);

  if (!hasAnyOpenDay) {
    return (
      <p className="text-sm text-gray-500 text-center py-8">
        Esta sucursal no tiene horarios configurados todavía.
      </p>
    );
  }

  function prevMonth() {
    if (month === 0) { setMonth(11); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  }
  function nextMonth() {
    if (month === 11) { setMonth(0); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button onClick={prevMonth} className="p-2 text-gray-500 hover:text-gray-900">←</button>
        <p className="text-sm font-semibold capitalize">{monthName}</p>
        <button onClick={nextMonth} className="p-2 text-gray-500 hover:text-gray-900">→</button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center">
        {["Do","Lu","Ma","Mi","Ju","Vi","Sa"].map((d) => (
          <p key={d} className="text-[11px] text-gray-400 font-medium pb-1">{d}</p>
        ))}
        {Array(firstDay).fill(null).map((_, i) => <div key={`e${i}`} />)}
        {days.map((dateStr) => {
          const isPast = dateStr < today;
          const isFuture = dateStr > maxStr;
          const closed = !isBranchOpenOnDate(branch, dateStr);
          const disabled = isPast || isFuture || closed;
          const dayNum = parseInt(dateStr.split("-")[2], 10);
          const isToday = dateStr === today;
          return (
            <button
              key={dateStr}
              disabled={disabled}
              onClick={() => onSelect(dateStr)}
              className={[
                "rounded-lg py-2 text-sm transition",
                disabled ? "text-gray-300 cursor-default" : "text-gray-900 hover:bg-blue-50 hover:text-blue-700 font-medium",
                isToday && !disabled ? "ring-2 ring-blue-500" : "",
              ].join(" ")}
            >
              {dayNum}
            </button>
          );
        })}
      </div>

      <p className="text-xs text-gray-400 text-center">
        Solo días en que la sucursal está abierta están disponibles.
      </p>
    </div>
  );
}

// ── Step 3: Horario ────────────────────────────────────────
function Step3({
  branchId,
  serviceId,
  dateStr,
  onSelect,
}: {
  branchId: string;
  serviceId: string;
  dateStr: string;
  onSelect: (slot: Slot) => void;
}) {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    setSlots([]);

    fetch(
      `/api/appointments/availability?branch_id=${branchId}&service_id=${serviceId}&date=${dateStr}`
    )
      .then(async (res) => {
        if (!res.ok) { if (!cancelled) setError(true); return; }
        const data = await res.json() as unknown;
        if (!cancelled) setSlots(Array.isArray(data) ? (data as Slot[]) : []);
      })
      .catch(() => { if (!cancelled) setError(true); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [branchId, serviceId, dateStr]);

  if (loading) {
    return <p className="text-sm text-gray-400 text-center py-8">Cargando horarios…</p>;
  }
  if (error) {
    return (
      <p className="text-sm text-red-500 text-center py-8">
        Error cargando horarios. Intenta de nuevo.
      </p>
    );
  }
  if (slots.length === 0) {
    return (
      <p className="text-sm text-gray-500 text-center py-8">
        No hay horarios disponibles para este día.
        <br />Elige otra fecha.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-2">
      {slots.map((slot) => (
        <button
          key={slot.starts_at}
          onClick={() => onSelect(slot)}
          className="rounded-xl border border-gray-200 py-3 text-sm font-medium text-gray-700 hover:border-blue-400 hover:bg-blue-50 hover:text-blue-700 transition"
        >
          {formatCSTTime(slot.starts_at)}
        </button>
      ))}
    </div>
  );
}

// ── Step 4: Confirmación ───────────────────────────────────
function Step4({
  branch,
  service,
  dateStr,
  slot,
  onConfirm,
  isPending,
}: {
  branch: Branch;
  service: FlatService;
  dateStr: string;
  slot: Slot;
  onConfirm: () => void;
  isPending: boolean;
}) {
  const date = new Date(`${dateStr}T12:00:00`).toLocaleDateString("es-MX", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });

  return (
    <div className="space-y-5">
      <div className="rounded-2xl bg-gray-50 border border-gray-200 p-5 space-y-3">
        <Row label="Sucursal" value={branch.name} />
        <Row label="Servicio" value={`${service.name} (${service.duration_minutes} min)`} />
        {service.price > 0 && (
          <Row label="Precio" value={`$${service.price.toLocaleString("es-MX")}`} />
        )}
        <Row label="Fecha" value={date} />
        <Row label="Hora" value={formatCSTTime(slot.starts_at)} />
      </div>
      <p className="text-xs text-gray-500 text-center">
        Al confirmar recibirás un mensaje de WhatsApp con los detalles.
      </p>
      <button onClick={onConfirm} disabled={isPending} className={btnPrimary}>
        {isPending ? "Agendando…" : "Confirmar cita"}
      </button>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-gray-500">{label}</span>
      <span className="font-medium text-gray-900 text-right max-w-[60%]">{value}</span>
    </div>
  );
}

// ── Componente principal ───────────────────────────────────
export function BookingFlow({ branches }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [step, setStep] = useState<Step>(1);
  const [branchId, setBranchId] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [dateStr, setDateStr] = useState("");
  const [slot, setSlot] = useState<Slot | null>(null);
  const [error, setError] = useState("");

  const branch = branches.find((b) => b.id === branchId);
  const service = branch
    ? getBranchServices(branch).find((s) => s.id === serviceId) ?? null
    : null;

  const STEP_LABELS = ["Sucursal y servicio", "Fecha", "Horario", "Confirmación"];

  function handleConfirm() {
    if (!slot) return;
    setError("");
    startTransition(async () => {
      const res = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branch_id: branchId,
          service_id: serviceId,
          starts_at: slot.starts_at,
          ends_at: slot.ends_at,
        }),
      });
      const data = await res.json() as { error?: string; message?: string };

      if (res.status === 409) {
        setError("Este horario acaba de ser tomado. Elige otro.");
        setStep(3);
        return;
      }
      if (!res.ok) {
        const msg = data.message ?? "Error al agendar. Intenta de nuevo.";
        const extra = data.error === "NO_THERAPIST"
          ? " — No hay terapeuta disponible en esta sucursal."
          : data.error ? ` [${data.error}]` : "";
        setError(msg + extra);
        return;
      }

      router.push("/paciente/citas?booked=1");
    });
  }

  return (
    <div className="space-y-6">
      {/* Barra de progreso */}
      <div className="flex gap-1">
        {STEP_LABELS.map((_, i) => (
          <div
            key={i}
            className={[
              "flex-1 h-1 rounded-full transition-colors",
              i + 1 <= step ? "bg-blue-600" : "bg-gray-200",
            ].join(" ")}
          />
        ))}
      </div>
      <p className="text-xs text-gray-500 font-medium">{STEP_LABELS[step - 1]}</p>

      {step === 1 && (
        <Step1
          branches={branches}
          branchId={branchId}
          serviceId={serviceId}
          onSelect={(b, s) => { setBranchId(b); setServiceId(s); setStep(2); }}
        />
      )}

      {step === 2 && branch && (
        <>
          <Step2 branch={branch} onSelect={(d) => { setDateStr(d); setStep(3); }} />
          <BackButton onClick={() => setStep(1)} />
        </>
      )}

      {step === 3 && (
        <>
          <Step3
            branchId={branchId}
            serviceId={serviceId}
            dateStr={dateStr}
            onSelect={(s) => { setSlot(s); setStep(4); }}
          />
          <BackButton onClick={() => { setDateStr(""); setStep(2); }} />
        </>
      )}

      {step === 4 && branch && service && slot && (
        <>
          <Step4
            branch={branch}
            service={service}
            dateStr={dateStr}
            slot={slot}
            onConfirm={handleConfirm}
            isPending={isPending}
          />
          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-4 py-3">{error}</p>
          )}
          <BackButton onClick={() => { setSlot(null); setStep(3); }} />
        </>
      )}
    </div>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full text-sm text-gray-400 hover:text-gray-600 py-2 transition"
    >
      ← Volver
    </button>
  );
}

const card = (active: boolean) =>
  [
    "w-full text-left rounded-xl border-2 px-4 py-3 transition text-gray-900",
    active ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-gray-300",
  ].join(" ");

const btnPrimary =
  "w-full rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white hover:bg-blue-700 transition disabled:opacity-60";
