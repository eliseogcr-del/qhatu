"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import ExcelJS from "exceljs";
import { createClient } from "@/utils/supabase/server";
import { requireAdmin } from "@/utils/supabase/session";
import { chunk } from "@/lib/chunk";

// Un solo formulario/acción para ambos interruptores — antes eran dos
// formularios separados, cada uno con su propio botón "Guardar" uno
// debajo del otro: era fácil marcar una casilla y sin querer enviar el
// formulario del otro interruptor, perdiendo el cambio en silencio (la
// página volvía a mostrar el valor real de la base de datos, sin marcar,
// dando la sensación de que "se desactivaba sola").
export async function actualizarConfiguracionPrecios(formData: FormData) {
  const supabase = await createClient();
  const { empresaId } = await requireAdmin(supabase);

  const bloqueados = formData.get("precios_bloqueados") === "on";
  const descuentoHabilitado = formData.get("descuento_habilitado") === "on";

  const { error } = await supabase.from("configuracion_precios").upsert(
    {
      empresa_id: empresaId,
      precios_bloqueados: bloqueados,
      descuento_habilitado: descuentoHabilitado,
    },
    { onConflict: "empresa_id" },
  );

  if (error) {
    redirect(`/configuracion-precios?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/configuracion-precios");
  redirect("/configuracion-precios?guardado=1");
}

export async function crearPrecioEspecial(formData: FormData) {
  const supabase = await createClient();
  const { empresaId } = await requireAdmin(supabase);

  const clienteId = String(formData.get("cliente_id") ?? "");
  const productoId = String(formData.get("producto_id") ?? "");
  const unidadMedidaId = String(formData.get("unidad_medida_id") ?? "");
  const precio = Number(formData.get("precio") ?? 0);

  // El cliente, producto, unidad de medida y precio se llevan de vuelta al
  // formulario tras cada intento (éxito o error) para no obligar a
  // reescribirlos al cargar varios precios especiales seguidos.
  const previo = new URLSearchParams();
  if (clienteId) previo.set("cliente_id", clienteId);
  if (productoId) previo.set("producto_id", productoId);
  if (unidadMedidaId) previo.set("unidad_medida_id", unidadMedidaId);
  if (formData.get("precio")) previo.set("precio", String(formData.get("precio")));

  if (!clienteId || !productoId || !unidadMedidaId) {
    redirect(
      `/configuracion-precios?error=${encodeURIComponent("Selecciona un cliente, un producto y la unidad de medida.")}&${previo}`,
    );
  }
  if (!(precio > 0)) {
    redirect(
      `/configuracion-precios?error=${encodeURIComponent("El precio especial debe ser mayor a 0.")}&${previo}`,
    );
  }

  const { data: existente } = await supabase
    .from("precios_especiales_cliente")
    .select("id")
    .eq("empresa_id", empresaId)
    .eq("cliente_id", clienteId)
    .eq("producto_id", productoId)
    .maybeSingle();

  if (existente) {
    redirect(
      `/configuracion-precios?error=${encodeURIComponent("Este cliente ya tiene un precio especial para ese producto. Quítalo primero si quieres cambiar el precio.")}&${previo}`,
    );
  }

  const { error } = await supabase.from("precios_especiales_cliente").insert({
    empresa_id: empresaId,
    cliente_id: clienteId,
    producto_id: productoId,
    unidad_medida_id: unidadMedidaId,
    precio,
  });

  if (error) {
    redirect(`/configuracion-precios?error=${encodeURIComponent(error.message)}&${previo}`);
  }

  revalidatePath("/configuracion-precios");
  redirect(`/configuracion-precios?guardado=1&${previo}`);
}

export async function actualizarPrecioEspecial(id: string, formData: FormData) {
  const supabase = await createClient();
  const { empresaId } = await requireAdmin(supabase);

  const precio = Number(formData.get("precio") ?? 0);

  if (!(precio > 0)) {
    redirect(
      `/configuracion-precios?error=${encodeURIComponent("El precio especial debe ser mayor a 0.")}`,
    );
  }

  const { error } = await supabase
    .from("precios_especiales_cliente")
    .update({ precio })
    .eq("id", id)
    .eq("empresa_id", empresaId);

  if (error) {
    redirect(`/configuracion-precios?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/configuracion-precios");
  redirect("/configuracion-precios?guardado=1");
}

export async function eliminarPrecioEspecial(id: string) {
  const supabase = await createClient();
  await requireAdmin(supabase);

  const { error } = await supabase
    .from("precios_especiales_cliente")
    .delete()
    .eq("id", id);

  if (error) throw new Error(error.message);

  revalidatePath("/configuracion-precios");
}

// Columnas del archivo que genera /configuracion-precios/export-plantilla
// (1-indexado, como usa ExcelJS): A Cliente, B Producto, C Unidad de
// medida, D Precio, E Cliente ID, F Producto ID. Las dos últimas van
// ocultas en la plantilla pero Excel las conserva igual si el usuario
// solo tocó la columna Precio — son la forma confiable de volver a
// encontrar el cliente/producto exactos sin depender del nombre (que
// podría repetirse o haber cambiado).
const COL_PRECIO = 4;
const COL_CLIENTE_ID = 5;
const COL_PRODUCTO_ID = 6;

export async function importarPlantillaPrecios(formData: FormData) {
  const supabase = await createClient();
  const { empresaId } = await requireAdmin(supabase);

  const clienteId = String(formData.get("cliente_id") ?? "");
  const archivo = formData.get("archivo");

  if (!clienteId) {
    redirect(
      `/configuracion-precios?error=${encodeURIComponent("Selecciona el cliente antes de importar.")}`,
    );
  }
  if (!(archivo instanceof File) || archivo.size === 0) {
    redirect(
      `/configuracion-precios?error=${encodeURIComponent("Selecciona el archivo de la plantilla (.xlsx).")}`,
    );
  }

  const workbook = new ExcelJS.Workbook();
  try {
    // El tipo Buffer que exceljs declara en su propio .d.ts quedó
    // desactualizado frente al de @types/node — son el mismo objeto en
    // tiempo de ejecución, por eso el cast.
    const bytes: ArrayBuffer = await archivo.arrayBuffer();
    await workbook.xlsx.load(
      Buffer.from(bytes) as unknown as Parameters<typeof workbook.xlsx.load>[0],
    );
  } catch {
    redirect(
      `/configuracion-precios?error=${encodeURIComponent("No se pudo leer el archivo — ¿es un .xlsx exportado desde acá?")}`,
    );
  }

  const sheet = workbook.worksheets[0];
  if (!sheet) {
    redirect(`/configuracion-precios?error=${encodeURIComponent("El archivo no tiene ninguna hoja.")}`);
  }

  const filas: { productoId: string; precio: number }[] = [];
  let clienteDelArchivo: string | null = null;
  let filasConPrecioInvalido = 0;

  sheet.eachRow((row, numeroFila) => {
    if (numeroFila === 1) return; // encabezado

    const clienteIdCelda = String(row.getCell(COL_CLIENTE_ID).value ?? "").trim();
    const productoIdCelda = String(row.getCell(COL_PRODUCTO_ID).value ?? "").trim();
    if (!productoIdCelda) return; // fila vacía o sin la columna oculta

    if (clienteIdCelda) clienteDelArchivo = clienteIdCelda;

    const valorPrecio = row.getCell(COL_PRECIO).value;
    if (valorPrecio === null || valorPrecio === undefined || valorPrecio === "") return; // en blanco: se ignora, no se toca

    const precio = typeof valorPrecio === "number" ? valorPrecio : Number(valorPrecio);
    if (!(precio > 0)) {
      filasConPrecioInvalido += 1;
      return;
    }

    filas.push({ productoId: productoIdCelda, precio: Math.round(precio * 100) / 100 });
  });

  if (clienteDelArchivo && clienteDelArchivo !== clienteId) {
    redirect(
      `/configuracion-precios?error=${encodeURIComponent(
        "Este archivo es la plantilla de otro cliente — expórtala de nuevo para el cliente que elegiste antes de importar.",
      )}`,
    );
  }

  if (filas.length === 0) {
    redirect(
      `/configuracion-precios?error=${encodeURIComponent(
        filasConPrecioInvalido > 0
          ? "Ningún precio es válido (deben ser mayores a 0)."
          : "No hay ningún precio para importar — llena la columna Precio de al menos un producto.",
      )}`,
    );
  }

  const productoIds = [...new Set(filas.map((f) => f.productoId))];
  const productos = (
    await Promise.all(
      chunk(productoIds, 150).map((ids) =>
        supabase.from("productos").select("id, unidad_medida_id").eq("empresa_id", empresaId).in("id", ids),
      ),
    )
  ).flatMap((r) => r.data ?? []);
  const productoPorId = new Map(productos.map((p) => [p.id, p]));

  const filasValidas = filas.filter((f) => productoPorId.get(f.productoId)?.unidad_medida_id);
  const omitidas = filas.length - filasValidas.length;

  if (filasValidas.length === 0) {
    redirect(
      `/configuracion-precios?error=${encodeURIComponent(
        "Ninguno de los productos del archivo tiene unidad de medida configurada — revísalos en Productos antes de reintentar.",
      )}`,
    );
  }

  const { error } = await supabase.from("precios_especiales_cliente").upsert(
    filasValidas.map((f) => ({
      empresa_id: empresaId,
      cliente_id: clienteId,
      producto_id: f.productoId,
      unidad_medida_id: productoPorId.get(f.productoId)!.unidad_medida_id,
      precio: f.precio,
      updated_at: new Date().toISOString(),
    })),
    { onConflict: "empresa_id,cliente_id,producto_id" },
  );

  if (error) {
    redirect(`/configuracion-precios?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/configuracion-precios");
  const resumen =
    omitidas > 0
      ? `Se guardaron ${filasValidas.length} precios especiales (${omitidas} se omitieron por no tener unidad de medida configurada).`
      : `Se guardaron ${filasValidas.length} precios especiales.`;
  redirect(`/configuracion-precios?guardado=1&detalle=${encodeURIComponent(resumen)}`);
}
