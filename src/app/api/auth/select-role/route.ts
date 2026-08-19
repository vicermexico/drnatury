import { type NextRequest, NextResponse } from "next/server";
import { createRouteClient } from "@/lib/supabase/route-handler";
import { createAdminClient } from "@/lib/supabase/admin";
import { getRolePath } from "@/lib/auth";
import type { Role } from "@/types";

export async function POST(request: NextRequest) {
  const { role } = await request.json().catch(() => ({})) as { role?: Role };

  if (!role) {
    return NextResponse.json({ error: "MISSING_ROLE" }, { status: 400 });
  }

  const { supabase } = createRouteClient(request);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  // Verificar que el usuario realmente tiene ese rol
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("roles")
    .eq("id", user.id)
    .single();

  if (!(profile?.roles as Role[] | undefined)?.includes(role)) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const response = NextResponse.json({ nextPath: getRolePath(role) });

  // Cookie de sesiÃ³n de rol â€” dura lo mismo que un turno de trabajo (8h)
  response.cookies.set("selected_role", role, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "none",
    domain: ".drnatury.com",
    maxAge: 60 * 60 * 8,
    path: "/",
  });

  return response;
}


