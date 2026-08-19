"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
type Step = "phone" | "password";
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
export function PhoneLoginForm() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("phone");
  const [countryCode, setCountryCode] = useState("+52");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const selectedCountry = COUNTRIES.find(c => c.code === countryCode) ?? COUNTRIES[0];
  const fullPhone = countryCode.replace("+", "") + phone;
  function handlePhoneChange(value: string) {
    setPhone(value.replace(/\D/g, "").slice(0, selectedCountry.maxDigits));
  }
  function goTo(nextPath: string) {
    // Navegacion completa (no client-side) para garantizar que el
    // navegador mande las cookies de sesion recien creadas al middleware.
    window.location.href = nextPath;
  }
  function submitPhone(e: React.FormEvent) {
    e.preventDefault();
    if (phone.length < selectedCountry.maxDigits) {
      setError(`Ingresa los ${selectedCountry.maxDigits} dígitos de tu celular`);
      return;
    }
    setError("");
    startTransition(async () => {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: fullPhone }),
      });
      const data = await res.json();
      if (res.status === 404) {
        router.push(`/registro?phone=${encodeURIComponent(fullPhone)}`);
        return;
      }
      if (res.status === 403) {
        setError("Esta cuenta está suspendida. Contacta a tu administrador.");
        return;
      }
      if (res.status === 429) {
        setError(data.message);
        return;
      }
      if (!res.ok) {
        setError("Error inesperado. Intenta de nuevo.");
        return;
      }
      if (data.requirePassword) {
        setStep("password");
        return;
      }
      goTo(data.nextPath);
    });
  }
  function submitPassword(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    startTransition(async () => {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: fullPhone, password }),
      });
      const data = await res.json();
      alert("DEBUG status=" + res.status + " body=" + JSON.stringify(data) + " cookies=" + document.cookie);
      if (res.status === 401) {
        setError("Contraseña incorrecta");
        return;
      }
      if (res.status === 429) {
        setError(data.message);
        return;
      }
      if (!res.ok) {
        setError("Error inesperado. Intenta de nuevo.");
        return;
      }
      goTo(data.nextPath);
    });
  }
  return (
    <div className="space-y-6">
      {step === "phone" ? (
        <form onSubmit={submitPhone} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Número de celular
            </label>
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
                autoComplete="tel"
                autoFocus
                value={phone}
                onChange={(e) => handlePhoneChange(e.target.value)}
                placeholder={`${selectedCountry.maxDigits} dígitos`}
                style={{ color: "black" }}
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-lg tracking-widest focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
            </div>
            <p className="text-xs text-gray-400 mt-1">{selectedCountry.flag} {selectedCountry.name} — {countryCode} + {phone || "..."}</p>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={isPending}
            className="w-full rounded-xl bg-blue-600 py-3 text-base font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
          >
            {isPending ? "Verificando..." : "Continuar"}
          </button>
          <p className="text-center text-sm text-gray-500">
            ¿Primera vez?{" "}
            <a href="/registro" className="text-blue-600 underline">
              Crear cuenta
            </a>
          </p>
        </form>
      ) : (
        <form onSubmit={submitPassword} className="space-y-4">
          <p className="text-sm text-gray-600">
            Número: <span className="font-semibold tracking-widest">{countryCode} {phone}</span>
          </p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Contraseña
            </label>
            <input
              type="password"
              autoComplete="current-password"
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ color: "black" }}
              className="w-full rounded-xl border border-gray-300 px-4 py-3 text-base focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={isPending}
            className="w-full rounded-xl bg-blue-600 py-3 text-base font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
          >
            {isPending ? "Entrando..." : "Entrar"}
          </button>
          <button
            type="button"
            onClick={() => { setStep("phone"); setPassword(""); setError(""); }}
            className="w-full text-sm text-gray-500 underline"
          >
            Cambiar número
          </button>
        </form>
      )}
    </div>
  );
}
