"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { getEmpresaSession } from "@/utils/supabase/session";

function clienteFromForm(formData: FormData) {
  const num = (key: string) => {
    const raw = formData.get(key);
    if (raw === null || raw === "") return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  };
  const text = (key: string) => {
    const raw = formData.get(key);
    return raw === null || raw === "" ? null : String(raw);
  };

  return {
    tipo_documento: String(formData.get("tipo_documento") ?? "DNI"),
    numero_documento: String(formData.get("numero_documento") ?? ""),
    nombre: String(formData.get("nombre") ?? ""),
    contacto: text("contacto"),
    correo_electronico: text("correo_electronico"),
    telefono: text("telefono"),
    departamento: text("departamento"),
    provincia: text("provincia"),
    distrito: text("distrito"),
    direccion: text("direccion"),
    referencia: text("referencia"),
    latitud: num("latitud"),
    longitud: num("longitud"),
    zona: text("zona"),
    giro_negocio: text("giro_negocio"),
    grupo: text("grupo"),
    linea_credito: num("linea_credito") ?? 0,
    codigo_interno: text("codigo_interno"),
    activo: formData.get("activo") === "on",
  };
}

export async function createCliente(formData: FormData) {
  const supabase = await createClient();
  const { empresaId: empresa_id } = await getEmpresaSession(supabase);
  const cliente = clienteFromForm(formData);

  const { error } = await supabase
    .from("clientes")
    .insert({ ...cliente, empresa_id });

  if (error) {
    redirect(`/clientes/nuevo?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/clientes");
  redirect("/clientes");
}

export async function updateCliente(id: string, formData: FormData) {
  const supabase = await createClient();
  await getEmpresaSession(supabase);
  const cliente = clienteFromForm(formData);

  const { error } = await supabase.from("clientes").update(cliente).eq("id", id);

  if (error) {
    redirect(
      `/clientes/${id}/editar?error=${encodeURIComponent(error.message)}`,
    );
  }

  revalidatePath("/clientes");
  redirect("/clientes");
}

export async function toggleActivo(id: string, activo: boolean) {
  const supabase = await createClient();
  await getEmpresaSession(supabase);

  const { error } = await supabase
    .from("clientes")
    .update({ activo })
    .eq("id", id);

  if (error) throw new Error(error.message);

  revalidatePath("/clientes");
}
