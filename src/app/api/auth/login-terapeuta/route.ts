import { type NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createRouteClient } from "@/lib/supabase/route-handler";
import { phoneToEmail } from "@/lib/auth/patient-secret";
import { checkRateLimit } from "@/lib/rate-limit";
import type { Role } from "@/types";

// Login "exclusivo terapeuta": el link ya trae quien es (therapistId),
// asi que solo se le pide la contraseña — no el celular. Se usa desde el
// link que se manda por WhatsApp cuando un paciente agenda, para que la
// terapeuta entre directo al detalle de esa cita.
export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") ?? "unknown";
  if (!checkRateLimit(`login-terapeuta:${ip}`, 10, 60_000)) {
    return NextResponse.json(
      { error: "RATE_LIMITED", message: "Demasiados intentos. Espera un momento." },
      { status: 429 }
    );
  }

  const body = await request.json().catch(() => ({})) as {
    therapistId?: string;
    password?: string;
    next?: string;
  };
  const { therapistId, password } = body;
  if (!therapistId || !password) {
    return NextResponse.json(
      { error: "MISSING_FIELDS", message: "Faltan datos" },
      { status: 400 }
    );
  }

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("id, phone, roles, is_active, deleted_at")
    .eq("id", therapistId)
    .is("deleted_at", null)
    .maybeSingle();

  if (!profile || !(profile.roles as Role[]).includes("TERAPEUTA")) {
    return NextResponse.json(
      { error: "NOT_FOUND", message: "Terapeuta no encontrada" },
      { status: 404 }
    );
  }
  if (!profile.is_active) {
    return NextResponse.json(
      { error: "SUSPENDED", message: "Esta cuenta esta suspendida" },
      { status: 403 }
    );
  }

  const { supabase, applyTo } = createRouteClient(request);
  const { error: authError } = await supabase.auth.signInWithPassword({
    email: phoneToEmail(profile.phone),
    password,
  });
  if (authError) {
    return NextResponse.json(
      { error: "INVALID_CREDENTIALS", message: "Contraseña incorrecta" },
      { status: 401 }
    );
  }

  // Solo se acepta un "next" que caiga dentro del panel de terapeuta —
  // cualquier otra cosa se ignora y se manda al dashboard.
  const next = body.next && body.next.startsWith("/terapeuta/") ? body.next : "/terapeuta/dashboard";

  const response = NextResponse.json({ nextPath: next });
  applyTo(response);
  response.cookies.set("selected_role", "TERAPEUTA", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 8,
    path: "/",
  });
  return response;
}
