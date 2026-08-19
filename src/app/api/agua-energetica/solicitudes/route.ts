import { type NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { guardAnyRole } from "@/lib/auth/api-guard";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const body = await request.json().catch(() => ({})) as { branch_id?: string };
  if (!body.branch_id) {
    return NextResponse.json({ error: "MISSING_FIELDS" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Verificar si ya tiene solicitud pendiente
  const { data: existing } = await admin
    .from("agua_energetica_solicitudes")
    .select("id")
    .eq("patient_id", user.id)
    .eq("estado", "pendiente")
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: "ALREADY_PENDING", message: "Ya tienes una solicitud pendiente" }, { status: 409 });
  }

  const { data, error: dbErr } = await admin
    .from("agua_energetica_solicitudes")
    .insert({
      patient_id: user.id,
      branch_id: body.branch_id,
      estado: "pendiente",
    })
    .select()
    .single();

  if (dbErr) return NextResponse.json({ error: "DB_ERROR", message: dbErr.message }, { status: 500 });

  return NextResponse.json(data, { status: 201 });
}

export async function GET(request: NextRequest) {
  const { error } = await guardAnyRole("TERAPEUTA", "ASISTENTE", "MASTER");
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const branchId = searchParams.get("branch_id");

  const admin = createAdminClient();
  let query = admin
    .from("agua_energetica_solicitudes")
    .select("id, estado, created_at, patient:profiles!patient_id(id, name, phone), branch:branches!branch_id(name)")
    .eq("estado", "pendiente")
    .order("created_at", { ascending: false });

  if (branchId) query = query.eq("branch_id", branchId);

  const { data } = await query;
  return NextResponse.json(data ?? []);
}

export async function PATCH(request: NextRequest) {
  const { error } = await guardAnyRole("TERAPEUTA", "ASISTENTE", "MASTER");
  if (error) return error;

  const body = await request.json().catch(() => ({})) as { id?: string; estado?: string };
  if (!body.id || !body.estado) {
    return NextResponse.json({ error: "MISSING_FIELDS" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error: dbErr } = await admin
    .from("agua_energetica_solicitudes")
    .update({ estado: body.estado })
    .eq("id", body.id)
    .select()
    .single();

  if (dbErr) return NextResponse.json({ error: "DB_ERROR" }, { status: 500 });
  return NextResponse.json(data);
}
