import { NextResponse, type NextRequest } from "next/server";
import ExcelJS from "exceljs";
import { formatFechaHora, inicioDiaLima, finDiaLima } from "@/lib/fecha";
import { createClient } from "@/utils/supabase/server";
import { TIPOS_MOVIMIENTO, TIPO_MOVIMIENTO_LABEL, type TipoMovimiento } from "@/lib/kardex-tipos";

const HEADERS = [
  "Fecha",
  "Producto",
  "Almacén",
  "Tipo",
  "Cantidad",
  "Saldo resultante",
  "Usuario",
  "Detalle",
];
const ANCHOS = [16, 28, 22, 20, 10, 14, 18, 30];

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return new NextResponse("No autorizado", { status: 401 });
  }

  const params = request.nextUrl.searchParams;
  const desde = params.get("desde");
  const hasta = params.get("hasta");
  const productoId = params.get("producto_id");
  const almacenId = params.get("almacen_id");
  const tipo = params.get("tipo");

  let query = supabase
    .from("kardex_movimientos")
    .select(
      "fecha, tipo_movimiento, cantidad, saldo_resultante, detalle, productos(nombre), almacenes(nombre), usuarios(nombre)",
    )
    .order("fecha", { ascending: false });

  if (desde) query = query.gte("fecha", inicioDiaLima(desde));
  if (hasta) query = query.lte("fecha", finDiaLima(hasta));
  if (productoId) query = query.eq("producto_id", productoId);
  if (almacenId) query = query.eq("almacen_id", almacenId);
  if (tipo) query = query.eq("tipo_movimiento", tipo);

  const { data: movimientos } = await query;

  const filas = (movimientos ?? []).map((m) => {
    const producto = m.productos as unknown as { nombre: string } | null;
    const almacen = m.almacenes as unknown as { nombre: string } | null;
    const usuario = m.usuarios as unknown as { nombre: string | null } | null;
    return {
      fecha: formatFechaHora(m.fecha),
      producto: producto?.nombre ?? "—",
      almacen: almacen?.nombre ?? "—",
      tipo: TIPO_MOVIMIENTO_LABEL[m.tipo_movimiento as TipoMovimiento] ?? m.tipo_movimiento,
      cantidad: m.cantidad,
      saldo: m.saldo_resultante,
      usuario: usuario?.nombre ?? "—",
      detalle: m.detalle ?? "—",
    };
  });

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Kardex");

  sheet.addRow(HEADERS).font = { bold: true };
  for (const f of filas) {
    sheet.addRow([f.fecha, f.producto, f.almacen, f.tipo, f.cantidad, f.saldo, f.usuario, f.detalle]);
  }
  ANCHOS.forEach((ancho, i) => {
    sheet.getColumn(i + 1).width = ancho;
  });

  const n = filas.length;
  const primeraFilaDatos = 2;
  const ultimaFilaDatos = 1 + n;

  // Resumen tipo "tabla dinámica" al costado: una celda con lista
  // desplegable para filtrar por Tipo (o "(Todas)") y, por debajo, la suma
  // de Cantidad por producto recalculada en vivo con fórmulas SUMIF(S) —
  // en vez de un PivotTable nativo de Excel, que requiere una estructura
  // de caché binaria propia que no se puede generar de forma confiable
  // fuera de Excel. El resultado se ve y se usa igual: se elige el tipo en
  // la celda K1 y las sumas de abajo se actualizan solas.
  const COL_ETIQUETA = "J";
  const COL_VALOR = "K";
  sheet.getColumn(9).width = 3; // columna I como separador visual
  sheet.getColumn(10).width = 24;
  sheet.getColumn(11).width = 16;

  const productos = Array.from(new Set(filas.map((f) => f.producto))).sort((a, b) =>
    a.localeCompare(b, "es"),
  );
  const sumaPorProducto = new Map<string, number>();
  for (const f of filas) {
    sumaPorProducto.set(f.producto, (sumaPorProducto.get(f.producto) ?? 0) + f.cantidad);
  }

  sheet.getCell(`${COL_ETIQUETA}1`).value = "Tipo";
  sheet.getCell(`${COL_ETIQUETA}1`).font = { bold: true };
  const celdaFiltro = sheet.getCell(`${COL_VALOR}1`);
  celdaFiltro.value = "(Todas)";
  celdaFiltro.font = { bold: true };
  celdaFiltro.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF2CC" } };
  celdaFiltro.dataValidation = {
    type: "list",
    allowBlank: false,
    formulae: [`"(Todas),${TIPOS_MOVIMIENTO.map((t) => TIPO_MOVIMIENTO_LABEL[t]).join(",")}"`],
  };

  const filaEncabezado = 3;
  sheet.getCell(`${COL_ETIQUETA}${filaEncabezado}`).value = "Rótulos de fila";
  sheet.getCell(`${COL_VALOR}${filaEncabezado}`).value = "Suma de Cantidad";
  sheet.getRow(filaEncabezado).font = { bold: true };

  productos.forEach((p, i) => {
    const fila = filaEncabezado + 1 + i;
    sheet.getCell(`${COL_ETIQUETA}${fila}`).value = p;
    sheet.getCell(`${COL_VALOR}${fila}`).value =
      n === 0
        ? 0
        : {
            formula:
              `IF($${COL_VALOR}$1="(Todas)",` +
              `SUMIF($B$${primeraFilaDatos}:$B$${ultimaFilaDatos},${COL_ETIQUETA}${fila},$E$${primeraFilaDatos}:$E$${ultimaFilaDatos}),` +
              `SUMIFS($E$${primeraFilaDatos}:$E$${ultimaFilaDatos},$B$${primeraFilaDatos}:$B$${ultimaFilaDatos},${COL_ETIQUETA}${fila},$D$${primeraFilaDatos}:$D$${ultimaFilaDatos},$${COL_VALOR}$1))`,
            result: sumaPorProducto.get(p) ?? 0,
          };
  });

  const filaTotal = filaEncabezado + 1 + productos.length;
  sheet.getCell(`${COL_ETIQUETA}${filaTotal}`).value = "Total general";
  sheet.getCell(`${COL_ETIQUETA}${filaTotal}`).font = { bold: true };
  const celdaTotal = sheet.getCell(`${COL_VALOR}${filaTotal}`);
  celdaTotal.font = { bold: true };
  celdaTotal.value =
    productos.length === 0
      ? 0
      : {
          formula: `SUM(${COL_VALOR}${filaEncabezado + 1}:${COL_VALOR}${filaTotal - 1})`,
          result: filas.reduce((acc, f) => acc + f.cantidad, 0),
        };

  const buffer = await workbook.xlsx.writeBuffer();

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="kardex.xlsx"',
    },
  });
}
