"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { getEmpresaSession } from "@/utils/supabase/session";

function productoFromForm(formData: FormData) {
  const text = (key: string) => {
    const raw = formData.get(key);
    return raw === null || raw === "" ? null : String(raw);
  };
  const num = (key: string) => {
    const raw = formData.get(key);
    if (raw === null || raw === "") return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  };

  return {
    codigo_barra: text("codigo_barra"),
    codigo_proveedor: text("codigo_proveedor"),
    nombre: String(formData.get("nombre") ?? ""),
    descripcion: text("descripcion"),
    marca: text("marca"),
    grupo: text("grupo"),
    familia: text("familia"),
    modelo: text("modelo"),
    proveedor_id: text("proveedor_id"),
    stock_minimo: num("stock_minimo"),
    stock_maximo: num("stock_maximo"),
    afectacion_impuesto: text("afectacion_impuesto"),
    tipo_impuesto: text("tipo_impuesto"),
    cualidad: text("cualidad"),
    control_inventario: formData.get("control_inventario") === "on",
    tipo_producto: String(formData.get("tipo_producto") ?? "bien"),
    lugar_elaboracion: text("lugar_elaboracion"),
    precio_venta: num("precio_venta") ?? 0,
    precio_venta_moneda: String(formData.get("precio_venta_moneda") ?? "PEN"),
    costo_referencial: num("costo_referencial"),
    unidad_medida_id: text("unidad_medida_id"),
    activo: formData.get("activo") === "on",
  };
}

export async function createProducto(formData: FormData) {
  const supabase = await createClient();
  const { empresaId: empresa_id } = await getEmpresaSession(supabase);
  const producto = productoFromForm(formData);

  if (!(producto.precio_venta > 0)) {
    redirect(
      `/productos/nuevo?error=${encodeURIComponent("El precio de venta debe ser mayor a 0.")}`,
    );
  }
  if (!producto.unidad_medida_id) {
    redirect(`/productos/nuevo?error=${encodeURIComponent("Selecciona la unidad de medida.")}`);
  }

  const { error } = await supabase
    .from("productos")
    .insert({ ...producto, empresa_id });

  if (error) {
    redirect(`/productos/nuevo?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/productos");
  redirect("/productos");
}

export async function updateProducto(id: string, formData: FormData) {
  const supabase = await createClient();
  await getEmpresaSession(supabase);
  const producto = productoFromForm(formData);

  if (!(producto.precio_venta > 0)) {
    redirect(
      `/productos/${id}/editar?error=${encodeURIComponent("El precio de venta debe ser mayor a 0.")}`,
    );
  }
  if (!producto.unidad_medida_id) {
    redirect(
      `/productos/${id}/editar?error=${encodeURIComponent("Selecciona la unidad de medida.")}`,
    );
  }

  const { error } = await supabase
    .from("productos")
    .update(producto)
    .eq("id", id);

  if (error) {
    redirect(
      `/productos/${id}/editar?error=${encodeURIComponent(error.message)}`,
    );
  }

  revalidatePath("/productos");
  redirect("/productos");
}

export async function toggleActivoProducto(id: string, activo: boolean) {
  const supabase = await createClient();
  await getEmpresaSession(supabase);

  const { error } = await supabase
    .from("productos")
    .update({ activo })
    .eq("id", id);

  if (error) throw new Error(error.message);

  revalidatePath("/productos");
}
