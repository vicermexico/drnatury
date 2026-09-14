import { type NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { guardRole } from "@/lib/auth/api-guard";

// GET: cualquier staff autenticado lo puede leer (lo usa tanto el panel
// de Master como el formulario de Receta del terapeuta).
export async function GET() {
  const admin = createAdminClient();
  const { data } = await admin
    .from("padecimientos")
    .select("id, nombre, recomendacion, orden")
    .order("orden")
    .order("nombre");
  return NextResponse.json(data ?? []);
}

// POST: solo Master da de alta padecimientos nuevos.
export async function POST(request: NextRequest) {
  const { error } = await guardRole("MASTER");
  if (error) return error;

  const body = (await request.json().catch(() => ({}))) as {
    nombre?: string;
    recomendacion?: string;
  };
  const nombre = body.nombre?.trim();
  if (!nombre) {
    return NextResponse.json({ error: "MISSING_FIELDS" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error: dbErr } = await admin
    .from("padecimientos")
    .insert({ nombre, recomendacion: body.recomendacion?.trim() ?? "" })
    .select()
    .single();

  if (dbErr) return NextResponse.json({ error: "DB_ERROR", message: dbErr.message }, { status: 500 });
  return NextResponse.json(data);
}
