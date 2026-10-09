import { type NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { guardRole } from "@/lib/auth/api-guard";

// Banco de referencia de iridologia — SOLO Master lo ve y lo administra.
// La imagen ya se subio directo desde el navegador al bucket privado
// "iris-reference" (mismo patron que product-images); aqui solo se
// guarda/lista/borra el registro con su significado.

export async function GET() {
  const { error } = await guardRole("MASTER");
  if (error) return error;

  const admin = createAdminClient();
  const { data, error: dbErr } = await admin
    .from("iris_reference_images")
    .select("id, label, meaning, zone, image_path, created_at")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (dbErr) return NextResponse.json({ error: "DB_ERROR", message: dbErr.message }, { status: 500 });

  const withUrls = await Promise.all(
    (data ?? []).map(async (row) => {
      const { data: signed } = await admin.storage
        .from("iris-reference")
        .createSignedUrl(row.image_path, 3600);
      return { ...row, image_url: signed?.signedUrl ?? null };
    })
  );

  return NextResponse.json(withUrls);
}

export async function POST(request: NextRequest) {
  const { error, userId } = await guardRole("MASTER");
  if (error) return error;

  const body = (await request.json().catch(() => ({}))) as {
    label?: string;
    meaning?: string;
    zone?: string;
    image_path?: string;
  };
  const { label, meaning, zone, image_path } = body;

  if (!label?.trim() || !meaning?.trim() || !image_path) {
    return NextResponse.json({ error: "MISSING_FIELDS" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error: dbErr } = await admin
    .from("iris_reference_images")
    .insert({
      label: label.trim(),
      meaning: meaning.trim(),
      zone: zone?.trim() || null,
      image_path,
      created_by: userId,
    })
    .select()
    .single();

  if (dbErr) return NextResponse.json({ error: "DB_ERROR", message: dbErr.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const { error } = await guardRole("MASTER");
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "MISSING_ID" }, { status: 400 });

  const admin = createAdminClient();
  await admin
    .from("iris_reference_images")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);

  return NextResponse.json({ deleted: true });
}
