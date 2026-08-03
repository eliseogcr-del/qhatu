"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";

async function getEmpresaId(supabase: Awaited<ReturnType<typeof createClient>>) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: usuario, error } = await supabase
    .from("usuarios")
    .select("empresa_id")
    .eq("id", user.id)
    .single();

  if (error || !usuario) {
    throw new Error(
      "Tu usuario no tiene un perfil de empresa asociado. Contacta al administrador.",
    );
  }

  return usuario.empresa_id as string;
}

function proveedorFromForm(formData: FormData) {
  const text = (key: string) => {
    const raw = formData.get(key);
    return raw === null || raw === "" ? null : String(raw);
  };

  return {
    nombre: String(formData.get("nombre") ?? ""),
    ruc: text("ruc"),
    contacto: text("contacto"),
    telefono: text("telefono"),
    correo_electronico: text("correo_electronico"),
    activo: formData.get("activo") === "on",
  };
}

export async function createProveedor(formData: FormData) {
  const supabase = await createClient();
  const empresa_id = await getEmpresaId(supabase);
  const proveedor = proveedorFromForm(formData);

  const { error } = await supabase
    .from("proveedores")
    .insert({ ...proveedor, empresa_id });

  if (error) {
    redirect(`/proveedores/nuevo?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/proveedores");
  redirect("/proveedores");
}

export async function updateProveedor(id: string, formData: FormData) {
  const supabase = await createClient();
  await getEmpresaId(supabase);
  const proveedor = proveedorFromForm(formData);

  const { error } = await supabase
    .from("proveedores")
    .update(proveedor)
    .eq("id", id);

  if (error) {
    redirect(
      `/proveedores/${id}/editar?error=${encodeURIComponent(error.message)}`,
    );
  }

  revalidatePath("/proveedores");
  redirect("/proveedores");
}

export async function toggleActivoProveedor(id: string, activo: boolean) {
  const supabase = await createClient();
  await getEmpresaId(supabase);

  const { error } = await supabase
    .from("proveedores")
    .update({ activo })
    .eq("id", id);

  if (error) throw new Error(error.message);

  revalidatePath("/proveedores");
}
