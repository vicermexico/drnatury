"use client";

import { usePathname, useSearchParams, useRouter } from "next/navigation";
import { useTransition } from "react";

interface Branch { id: string; name: string }

export function DateNav({ branches }: { branches: Branch[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const todayCst = new Date().toLocaleDateString("en-CA", { timeZone: "America/Monterrey" });
  const currentDate = searchParams.get("date") ?? todayCst;
  const currentBranch = searchParams.get("branch_id") ?? "";

  function navigate(newDate: string, newBranch = currentBranch) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("date", newDate);
    if (newBranch) params.set("branch_id", newBranch);
    else params.delete("branch_id");
    startTransition(() => router.replace(`${pathname}?${params.toString()}`));
  }

  function shift(days: number) {
    const d = new Date(currentDate + "T12:00:00");
    d.setDate(d.getDate() + days);
    navigate(d.toLocaleDateString("en-CA"));
  }

  const label = new Date(currentDate + "T12:00:00").toLocaleDateString("es-MX", {
    weekday: "long", day: "numeric", month: "long",
  });

  return (
    <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
      {/* Navegación de fecha */}
      <div className="flex items-center gap-2 flex-1">
        <button onClick={() => shift(-1)} disabled={isPending}
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm hover:bg-gray-50 transition disabled:opacity-50">
          ←
        </button>
        <div className="flex-1 min-w-0 text-center">
          <p className="text-sm font-semibold text-gray-900 capitalize truncate">{label}</p>
        </div>
        <button onClick={() => shift(1)} disabled={isPending}
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm hover:bg-gray-50 transition disabled:opacity-50">
          →
        </button>
        {currentDate !== todayCst && (
          <button onClick={() => navigate(todayCst)}
            className="text-xs font-medium text-blue-600 hover:text-blue-800 whitespace-nowrap px-1">
            Hoy
          </button>
        )}
        {isPending && (
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent shrink-0" />
        )}
      </div>

      {/* Filtro de sucursal */}
      {branches.length > 1 && (
        <select value={currentBranch}
          onChange={(e) => navigate(currentDate, e.target.value)}
          className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:border-blue-400 shrink-0">
          <option value="">Todas las sucursales</option>
          {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      )}
    </div>
  );
}
