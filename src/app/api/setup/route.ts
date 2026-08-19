import { type NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { phoneToEmail } from "@/lib/auth/patient-secret";

// POST — crea la cuenta MASTER inicial.
// Solo funciona si no existe ningún perfil con rol MASTER.
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({})) as Record<string, string>;
  const { name, phone, password } = body;

  if (!name || !phone || !password) {
    return NextResponse.json(
      { error: "MISSING_FIELDS", message: "Nombre, teléfono y contraseña son obligatorios" },
      { status: 400 }
    );
  }

  if (password.length < 8) {
    return NextResponse.json(
      { error: "WEAK_PASSWORD", message: "La contraseña debe tener al menos 8 caracteres" },
      { status: 400 }
    );
  }

  const normalizedPhone = phone.replace(/\D/g, "");
  if (normalizedPhone.length < 10) {
    return NextResponse.json(
      { error: "INVALID_PHONE", message: "Teléfono debe tener al menos 10 dígitos" },
      { status: 400 }
    );
  }

  const admin = createAdminClient();

  // Verificar que no exista ningún MASTER — garantiza uso único
  const { count } = await admin
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .contains("roles", ["MASTER"]);

  if (count && count > 0) {
    return NextResponse.json(
      { error: "ALREADY_SETUP", message: "La cuenta Master ya fue creada" },
      { status: 409 }
    );
  }

  // Crear usuario en auth.users con contraseña real (no derivada)
  const { data: authUser, error: createErr } = await admin.auth.admin.createUser({
    email: phoneToEmail(normalizedPhone),
    password,
    email_confirm: true,
  });

  if (createErr || !authUser.user) {
    return NextResponse.json(
      { error: "AUTH_ERROR", message: createErr?.message ?? "Error al crear cuenta" },
      { status: 500 }
    );
  }

  // Insertar perfil con rol MASTER
  const { error: profileErr } = await admin.from("profiles").insert({
    id: authUser.user.id,
    phone: normalizedPhone,
    name: name.trim(),
    roles: ["MASTER"],
  });

  if (profileErr) {
    await admin.auth.admin.deleteUser(authUser.user.id);
    return NextResponse.json(
      { error: "PROFILE_ERROR", message: "Error al guardar el perfil" },
      { status: 500 }
    );
  }

  return NextResponse.json({ message: "Cuenta Master creada. Ya puedes iniciar sesión." }, { status: 201 });
}
