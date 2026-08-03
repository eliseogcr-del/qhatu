import Link from "next/link";
import { createClient } from "@/utils/supabase/server";

export default async function ReportesPage({
  searchParams,
}: {
  searchParams: Promise<{ desde?: string; hasta?: string }>;
}) {
  const { desde, hasta } = await searchParams;
  const supabase = await createClient();

  let ventasQuery = supabase.from("ventas").select("id, total, fecha");
  if (desde) ventasQuery = ventasQuery.gte("fecha", desde);
  if (hasta) ventasQuery = ventasQuery.lte("fecha", `${hasta}T23:59:59`);
  const { data: ventas } = await ventasQuery;

  let cobranzasQuery = supabase.from("cobranzas").select("id, monto, fecha");
  if (desde) cobranzasQuery = cobranzasQuery.gte("fecha", desde);
  if (hasta) cobranzasQuery = cobranzasQuery.lte("fecha", `${hasta}T23:59:59`);
  const { data: cobranzas } = await cobranzasQuery;

  let devolucionesQuery = supabase
    .from("devoluciones")
    .select("cantidad, fecha, venta_detalle:venta_detalle_id(precio_unitario)");
  if (desde) devolucionesQuery = devolucionesQuery.gte("fecha", desde);
  if (hasta) devolucionesQuery = devolucionesQuery.lte("fecha", `${hasta}T23:59:59`);
  const { data: devoluciones } = await devolucionesQuery;

  const totalVendido = (ventas ?? []).reduce((acc, v) => acc + v.total, 0);
  const totalCobrado = (cobranzas ?? []).reduce((acc, c) => acc + c.monto, 0);
  const saldoPendiente = totalVendido - totalCobrado;
  const mermaCantidad = (devoluciones ?? []).reduce((acc, d) => acc + d.cantidad, 0);
  const mermaValorizada = (devoluciones ?? []).reduce((acc, d) => {
    const precio =
      (d.venta_detalle as unknown as { precio_unitario: number } | null)
        ?.precio_unitario ?? 0;
    return acc + d.cantidad * precio;
  }, 0);

  const cards = [
    { label: "Total vendido", value: totalVendido.toFixed(2) },
    { label: "Total cobrado", value: totalCobrado.toFixed(2) },
    { label: "Saldo pendiente", value: saldoPendiente.toFixed(2) },
    { label: "Cantidad en merma", value: mermaCantidad.toFixed(2) },
    { label: "Merma valorizada", value: mermaValorizada.toFixed(2) },
  ];

  return (
    <div className="p-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-gray-900">Reportes</h1>
          <div className="flex gap-4 text-sm">
            <Link href="/inventario" className="font-medium text-gray-600 hover:underline">
              Ver inventario
            </Link>
            <Link href="/kardex" className="font-medium text-gray-600 hover:underline">
              Ver kardex
            </Link>
          </div>
        </div>

        <form className="mb-6 flex items-end gap-3" method="get">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Desde</label>
            <input
              type="date"
              name="desde"
              defaultValue={desde ?? ""}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Hasta</label>
            <input
              type="date"
              name="hasta"
              defaultValue={hasta ?? ""}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <button
            type="submit"
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
          >
            Filtrar
          </button>
          {(desde || hasta) && (
            <Link href="/reportes" className="text-sm font-medium text-gray-500 hover:underline">
              Limpiar
            </Link>
          )}
        </form>

        <p className="mb-4 text-xs text-gray-400">
          Los montos asumen una sola moneda por simplicidad (no convierten PEN/USD).
        </p>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {cards.map((card) => (
            <div
              key={card.label}
              className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm"
            >
              <p className="text-sm text-gray-500">{card.label}</p>
              <p className="mt-1 text-2xl font-semibold text-gray-900">{card.value}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
