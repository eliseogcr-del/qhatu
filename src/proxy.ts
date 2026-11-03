import { type NextRequest } from "next/server";
import { updateSession } from "@/utils/supabase/middleware";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    // El "purpose/next-router-prefetch" excluye las precargas automáticas
    // de Next.js (ej. cada link visible del menú lateral) — con Next 16 el
    // proxy corre por defecto como función Node (ya no Edge liviano), así
    // que cada prefetch innecesario es una ejecución real que consume CPU
    // facturable. La navegación real del usuario sigue pasando por acá
    // igual, así que la seguridad de rutas no se pierde.
    {
      source:
        "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
