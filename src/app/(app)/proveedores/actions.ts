"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { getEmpresaSession } from "@/utils/supabase/session";

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
  const { empresaId: empresa_id } = await getEmpresaSession(supabase);
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
  await getEmpresaSession(supabase);
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
  await getEmpresaSession(supabase);

  const { error } = await supabase
    .from("proveedores")
    .update({ activo })
    .eq("id", id);

  if (error) throw new Error(error.message);

  revalidatePath("/proveedores");
}
