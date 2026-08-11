import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { formatFecha } from "@/lib/fecha";
import { numeroALetras } from "@/lib/numero-a-letras";
import { construirItemsYTotales } from "@/utils/supabase/comprobantes";
import { TIPO_NOTA_VENTA } from "@/lib/comprobante-links";
import BotonImprimir from "@/components/BotonImprimir";

export default async function NotaVentaPage({
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

  const { data: comprobante } = await supabase
    .from("comprobantes")
    .select(
      "id, serie, numero, estado, tipo_comprobante, fecha_emision, venta_id, empresas(nombre), almacenes(nombre, direccion), ventas(moneda, total, clientes(tipo_documento, numero_documento, nombre, direccion))",
    )
    .eq("id", id)
    .eq("tipo_comprobante", TIPO_NOTA_VENTA)
    .maybeSingle();

  if (!comprobante) notFound();

  const empresa = comprobante.empresas as unknown as { nombre: string } | null;
  const almacen = comprobante.almacenes as unknown as {
    nombre: string;
    direccion: string | null;
  } | null;
  const venta = comprobante.ventas as unknown as {
    moneda: string;
    total: number;
    clientes: {
      tipo_documento: string;
      numero_documento: string;
      nombre: string;
      direccion: string | null;
    } | null;
  } | null;
  const cliente = venta?.clientes ?? null;

  const totales = await construirItemsYTotales(supabase, comprobante.venta_id);
  if (!totales || !venta) notFound();

  const importeEnLetras = numeroALetras(venta.total, venta.moneda === "USD" ? "USD" : "PEN");

  return (
    <div className="mx-auto max-w-md p-8">
      <style>{"@media print { .no-imprimir { display: none !important; } }"}</style>

      <div className="no-imprimir mb-6 flex items-center justify-between">
        <Link
          href={`/ventas/${comprobante.venta_id}`}
          className="flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:underline"
        >
          <ArrowLeft size={16} />
          Volver a la venta
        </Link>
        <BotonImprimir />
      </div>

      <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-6 text-sm shadow-sm print:border-0 print:shadow-none">
        <div className="text-center">
          <p className="font-semibold text-gray-900">{empresa?.nombre ?? "—"}</p>
          {almacen && (
            <p className="text-xs text-gray-500">
              {almacen.nombre}
              {almacen.direccion ? ` — ${almacen.direccion}` : ""}
            </p>
          )}
          <p className="mt-3 text-base font-bold tracking-wide text-gray-900">
            NOTA DE VENTA
          </p>
          <p className="font-semibold text-gray-900">
            {comprobante.serie}-{String(comprobante.numero).padStart(6, "0")}
          </p>
        </div>

        <div className="border-t border-gray-200 pt-3">
          <p className="text-xs font-semibold uppercase text-gray-500">Adquiriente</p>
          <p className="text-gray-900">
            {cliente?.tipo_documento ?? "—"}: {cliente?.numero_documento ?? "—"}
          </p>
          <p className="text-gray-900">{cliente?.nombre ?? "—"}</p>
        </div>

        <div className="grid grid-cols-2 gap-1 border-t border-gray-200 pt-3 text-xs">
          <p className="text-gray-500">Fecha emisión:</p>
          <p className="text-right text-gray-900">{formatFecha(comprobante.fecha_emision)}</p>
          <p className="text-gray-500">Moneda:</p>
          <p className="text-right text-gray-900">
            {venta.moneda === "USD" ? "Dólares" : "Soles"}
          </p>
        </div>

        <table className="w-full border-t border-gray-200 pt-2 text-left text-xs">
          <thead>
            <tr className="text-gray-500">
              <th className="py-1 font-medium">Cant.</th>
              <th className="py-1 font-medium">Descripción</th>
              <th className="py-1 text-right font-medium">P/U</th>
              <th className="py-1 text-right font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
            {totales.items.map((item, i) => (
              <tr key={i} className="border-t border-gray-100">
                <td className="py-1 text-gray-900">{item.cantidad}</td>
                <td className="py-1 text-gray-900">{item.descripcion}</td>
                <td className="py-1 text-right text-gray-900">
                  {item.precio_unitario.toFixed(2)}
                </td>
                <td className="py-1 text-right text-gray-900">{item.total.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="ml-auto w-40 space-y-1 border-t border-gray-200 pt-2 text-xs">
          <div className="flex justify-between">
            <span className="text-gray-500">Gravada</span>
            <span className="text-gray-900">{venta.moneda} {totales.totalGravada.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">IGV</span>
            <span className="text-gray-900">{venta.moneda} {totales.totalIgv.toFixed(2)}</span>
          </div>
          <div className="flex justify-between font-semibold">
            <span className="text-gray-900">Total</span>
            <span className="text-gray-900">{venta.moneda} {totales.total.toFixed(2)}</span>
          </div>
        </div>

        <p className="border-t border-gray-200 pt-3 text-xs text-gray-600">
          <span className="font-semibold">Importe en letras: </span>
          {importeEnLetras}
        </p>

        <p className="border-t border-gray-200 pt-3 text-center text-[10px] text-gray-400">
          Documento interno de uso comercial. No es un comprobante de pago
          electrónico ni ha sido emitido a través de SUNAT — sin valor
          fiscal ni tributario.
        </p>
      </div>
    </div>
  );
}
