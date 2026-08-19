import { type NextRequest, NextResponse } from "next/server";
import { createRouteClient } from "@/lib/supabase/route-handler";

export async function POST(request: NextRequest) {
  const { supabase, applyTo } = createRouteClient(request);
  await supabase.auth.signOut();

  const response = NextResponse.redirect(new URL("/inicio", request.url));
  applyTo(response);
  return response;
}

