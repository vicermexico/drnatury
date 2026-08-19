import { type NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createRouteClient } from "@/lib/supabase/route-handler";
import { derivePatientPassword, phoneToEmail } from "@/lib/auth/patient-secret";
import { getRedirectPath } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import type { Role } from "@/types";

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") ?? "unknown";
  if (!checkRateLimit(`login:${ip}`, 10, 60_000)) {
    return NextResponse.json(
      { error: "RATE_LIMITED", message: "Demasiados intentos. Espera un momento." },
      { status: 429 }
    );
  }

  const body = await request.json().catch(() => ({})) as {
    phone?: string;
    password?: string;
  };

  const phone = body.phone?.replace(/\D/g, "");
  if (!phone) {
    return NextResponse.json(
      { error: "MISSING_PHONE", message: "Telefono requerido" },
      { status: 400 }
    );
  }

  const admin = createAdminClient();

  // Buscar primero con el numero completo (con lada)
  let { data: profile } = await admin
    .from("profiles")
    .select("id, roles, is_active, deleted_at")
    .eq("phone", phone)
    .is("deleted_at", null)
    .maybeSingle();

  // Si no encontro con lada, intentar los ultimos 10 digitos (compatibilidad con registros anteriores)
  if (!profile && phone.length > 10) {
    const phoneShort = phone.slice(-10);
    const { data: profileShort } = await admin
      .from("profiles")
      .select("id, roles, is_active, deleted_at")
      .eq("phone", phoneShort)
      .is("deleted_at", null)
      .maybeSingle();
    profile = profileShort;
  }

  if (!profile) {
    return NextResponse.json(
      { error: "NOT_FOUND", message: "Numero no registrado" },
      { status: 404 }
    );
  }

  if (!profile.is_active || profile.deleted_at) {
    return NextResponse.json(
      { error: "SUSPENDED", message: "Esta cuenta esta suspendida" },
      { status: 403 }
    );
  }

  const roles = profile.roles as Role[];
  const isPatientOnly = roles.length === 1 && roles[0] === "PACIENTE";

  if (!isPatientOnly && !body.password) {
    return NextResponse.json({ requirePassword: true }, { status: 200 });
  }

  // Para pacientes con numero corto (sin lada), usar el numero corto para derivar password
  const phoneForAuth = phone.length > 10
    ? (profile ? phone.slice(-10) : phone)
    : phone;

  const actualPassword = isPatientOnly
    ? derivePatientPassword(phoneForAuth)
    : body.password!;

  const { supabase, applyTo } = createRouteClient(request);
  const { error: authError } = await supabase.auth.signInWithPassword({
    email: phoneToEmail(phoneForAuth),
    password: actualPassword,
  });

  if (authError) {
    return NextResponse.json(
      { error: "INVALID_CREDENTIALS", message: "Contrasena incorrecta" },
      { status: 401 }
    );
  }

  const response = NextResponse.json({
    roles,
    nextPath: getRedirectPath(roles),
  });

  applyTo(response);

  if (roles.length === 1) {
    response.cookies.set("selected_role", roles[0], {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "none",
      maxAge: 60 * 60 * 8,
      path: "/",
      domain: ".drbioescaner.com",
    });
  }

  return response;
}