import Link from "next/link";
import { formatFecha, inicioDiaLima, finDiaLima } from "@/lib/fecha";
import { FileDown, XCircle } from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import { getEmpresaSession } from "@/utils/supabase/session";
import {
  METODOS_PAGO,
  METODO_PAGO_LABEL,
  TIPO_PAGO_LABEL,
  type MetodoPago,
} from "@/lib/cobranza-tipos";
import ConfirmFormButton from "@/components/ConfirmFormButton";
import { anularCobranza } from "./actions";
import CobranzasFiltroForm from "@/components/CobranzasFiltroForm";
import ResultadosCount from "@/components/ResultadosCount";

export default async function CobranzasPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    desde?: string;
    hasta?: string;
    metodo_pago?: string;
    tipo_pago?: string;
    estado?: string;
  }>;
}) {
  const { q, desde, hasta, metodo_pago: metodoPago, tipo_pago: tipoPago, estado } =
    await searchParams;

  const supabase = await createClient();
  const { rol } = await getEmpresaSession(supabase);

  let query = supabase
    .from("cobranzas")
    .select(
      q
        ? "id, fecha, monto, moneda, metodo_pago, tipo_pago, referencia, estado, pedido_id, pedidos!inner(clientes!inner(nombre))"
        : "id, fecha, monto, moneda, metodo_pago, tipo_pago, referencia, estado, pedido_id, pedidos(clientes(nombre))",
    )
    .order("fecha", { ascending: false });

  if (q) query = query.ilike("pedidos.clientes.nombre", `%${q}%`);
  if (desde) query = query.gte("fecha", inicioDiaLima(desde));
  if (hasta) query = query.lte("fecha", finDiaLima(hasta));
  if (metodoPago) query = query.eq("metodo_pago", metodoPago);
  if (tipoPago) query = query.eq("tipo_pago", tipoPago);
  if (estado) query = query.eq("estado", estado);

  const { data: cobranzas, error } = await query;

  const hayFiltros = !!(q || desde || hasta || metodoPago || tipoPago || estado);

  // Resumen de lo cobrado (solo cobros activos) agrupado por método de
  // pago, sobre el mismo conjunto ya filtrado arriba — se recalcula solo
  // con cambiar cualquiera de los filtros existentes.
  const cobranzasActivas = cobranzas?.filter((c) => c.estado === "activa") ?? [];
  const monedaResumen = cobranzas?.[0]?.moneda ?? "PEN";
  const resumenPorMetodo = METODOS_PAGO.map((m) => ({
    metodo: m,
    label: METODO_PAGO_LABEL[m],
    monto:
      Math.round(
        cobranzasActivas
          .filter((c) => c.metodo_pago === m)
          .reduce((acc, c) => acc + c.monto, 0) * 100,
      ) / 100,
  })).filter((r) => r.monto > 0);
  const totalResumen = Math.round(resumenPorMetodo.reduce((acc, r) => acc + r.monto, 0) * 100) / 100;

  const exportParams = new URLSearchParams();
  if (q) exportParams.set("q", q);
  if (desde) exportParams.set("desde", desde);
  if (hasta) exportParams.set("hasta", hasta);
  if (metodoPago) exportParams.set("metodo_pago", metodoPago);
  if (tipoPago) exportParams.set("tipo_pago", tipoPago);
  if (estado) exportParams.set("estado", estado);
  const exportQs = exportParams.toString();

  return (
    <div className="p-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-gray-900">Cobranzas</h1>
          <div className="flex items-center gap-3">
            <a
              href={`/cobranzas/export${exportQs ? `?${exportQs}` : ""}`}
              className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <FileDown size={16} />
              Exportar a Excel
            </a>
            <Link
              href="/cobranzas/nueva"
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
            >
              + Registrar cobro
            </Link>
          </div>
        </div>

        <CobranzasFiltroForm
          q={q ?? ""}
          desde={desde ?? ""}
          hasta={hasta ?? ""}
          metodoPago={metodoPago ?? ""}
          tipoPago={tipoPago ?? ""}
          estado={estado ?? ""}
          opcionesMetodoPago={METODOS_PAGO.map((m) => ({ value: m, label: METODO_PAGO_LABEL[m] }))}
          hayFiltros={hayFiltros}
        />

        {rol === "admin" && resumenPorMetodo.length > 0 && (
          <div className="mb-4 overflow-x-auto rounded-xl border border-emerald-200 bg-emerald-50 shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-emerald-200 text-emerald-900">
                <tr>
                  <th className="px-4 py-2 font-bold">
                    Resumen de lo cobrado{hayFiltros ? " (según filtros aplicados)" : ""}
                  </th>
                  <th className="px-4 py-2 text-right font-bold">Monto</th>
                </tr>
              </thead>
              <tbody>
                {resumenPorMetodo.map((r) => (
                  <tr key={r.metodo} className="border-b border-emerald-100 last:border-0">
                    <td className="px-4 py-2 text-emerald-800">{r.label}</td>
                    <td className="px-4 py-2 text-right text-emerald-800">
                      {monedaResumen} {r.monto.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-emerald-200 font-semibold text-emerald-900">
                  <td className="px-4 py-2">Total</td>
                  <td className="px-4 py-2 text-right">
                    {monedaResumen} {totalResumen.toFixed(2)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {error && (
          <p className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error.message}
          </p>
        )}

        <ResultadosCount count={cobranzas?.length ?? 0} />

        <div className="max-h-[70vh] overflow-auto rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="border-b-2 border-sky-200 bg-sky-50 text-gray-700 sticky top-0 z-10">
              <tr>
                <th className="px-4 py-3 font-bold">Cliente</th>
                <th className="px-4 py-3 font-bold">Fecha</th>
                <th className="px-4 py-3 font-bold">Monto</th>
                <th className="px-4 py-3 font-bold">Método</th>
                <th className="px-4 py-3 font-bold">Tipo</th>
                <th className="px-4 py-3 font-bold">Referencia</th>
                <th className="px-4 py-3 font-bold">Estado</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {cobranzas?.map((cobranza) => {
                const cliente = (
                  cobranza.pedidos as unknown as { clientes: { nombre: string } | null } | null
                )?.clientes;
                return (
                  <tr
                    key={cobranza.id}
                    className={`border-b-2 border-gray-200 last:border-0 ${cobranza.estado === "anulada" ? "opacity-50" : ""}`}
                  >
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {cliente?.nombre ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {formatFecha(cobranza.fecha)}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {cobranza.moneda} {cobranza.monto}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {METODO_PAGO_LABEL[cobranza.metodo_pago as MetodoPago] ??
                        cobranza.metodo_pago}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {TIPO_PAGO_LABEL[cobranza.tipo_pago] ?? cobranza.tipo_pago}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {cobranza.referencia ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={
                          cobranza.estado === "anulada"
                            ? "rounded-full bg-red-100 px-2 py-1 text-xs font-medium text-red-700"
                            : "rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-700"
                        }
                      >
                        {cobranza.estado === "anulada" ? "Anulada" : "Activa"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-3">
                        <Link
                          href={`/pedidos/${cobranza.pedido_id}`}
                          className="text-sm font-medium text-gray-700 hover:underline"
                        >
                          Ver pedido
                        </Link>
                        {cobranza.estado === "activa" && (
                          <ConfirmFormButton
                            action={anularCobranza.bind(null, cobranza.id, "/cobranzas")}
                            confirmMessage="¿Anular este cobro? Quedará registrado en el log de auditoría."
                            icon={<XCircle size={14} />}
                            pendingLabel="Anulando..."
                            className="border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50"
                          >
                            Anular
                          </ConfirmFormButton>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}

              {cobranzas?.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-gray-400">
                    {hayFiltros
                      ? "Ningún cobro coincide con los filtros."
                      : "Aún no hay cobranzas registradas."}
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
