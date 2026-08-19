import { type NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { guardRole } from "@/lib/auth/api-guard";
import { phoneToEmail } from "@/lib/auth/patient-secret";
import { checkRateLimit } from "@/lib/rate-limit";

export async function GET() {
  const { error } = await guardRole("MASTER");
  if (error) return error;

  const admin = createAdminClient();
  const { data, error: dbErr } = await admin
    .from("profiles")
    .select("id, name, phone, email, is_active")
    .contains("roles", ["ALMACENISTA"])
    .is("deleted_at", null)
    .order("name");

  if (dbErr) return NextResponse.json({ error: "DB_ERROR" }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") ?? "unknown";
  if (!checkRateLimit(`almacenistas:${ip}`, 20, 60_000)) {
    return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429 });
  }

  const { error } = await guardRole("MASTER");
  if (error) return error;

  const body = await request.json().catch(() => ({})) as Record<string, string>;
  const { name, phone, email, password } = body;

  if (!name || !phone || !password) {
    return NextResponse.json(
      { error: "MISSING_FIELDS", message: "Nombre, teléfono y contraseña son obligatorios" },
      { status: 400 }
    );
  }

  const normalizedPhone = phone.replace(/\D/g, "");
  if (normalizedPhone.length < 10) {
    return NextResponse.json(
      { error: "INVALID_PHONE", message: "Ingresa un teléfono válido de 10 dígitos" },
      { status: 400 }
    );
  }
  if (password.length < 6) {
    return NextResponse.json(
      { error: "WEAK_PASSWORD", message: "La contraseña debe tener al menos 6 caracteres" },
      { status: 400 }
    );
  }

  const admin = createAdminClient();

  const { data: existing } = await admin
    .from("profiles")
    .select("id")
    .eq("phone", normalizedPhone)
    .is("deleted_at", null)
    .maybeSingle();

  if (existing) {
    return NextResponse.json(
      { error: "ALREADY_EXISTS", message: "Este número de celular ya está registrado" },
      { status: 409 }
    );
  }

  const { data: deletedProfile } = await admin
    .from("profiles")
    .select("id")
    .eq("phone", normalizedPhone)
    .not("deleted_at", "is", null)
    .maybeSingle();

  if (deletedProfile) {
    await admin.auth.admin.deleteUser(deletedProfile.id);
  }

  const { data: authUser, error: createErr } = await admin.auth.admin.createUser({
    email: phoneToEmail(normalizedPhone),
    password,
    email_confirm: true,
  });

  if (createErr || !authUser.user) {
    return NextResponse.json(
      { error: "AUTH_ERROR", message: "Error al crear la cuenta de acceso" },
      { status: 500 }
    );
  }

  const { data: profile, error: profileErr } = await admin
    .from("profiles")
    .insert({
      id: authUser.user.id,
      phone: normalizedPhone,
      name: name.trim(),
      email: email?.trim() || null,
      roles: ["ALMACENISTA"],
    })
    .select("id, name, phone")
    .single();

  if (profileErr) {
    await admin.auth.admin.deleteUser(authUser.user.id);
    return NextResponse.json(
      { error: "PROFILE_ERROR", message: "Error al guardar el perfil" },
      { status: 500 }
    );
  }

  return NextResponse.json(profile, { status: 201 });
}
