import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Rutas accesibles sin sesión
const PUBLIC_PATHS = [
  "/",
  "/inicio/servicio",
  "/login",
  "/registro",
  "/setup",             // configuración inicial del MASTER (uso único)
  "/seleccionar-rol",
  "/aviso-privacidad",
  "/terminos-de-uso",
  "/derechos-arco",
  "/cita",              // link de confirmar/cancelar desde WhatsApp
  "/api/auth/login",
  "/api/auth/register",
  "/api/setup",
  "/api/cron",
  "/resultado",
];

// Qué rol necesita cada prefijo de ruta
const ROLE_REQUIRED: Record<string, string> = {
  "/master":    "MASTER",
  "/terapeuta": "TERAPEUTA",
  "/asistente": "ASISTENTE",
  "/almacen":   "ALMACENISTA",
  "/paciente":  "PACIENTE",
};

function noStore(res: NextResponse) {
  // Evita que Vercel/Next guarden en caché una respuesta de una ruta
  // protegida por sesión (por ejemplo, un redirect a /login calculado
  // para un usuario sin sesión, que luego se serviría también a un
  // usuario que sí inició sesión).
  res.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
  return res;
}

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const pathname = request.nextUrl.pathname;

  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return noStore(supabaseResponse);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return noStore(NextResponse.redirect(new URL("/login", request.url)));
  }

  // Verificar rol para rutas protegidas
  const requiredRole = Object.entries(ROLE_REQUIRED).find(([prefix]) =>
    pathname.startsWith(prefix)
  )?.[1];

  if (requiredRole) {
    const selectedRole = request.cookies.get("selected_role")?.value;
    // Si el usuario tiene múltiples roles y no ha seleccionado uno, redirigir al selector
    if (!selectedRole) {
      return noStore(NextResponse.redirect(new URL("/seleccionar-rol", request.url)));
    }
    if (selectedRole !== requiredRole) {
      return noStore(NextResponse.redirect(new URL("/seleccionar-rol", request.url)));
    }
  }

  return noStore(supabaseResponse);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.json|icons|public).*)",
  ],
};
