import { type NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { guardRole } from "@/lib/auth/api-guard";
import { phoneToEmail } from "@/lib/auth/patient-secret";

function computeAge(birthDate: string): number {
  const birth = new Date(birthDate);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await guardRole("MASTER");
  if (error) return error;

  const { id } = await params;
  const admin = createAdminClient();

  const [profileRes, apptRes] = await Promise.all([
    admin
      .from("profiles")
      .select("id, name, phone, birth_date, age, address, sex, city, email, consultation_reason, branch_id, is_active, created_at, branches(id, name)")
      .eq("id", id)
      .contains("roles", ["PACIENTE"])
      .is("deleted_at", null)
      .maybeSingle(),
    admin
      .from("appointments")
      .select(`
        id, starts_at, ends_at, status, notes,
        services(name),
        branches(name),
        profiles!appointments_therapist_id_fkey(name)
      `)
      .eq("patient_id", id)
      .is("deleted_at", null)
      .order("starts_at", { ascending: false }),
  ]);

  if (profileRes.error || !profileRes.data) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  return NextResponse.json({ patient: profileRes.data, appointments: apptRes.data ?? [] });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await guardRole("MASTER");
  if (error) return error;

  const { id } = await params;
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;

  const allowed = ["name", "phone", "birth_date", "address", "sex", "city", "email", "consultation_reason", "branch_id", "is_active"];
  const updates = Object.fromEntries(
    Object.entries(body).filter(([k]) => allowed.includes(k))
  );

  if ("birth_date" in updates && typeof updates.birth_date === "string" && updates.birth_date) {
    updates.age = computeAge(updates.birth_date);
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "NO_FIELDS" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Cambio de teléfono: requiere actualizar auth.users y verificar disponibilidad
  if (typeof updates.phone === "string") {
    const newPhone = updates.phone.replace(/\D/g, "");
    if (newPhone.length < 10) {
      return NextResponse.json(
        { error: "INVALID_PHONE", message: "Ingresa un teléfono válido de 10 dígitos" },
        { status: 400 }
      );
    }
    updates.phone = newPhone;

    // Verificar que el nuevo número no esté en uso por otro paciente activo
    const { data: conflict } = await admin
      .from("profiles")
      .select("id")
      .eq("phone", newPhone)
      .is("deleted_at", null)
      .neq("id", id)
      .maybeSingle();

    if (conflict) {
      return NextResponse.json(
        { error: "PHONE_TAKEN", message: "Ese número ya está registrado en otro paciente" },
        { status: 409 }
      );
    }

    // Limpiar auth.users de perfil soft-deleted con ese teléfono (si existe)
    const { data: deletedProfile } = await admin
      .from("profiles")
      .select("id")
      .eq("phone", newPhone)
      .not("deleted_at", "is", null)
      .maybeSingle();

    if (deletedProfile) {
      await admin.auth.admin.deleteUser(deletedProfile.id);
    }

    // Actualizar email en auth.users para que el login siga funcionando
    const { error: authErr } = await admin.auth.admin.updateUserById(id, {
      email: phoneToEmail(newPhone),
    });

    if (authErr) {
      return NextResponse.json(
        { error: "AUTH_ERROR", message: "Error al actualizar las credenciales de acceso" },
        { status: 500 }
      );
    }
  }

  const { data, error: dbErr } = await admin
    .from("profiles")
    .update(updates)
    .eq("id", id)
    .contains("roles", ["PACIENTE"])
    .is("deleted_at", null)
    .select("id, name")
    .single();

  if (dbErr || !data) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  return NextResponse.json(data);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await guardRole("MASTER");
  if (error) return error;

  const { id } = await params;
  const admin = createAdminClient();

  // Soft delete — CLAUDE.md regla 1
  const { error: dbErr } = await admin
    .from("profiles")
    .update({ deleted_at: new Date().toISOString(), is_active: false })
    .eq("id", id)
    .contains("roles", ["PACIENTE"])
    .is("deleted_at", null);

  if (dbErr) return NextResponse.json({ error: "DB_ERROR", message: dbErr.message }, { status: 500 });

  // Anonimizar email en auth.users para liberar el número de celular
  await admin.auth.admin.updateUserById(id, {
    email: `deleted_${Date.now()}_${id}@deleted.invalid`,
  });

  return NextResponse.json({ message: "Paciente eliminado" });
}
