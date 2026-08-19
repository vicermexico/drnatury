import { type NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

function checkApiKey(request: NextRequest): boolean {
  const key = request.headers.get("x-api-key");
return key === process.env.BIORED_API_KEY;
}

export async function GET(request: NextRequest) {
  if (!checkApiKey(request)) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("branches")
    .select("id, name, address, municipio, estado, lat, lng")
    .eq("is_active", true)
    .is("deleted_at", null)
    .order("name");

  if (error) return NextResponse.json({ error: "DB_ERROR" }, { status: 500 });

  return NextResponse.json(data);
}


