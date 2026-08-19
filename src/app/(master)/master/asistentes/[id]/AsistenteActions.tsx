"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

interface Asistente {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  branch_id: string | null;
  is_active: boolean;
}

function EditForm({
  asistente, onCancel,
}: {
  asistente: Asistente;
  onCancel: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [name, setName] = useState(asistente.name);
  const [phone, setPhone] = useState(asistente.phone);
  const [email, setEmail] = useState(asistente.email ?? "");
  const [isActive, setIsActive] = useState(asistente.is_active);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    startTransition(async () => {
      const res = await fetch(`/api/assistants/${asistente.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          phone,
          email: email.trim() || null,
          is_active: isActive,
        }),
      });
      const data = await res.json() as { message?: string };
      if (!res.ok) { setError(data.message ?? "Error al guardar"); return; }
      router.refresh();
      onCancel();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 pt-2">
      <div>
        <label className={lc}>Nombre completo</label>
        <input required value={name} onChange={e => setName(e.target.value)} className={ic} />
      </div>
      <div>
        <label className={lc}>Número de celular</label>
        <input
          type="tel" inputMode="numeric" required
          value={phone}
          onChange={e => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
          placeholder="10 dígitos"
          className={ic}
        />
      </div>
      <div>
        <label className={lc}>Correo electrónico</label>
        <input type="email" value={email} onChange={e => setEmail(e.target.value)}
          placeholder="Opcional" className={ic} />
      </div>
      <div className="flex items-center gap-3">
        <input type="checkbox" id="is_active" checked={isActive}
          onChange={e => setIsActive(e.target.checked)}
          className="h-4 w-4 rounded border-gray-300 text-blue-600" />
        <label htmlFor="is_active" className="text-sm text-gray-700 cursor-pointer">
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

function DeleteButton({ asistenteId, name }: { asistenteId: string; name: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");

  function handleDelete() {
    startTransition(async () => {
      const res = await fetch(`/api/assistants/${asistenteId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json() as { message?: string };
        setError(data.message ?? "Error al eliminar");
        setConfirming(false);
        return;
      }
      router.push("/master/asistentes");
    });
  }

  if (confirming) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-5 space-y-3">
        <p className="text-sm font-medium text-red-800">
          ¿Eliminar a <span className="font-bold">{name}</span>?
        </p>
        <p className="text-xs text-red-600">
          El asistente perderá acceso al sistema. Los datos de citas no se eliminan.
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
      Eliminar asistente
    </button>
  );
}

export function AsistenteActions({ asistente }: { asistente: Asistente }) {
  const [editing, setEditing] = useState(false);

  return (
    <div className="space-y-3">
      {editing ? (
        <div className="rounded-2xl bg-white border border-blue-200 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Editar asistente</h2>
          <EditForm asistente={asistente} onCancel={() => setEditing(false)} />
        </div>
      ) : (
        <button type="button" onClick={() => setEditing(true)}
          className="w-full rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition">
          Editar asistente
        </button>
      )}
      <DeleteButton asistenteId={asistente.id} name={asistente.name} />
    </div>
  );
}

const lc = "block text-sm font-medium text-gray-700 mb-1";
const ic = "w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100";
