import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// El rol "producción" tiene un almacén fijo de verdad (a diferencia de
// repartidor, que no tiene almacén y por eso RLS ya le devuelve todo vacío
// en cualquier otra pantalla) — sin este bloqueo, entrar a mano a
// /ventas, /pedidos, /compras, etc. le mostraría datos reales de ese
// almacén. Esto es la barrera de navegación; RLS sigue siendo la barrera
// real de datos por debajo.
const PRODUCCION_PERMITIDO = ["/produccion", "/dashboard", "/login", "/auth"];

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Refreshes the session cookie if it's expired. Required so Server
  // Components can read a valid session via the cookie-based client above.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (
    !user &&
    !request.nextUrl.pathname.startsWith("/login") &&
    !request.nextUrl.pathname.startsWith("/auth")
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user) {
    const { data: usuario } = await supabase
      .from("usuarios")
      .select("rol")
      .eq("id", user.id)
      .maybeSingle();

    if (
      usuario?.rol === "produccion" &&
      !PRODUCCION_PERMITIDO.some((p) => request.nextUrl.pathname.startsWith(p))
    ) {
      const url = request.nextUrl.clone();
      url.pathname = "/produccion";
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}
