import Link from "next/link";
import { ArrowLeft, Printer, Send } from "lucide-react";
import { notFound } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { requireComercial } from "@/utils/supabase/session";
import { formatFecha } from "@/lib/fecha";

export default async function CotizacionDetallePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const supabase = await createClient();
  await requireComercial(supabase);

  const { data: cotizacion } = await supabase
    .from("cotizaciones")
    .select(
      "id, numero, fecha, moneda, subtotal, igv, total, porcentaje_igv, condiciones_comerciales, pedido_id, cliente_id, prospecto_nombre, prospecto_ruc, prospecto_telefono, prospecto_correo, clientes(nombre, numero_documento, telefono, correo_electronico), usuarios(nombre)",
    )
    .eq("id", id)
    .maybeSingle();

  if (!cotizacion) notFound();

  const { data: detalle } = await supabase
    .from("cotizacion_detalle")
    .select("cantidad, precio_unitario, subtotal, productos(nombre), unidades_medida(descripcion)")
    .eq("cotizacion_id", id);

  const cliente = cotizacion.clientes as unknown as {
    nombre: string;
    numero_documento: string;
    telefono: string | null;
    correo_electronico: string | null;
  } | null;
  const ejecutivo = cotizacion.usuarios as unknown as { nombre: string | null } | null;

  return (
    <div className="p-8">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-gray-900">
            Cotización #{cotizacion.numero}
          </h1>
          <Link
            href="/cotizaciones"
            className="flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:underline"
          >
            <ArrowLeft size={16} />
            Volver al listado
          </Link>
        </div>

        {error && (
          <p className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
        )}

        <div className="mb-6 flex flex-wrap gap-3">
          <Link
            href={`/cotizaciones-pdf/${id}`}
            target="_blank"
            className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
          >
            <Printer size={16} />
            Ver / imprimir PDF
          </Link>
          {cotizacion.pedido_id ? (
            <Link
              href={`/pedidos/${cotizacion.pedido_id}`}
              className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
            >
              Ver pedido generado
            </Link>
          ) : (
            <Link
              href={`/cotizaciones/${id}/enviar-a-pedido`}
              className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
            >
              <Send size={16} />
              Enviar a pedido
            </Link>
          )}
        </div>

        <div className="space-y-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase text-gray-500">Cliente</p>
              <p className="text-gray-900">{cliente?.nombre ?? cotizacion.prospecto_nombre ?? "—"}</p>
              {!cliente && (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700">
                  Prospecto sin registrar
                </span>
              )}
              <p className="text-sm text-gray-500">
                {cliente?.numero_documento ?? cotizacion.prospecto_ruc ?? "—"}
              </p>
              <p className="text-sm text-gray-500">
                {cliente?.telefono ?? cotizacion.prospecto_telefono ?? "—"} ·{" "}
                {cliente?.correo_electronico ?? cotizacion.prospecto_correo ?? "—"}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase text-gray-500">Fecha</p>
              <p className="text-gray-900">{formatFecha(cotizacion.fecha)}</p>
              <p className="mt-2 text-xs font-semibold uppercase text-gray-500">
                Ejecutivo comercial
              </p>
              <p className="text-gray-900">{ejecutivo?.nombre ?? "—"}</p>
            </div>
          </div>

          <table className="w-full text-left text-sm">
            <thead className="border-b border-gray-200 text-xs uppercase text-gray-500">
              <tr>
                <th className="py-2">Producto</th>
                <th className="py-2">Cantidad</th>
                <th className="py-2">Unidad</th>
                <th className="py-2 text-right">P. unitario</th>
                <th className="py-2 text-right">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {detalle?.map((d, i) => {
                const producto = d.productos as unknown as { nombre: string } | null;
                const unidad = d.unidades_medida as unknown as { descripcion: string } | null;
                return (
                  <tr key={i} className="border-b border-gray-100 last:border-0">
                    <td className="py-2 text-gray-900">{producto?.nombre ?? "—"}</td>
                    <td className="py-2 text-gray-900">{d.cantidad}</td>
                    <td className="py-2 text-gray-600">{unidad?.descripcion ?? "—"}</td>
                    <td className="py-2 text-right text-gray-900">
                      {Number(d.precio_unitario).toFixed(2)}
                    </td>
                    <td className="py-2 text-right text-gray-900">
                      {Number(d.subtotal).toFixed(2)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div className="ml-auto w-56 space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Subtotal</span>
              <span className="text-gray-900">
                {cotizacion.moneda} {Number(cotizacion.subtotal).toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Impuestos ({cotizacion.porcentaje_igv}%)</span>
              <span className="text-gray-900">
                {cotizacion.moneda} {Number(cotizacion.igv).toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between font-semibold">
              <span className="text-gray-900">Total</span>
              <span className="text-gray-900">
                {cotizacion.moneda} {Number(cotizacion.total).toFixed(2)}
              </span>
            </div>
          </div>

          {cotizacion.condiciones_comerciales && (
            <div className="border-t border-gray-200 pt-4">
              <p className="text-xs font-semibold uppercase text-gray-500">
                Condiciones comerciales
              </p>
              <p className="whitespace-pre-line text-sm text-gray-700">
                {cotizacion.condiciones_comerciales}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
