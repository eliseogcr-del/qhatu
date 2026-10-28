import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { mejorOpcionParaRuta, rutaSiempreLibre } from "@/lib/opciones-sistema";

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

  // Qué opciones del sistema ve/puede abrir cada quien ya no depende solo
  // del rol — es personalizable por usuario desde Usuarios → Permisos
  // (usuario_opciones). Admin sigue viendo/operando todo siempre, sin
  // necesidad de filas ahí. Esta es la barrera de navegación (bloquea
  // entrar escribiendo la URL a mano aunque el enlace no se muestre en el
  // menú); RLS sigue siendo la barrera real de datos por debajo.
  if (user && !rutaSiempreLibre(request.nextUrl.pathname)) {
    const { data: usuario } = await supabase
      .from("usuarios")
      .select("rol")
      .eq("id", user.id)
      .maybeSingle();

    if (usuario && usuario.rol !== "admin") {
      const opcion = mejorOpcionParaRuta(request.nextUrl.pathname);
      if (opcion) {
        const { data: permiso } = await supabase
          .from("usuario_opciones")
          .select("opcion_codigo")
          .eq("usuario_id", user.id)
          .eq("opcion_codigo", opcion.codigo)
          .maybeSingle();

        if (!permiso) {
          const url = request.nextUrl.clone();
          url.pathname = "/dashboard";
          return NextResponse.redirect(url);
        }
      }
    }
  }

  return supabaseResponse;
}
