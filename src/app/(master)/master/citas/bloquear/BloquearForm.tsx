"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

interface Branch { id: string; name: string; }
interface Slot { start: string; end: string; }

export function BloquearForm({ branches }: { branches: Branch[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [step, setStep] = useState<"calendar" | "hours">("calendar");
  const [selectedDate, setSelectedDate] = useState("");
  const [branchId, setBranchId] = useState<string>("global");
  const [allDay, setAllDay] = useState(false);
  const [slots, setSlots] = useState<Slot[]>([{ start: "09:00", end: "17:00" }]);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  function addSlot() {
    setSlots(prev => [...prev, { start: "09:00", end: "17:00" }]);
  }

  function updateSlot(i: number, field: "start" | "end", value: string) {
    setSlots(prev => prev.map((s, idx) => idx === i ? { ...s, [field]: value } : s));
  }

  function removeSlot(i: number) {
    setSlots(prev => prev.filter((_, idx) => idx !== i));
  }

  function handleDateSelect(date: string) {
    setSelectedDate(date);
    setStep("hours");
  }

  function handleBloquear() {
    if (!selectedDate) { setError("Selecciona una fecha"); return; }
    setError("");
    startTransition(async () => {
      const res = await fetch("/api/blocked-slots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branch_id: branchId === "global" ? null : branchId,
          date: selectedDate,
          all_day: allDay,
          slots: allDay ? [] : slots,
          reason: reason.trim() || null,
        }),
      });
      if (!res.ok) { setError("Error al bloquear"); return; }
      setSuccess(`Bloqueado: ${selectedDate}`);
      setStep("calendar");
      setSelectedDate("");
      setSlots([{ start: "09:00", end: "17:00" }]);
      setReason("");
      setTimeout(() => setSuccess(""), 3000);
      router.refresh();
    });
  }

  // Generar calendario del mes actual
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthName = today.toLocaleDateString("es-MX", { month: "long", year: "numeric" });

  return (
    <div className="space-y-5">
      {/* Sucursal */}
      <div className="rounded-2xl bg-white border border-gray-200 p-5 space-y-3">
        <label className="block text-sm font-semibold text-gray-700">Aplicar a</label>
        <select
          value={branchId}
          onChange={e => setBranchId(e.target.value)}
          style={{ color: "black" }}
          className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm bg-white focus:border-blue-500 focus:outline-none"
        >
          <option value="global">Todas las sucursales</option>
          {branches.map(b => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
      </div>

      {/* Calendario */}
      <div className="rounded-2xl bg-white border border-gray-200 p-5 space-y-3">
        <p className="text-sm font-semibold text-gray-700 capitalize">{monthName}</p>
        <div className="grid grid-cols-7 gap-1 text-center">
          {["Do","Lu","Ma","Mi","Ju","Vi","Sa"].map(d => (
            <p key={d} className="text-xs text-gray-400 font-medium py-1">{d}</p>
          ))}
          {Array.from({ length: firstDay }).map((_, i) => <div key={`e${i}`} />)}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
            const isSelected = selectedDate === dateStr;
            const isPast = new Date(dateStr) < new Date(today.toLocaleDateString("en-CA"));
            return (
              <button
                key={day}
                onClick={() => !isPast && handleDateSelect(dateStr)}
                disabled={isPast}
                className={[
                  "rounded-xl py-2 text-sm font-medium transition",
                  isSelected ? "bg-red-600 text-white" :
                  isPast ? "text-gray-300 cursor-not-allowed" :
                  "hover:bg-gray-100 text-gray-700"
                ].join(" ")}
              >
                {day}
              </button>
            );
          })}
        </div>
      </div>

      {/* Opciones de hora */}
      {step === "hours" && selectedDate && (
        <div className="rounded-2xl bg-white border border-red-200 p-5 space-y-4">
          <p className="text-sm font-semibold text-gray-800">
            Bloquear: {new Date(selectedDate + "T12:00:00").toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" })}
          </p>

          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={allDay} onChange={e => setAllDay(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-red-600" />
            <span className="text-sm font-medium text-gray-700">Todo el dia</span>
            {allDay && (
              <button onClick={handleBloquear} disabled={isPending}
                className="ml-auto rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 transition disabled:opacity-60">
                {isPending ? "Bloqueando..." : "Bloquear"}
              </button>
            )}
          </label>

          {!allDay && (
            <div className="space-y-3">
              {slots.map((slot, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 w-6">De</span>
                  <input type="time" value={slot.start}
                    onChange={e => updateSlot(i, "start", e.target.value)}
                    style={{ color: "black" }}
                    className="rounded-xl border border-gray-300 px-3 py-2 text-sm bg-white focus:outline-none" />
                  <span className="text-xs text-gray-500">Hasta</span>
                  <input type="time" value={slot.end}
                    onChange={e => updateSlot(i, "end", e.target.value)}
                    style={{ color: "black" }}
                    className="rounded-xl border border-gray-300 px-3 py-2 text-sm bg-white focus:outline-none" />
                  {slots.length > 1 && (
                    <button onClick={() => removeSlot(i)}
                      className="text-red-400 hover:text-red-600 text-lg leading-none">×</button>
                  )}
                </div>
              ))}

              <button onClick={addSlot}
                className="text-sm text-blue-600 hover:text-blue-800 font-medium">
                + Nueva hora
              </button>

              <div>
                <input type="text" value={reason} onChange={e => setReason(e.target.value)}
                  placeholder="Motivo (opcional)"
                  style={{ color: "black" }}
                  className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm bg-white focus:outline-none" />
              </div>

              <button onClick={handleBloquear} disabled={isPending}
                className="w-full rounded-xl bg-red-600 py-3 text-sm font-semibold text-white hover:bg-red-700 transition disabled:opacity-60">
                {isPending ? "Bloqueando..." : "Bloquear"}
              </button>
            </div>
          )}
        </div>
      )}

      {error   && <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3">{error}</p>}
      {success && <p className="text-sm text-green-700 bg-green-50 rounded-xl px-4 py-3">✓ {success}</p>}
    </div>
  );
}
