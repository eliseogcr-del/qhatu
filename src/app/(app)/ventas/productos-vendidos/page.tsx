import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { formatFecha, hoyLima } from "@/lib/fecha";
import { createClient } from "@/utils/supabase/server";
import { getEmpresaSession } from "@/utils/supabase/session";
import { fetchDetalleProductosVendidos } from "@/utils/supabase/ventas";
import { TIPO_COMPROBANTE_LABEL } from "@/lib/comprobante-links";
import VentasProductosFiltroForm from "@/components/VentasProductosFiltroForm";
import ResultadosCount from "@/components/ResultadosCount";

export default async function VentasProductosVendidosPage({
  searchParams,
}: {
  searchParams: Promise<{
    desde?: string;
    hasta?: string;
    producto_id?: string;
    almacen_id?: string;
  }>;
}) {
  const { desde, hasta, producto_id, almacen_id: almacenIdParam } = await searchParams;
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

  const [{ data: productos }, { data: almacenes }, { filas, error }] = await Promise.all([
    supabase.from("productos").select("id, nombre").eq("activo", true).order("nombre"),
    almacenesQuery,
    fetchDetalleProductosVendidos(supabase, {
      productoId: producto_id,
      fechaDesde: desdeEfectivo,
      fechaHasta: hastaEfectivo,
      almacenId,
    }),
  ]);

  const hayFiltros = !!(
    desde !== undefined ||
    hasta !== undefined ||
    producto_id ||
    (!session.almacenId && almacenId)
  );

  return (
    <div className="p-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-gray-900">Productos vendidos</h1>
          <Link
            href="/ventas"
            className="flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:underline"
          >
            <ArrowLeft size={16} />
            Volver a Ventas
          </Link>
        </div>
        <p className="mb-4 text-sm text-gray-500">
          Detalle línea por línea de todos los productos vendidos.
        </p>

        <VentasProductosFiltroForm
          desde={desdeEfectivo}
          hasta={hastaEfectivo}
          productoId={producto_id ?? ""}
          almacenId={almacenId ?? ""}
          productos={productos ?? []}
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

        <div className="max-h-[70vh] overflow-auto rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="border-b-2 border-sky-200 bg-sky-50 text-gray-700 sticky top-0 z-10">
              <tr>
                <th className="px-4 py-3 font-bold">Tipo de documento</th>
                <th className="px-4 py-3 font-bold">N° de documento</th>
                <th className="px-4 py-3 font-bold">Fecha</th>
                <th className="px-4 py-3 font-bold">Producto</th>
                <th className="px-4 py-3 font-bold">Unidad de medida</th>
                <th className="px-4 py-3 font-bold">Cantidad</th>
                <th className="px-4 py-3 font-bold">Precio unitario</th>
                <th className="px-4 py-3 font-bold">Importe total</th>
                <th className="px-4 py-3 font-bold">Almacén</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((f) => (
                <tr key={f.id} className="border-b-2 border-gray-200 last:border-0">
                  <td className="px-4 py-3 text-gray-600">
                    {f.comprobanteTipo != null
                      ? (TIPO_COMPROBANTE_LABEL[f.comprobanteTipo] ?? "—")
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{f.comprobanteNumero ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-600">{formatFecha(f.fecha)}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">{f.productoNombre}</td>
                  <td className="px-4 py-3 text-gray-600">{f.unidadMedida ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-600">{f.cantidad}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {f.moneda} {f.precioUnitario.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {f.moneda} {f.importe.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{f.almacenNombre ?? "—"}</td>
                </tr>
              ))}

              {filas.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-gray-400">
                    {hayFiltros
                      ? "Ningún producto vendido coincide con los filtros."
                      : "Aún no hay productos vendidos registrados."}
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
