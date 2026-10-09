import { NextResponse, type NextRequest } from "next/server";
import ExcelJS from "exceljs";
import { createClient } from "@/utils/supabase/server";
import { requireAdmin } from "@/utils/supabase/session";

const HEADERS = ["Cliente", "Producto", "Unidad de medida", "Precio", "Cliente ID", "Producto ID"];
const ANCHOS = [28, 32, 18, 14, 2, 2];

// Columnas E y F (Cliente ID / Producto ID) van ocultas — solo sirven
// para que importar-plantilla pueda volver a encontrar exactamente el
// mismo cliente/producto sin depender de que el nombre no haya cambiado
// ni se repita con otro. El usuario nunca necesita tocarlas; con que no
// las borre alcanza (Excel las conserva solas si solo edita "Precio").
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { empresaId } = await requireAdmin(supabase);

  // Nunca un NextResponse de solo texto para los errores: eso saca a la
  // persona de la app sin ningún botón para volver — mejor redirigir a la
  // misma pantalla con el aviso de siempre.
  const volver = (mensaje: string) =>
    NextResponse.redirect(
      new URL(`/configuracion-precios?error=${encodeURIComponent(mensaje)}`, request.url),
    );

  const clienteId = request.nextUrl.searchParams.get("cliente_id");
  if (!clienteId) {
    return volver("Elige un cliente de la lista antes de exportar la plantilla.");
  }

  const { data: cliente } = await supabase
    .from("clientes")
    .select("nombre")
    .eq("id", clienteId)
    .single();

  if (!cliente) {
    return volver("Ese cliente ya no existe — elige otro.");
  }

  const [{ data: productos, error: errorProductos }, { data: especiales, error: errorEspeciales }] =
    await Promise.all([
      // productos tiene DOS columnas que apuntan a unidades_medida
      // (unidad_medida_id y unidad_venta_defecto_id) — sin el
      // "!unidad_medida_id" el embed queda ambiguo y PostgREST devuelve
      // error (que acá quedaba sin revisar, dejando la plantilla vacía en
      // silencio).
      supabase
        .from("productos")
        .select("id, nombre, unidad_medida_id, unidades_medida!unidad_medida_id(descripcion)")
        .eq("control_inventario", true)
        .eq("activo", true)
        .order("nombre"),
      supabase
        .from("precios_especiales_cliente")
        .select("producto_id, precio")
        .eq("empresa_id", empresaId)
        .eq("cliente_id", clienteId),
    ]);

  if (errorProductos || errorEspeciales) {
    return volver(`No se pudo armar la plantilla: ${(errorProductos ?? errorEspeciales)?.message}`);
  }

  const precioPorProducto = new Map((especiales ?? []).map((e) => [e.producto_id, e.precio]));

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Precios especiales");

  sheet.addRow(HEADERS).font = { bold: true };
  for (const p of productos ?? []) {
    const unidad = p.unidades_medida as unknown as { descripcion: string } | null;
    sheet.addRow([
      cliente.nombre,
      p.nombre,
      unidad?.descripcion ?? "—",
      precioPorProducto.get(p.id) ?? null,
      clienteId,
      p.id,
    ]);
  }
  ANCHOS.forEach((ancho, i) => {
    sheet.getColumn(i + 1).width = ancho;
  });
  sheet.getColumn(5).hidden = true;
  sheet.getColumn(6).hidden = true;

  const buffer = await workbook.xlsx.writeBuffer();
  const nombreArchivo = `precios-especiales-${cliente.nombre.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.xlsx`;

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${nombreArchivo}"`,
    },
  });
}
