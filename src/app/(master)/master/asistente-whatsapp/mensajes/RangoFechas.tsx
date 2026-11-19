"use client";

import { usePathname, useSearchParams, useRouter } from "next/navigation";
import { useTransition } from "react";

// Filtro de fechas para la pantalla de mensajes del chat: botones rapidos
// (Hoy / Este mes / Este año / Todo) mas dos campos para un rango
// cualquiera, igual de simple que el DateNav de Citas pero con rango en
// vez de un solo dia.
export function RangoFechas() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const hoyCst = new Date().toLocaleDateString("en-CA", { timeZone: "America/Monterrey" });
  const desde = searchParams.get("desde") ?? "";
  const hasta = searchParams.get("hasta") ?? "";

  function ir(nuevoDesde: string | null, nuevoHasta: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (nuevoDesde) params.set("desde", nuevoDesde); else params.delete("desde");
    if (nuevoHasta) params.set("hasta", nuevoHasta); else params.delete("hasta");
    startTransition(() => router.replace(`${pathname}?${params.toString()}`));
  }

  function primerDiaDelMes(): string {
    const [y, m] = hoyCst.split("-").map(Number);
    return `${y}-${String(m).padStart(2, "0")}-01`;
  }

  function primerDiaDelAnio(): string {
    const [y] = hoyCst.split("-");
    return `${y}-01-01`;
  }

  const presets: { label: string; activo: boolean; onClick: () => void }[] = [
    { label: "Hoy", activo: desde === hoyCst && hasta === hoyCst, onClick: () => ir(hoyCst, hoyCst) },
    { label: "Este mes", activo: desde === primerDiaDelMes() && hasta === hoyCst, onClick: () => ir(primerDiaDelMes(), hoyCst) },
    { label: "Este año", activo: desde === primerDiaDelAnio() && hasta === hoyCst, onClick: () => ir(primerDiaDelAnio(), hoyCst) },
    { label: "Todo", activo: !desde && !hasta, onClick: () => ir(null, null) },
  ];

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap gap-2">
        {presets.map((p) => (
          <button
            key={p.label}
            onClick={p.onClick}
            disabled={isPending}
            className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition disabled:opacity-50 ${
              p.activo ? "bg-emerald-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <input
          type="date"
          value={desde}
          onChange={(e) => ir(e.target.value || null, hasta || null)}
          className="rounded-lg border border-gray-200 px-2 py-1.5 text-sm"
        />
        <span>a</span>
        <input
          type="date"
          value={hasta}
          onChange={(e) => ir(desde || null, e.target.value || null)}
          className="rounded-lg border border-gray-200 px-2 py-1.5 text-sm"
        />
      </div>
    </div>
  );
}
