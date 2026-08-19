import { type NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { guardAnyRole } from "@/lib/auth/api-guard";
import { phoneToEmail, derivePatientPassword } from "@/lib/auth/patient-secret";
import { checkRateLimit } from "@/lib/rate-limit";

// Registro rápido de paciente: solo nombre + teléfono.
// Permitido para MASTER, ASISTENTE y TERAPEUTA.
export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") ?? "unknown";
  if (!checkRateLimit(`patients-quick:${ip}`, 20, 60_000)) {
    return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429 });
  }

  const { error, userId } = await guardAnyRole("MASTER", "ASISTENTE", "TERAPEUTA");
  if (error) return error;

  const body = await request.json().catch(() => ({})) as Record<string, string>;
  const { name, phone } = body;

  if (!name?.trim() || !phone) {
    return NextResponse.json(
      { error: "MISSING_FIELDS", message: "Nombre y teléfono son obligatorios" },
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

  const admin = createAdminClient();

  // Verificar que el número no esté ya registrado
  const { data: existing } = await admin
    .from("profiles")
    .select("id, name, phone")
    .eq("phone", normalizedPhone)
    .is("deleted_at", null)
    .maybeSingle();

  if (existing) {
    // Si ya existe, devolver el perfil existente en lugar de error
    // (el usuario ya existe — la terapeuta lo puede seleccionar)
    return NextResponse.json(
      { error: "ALREADY_EXISTS", message: "Este número ya está registrado", profile: existing },
      { status: 409 }
    );
  }

  // Obtener branch_id del caller para asignárselo al paciente
  const { data: callerProfile } = await admin
    .from("profiles")
    .select("branch_id")
    .eq("id", userId)
    .single();

  // Limpiar auth eliminado con ese teléfono si hubiera
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
    password: derivePatientPassword(normalizedPhone),
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
      branch_id: callerProfile?.branch_id ?? null,
      roles: ["PACIENTE"],
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
