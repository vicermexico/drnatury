import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const admin = createAdminClient();
  const { data } = await admin
    .from("ph_revision_config")
    .select("*")
    .single();
  return NextResponse.json(data);
}
