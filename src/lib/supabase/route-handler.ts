import "server-only";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

type PendingCookie = { name: string; value: string; options: CookieOptions };

// Crea un cliente Supabase compatible con Route Handlers de Next.js 15.
// Devuelve el cliente y una función para aplicar las cookies (y headers
// anti-caché) al response final — necesario desde @supabase/ssr 0.10+.
export function createRouteClient(request: NextRequest) {
  const pendingCookies: PendingCookie[] = [];
  const pendingHeaders: Record<string, string> = {};

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookies, headers) {
          cookies.forEach((c) => pendingCookies.push(c));
          if (headers) {
            Object.assign(pendingHeaders, headers);
          }
        },
      },
    }
  );

  function applyTo(response: NextResponse): void {
    pendingCookies.forEach(({ name, value, options }) =>
      response.cookies.set(name, value, options)
    );
    Object.entries(pendingHeaders).forEach(([key, value]) =>
      response.headers.set(key, value)
    );
  }

  return { supabase, applyTo };
}
