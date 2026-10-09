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

  const clienteId = request.nextUrl.searchParams.get("cliente_id");
  if (!clienteId) {
    return new NextResponse("Falta el cliente.", { status: 400 });
  }

  const { data: cliente } = await supabase
    .from("clientes")
    .select("nombre")
    .eq("id", clienteId)
    .single();

  if (!cliente) {
    return new NextResponse("Cliente no encontrado.", { status: 404 });
  }

  const [{ data: productos }, { data: especiales }] = await Promise.all([
    supabase
      .from("productos")
      .select("id, nombre, unidad_medida_id, unidades_medida(descripcion)")
      .eq("control_inventario", true)
      .eq("activo", true)
      .order("nombre"),
    supabase
      .from("precios_especiales_cliente")
      .select("producto_id, precio")
      .eq("empresa_id", empresaId)
      .eq("cliente_id", clienteId),
  ]);

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
