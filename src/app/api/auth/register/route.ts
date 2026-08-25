import { type NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createRouteClient } from "@/lib/supabase/route-handler";
import { derivePatientPassword, phoneToEmail } from "@/lib/auth/patient-secret";
import { getRolePath } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") ?? "unknown";
  if (!checkRateLimit(`register:${ip}`, 5, 60_000)) {
    return NextResponse.json(
      { error: "RATE_LIMITED", message: "Demasiados intentos. Espera un momento." },
      { status: 429 }
    );
  }
  const body = await request.json().catch(() => ({})) as Record<string, string>;
  const phone = body.phone?.replace(/\D/g, "");
  const { name, address, age, sex, city, branch_id, email, consultation_reason } = body;
  // Campos obligatorios simplificados: solo telefono, nombre y sucursal.
  // (Direccion, edad, sexo, ciudad y correo ya no se piden, quedan opcionales.)
  if (!phone || !name || !branch_id) {
    return NextResponse.json(
      { error: "MISSING_FIELDS", message: "Completa todos los campos obligatorios" },
      { status: 400 }
    );
  }
  const admin = createAdminClient();
  // Verificar que el telefono no este registrado ya (ignorar soft-deleted)
  const { data: existing } = await admin
    .from("profiles")
    .select("id")
    .eq("phone", phone)
    .is("deleted_at", null)
    .maybeSingle();
  if (existing) {
    return NextResponse.json(
      { error: "ALREADY_REGISTERED", message: "Este numero ya esta registrado" },
      { status: 409 }
    );
  }
  // Crear usuario en auth.users
  const { data: authUser, error: createError } = await admin.auth.admin.createUser({
    email: phoneToEmail(phone),
    password: derivePatientPassword(phone),
    email_confirm: true,
  });
  if (createError || !authUser.user) {
    return NextResponse.json(
      { error: "AUTH_ERROR", message: "Error al crear la cuenta" },
      { status: 500 }
    );
  }
  // Insertar perfil
  const { error: profileError } = await admin.from("profiles").insert({
    id: authUser.user.id,
    phone,
    name: name.trim(),
    address: address?.trim() || null,
    age: age ? parseInt(age, 10) : null,
    sex: sex || null,
    city: city?.trim() || null,
    branch_id,
    email: email?.trim() || null,
    consultation_reason: consultation_reason?.trim() || null,
    roles: ["PACIENTE"],
  });
  if (profileError) {
    // Rollback: eliminar el usuario de auth si el perfil fallo
    await admin.auth.admin.deleteUser(authUser.user.id);
    return NextResponse.json(
      { error: "PROFILE_ERROR", message: "Error al guardar el perfil" },
      { status: 500 }
    );
  }
  // Auto-login tras registro
  const { supabase, applyTo } = createRouteClient(request);
  await supabase.auth.signInWithPassword({
    email: phoneToEmail(phone),
    password: derivePatientPassword(phone),
  });
  const response = NextResponse.json(
    { nextPath: getRolePath("PACIENTE") },
    { status: 201 }
  );
  applyTo(response);
  return response;
}
