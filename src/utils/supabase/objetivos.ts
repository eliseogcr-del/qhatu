import { createClient } from "./server";
import { inicioMesLima, finMesLima, diasDelMes, soloFechaLima } from "@/lib/fecha";
import { chunk } from "@/lib/chunk";

const DIAS_SEMANA = [
  "Domingo",
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
];
// Mismo orden que el Excel (empieza en lunes).
const ORDEN_DIAS_SEMANA = [1, 2, 3, 4, 5, 6, 0];

export type ObjetivosModo = "cobrado" | "total";

export type ObjetivosFiltro = {
  periodo: string; // "AAAA-MM"
  vendedorId?: string | null;
  modo: ObjetivosModo;
};

export type ObjetivosDia = {
  dia: number;
  fechaISO: string;
  diaSemana: string;
  monto: number;
};

export type ObjetivosPorDiaSemana = {
  diaSemana: string;
  total: number;
  promedio: number;
  porcentaje: number;
};

export type ObjetivosPorSemana = {
  semana: number;
  total: number;
  porcentaje: number;
};

export type ObjetivosPorVendedor = {
  vendedorId: string;
  vendedorNombre: string;
  vendido: number;
  meta: number;
  porcentaje: number;
};

export type ObjetivosData = {
  vendido: number;
  meta: number;
  porcentajeAvance: number;
  metaDiaria: number;
  metaSemanal: number;
  saldoParaMeta: number;
  dias: ObjetivosDia[];
  porDiaSemana: ObjetivosPorDiaSemana[];
  porSemana: ObjetivosPorSemana[];
  porVendedor: ObjetivosPorVendedor[];
  error: string | null;
};

const vacio = (error: string | null = null): ObjetivosData => ({
  vendido: 0,
  meta: 0,
  porcentajeAvance: 0,
  metaDiaria: 0,
  metaSemanal: 0,
  saldoParaMeta: 0,
  dias: [],
  porDiaSemana: [],
  porSemana: [],
  porVendedor: [],
  error,
});

// Reporte "Objetivos": compara lo vendido en un mes contra una meta
// cargada a mano (tabla metas_ventas), con el mismo modelo del tablero en
// Excel que lo inspiró (meta mensual → meta diaria/semanal derivadas,
// desglose por día, por día de la semana y por semana).
//
// El "monto" de cada venta depende del modo:
//  - "cobrado": lo efectivamente pagado a la fecha (cobranzas activas de
//    esa venta, sin importar cuándo se pagaron) — si una venta de 500 solo
//    tiene 450 cobrados, cuenta por 450. Esto es justo lo que ya calcula
//    fetchVentasConSaldo, reutilizado acá.
//  - "total": el importe facturado (total - descuento), sin mirar pagos.
// La venta siempre se ubica en el día en que se vendió (v.fecha), nunca en
// la fecha del cobro — un pago de este mes sobre una venta de un mes
// anterior no mueve el tablero del mes actual, solo el del mes de la venta
// (que irá creciendo a medida que se cobra).
export async function fetchObjetivosData(
  supabase: Awaited<ReturnType<typeof createClient>>,
  empresaId: string,
  { periodo, vendedorId, modo }: ObjetivosFiltro,
): Promise<ObjetivosData> {
  let ventasQuery = supabase
    .from("ventas")
    .select(
      `id, fecha, total, descuento, ${
        vendedorId ? "pedidos!inner(usuario_id, usuarios(nombre))" : "pedidos(usuario_id, usuarios(nombre))"
      }`,
    )
    .neq("estado", "anulada")
    .gte("fecha", inicioMesLima(periodo))
    .lte("fecha", finMesLima(periodo));
  if (vendedorId) ventasQuery = ventasQuery.eq("pedidos.usuario_id", vendedorId);

  const [{ data: ventas, error }, { data: metas }] = await Promise.all([
    ventasQuery,
    supabase
      .from("metas_ventas")
      .select("vendedor_id, monto")
      .eq("empresa_id", empresaId)
      .eq("periodo", `${periodo}-01`),
  ]);

  if (error || !ventas) {
    return vacio(error?.message ?? null);
  }

  const cobradoPorVenta = new Map<string, number>();
  if (modo === "cobrado") {
    const ventaIds = ventas.map((v) => v.id);
    const cobranzas = (
      await Promise.all(
        chunk(ventaIds, 150).map((ids) =>
          supabase.from("cobranzas").select("venta_id, monto").in("venta_id", ids).eq("estado", "activa"),
        ),
      )
    ).flatMap((r) => r.data ?? []);
    for (const c of cobranzas) {
      cobradoPorVenta.set(c.venta_id, (cobradoPorVenta.get(c.venta_id) ?? 0) + c.monto);
    }
  }

  type VentaConVendedor = {
    id: string;
    fecha: string;
    total: number;
    descuento: number;
    pedidos: { usuario_id: string; usuarios: { nombre: string | null } | null } | null;
  };

  const metaGeneral = (metas ?? []).find((m) => m.vendedor_id === null)?.monto ?? 0;
  const metaPorVendedor = new Map<string, number>();
  for (const m of metas ?? []) {
    if (m.vendedor_id) metaPorVendedor.set(m.vendedor_id, m.monto);
  }

  const diaMap = new Map<number, number>();
  const vendedorMap = new Map<string, { nombre: string; vendido: number }>();
  let vendido = 0;

  for (const v of ventas as unknown as VentaConVendedor[]) {
    const montoVenta =
      modo === "cobrado"
        ? (cobradoPorVenta.get(v.id) ?? 0)
        : Math.round((v.total - v.descuento) * 100) / 100;
    if (montoVenta <= 0) continue;

    vendido = Math.round((vendido + montoVenta) * 100) / 100;

    const fechaISO = soloFechaLima(v.fecha);
    const dia = Number(fechaISO.slice(8, 10));
    diaMap.set(dia, Math.round(((diaMap.get(dia) ?? 0) + montoVenta) * 100) / 100);

    const vendedorUsuarioId = v.pedidos?.usuario_id;
    if (vendedorUsuarioId) {
      const actual = vendedorMap.get(vendedorUsuarioId) ?? {
        nombre: v.pedidos?.usuarios?.nombre ?? "—",
        vendido: 0,
      };
      actual.vendido = Math.round((actual.vendido + montoVenta) * 100) / 100;
      vendedorMap.set(vendedorUsuarioId, actual);
    }
  }

  const totalDias = diasDelMes(periodo);
  const dias: ObjetivosDia[] = [];
  for (let dia = 1; dia <= totalDias; dia++) {
    const fechaISO = `${periodo}-${String(dia).padStart(2, "0")}`;
    // new Date("AAAA-MM-DD") lo interpreta como medianoche UTC — alcanza
    // para saber el día de la semana (no depende de la hora del día).
    const diaSemanaIdx = new Date(`${fechaISO}T00:00:00Z`).getUTCDay();
    dias.push({
      dia,
      fechaISO,
      diaSemana: DIAS_SEMANA[diaSemanaIdx],
      monto: diaMap.get(dia) ?? 0,
    });
  }

  const meta = vendedorId ? (metaPorVendedor.get(vendedorId) ?? 0) : metaGeneral;

  const acumPorDiaSemana = new Map<number, { total: number; dias: number }>();
  for (const d of dias) {
    const idx = new Date(`${d.fechaISO}T00:00:00Z`).getUTCDay();
    const actual = acumPorDiaSemana.get(idx) ?? { total: 0, dias: 0 };
    actual.total = Math.round((actual.total + d.monto) * 100) / 100;
    actual.dias += 1;
    acumPorDiaSemana.set(idx, actual);
  }
  const porDiaSemana: ObjetivosPorDiaSemana[] = ORDEN_DIAS_SEMANA.map((idx) => {
    const acc = acumPorDiaSemana.get(idx) ?? { total: 0, dias: 0 };
    return {
      diaSemana: DIAS_SEMANA[idx],
      total: acc.total,
      promedio: acc.dias > 0 ? Math.round((acc.total / acc.dias) * 100) / 100 : 0,
      porcentaje: vendido > 0 ? acc.total / vendido : 0,
    };
  });

  const acumPorSemana = new Map<number, number>();
  for (const d of dias) {
    const semana = Math.floor((d.dia - 1) / 7) + 1;
    acumPorSemana.set(semana, Math.round(((acumPorSemana.get(semana) ?? 0) + d.monto) * 100) / 100);
  }
  const porSemana: ObjetivosPorSemana[] = [...acumPorSemana.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([semana, total]) => ({
      semana,
      total,
      porcentaje: meta > 0 ? total / meta : 0,
    }));

  const porVendedor: ObjetivosPorVendedor[] = vendedorId
    ? []
    : [...vendedorMap.entries()]
        .map(([id, { nombre, vendido: vendidoVendedor }]) => {
          const metaVendedor = metaPorVendedor.get(id) ?? 0;
          return {
            vendedorId: id,
            vendedorNombre: nombre,
            vendido: vendidoVendedor,
            meta: metaVendedor,
            porcentaje: metaVendedor > 0 ? vendidoVendedor / metaVendedor : 0,
          };
        })
        .sort((a, b) => b.vendido - a.vendido);

  const metaDiaria = totalDias > 0 ? Math.round((meta / totalDias) * 100) / 100 : 0;

  return {
    vendido,
    meta,
    porcentajeAvance: meta > 0 ? vendido / meta : 0,
    metaDiaria,
    metaSemanal: Math.round(metaDiaria * 7 * 100) / 100,
    saldoParaMeta: Math.max(0, Math.round((meta - vendido) * 100) / 100),
    dias,
    porDiaSemana,
    porSemana,
    porVendedor,
    error: null,
  };
}
