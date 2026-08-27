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
  let matchedPhone = phone;
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
    if (profileShort) {
      profile = profileShort;
      matchedPhone = phoneShort;
    }
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
  // Usar exactamente el numero con el que se encontro el perfil (con o sin
  // lada, segun quedo guardado), para que la contrasena derivada coincida
  // con la que se genero al registrar al paciente.
  const phoneForAuth = matchedPhone;
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
    // NOTA: antes esta cookie usaba sameSite:"none" + un dominio manual
    // (".drnatury.com"). Esa combinacion hace que varios navegadores la
    // rechacen en silencio (sin marcar error), lo que causaba que a veces
    // el sistema no supiera que ya habias elegido el rol y te mandara de
    // regreso al login. Ahora usa la misma configuracion simple y
    // confiable que usan las demas cookies de sesion del sitio.
    response.cookies.set("selected_role", roles[0], {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 8,
      path: "/",
    });
  }
  return response;
}
