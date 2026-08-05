import Link from "next/link";
import { XCircle, Search, X } from "lucide-react";
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

const inputClass =
  "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none";

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
  if (desde) query = query.gte("fecha", desde);
  if (hasta) query = query.lte("fecha", `${hasta}T23:59:59`);
  if (metodoPago) query = query.eq("metodo_pago", metodoPago);
  if (tipoPago) query = query.eq("tipo_pago", tipoPago);
  if (estado) query = query.eq("estado", estado);

  const { data: cobranzas, error } = await query;

  const hayFiltros = !!(q || desde || hasta || metodoPago || tipoPago || estado);

  const sumaActiva =
    cobranzas
      ?.filter((c) => c.estado === "activa")
      .reduce((acc, c) => acc + c.monto, 0) ?? 0;

  return (
    <div className="p-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-gray-900">Cobranzas</h1>
          <Link
            href="/cobranzas/nueva"
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
          >
            + Registrar cobro
          </Link>
        </div>

        <form
          className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
          method="get"
        >
          <div className="min-w-[180px] flex-1">
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Cliente
            </label>
            <div className="relative">
              <Search
                size={16}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                type="text"
                name="q"
                defaultValue={q ?? ""}
                placeholder="Buscar por nombre..."
                className={`${inputClass} pl-9`}
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Desde
            </label>
            <input
              type="date"
              name="desde"
              defaultValue={desde ?? ""}
              className={inputClass}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Hasta
            </label>
            <input
              type="date"
              name="hasta"
              defaultValue={hasta ?? ""}
              className={inputClass}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Método de pago
            </label>
            <select name="metodo_pago" defaultValue={metodoPago ?? ""} className={inputClass}>
              <option value="">Todos</option>
              {METODOS_PAGO.map((m) => (
                <option key={m} value={m}>
                  {METODO_PAGO_LABEL[m]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Tipo de pago
            </label>
            <select name="tipo_pago" defaultValue={tipoPago ?? ""} className={inputClass}>
              <option value="">Todos</option>
              <option value="anticipo">Anticipo</option>
              <option value="pago">Pago</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Estado
            </label>
            <select name="estado" defaultValue={estado ?? ""} className={inputClass}>
              <option value="">Todos</option>
              <option value="activa">Activa</option>
              <option value="anulada">Anulada</option>
            </select>
          </div>
          <button
            type="submit"
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Filtrar
          </button>
          {hayFiltros && (
            <Link
              href="/cobranzas"
              className="flex items-center gap-1 text-sm font-medium text-gray-500 hover:underline"
            >
              <X size={14} />
              Limpiar
            </Link>
          )}
        </form>

        {hayFiltros && rol === "admin" && (
          <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm">
            <p className="text-emerald-800">
              Suma cobrada (cobros activos, según filtros aplicados):{" "}
              <span className="font-semibold">
                {cobranzas?.[0]?.moneda ?? "PEN"} {sumaActiva.toFixed(2)}
              </span>
            </p>
          </div>
        )}

        {error && (
          <p className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error.message}
          </p>
        )}

        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-gray-200 bg-gray-50 text-gray-500">
              <tr>
                <th className="px-4 py-3 font-medium">Cliente</th>
                <th className="px-4 py-3 font-medium">Fecha</th>
                <th className="px-4 py-3 font-medium">Monto</th>
                <th className="px-4 py-3 font-medium">Método</th>
                <th className="px-4 py-3 font-medium">Tipo</th>
                <th className="px-4 py-3 font-medium">Referencia</th>
                <th className="px-4 py-3 font-medium">Estado</th>
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
                    className={`border-b border-gray-100 last:border-0 ${cobranza.estado === "anulada" ? "opacity-50" : ""}`}
                  >
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {cliente?.nombre ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {new Date(cobranza.fecha).toLocaleDateString("es-PE")}
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
