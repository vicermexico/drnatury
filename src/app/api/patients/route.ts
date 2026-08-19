import { type NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { guardAnyRole } from "@/lib/auth/api-guard";
import { checkRateLimit } from "@/lib/rate-limit";
import { phoneToEmail, derivePatientPassword } from "@/lib/auth/patient-secret";

export async function GET(request: NextRequest) {
  const { error } = await guardAnyRole("MASTER", "ASISTENTE", "TERAPEUTA");
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim();

  const admin = createAdminClient();
  let query = admin
    .from("profiles")
    .select("id, name, phone, age, city, branch_id, created_at, branches(name)")
    .contains("roles", ["PACIENTE"])
    .is("deleted_at", null)
    .order("name");

  if (q) {
    query = query.or(`name.ilike.%${q}%,phone.ilike.%${q}%`);
  }

  const { data, error: dbErr } = await query.limit(50);
  if (dbErr) return NextResponse.json({ error: "DB_ERROR" }, { status: 500 });

  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") ?? "unknown";
  if (!checkRateLimit(`patients:${ip}`, 20, 60_000)) {
    return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429 });
  }

  const { error } = await guardAnyRole("MASTER", "ASISTENTE", "TERAPEUTA");
  if (error) return error;

  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const { name, phone, birth_date, address, sex, city, email, consultation_reason, branch_id } = body;

  if (!name || !phone) {
    return NextResponse.json(
      { error: "MISSING_FIELDS", message: "Nombre y telefono son obligatorios" },
      { status: 400 }
    );
  }

  const cleanPhone = String(phone).replace(/\D/g, "");
  const admin = createAdminClient();

  // Verificar si ya existe
  const { data: existing } = await admin
    .from("profiles")
    .select("id")
    .eq("phone", cleanPhone)
    .is("deleted_at", null)
    .maybeSingle();

  if (existing) {
    return NextResponse.json(
      { error: "DUPLICATE", message: "Este numero ya esta registrado" },
      { status: 409 }
    );
  }

  // Crear usuario en auth
  const email_auth = phoneToEmail(cleanPhone);
  const password   = derivePatientPassword(cleanPhone);

  const { data: authUser, error: authErr } = await admin.auth.admin.createUser({
    email:    email_auth,
    password: password,
    email_confirm: true,
  });

  if (authErr || !authUser.user) {
    return NextResponse.json(
      { error: "AUTH_ERROR", message: authErr?.message ?? "Error al crear usuario" },
      { status: 500 }
    );
  }

  // Crear perfil
  const { data: profile, error: profileErr } = await admin
    .from("profiles")
    .insert({
      id:                 authUser.user.id,
      name:               String(name).trim(),
      phone:              cleanPhone,
      roles:              ["PACIENTE"],
      is_active:          true,
      birth_date:         birth_date ?? null,
      address:            address ?? null,
      sex:                sex ?? null,
      city:               city ?? null,
      email:              email ?? null,
      consultation_reason: consultation_reason ?? null,
      branch_id:          branch_id ?? null,
    })
    .select("id, name, phone")
    .single();

  if (profileErr || !profile) {
    await admin.auth.admin.deleteUser(authUser.user.id);
    return NextResponse.json(
      { error: "PROFILE_ERROR", message: profileErr?.message ?? "Error al crear perfil" },
      { status: 500 }
    );
  }

  return NextResponse.json(profile, { status: 201 });
}