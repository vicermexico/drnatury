import "server-only";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import type { Role } from "@/types";

export async function getServerUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function getServerProfile() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("profiles")
    .select("id, name, phone, roles, branch_id, is_active, branches(name)")
    .eq("id", user.id)
    .single();

  return data;
}

export async function requireAuth() {
  const user = await getServerUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireRole(role: Role) {
  const profile = await getServerProfile();
  if (!profile) redirect("/login");
  if (!(profile.roles as Role[]).includes(role)) redirect("/login");
  return profile;
}

// Dónde va el usuario después de autenticarse con un solo rol
export function getRolePath(role: Role): string {
  const paths: Record<Role, string> = {
    MASTER: "/master/dashboard",
    TERAPEUTA: "/terapeuta/dashboard",
    ASISTENTE: "/asistente/dashboard",
    ALMACENISTA: "/almacen/dashboard",
    PACIENTE: "/paciente/citas",
  };
  return paths[role];
}

// Si tiene 2 roles → selector; si tiene 1 → directo
export function getRedirectPath(roles: Role[]): string {
  if (roles.length === 0) return "/login";
  if (roles.length > 1) return "/seleccionar-rol";
  return getRolePath(roles[0]);
}
