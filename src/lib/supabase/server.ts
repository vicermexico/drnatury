import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Cliente de Supabase para usar dentro de Server Components / Server Actions.
//
// IMPORTANTE (Next.js 15): cookies() ahora devuelve una Promise y hay que
// hacerle "await". Si no se le hace await, cookieStore.getAll() no lee
// correctamente las cookies de la sesión y auth.getUser() se comporta como
// si el usuario no hubiera iniciado sesión, aunque el middleware sí lo vea
// autenticado — lo que produce justo el síntoma de "inicio sesión bien,
// pero la página protegida me regresa al login".
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Se puede ignorar: si esto se llama desde un Server Component
            // (no desde una Server Action o Route Handler), Next.js no deja
            // escribir cookies. La sesión se refresca de todos modos en el
            // middleware, que sí puede escribir cookies en cada request.
          }
        },
      },
    }
  );
}
