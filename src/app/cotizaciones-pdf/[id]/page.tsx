import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { formatFecha, formatFechaSolo } from "@/lib/fecha";
import BotonImprimir from "@/components/BotonImprimir";

export default async function CotizacionPdfPage({
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

  const { data: cotizacion } = await supabase
    .from("cotizaciones")
    .select(
      "numero, fecha, moneda, subtotal, igv, total, porcentaje_igv, oferta_valida_hasta, fecha_entrega, lugar_entrega, cliente_id, prospecto_nombre, prospecto_ruc, prospecto_telefono, prospecto_correo, clientes(nombre, numero_documento, telefono, correo_electronico), usuarios(nombre), empresas(nombre)",
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
  const empresa = cotizacion.empresas as unknown as { nombre: string } | null;

  return (
    <div className="mx-auto max-w-2xl p-8">
      <style>{"@media print { .no-imprimir { display: none !important; } }"}</style>

      <div className="no-imprimir mb-6 flex items-center justify-between">
        <Link
          href={`/cotizaciones/${id}`}
          className="flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:underline"
        >
          <ArrowLeft size={16} />
          Volver a la cotización
        </Link>
        <BotonImprimir />
      </div>

      <div className="space-y-6 rounded-xl border border-gray-200 bg-white p-8 text-sm shadow-sm print:border-0 print:shadow-none">
        <div className="flex items-start justify-between border-b border-gray-200 pb-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-grimana.PNG" alt={empresa?.nombre ?? "Logo"} className="h-16 w-auto" />
          <div className="text-right">
            <p className="text-lg font-bold tracking-wide text-gray-900">COTIZACIÓN</p>
            <p className="font-semibold text-gray-900">
              N° {String(cotizacion.numero).padStart(4, "0")}
            </p>
            <p className="text-xs text-gray-500">{formatFecha(cotizacion.fecha)}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase text-gray-500">Cliente</p>
            <p className="font-medium text-gray-900">
              {cliente?.nombre ?? cotizacion.prospecto_nombre ?? "—"}
            </p>
            <p className="text-gray-700">
              RUC/DNI: {cliente?.numero_documento ?? cotizacion.prospecto_ruc ?? "—"}
            </p>
            <p className="text-gray-700">
              Teléfono: {cliente?.telefono ?? cotizacion.prospecto_telefono ?? "—"}
            </p>
            <p className="text-gray-700">
              Correo: {cliente?.correo_electronico ?? cotizacion.prospecto_correo ?? "—"}
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase text-gray-500">Ejecutivo comercial</p>
            <p className="text-gray-700">{ejecutivo?.nombre ?? "—"}</p>
          </div>
        </div>

        <table className="w-full border-t border-gray-200 pt-2 text-left text-xs">
          <thead>
            <tr className="text-gray-500">
              <th className="py-1 font-medium">Cant.</th>
              <th className="py-1 font-medium">Unidad</th>
              <th className="py-1 font-medium">Descripción</th>
              <th className="py-1 text-right font-medium">P/U</th>
              <th className="py-1 text-right font-medium">Total</th>
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

        <div className="ml-auto w-48 space-y-1 border-t border-gray-200 pt-2 text-xs">
          <div className="flex justify-between">
            <span className="text-gray-500">Subtotal</span>
            <span className="text-gray-900">
              {cotizacion.moneda} {Number(cotizacion.subtotal).toFixed(2)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Impuestos ({cotizacion.porcentaje_igv}%)</span>
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

        <div className="border-t border-gray-200 pt-3 text-xs">
          <p className="mb-1 font-semibold uppercase text-gray-500">Condiciones comerciales</p>
          <p className="text-gray-700">
            <span className="font-medium">Oferta válido hasta:</span>{" "}
            {cotizacion.oferta_valida_hasta ? formatFechaSolo(cotizacion.oferta_valida_hasta) : "—"}
          </p>
          <p className="text-gray-700">
            <span className="font-medium">Fecha de entrega:</span>{" "}
            {cotizacion.fecha_entrega ? formatFechaSolo(cotizacion.fecha_entrega) : "—"}
          </p>
          <p className="text-gray-700">
            <span className="font-medium">Lugar de entrega:</span> {cotizacion.lugar_entrega ?? "—"}
          </p>
        </div>

        <p className="border-t border-gray-200 pt-3 text-center text-[10px] text-gray-400">
          Documento comercial informativo — no es un comprobante de pago
          electrónico ni tiene valor tributario.
        </p>
      </div>
    </div>
  );
}
