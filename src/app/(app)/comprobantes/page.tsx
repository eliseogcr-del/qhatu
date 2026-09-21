import Link from "next/link";
import { formatFecha, hoyLima, inicioDiaLima, finDiaLima } from "@/lib/fecha";
import { FileText } from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import { requireComprobantesAcceso } from "@/utils/supabase/session";
import {
  TIPO_COMPROBANTE_LABEL,
  TIPOS_DOCUMENTO_FILTRO,
  enlacePdfComprobante,
} from "@/lib/comprobante-links";
import ComprobantesFiltroForm from "@/components/ComprobantesFiltroForm";
import ResultadosCount from "@/components/ResultadosCount";

const ESTADO_BADGE: Record<string, string> = {
  emitido: "bg-green-100 text-green-700",
  aceptada: "bg-green-100 text-green-700",
  pendiente: "bg-yellow-100 text-yellow-700",
  error: "bg-red-100 text-red-700",
  rechazada: "bg-red-100 text-red-700",
  anulado: "bg-gray-100 text-gray-600",
};

// La Guía de Remisión vive en su propia tabla (se emite desde un reparto,
// no desde una venta — ver guias_remision) — para que el filtro "Tipo de
// documento" la incluya junto a factura/boleta/notas, se consulta aparte
// y se normaliza a la misma forma de fila antes de mezclar y ordenar.
const TIPO_GUIA_REMISION = 7;

type Fila = {
  id: string;
  tipoComprobante: number;
  serie: string;
  numero: number;
  estado: string;
  enlacePdf: string | null;
  enlaceXml: string | null;
  fechaEmision: string;
  clienteNombre: string;
  almacenNombre: string;
  totalTexto: string;
  verHref: string;
  verLabel: string;
};

export default async function ComprobantesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; desde?: string; hasta?: string; estado?: string; tipo?: string }>;
}) {
  const { q, desde, hasta, estado, tipo } = await searchParams;
  const supabase = await createClient();
  await requireComprobantesAcceso(supabase);

  // Sin parámetros en la URL (primera carga) se muestra el día de hoy por
  // defecto, igual que en Ventas — si el usuario borra los campos de fecha
  // y filtra, quedan como string vacío (presentes pero sin valor) y ahí sí
  // se ve todo el historial.
  const hoy = hoyLima();
  const desdeEfectivo = desde === undefined ? hoy : desde;
  const hastaEfectivo = hasta === undefined ? hoy : hasta;

  const tipoNumero = tipo ? Number(tipo) : null;
  const incluirComprobantes = !tipoNumero || tipoNumero !== TIPO_GUIA_REMISION;
  const incluirGuiasRemision = !tipoNumero || tipoNumero === TIPO_GUIA_REMISION;

  let filasComprobantes: Fila[] = [];
  let errorComprobantes: { message: string } | null = null;

  if (incluirComprobantes) {
    let query = supabase
      .from("comprobantes")
      .select(
        q
          ? "id, tipo_comprobante, serie, numero, estado, enlace_pdf, enlace_xml, fecha_emision, venta_id, almacenes(nombre), ventas!inner(total, moneda, clientes!inner(nombre))"
          : "id, tipo_comprobante, serie, numero, estado, enlace_pdf, enlace_xml, fecha_emision, venta_id, almacenes(nombre), ventas(total, moneda, clientes(nombre))",
      )
      .order("fecha_emision", { ascending: false });

    if (q) query = query.ilike("ventas.clientes.nombre", `%${q}%`);
    if (desdeEfectivo) query = query.gte("fecha_emision", inicioDiaLima(desdeEfectivo));
    if (hastaEfectivo) query = query.lte("fecha_emision", finDiaLima(hastaEfectivo));
    if (estado) query = query.eq("estado", estado);
    if (tipoNumero) query = query.eq("tipo_comprobante", tipoNumero);

    const { data, error } = await query;
    errorComprobantes = error;
    filasComprobantes = (data ?? []).map((c) => {
      const venta = c.ventas as unknown as {
        total: number;
        moneda: string;
        clientes: { nombre: string } | null;
      } | null;
      const almacen = c.almacenes as unknown as { nombre: string } | null;
      return {
        id: c.id,
        tipoComprobante: c.tipo_comprobante,
        serie: c.serie,
        numero: c.numero,
        estado: c.estado,
        enlacePdf: enlacePdfComprobante(c),
        enlaceXml: c.enlace_xml,
        fechaEmision: c.fecha_emision,
        clienteNombre: venta?.clientes?.nombre ?? "—",
        almacenNombre: almacen?.nombre ?? "—",
        totalTexto: venta ? `${venta.moneda} ${venta.total.toFixed(2)}` : "—",
        verHref: `/ventas/${c.venta_id}`,
        verLabel: "Ver venta",
      };
    });
  }

  let filasGuias: Fila[] = [];
  let errorGuias: { message: string } | null = null;

  if (incluirGuiasRemision) {
    let query = supabase
      .from("guias_remision")
      .select(
        q
          ? "id, tipo_comprobante, serie, numero, estado, enlace_pdf, enlace_xml, fecha_emision, reparto_id, repartos!inner(pedidos!inner(clientes!inner(nombre), almacenes!inner(nombre)))"
          : "id, tipo_comprobante, serie, numero, estado, enlace_pdf, enlace_xml, fecha_emision, reparto_id, repartos(pedidos(clientes(nombre), almacenes(nombre)))",
      )
      .order("fecha_emision", { ascending: false });

    if (q) query = query.ilike("repartos.pedidos.clientes.nombre", `%${q}%`);
    if (desdeEfectivo) query = query.gte("fecha_emision", inicioDiaLima(desdeEfectivo));
    if (hastaEfectivo) query = query.lte("fecha_emision", finDiaLima(hastaEfectivo));
    if (estado) query = query.eq("estado", estado);

    const { data, error } = await query;
    errorGuias = error;
    filasGuias = (data ?? []).map((g) => {
      const pedido = (
        g.repartos as unknown as {
          pedidos: {
            clientes: { nombre: string } | null;
            almacenes: { nombre: string } | null;
          } | null;
        } | null
      )?.pedidos;
      return {
        id: g.id,
        tipoComprobante: g.tipo_comprobante,
        serie: g.serie,
        numero: g.numero,
        estado: g.estado,
        enlacePdf: g.enlace_pdf,
        enlaceXml: g.enlace_xml,
        fechaEmision: g.fecha_emision,
        clienteNombre: pedido?.clientes?.nombre ?? "—",
        almacenNombre: pedido?.almacenes?.nombre ?? "—",
        totalTexto: "—",
        verHref: `/repartos/${g.reparto_id}/editar`,
        verLabel: "Ver reparto",
      };
    });
  }

  const filas = [...filasComprobantes, ...filasGuias].sort(
    (a, b) => new Date(b.fechaEmision).getTime() - new Date(a.fechaEmision).getTime(),
  );

  const error = errorComprobantes ?? errorGuias;
  const hayFiltros = !!(q || desde !== undefined || hasta !== undefined || estado || tipo);

  return (
    <div className="p-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex items-center gap-3">
          <FileText size={24} className="text-emerald-700" />
          <h1 className="text-2xl font-semibold text-gray-900">Comprobantes electrónicos</h1>
        </div>
        <p className="mb-6 text-sm text-gray-500">
          Facturas y boletas emitidas a través de Nubefact, notas de venta
          (documento interno, sin XML ni valor fiscal) y guías de remisión
          emitidas desde Reparto.
        </p>

        <ComprobantesFiltroForm
          q={q ?? ""}
          desde={desdeEfectivo}
          hasta={hastaEfectivo}
          estado={estado ?? ""}
          tipo={tipo ?? ""}
          opcionesTipo={TIPOS_DOCUMENTO_FILTRO.map((t) => ({
            value: String(t),
            label: TIPO_COMPROBANTE_LABEL[t],
          }))}
          hayFiltros={hayFiltros}
        />

        {error && (
          <p className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error.message}
          </p>
        )}

        <ResultadosCount count={filas.length} />

        <div className="max-h-[70vh] overflow-auto rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="border-b-2 border-sky-200 bg-sky-50 text-gray-700 sticky top-0 z-10">
              <tr>
                <th className="px-4 py-3 font-bold">Comprobante</th>
                <th className="px-4 py-3 font-bold">Cliente</th>
                <th className="px-4 py-3 font-bold">Almacén</th>
                <th className="px-4 py-3 font-bold">Fecha</th>
                <th className="px-4 py-3 font-bold">Total</th>
                <th className="px-4 py-3 font-bold">Estado</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {filas.map((f) => (
                <tr key={f.id} className="border-b-2 border-gray-200 last:border-0">
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {TIPO_COMPROBANTE_LABEL[f.tipoComprobante] ?? "Comprobante"} {f.serie}-
                    {f.numero}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{f.clienteNombre}</td>
                  <td className="px-4 py-3 text-gray-600">{f.almacenNombre}</td>
                  <td className="px-4 py-3 text-gray-600">{formatFecha(f.fechaEmision)}</td>
                  <td className="px-4 py-3 text-gray-600">{f.totalTexto}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-medium ${ESTADO_BADGE[f.estado] ?? "bg-gray-100 text-gray-600"}`}
                    >
                      {f.estado}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-3">
                      {f.enlacePdf && (
                        <a
                          href={f.enlacePdf}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-medium text-emerald-700 hover:underline"
                        >
                          Ver PDF
                        </a>
                      )}
                      {f.enlaceXml && (
                        <a
                          href={f.enlaceXml}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-medium text-emerald-700 hover:underline"
                        >
                          XML
                        </a>
                      )}
                      <Link
                        href={f.verHref}
                        className="text-sm font-medium text-gray-700 hover:underline"
                      >
                        {f.verLabel}
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}

              {filas.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-gray-400">
                    {hayFiltros
                      ? "Ningún comprobante coincide con los filtros."
                      : "Aún no hay comprobantes emitidos."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
