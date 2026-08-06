"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { getEmpresaSession } from "@/utils/supabase/session";
import { consultarDni, consultarRuc, type ConsultaDocumento } from "@/utils/decolecta";

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

// Alta rápida desde un combobox (ej. venta directa): sin redirect, devuelve
// el cliente creado (o un error) para que el formulario que la invocó pueda
// seleccionarlo al vuelo sin perder lo que el usuario ya llenó.
export async function createClienteRapido(
  formData: FormData,
): Promise<{ id: string; nombre: string } | { error: string }> {
  const supabase = await createClient();
  const { empresaId } = await getEmpresaSession(supabase);
  const cliente = clienteFromForm(formData);

  if (!cliente.nombre || !cliente.numero_documento) {
    return { error: "Nombre y número de documento son obligatorios." };
  }

  const { data, error } = await supabase
    .from("clientes")
    .insert({ ...cliente, empresa_id: empresaId })
    .select("id, nombre")
    .single();

  if (error || !data) {
    return { error: error?.message ?? "No se pudo registrar el cliente." };
  }

  revalidatePath("/clientes");
  return { id: data.id, nombre: data.nombre };
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

// Autocompletar nombre/razón social y dirección a partir del número de
// documento (DNI o RUC), consultando SUNAT/RENIEC vía Decolecta.
export async function consultarDocumento(
  tipoDocumento: string,
  numeroDocumento: string,
): Promise<ConsultaDocumento | { error: string }> {
  const supabase = await createClient();
  await getEmpresaSession(supabase);

  const numero = numeroDocumento.trim();

  try {
    if (tipoDocumento === "RUC") {
      if (numero.length !== 11) return { error: "El RUC debe tener 11 dígitos." };
      return await consultarRuc(numero);
    }
    if (tipoDocumento === "DNI") {
      if (numero.length !== 8) return { error: "El DNI debe tener 8 dígitos." };
      return await consultarDni(numero);
    }
    return { error: "La búsqueda automática solo está disponible para DNI y RUC." };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "No se pudo consultar el documento.",
    };
  }
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
