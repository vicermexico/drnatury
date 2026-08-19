import { type NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { guardAnyRole } from "@/lib/auth/api-guard";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await guardAnyRole("MASTER", "TERAPEUTA", "ASISTENTE");
  if (error) return error;

  const { id } = await params;
  const formData = await request.formData();
  const file = formData.get("pdf") as File | null;

  if (!file || file.type !== "application/pdf") {
    return NextResponse.json({ error: "INVALID_FILE", message: "Solo se aceptan archivos PDF" }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: appt } = await admin
    .from("appointments")
    .select("id")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  if (!appt) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  const fileName = `${id}.pdf`;

  const { error: uploadErr } = await admin.storage
    .from("cita-pdfs")
    .upload(fileName, buffer, { contentType: "application/pdf", upsert: true });

  if (uploadErr) {
    return NextResponse.json({ error: "UPLOAD_ERROR", message: uploadErr.message }, { status: 500 });
  }

  const { data: urlData } = admin.storage.from("cita-pdfs").getPublicUrl(fileName);
  const pdfUrl = urlData.publicUrl;

  await admin.from("appointments").update({ pdf_url: pdfUrl }).eq("id", id);

  return NextResponse.json({ pdf_url: pdfUrl }, { status: 201 });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await guardAnyRole("MASTER", "TERAPEUTA", "ASISTENTE");
  if (error) return error;

  const { id } = await params;
  const admin = createAdminClient();

  await admin.storage.from("cita-pdfs").remove([`${id}.pdf`]);
  await admin.from("appointments").update({ pdf_url: null }).eq("id", id);

  return NextResponse.json({ deleted: true });
}
