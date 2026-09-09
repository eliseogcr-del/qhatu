import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { signOut } from "../login/actions";
import AppShell from "@/components/AppShell";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: usuario } = await supabase
    .from("usuarios")
    .select("nombre, rol, almacenes(nombre, es_digital)")
    .eq("id", user.id)
    .maybeSingle();

  const almacen = usuario?.almacenes as unknown as {
    nombre: string;
    es_digital: boolean;
  } | null;

  return (
    <AppShell
      nombre={usuario?.nombre ?? ""}
      rol={usuario?.rol ?? "vendedor"}
      almacenNombre={almacen?.nombre ?? null}
      almacenEsDigital={almacen?.es_digital ?? false}
      userEmail={user.email ?? ""}
      signOutAction={signOut}
    >
      {children}
    </AppShell>
  );
}
