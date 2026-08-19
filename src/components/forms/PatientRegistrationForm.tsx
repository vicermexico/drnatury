"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

interface Branch {
  id: string;
  name: string;
  address: string;
}

interface Props {
  branches: Branch[];
  defaultPhone?: string;
}

const COUNTRIES = [
  { code: "+52", flag: "🇲🇽", name: "México", maxDigits: 10 },
  { code: "+1",  flag: "🇺🇸", name: "USA/Canadá", maxDigits: 10 },
  { code: "+34", flag: "🇪🇸", name: "España", maxDigits: 9 },
  { code: "+57", flag: "🇨🇴", name: "Colombia", maxDigits: 10 },
  { code: "+54", flag: "🇦🇷", name: "Argentina", maxDigits: 10 },
  { code: "+56", flag: "🇨🇱", name: "Chile", maxDigits: 9 },
  { code: "+51", flag: "🇵🇪", name: "Perú", maxDigits: 9 },
  { code: "+58", flag: "🇻🇪", name: "Venezuela", maxDigits: 10 },
  { code: "+502",flag: "🇬🇹", name: "Guatemala", maxDigits: 8 },
  { code: "+503",flag: "🇸🇻", name: "El Salvador", maxDigits: 8 },
  { code: "+504",flag: "🇭🇳", name: "Honduras", maxDigits: 8 },
  { code: "+505",flag: "🇳🇮", name: "Nicaragua", maxDigits: 8 },
  { code: "+506",flag: "🇨🇷", name: "Costa Rica", maxDigits: 8 },
  { code: "+507",flag: "🇵🇦", name: "Panamá", maxDigits: 8 },
];

export function PatientRegistrationForm({ branches, defaultPhone = "" }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [countryCode, setCountryCode] = useState("+52");

  const selectedCountry = COUNTRIES.find(c => c.code === countryCode) ?? COUNTRIES[0];

  const [form, setForm] = useState({
    phone: defaultPhone,
    name: "",
    address: "",
    age: "",
    sex: "",
    city: "",
    branch_id: "",
    email: "",
    consultation_reason: "",
  });

  function set(field: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!accepted) {
      setError("Debes aceptar el Aviso de Privacidad para continuar");
      return;
    }
    setError("");

    // Combinar lada + numero
    const fullPhone = countryCode.replace("+", "") + form.phone;

    startTransition(async () => {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, phone: fullPhone }),
      });
      const data = await res.json();

      if (res.status === 409) {
        setError("Este número ya está registrado. Inicia sesión.");
        return;
      }
      if (!res.ok) {
        setError(data.message ?? "Error al crear la cuenta. Intenta de nuevo.");
        return;
      }

      router.push(data.nextPath);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Teléfono con selector de país */}
      <Field label="Número de celular *">
        <div className="flex gap-2">
          <select
            value={countryCode}
            onChange={e => setCountryCode(e.target.value)}
            style={{ color: "black" }}
            className="rounded-xl border border-gray-300 px-3 py-3 text-sm bg-white focus:border-blue-500 focus:outline-none shrink-0"
          >
            {COUNTRIES.map(c => (
              <option key={c.code} value={c.code}>
                {c.flag} {c.code}
              </option>
            ))}
          </select>
          <input
            type="tel"
            inputMode="numeric"
            required
            value={form.phone}
            onChange={(e) => set("phone", e.target.value.replace(/\D/g, "").slice(0, selectedCountry.maxDigits))}
            placeholder={`${selectedCountry.maxDigits} dígitos`}
            style={{ color: "black" }}
            className={inputClass}
          />
        </div>
        <p className="text-xs text-gray-400 mt-1">{selectedCountry.flag} {selectedCountry.name} — {countryCode} + {form.phone || "..."}</p>
      </Field>

      {/* Nombre */}
      <Field label="Nombre completo *">
        <input
          type="text"
          required
          value={form.name}
          onChange={(e) => set("name", e.target.value)}
          style={{ color: "black" }}
          className={inputClass}
        />
      </Field>

      {/* Dirección */}
      <Field label="Dirección *">
        <input
          type="text"
          required
          value={form.address}
          onChange={(e) => set("address", e.target.value)}
          style={{ color: "black" }}
          className={inputClass}
        />
      </Field>

      {/* Edad y Sexo */}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Edad *">
          <input
            type="number"
            required
            min={1}
            max={120}
            value={form.age}
            onChange={(e) => set("age", e.target.value)}
            style={{ color: "black" }}
            className={inputClass}
          />
        </Field>
        <Field label="Sexo *">
          <select
            required
            value={form.sex}
            onChange={(e) => set("sex", e.target.value)}
            style={{ color: "black" }}
            className={inputClass}
          >
            <option value="">--</option>
            <option value="M">Masculino</option>
            <option value="F">Femenino</option>
            <option value="OTRO">Otro</option>
          </select>
        </Field>
      </div>

      {/* Ciudad */}
      <Field label="Ciudad *">
        <input
          type="text"
          required
          value={form.city}
          onChange={(e) => set("city", e.target.value)}
          style={{ color: "black" }}
          className={inputClass}
        />
      </Field>

      {/* Sucursal */}
      <Field label="Sucursal *">
        <select
          required
          value={form.branch_id}
          onChange={(e) => set("branch_id", e.target.value)}
          style={{ color: "black" }}
          className={inputClass}
        >
          <option value="">Selecciona una sucursal</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name} — {b.address}
            </option>
          ))}
        </select>
      </Field>

      {/* Correo (opcional) */}
      <Field label="Correo electrónico">
        <input
          type="email"
          value={form.email}
          onChange={(e) => set("email", e.target.value)}
          style={{ color: "black" }}
          className={inputClass}
          placeholder="Opcional"
        />
      </Field>

      {/* Motivo de consulta (opcional) */}
      <Field label="Motivo de consulta">
        <textarea
          value={form.consultation_reason}
          onChange={(e) => set("consultation_reason", e.target.value)}
          rows={3}
          style={{ color: "black" }}
          className={inputClass}
          placeholder="Opcional"
        />
      </Field>

      {/* Aviso de privacidad */}
      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={accepted}
          onChange={(e) => setAccepted(e.target.checked)}
          className="mt-1 h-4 w-4 rounded border-gray-300"
        />
        <span className="text-sm text-gray-700">
          He leído y acepto el{" "}
          <a href="/aviso-privacidad" target="_blank" className="text-blue-600 underline">
            Aviso de Privacidad
          </a>{" "}
          y los{" "}
          <a href="/terminos-de-uso" target="_blank" className="text-blue-600 underline">
            Términos de Uso
          </a>{" "}
          *
        </span>
      </label>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-xl bg-blue-600 py-3 text-base font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
      >
        {isPending ? "Creando cuenta..." : "Crear cuenta"}
      </button>

      <p className="text-center text-sm text-gray-500">
        ¿Ya tienes cuenta?{" "}
        <a href="/login" className="text-blue-600 underline">
          Iniciar sesión
        </a>
      </p>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {children}
    </div>
  );
}

const inputClass = "w-full rounded-xl border border-gray-300 px-4 py-3 text-base focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100";