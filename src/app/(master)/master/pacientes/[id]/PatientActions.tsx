"use client";

import { useState, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";

interface Branch { id: string; name: string }
interface Patient {
  id: string;
  name: string;
  phone: string;
  birth_date: string | null;
  address: string | null;
  sex: string | null;
  city: string | null;
  email: string | null;
  consultation_reason: string | null;
  branch_id: string | null;
  is_active: boolean;
}

const SEX_OPTIONS = [
  { value: "M", label: "Masculino" },
  { value: "F", label: "Femenino" },
  { value: "OTRO", label: "Prefiero no decir" },
];

// ── EditForm ───────────────────────────────────────────────────
function EditForm({ patient, branches, onCancel }: {
  patient: Patient;
  branches: Branch[];
  onCancel: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const submitting = useRef(false);
  const [error, setError] = useState("");

  const [name, setName] = useState(patient.name);
  const [phone, setPhone] = useState(patient.phone);
  const [birthDate, setBirthDate] = useState(patient.birth_date ?? "");
  const [address, setAddress] = useState(patient.address ?? "");
  const [sex, setSex] = useState(patient.sex ?? "");
  const [city, setCity] = useState(patient.city ?? "");
  const [email, setEmail] = useState(patient.email ?? "");
  const [notes, setNotes] = useState(patient.consultation_reason ?? "");
  const [branchId, setBranchId] = useState(patient.branch_id ?? "");
  const [isActive, setIsActive] = useState(patient.is_active);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting.current) return;
    submitting.current = true;
    setError("");

    startTransition(async () => {
      try {
        const res = await fetch(`/api/patients/${patient.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.trim(),
            phone: phone.replace(/\D/g, ""),
            birth_date: birthDate || null,
            address: address.trim() || null,
            sex: sex || null,
            city: city.trim() || null,
            email: email.trim() || null,
            consultation_reason: notes.trim() || null,
            branch_id: branchId || null,
            is_active: isActive,
          }),
        });
        const data = await res.json();
        if (!res.ok) { setError(data.message ?? "Error al guardar"); return; }
        router.refresh();
        onCancel();
      } finally {
        submitting.current = false;
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 pt-2">
      <div>
        <label className={lc}>Nombre completo</label>
        <input required value={name} onChange={(e) => setName(e.target.value)} className={ic} />
      </div>
      <div>
        <label className={lc}>Teléfono celular</label>
        <input required type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
          placeholder="10 dígitos" maxLength={10} className={ic} />
        <p className="text-xs text-gray-400 mt-1">
          Cambiar el teléfono actualiza también las credenciales de acceso del paciente.
        </p>
      </div>
      <div>
        <label className={lc}>Fecha de nacimiento</label>
        <input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)}
          max={new Date().toISOString().slice(0, 10)} className={ic} />
      </div>
      <div>
        <label className={lc}>Sexo</label>
        <select value={sex} onChange={(e) => setSex(e.target.value)} className={sc}>
          <option value="">Sin especificar</option>
          {SEX_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>
      <div>
        <label className={lc}>Dirección</label>
        <input value={address} onChange={(e) => setAddress(e.target.value)} className={ic} />
      </div>
      <div>
        <label className={lc}>Ciudad</label>
        <input value={city} onChange={(e) => setCity(e.target.value)} className={ic} />
      </div>
      <div>
        <label className={lc}>Correo electrónico</label>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
          placeholder="correo@ejemplo.com" className={ic} />
      </div>
      <div>
        <label className={lc}>Sucursal</label>
        <select value={branchId} onChange={(e) => setBranchId(e.target.value)} className={sc}>
          <option value="">Sin asignar</option>
          {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      </div>
      <div>
        <label className={lc}>Notas / Motivo de consulta</label>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
          rows={3} className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 resize-none" />
      </div>
      <div className="flex items-center gap-3">
        <input type="checkbox" id="is_active_edit" checked={isActive}
          onChange={(e) => setIsActive(e.target.checked)}
          className="h-4 w-4 rounded border-gray-300 text-blue-600" />
        <label htmlFor="is_active_edit" className="text-sm text-gray-700 cursor-pointer">
          Cuenta activa
        </label>
      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-4 py-3">{error}</p>}

      <div className="flex gap-3 pt-1">
        <button type="button" onClick={onCancel}
          className="flex-1 rounded-xl border border-gray-300 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition">
          Cancelar
        </button>
        <button type="submit" disabled={isPending}
          className="flex-1 rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white hover:bg-blue-700 transition disabled:opacity-60">
          {isPending ? "Guardando…" : "Guardar cambios"}
        </button>
      </div>
    </form>
  );
}

const lc = "block text-sm font-medium text-gray-700 mb-1";
const ic = "w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100";
const sc = "w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100";

// ── DeleteButton ───────────────────────────────────────────────
function DeleteButton({ patientId, patientName }: { patientId: string; patientName: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");

  function handleDelete() {
    startTransition(async () => {
      const res = await fetch(`/api/patients/${patientId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        setError(data.message ?? "Error al eliminar");
        setConfirming(false);
        return;
      }
      router.push("/master/pacientes");
    });
  }

  if (confirming) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-5 space-y-3">
        <p className="text-sm font-medium text-red-800">
          ¿Eliminar a <span className="font-bold">{patientName}</span>?
        </p>
        <p className="text-xs text-red-600">
          El paciente dejará de aparecer en la app. Su historial de citas se conserva.
        </p>
        {error && <p className="text-xs text-red-600">{error}</p>}
        <div className="flex gap-2">
          <button type="button" onClick={() => setConfirming(false)}
            className="flex-1 rounded-lg border border-gray-300 py-2 text-sm text-gray-700 hover:bg-white transition">
            Cancelar
          </button>
          <button type="button" onClick={handleDelete} disabled={isPending}
            className="flex-1 rounded-lg bg-red-600 py-2 text-sm font-semibold text-white hover:bg-red-700 transition disabled:opacity-60">
            {isPending ? "Eliminando…" : "Sí, eliminar"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <button type="button" onClick={() => setConfirming(true)}
      className="w-full rounded-xl border border-red-200 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 transition">
      Eliminar paciente
    </button>
  );
}

// ── Componente raíz ────────────────────────────────────────────
export function PatientActions({ patient, branches }: { patient: Patient; branches: Branch[] }) {
  const [editing, setEditing] = useState(false);

  return (
    <div className="space-y-3">
      {editing ? (
        <div className="rounded-2xl bg-white border border-blue-200 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Editar paciente</h2>
          <EditForm patient={patient} branches={branches} onCancel={() => setEditing(false)} />
        </div>
      ) : (
        <button type="button" onClick={() => setEditing(true)}
          className="w-full rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition">
          Editar paciente
        </button>
      )}
      <DeleteButton patientId={patient.id} patientName={patient.name} />
    </div>
  );
}
