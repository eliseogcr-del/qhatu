import Link from "next/link";
import { ArrowLeft, FileDown } from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import { getEmpresaSession } from "@/utils/supabase/session";
import { hoyLima } from "@/lib/fecha";
import {
  fetchCuadroControlProductos,
  COLUMNA_LABEL,
  COLUMNA_GRUPO,
} from "@/utils/supabase/cuadro-control";
import ReportesLogisticaFiltroForm from "@/components/ReportesLogisticaFiltroForm";
import ResultadosCount from "@/components/ResultadosCount";

export default async function CuadroControlProductosPage({
  searchParams,
}: {
  searchParams: Promise<{ desde?: string; hasta?: string; almacen_id?: string }>;
}) {
  const { desde, hasta, almacen_id: almacenIdParam } = await searchParams;
  const supabase = await createClient();
  const session = await getEmpresaSession(supabase);

  // Un vendedor tiene almacén fijo: siempre ve solo el suyo, sin importar
  // qué venga en la URL. Admin/logística (almacenId null) eligen libremente.
  const almacenId = session.almacenId ?? almacenIdParam;

  // Sin parámetros en la URL (primera carga) se muestra el día de hoy por
  // defecto. Si el usuario borra los campos y filtra, quedan como string
  // vacío (presentes pero sin valor) y ahí sí se ve todo el historial.
  const hoy = hoyLima();
  const desdeEfectivo = desde === undefined ? hoy : desde;
  const hastaEfectivo = hasta === undefined ? hoy : hasta;

  let almacenesQuery = supabase
    .from("almacenes")
    .select("id, nombre")
    .eq("activo", true)
    .order("nombre");
  if (session.almacenId) almacenesQuery = almacenesQuery.eq("id", session.almacenId);

  const [{ data: almacenes }, { filas, columnas, error }] = await Promise.all([
    almacenesQuery,
    fetchCuadroControlProductos(supabase, {
      fechaDesde: desdeEfectivo,
      fechaHasta: hastaEfectivo,
      almacenId,
    }),
  ]);

  const columnasEntrada = columnas.filter((c) => COLUMNA_GRUPO[c] === "entrada");
  const columnasSalida = columnas.filter((c) => COLUMNA_GRUPO[c] === "salida");

  const almacenesConMovimiento = [...new Set(filas.map((f) => f.almacenId))].map((id) => ({
    id,
    nombre: filas.find((f) => f.almacenId === id)!.almacenNombre,
  }));

  const hayFiltros = !!(
    desde !== undefined ||
    hasta !== undefined ||
    (!session.almacenId && almacenId)
  );

  const exportParams = new URLSearchParams();
  exportParams.set("desde", desdeEfectivo);
  exportParams.set("hasta", hastaEfectivo);
  if (almacenId) exportParams.set("almacen_id", almacenId);
  const exportQs = exportParams.toString();

  return (
    <div className="p-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-gray-900">
            Cuadro de Control de Productos
          </h1>
          <div className="flex items-center gap-3">
            <a
              href={`/reportes/cuadro-control/export${exportQs ? `?${exportQs}` : ""}`}
              className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <FileDown size={16} />
              Exportar a Excel
            </a>
            <Link
              href="/dashboard"
              className="flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:underline"
            >
              <ArrowLeft size={16} />
              Volver
            </Link>
          </div>
        </div>
        <p className="mb-6 text-sm text-gray-500">
          Como el Kardex, pero un solo renglón por producto: cada tipo de
          movimiento que tuvo en el rango filtrado, agrupado en Entradas y
          Salidas. Para cuadrar: Saldo anterior + Entradas − Salidas = Stock
          actual. El Stock actual es el de hoy (tabla Inventario), no el
          resultante del rango filtrado.
        </p>

        <ReportesLogisticaFiltroForm
          desde={desdeEfectivo}
          hasta={hastaEfectivo}
          almacenId={almacenId ?? ""}
          almacenes={almacenes ?? []}
          almacenFijoNombre={session.almacenId ? (almacenes?.[0]?.nombre ?? "Tu almacén") : null}
          hayFiltros={hayFiltros}
        />

        {error && (
          <p className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
        )}

        <ResultadosCount count={filas.length} />

        <div className="space-y-6">
          {almacenesConMovimiento.map((a) => {
            const filasAlmacen = filas.filter((f) => f.almacenId === a.id);
            return (
              <div
                key={a.id}
                className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm"
              >
                <div className="border-b border-gray-100 bg-gray-50 px-4 py-3">
                  <p className="font-medium text-gray-900">{a.nombre}</p>
                </div>
                <div className="max-h-[70vh] overflow-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b-2 border-sky-200 bg-sky-50 text-gray-700 sticky top-0 z-10">
                      <tr>
                        <th className="sticky left-0 z-20 border-r-2 border-gray-200 bg-sky-50 px-4 py-2 font-bold align-bottom" rowSpan={2}>
                          Producto
                        </th>
                        <th rowSpan={2} className="px-4 py-2 font-bold align-bottom">
                          Unidad de medida
                        </th>
                        <th rowSpan={2} className="border-l border-sky-200 px-4 py-2 font-bold align-bottom">
                          Saldo anterior
                        </th>
                        {columnasEntrada.length > 0 && (
                          <th
                            colSpan={columnasEntrada.length}
                            className="border-l border-sky-200 bg-blue-50 px-4 py-1 text-center font-bold text-blue-700"
                          >
                            ENTRADAS
                          </th>
                        )}
                        {columnasSalida.length > 0 && (
                          <th
                            colSpan={columnasSalida.length}
                            className="border-l border-sky-200 bg-red-50 px-4 py-1 text-center font-bold text-red-700"
                          >
                            SALIDAS
                          </th>
                        )}
                        <th rowSpan={2} className="border-l border-sky-200 px-4 py-2 font-bold align-bottom">
                          Stock actual
                        </th>
                      </tr>
                      <tr>
                        {columnasEntrada.map((c) => (
                          <th
                            key={c}
                            className="border-l border-sky-100 bg-blue-50 px-4 py-2 font-bold text-blue-700"
                          >
                            {COLUMNA_LABEL[c]}
                          </th>
                        ))}
                        {columnasSalida.map((c) => (
                          <th
                            key={c}
                            className="border-l border-sky-100 bg-red-50 px-4 py-2 font-bold text-red-700"
                          >
                            {COLUMNA_LABEL[c]}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filasAlmacen.map((f) => (
                        <tr key={f.productoId} className="border-b-2 border-gray-200 last:border-0">
                          <td className="sticky left-0 z-10 border-r-2 border-gray-200 bg-white px-4 py-2 font-medium text-gray-900">
                            {f.productoNombre}
                          </td>
                          <td className="px-4 py-2 text-gray-600">{f.unidadMedida}</td>
                          <td className="px-4 py-2 text-gray-600">{f.saldoAnterior}</td>
                          {columnasEntrada.map((c) => {
                            const valor = f.cantidadesPorColumna[c] ?? 0;
                            return (
                              <td key={c} className="px-4 py-2 font-medium text-blue-600">
                                {valor !== 0 ? `+${valor}` : "—"}
                              </td>
                            );
                          })}
                          {columnasSalida.map((c) => {
                            const valor = f.cantidadesPorColumna[c] ?? 0;
                            return (
                              <td key={c} className="px-4 py-2 font-medium text-red-600">
                                {valor !== 0 ? valor : "—"}
                              </td>
                            );
                          })}
                          <td className="px-4 py-2 font-semibold text-gray-900">
                            {f.stockActual}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}

          {almacenesConMovimiento.length === 0 && (
            <p className="rounded-xl border border-gray-200 bg-white p-10 text-center text-sm text-gray-400 shadow-sm">
              No hay movimientos de kardex en este rango.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
