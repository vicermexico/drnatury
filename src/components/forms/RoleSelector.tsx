"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Role } from "@/types";

const ROLE_LABELS: Record<Role, string> = {
  MASTER: "Administrador",
  TERAPEUTA: "Terapeuta",
  ASISTENTE: "Asistente",
  ALMACENISTA: "Almacenista",
  PACIENTE: "Paciente",
};

const ROLE_DESCRIPTIONS: Record<Role, string> = {
  MASTER: "Gestión completa de la clínica",
  TERAPEUTA: "Agenda y operación de tu sucursal",
  ASISTENTE: "Gestión de citas en todas las sucursales",
  ALMACENISTA: "Control de inventario y almacén",
  PACIENTE: "Ver y gestionar mis citas",
};

interface Props {
  roles: Role[];
}

export function RoleSelector({ roles }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function selectRole(role: Role) {
    startTransition(async () => {
      const res = await fetch("/api/auth/select-role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      if (!res.ok) return;
      const { nextPath } = await res.json();
      router.push(nextPath);
    });
  }

  return (
    <div className="space-y-3">
      <p className="text-center text-gray-600 mb-6">
        ¿Cómo quieres entrar hoy?
      </p>
      {roles.map((role) => (
        <button
          key={role}
          onClick={() => selectRole(role)}
          disabled={isPending}
          className="w-full rounded-2xl border-2 border-gray-200 p-5 text-left transition hover:border-blue-400 hover:bg-blue-50 disabled:opacity-60"
        >
          <p className="text-base font-semibold text-gray-900">
            {ROLE_LABELS[role]}
          </p>
          <p className="text-sm text-gray-500 mt-0.5">
            {ROLE_DESCRIPTIONS[role]}
          </p>
        </button>
      ))}
    </div>
  );
}
