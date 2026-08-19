import { type NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { guardRole } from "@/lib/auth/api-guard";

export async function POST(request: NextRequest) {
  const { error } = await guardRole("MASTER");
  if (error) return error;

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const tipo = formData.get("tipo") as string | null;

  if (!file || !tipo) {
    return NextResponse.json({ error: "MISSING_FIELDS" }, { status: 400 });
  }

  const validTipos = ["video_espera", "imagen_activa", "video_sesion"];
  if (!validTipos.includes(tipo)) {
    return NextResponse.json({ error: "INVALID_TIPO" }, { status: 400 });
  }

  const ext = file.name.split(".").pop();
  const fileName = `${tipo}.${ext}`;

  const admin = createAdminClient();
  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  const { error: uploadErr } = await admin.storage
    .from("agua-energetica")
    .upload(fileName, buffer, {
      contentType: file.type,
      upsert: true,
    });

  if (uploadErr) {
    return NextResponse.json({ error: "UPLOAD_ERROR", message: uploadErr.message }, { status: 500 });
  }

  const { data: urlData } = admin.storage.from("agua-energetica").getPublicUrl(fileName);
  const publicUrl = urlData.publicUrl;

  // Actualizar config
  const { data: config } = await admin.from("agua_energetica_config").select("id").single();
  if (config) {
    await admin.from("agua_energetica_config")
      .update({ [`${tipo}_url`]: publicUrl, updated_at: new Date().toISOString() })
      .eq("id", config.id);
  }

  return NextResponse.json({ url: publicUrl }, { status: 201 });
}
