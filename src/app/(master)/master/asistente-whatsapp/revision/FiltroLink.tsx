"use client";

import { usePathname, useSearchParams, useRouter } from "next/navigation";
import { useTransition } from "react";

// Filtro de "de cual link vino" para la lista de revision -- pedido de
// Vic: poder ver todas las conversaciones, o nada mas las que vinieron
// de un link especifico (ver /master/asistente-whatsapp/links).
export function FiltroLink({ links }: { links: { codigo: string; nota: string | null }[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const linkActivo = searchParams.get("link") ?? "";

  function cambiar(valor: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (valor) params.set("link", valor); else params.delete("link");
    startTransition(() => router.replace(`${pathname}?${params.toString()}`));
  }

  if (links.length === 0) return null;

  return (
    <div className="flex items-center gap-2 text-sm">
      <label className="text-gray-500 shrink-0">Link:</label>
      <select
        value={linkActivo}
        onChange={(e) => cambiar(e.target.value)}
        disabled={isPending}
        className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm disabled:opacity-60"
      >
        <option value="">Todos</option>
        {links.map((l) => (
          <option key={l.codigo} value={l.codigo}>
            {l.nota ? `${l.codigo} — ${l.nota}` : l.codigo}
          </option>
        ))}
      </select>
    </div>
  );
}
