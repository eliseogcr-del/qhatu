import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { formatFecha, formatFechaHora } from "@/lib/fecha";
import { canalLabel } from "@/lib/pedido-estados";
import { TIPO_TRANSPORTE_LABEL, type TipoTransporte } from "@/lib/reparto-estados";
import BotonImprimir from "@/components/BotonImprimir";

export default async function PedidoPdfPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: pedido } = await supabase
    .from("pedidos")
    .select(
      "canal_pedido, fecha, fecha_entrega_requerida, moneda, total, clientes(nombre, telefono, direccion), almacenes(nombre), empresas(nombre)",
    )
    .eq("id", id)
    .maybeSingle();

  if (!pedido) notFound();

  const [{ data: detalle }, { data: reparto }] = await Promise.all([
    supabase
      .from("pedido_detalle")
      .select("cantidad, precio_unitario, subtotal, productos(nombre), unidades_medida(descripcion)")
      .eq("pedido_id", id),
    supabase
      .from("repartos")
      .select("fecha_reparto, hora_reparto, tipo_transporte, transportista_nombre, usuarios(nombre)")
      .eq("pedido_id", id)
      .maybeSingle(),
  ]);

  const cliente = pedido.clientes as unknown as {
    nombre: string;
    telefono: string | null;
    direccion: string | null;
  } | null;
  const almacen = pedido.almacenes as unknown as { nombre: string } | null;
  const empresa = pedido.empresas as unknown as { nombre: string } | null;
  const repartidor = reparto?.usuarios as unknown as { nombre: string | null } | null;

  return (
    <div className="mx-auto max-w-2xl p-8">
      <style>{"@media print { .no-imprimir { display: none !important; } }"}</style>

      <div className="no-imprimir mb-6 flex items-center justify-between">
        <Link
          href={`/pedidos/${id}`}
          className="flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:underline"
        >
          <ArrowLeft size={16} />
          Volver al pedido
        </Link>
        <BotonImprimir />
      </div>

      <div className="space-y-6 rounded-xl border border-gray-200 bg-white p-8 text-sm shadow-sm print:border-0 print:shadow-none">
        <div className="flex items-start justify-between border-b border-gray-200 pb-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-grimana.PNG" alt={empresa?.nombre ?? "Logo"} className="h-16 w-auto" />
          <div className="text-right">
            <p className="text-lg font-bold tracking-wide text-gray-900">PEDIDO</p>
            <p className="text-xs text-gray-500">{formatFechaHora(pedido.fecha)}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase text-gray-500">Cliente</p>
            <p className="font-medium text-gray-900">{cliente?.nombre ?? "—"}</p>
            <p className="text-gray-700">Teléfono: {cliente?.telefono ?? "—"}</p>
            <p className="text-gray-700">Dirección: {cliente?.direccion ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase text-gray-500">Canal</p>
            <p className="text-gray-700">{canalLabel(pedido.canal_pedido)}</p>
            <p className="mt-2 text-xs font-semibold uppercase text-gray-500">Entrega requerida</p>
            <p className="text-gray-700">{pedido.fecha_entrega_requerida ?? "—"}</p>
            <p className="mt-2 text-xs font-semibold uppercase text-gray-500">Almacén / Local</p>
            <p className="text-gray-700">{almacen?.nombre ?? "—"}</p>
          </div>
        </div>

        <table className="w-full border-t border-gray-200 pt-2 text-left text-xs">
          <thead>
            <tr className="text-gray-500">
              <th className="py-1 font-medium">Cant.</th>
              <th className="py-1 font-medium">Unidad</th>
              <th className="py-1 font-medium">Producto</th>
              <th className="py-1 text-right font-medium">P/U</th>
              <th className="py-1 text-right font-medium">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {detalle?.map((d, i) => {
              const producto = d.productos as unknown as { nombre: string } | null;
              const unidad = d.unidades_medida as unknown as { descripcion: string } | null;
              return (
                <tr key={i} className="border-t border-gray-100">
                  <td className="py-1 text-gray-900">{d.cantidad}</td>
                  <td className="py-1 text-gray-600">{unidad?.descripcion ?? "—"}</td>
                  <td className="py-1 text-gray-900">{producto?.nombre ?? "—"}</td>
                  <td className="py-1 text-right text-gray-900">
                    {Number(d.precio_unitario).toFixed(2)}
                  </td>
                  <td className="py-1 text-right text-gray-900">
                    {Number(d.subtotal).toFixed(2)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <p className="ml-auto w-48 border-t border-gray-200 pt-2 text-right text-sm font-semibold text-gray-900">
          Total: {pedido.moneda} {Number(pedido.total).toFixed(2)}
        </p>

        <div className="border-t border-gray-200 pt-3 text-xs">
          <p className="mb-1 font-semibold uppercase text-gray-500">Reparto</p>
          {reparto ? (
            <>
              <p className="text-gray-700">
                <span className="font-medium">Quién reparte:</span>{" "}
                {repartidor?.nombre ??
                  reparto.transportista_nombre ??
                  (reparto.tipo_transporte
                    ? TIPO_TRANSPORTE_LABEL[reparto.tipo_transporte as TipoTransporte]
                    : "—")}
              </p>
              <p className="text-gray-700">
                <span className="font-medium">Fecha y hora:</span>{" "}
                {reparto.fecha_reparto ? formatFecha(reparto.fecha_reparto) : "—"}
                {reparto.hora_reparto ? ` — ${reparto.hora_reparto.slice(0, 5)}` : ""}
              </p>
            </>
          ) : (
            <p className="text-gray-400">Todavía no se asignó un reparto a este pedido.</p>
          )}
        </div>
      </div>
    </div>
  );
}
