import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { getAuthUser } from "@/utils/supabase/session";
import { obtenerOpcionesUsuario } from "@/utils/supabase/opciones";
import { signOut } from "../login/actions";
import AppShell from "@/components/AppShell";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  // getAuthUser() está cacheada por request (React cache()): esta misma
  // verificación la vuelve a pedir getEmpresaSession() dentro de la página
  // que se esté mostrando, y gracias al cache comparten una sola llamada
  // real a Supabase en vez de duplicarla en cada navegación.
  const user = await getAuthUser();

  if (!user) redirect("/login");

  const { data: usuario } = await supabase
    .from("usuarios")
    .select("nombre, rol, almacenes!almacen_id(nombre)")
    .eq("id", user.id)
    .maybeSingle();

  const almacen = usuario?.almacenes as unknown as { nombre: string } | null;
  const rol = usuario?.rol ?? "vendedor";
  // Admin ve el catálogo completo igual (SidebarNav lo trata aparte) —
  // no hace falta esta consulta para él.
  const opciones = rol === "admin" ? [] : [...(await obtenerOpcionesUsuario(supabase, user.id))];

  return (
    <AppShell
      nombre={usuario?.nombre ?? ""}
      rol={rol}
      almacenNombre={almacen?.nombre ?? null}
      opciones={opciones}
      userEmail={user.email ?? ""}
      signOutAction={signOut}
    >
      {children}
    </AppShell>
  );
}
