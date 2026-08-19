import "server-only";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import type { Role } from "@/types";

interface GuardSuccess {
  error: null;
  userId: string;
}
interface GuardFailure {
  error: NextResponse;
  userId: null;
}

export async function guardRole(role: Role): Promise<GuardSuccess | GuardFailure> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      error: NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 }),
      userId: null,
    };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("roles")
    .eq("id", user.id)
    .single();

  if (!(profile?.roles as string[] | undefined)?.includes(role)) {
    return {
      error: NextResponse.json({ error: "FORBIDDEN" }, { status: 403 }),
      userId: null,
    };
  }

  return { error: null, userId: user.id };
}

// Permite cualquiera de los roles indicados
export async function guardAnyRole(...roles: Role[]): Promise<GuardSuccess | GuardFailure> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      error: NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 }),
      userId: null,
    };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("roles")
    .eq("id", user.id)
    .single();

  const userRoles = (profile?.roles as string[] | undefined) ?? [];
  const hasAny = roles.some(r => userRoles.includes(r));

  if (!hasAny) {
    return {
      error: NextResponse.json({ error: "FORBIDDEN" }, { status: 403 }),
      userId: null,
    };
  }

  return { error: null, userId: user.id };
}
