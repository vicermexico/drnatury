"use client";

import { useState, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";

interface Branch { id: string; name: string }

const SEX_OPTIONS = [
  { value: "M", label: "Masculino" },
  { value: "F", label: "Femenino" },
  { value: "OTRO", label: "Prefiero no decir" },
];

const COUNTRIES = [
  { code: "+52", flag: "🇲🇽", name: "México", maxDigits: 10 },
  { code: "+1",  flag: "🇺🇸", name: "USA/Canadá", maxDigits: 10 },
  { code: "+34", flag: "🇪🇸", name: "España", maxDigits: 9 },
  { code: "+57", flag: "🇨🇴", name: "Colombia", maxDigits: 10 },
  { code: "+54", flag: "🇦🇷", name: "Argentina", maxDigits: 10 },
  { code: "+56", flag: "🇨🇱", name: "Chile", maxDigits: 9 },
  { code: "+51", flag: "🇵🇪", name: "Perú", maxDigits: 9 },
  { code: "+58", flag: "🇻🇪", name: "Venezuela", maxDigits: 10 },
  { code: "+502", flag: "🇬🇹", name: "Guatemala", maxDigits: 8 },
  { code: "+503", flag: "🇸🇻", name: "El Salvador", maxDigits: 8 },
  { code: "+504", flag: "🇭🇳", name: "Honduras", maxDigits: 8 },
  { code: "+505", flag: "🇳🇮", name: "Nicaragua", maxDigits: 8 },
  { code: "+506", flag: "🇨🇷", name: "Costa Rica", maxDigits: 8 },
  { code: "+507", flag: "🇵🇦", name: "Panamá", maxDigits: 8 },
];

export function PatientForm({ branches }: { branches: Branch[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const submitting = useRef(false);
  const [error, setError] = useState("");
  const [countryCode, setCountryCode] = useState("+52");

  const selectedCountry = COUNTRIES.find(c => c.code === countryCode) ?? COUNTRIES[0];

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [address, setAddress] = useState("");
  const [sex, setSex] = useState("");
  const [city, setCity] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [branchId, setBranchId] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting.current) return;
    submitting.current = true;
    setError("");

    const fullPhone = countryCode.replace("+", "") + phone;

    startTransition(async () => {
      try {
        const res = await fetch("/api/patients", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            phone: fullPhone,
            birth_date: birthDate || undefined,
            address: address || undefined,
            sex: sex || undefined,
            city: city || undefined,
            email: email || undefined,
            consultation_reason: notes || undefined,
            branch_id: branchId || undefined,
          }),
        });
        const data = await res.json();
        if (!res.ok) { setError(data.message ?? "Error al registrar"); return; }
        router.push(`/master/pacientes/${data.id}`);
      } finally {
        submitting.current = false;
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid gap-4">
        <div>
          <label className={lc}>Nombre completo *</label>
          <input required value={name} onChange={(e) => setName(e.target.value)}
            placeholder="Nombre del paciente" style={{ color: "black" }} className={ic} />
        </div>

        <div>
          <label className={lc}>Teléfono celular *</label>
          <div className="flex gap-2">
            <select
              value={countryCode}
              onChange={e => setCountryCode(e.target.value)}
              style={{ color: "black" }}
              className="rounded-xl border border-gray-300 px-3 py-3 text-sm bg-white focus:border-blue-500 focus:outline-none shrink-0"
            >
              {COUNTRIES.map(c => (
                <option key={c.code} value={c.code}>{c.flag} {c.code}</option>
              ))}
            </select>
            <input
              required
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, selectedCountry.maxDigits))}
              placeholder={`${selectedCountry.maxDigits} dígitos`}
              style={{ color: "black" }}
              className={ic}
            />
          </div>
          <p className="text-xs text-gray-400 mt-1">{selectedCountry.flag} {selectedCountry.name} — {countryCode} + {phone || "..."}</p>
        </div>

        <div>
          <label className={lc}>Fecha de nacimiento</label>
          <input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)}
            max={new Date().toISOString().slice(0, 10)} style={{ color: "black" }} className={ic} />
        </div>
        <div>
          <label className={lc}>Sexo</label>
          <select value={sex} onChange={(e) => setSex(e.target.value)} style={{ color: "black" }} className={sc}>
            <option value="">Sin especificar</option>
            {SEX_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div>
          <label className={lc}>Dirección</label>
          <input value={address} onChange={(e) => setAddress(e.target.value)}
            placeholder="Calle, colonia, ciudad" style={{ color: "black" }} className={ic} />
        </div>
        <div>
          <label className={lc}>Ciudad</label>
          <input value={city} onChange={(e) => setCity(e.target.value)}
            placeholder="Monterrey" style={{ color: "black" }} className={ic} />
        </div>
        <div>
          <label className={lc}>Correo electrónico</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
            placeholder="correo@ejemplo.com" style={{ color: "black" }} className={ic} />
        </div>
        <div>
          <label className={lc}>Sucursal *</label>
          <select required value={branchId} onChange={(e) => setBranchId(e.target.value)} style={{ color: "black" }} className={sc}>
            <option value="">Selecciona una sucursal</option>
            {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
        <div>
          <label className={lc}>Notas / Motivo de consulta</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
            rows={3} placeholder="Observaciones iniciales..."
            style={{ color: "black" }}
            className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 resize-none" />
        </div>
      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-4 py-3">{error}</p>}

      <button type="submit" disabled={isPending}
        className="w-full rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white hover:bg-blue-700 transition disabled:opacity-60">
        {isPending ? "Registrando..." : "Registrar paciente"}
      </button>
    </form>
  );
}

const lc = "block text-sm font-medium text-gray-700 mb-1";
const ic = "w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100";
const sc = "w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100";