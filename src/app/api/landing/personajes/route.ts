import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getServerProfile } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const profile = await getServerProfile();
  if (!profile) {
    return NextResponse.json({ message: "No autorizado" }, { status: 401 });
  }

  const body = (await req.json()) as {
    nombre?: string;
    puesto?: string;
    imagen_url: string;
    orden?: number;
  };

  const admin = createAdminClient();
  const { error } = await admin.from("landing_personajes").insert({
    nombre: body.nombre ?? "",
    puesto: body.puesto ?? "",
    imagen_url: body.imagen_url,
    orden: body.orden ?? 0,
  });

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
