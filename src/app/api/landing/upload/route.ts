import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getServerProfile } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const profile = await getServerProfile();
  if (!profile) {
    return NextResponse.json({ message: "No autorizado" }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File;

  if (!file) {
    return NextResponse.json({ message: "No se recibió archivo" }, { status: 400 });
  }

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  const filename = `${Date.now()}-${file.name}`;

  const admin = createAdminClient();
  const { error } = await admin.storage
    .from("landing")
    .upload(filename, buffer, {
      contentType: file.type,
      upsert: true,
    });

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  const { data } = admin.storage.from("landing").getPublicUrl(filename);

  return NextResponse.json({ url: data.publicUrl });
}