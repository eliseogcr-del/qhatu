import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { timestampAInputLocalLima } from "@/lib/fecha";
import EditarCobranzaForm from "@/components/EditarCobranzaForm";
import { updateCobranza } from "../../actions";

export default async function EditarCobranzaPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; volver?: string }>;
}) {
  const { id } = await params;
  const { error, volver } = await searchParams;
  const supabase = await createClient();

  const { data: cobranza } = await supabase
    .from("cobranzas")
    .select(
      "id, fecha, monto, moneda, tipo_cambio_aplicado, metodo_pago, referencia, estado, venta_id, pedido_id, ventas(total, descuento, clientes(nombre)), pedidos(clientes(nombre))",
    )
    .eq("id", id)
    .maybeSingle();

  if (!cobranza) notFound();

  if (cobranza.estado !== "activa") {
    return (
      <div className="p-8">
        <div className="mx-auto max-w-2xl">
          <p className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
            Este cobro ya está anulado — no se puede editar.
          </p>
          <Link
            href={volver || "/cobranzas"}
            className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:underline"
          >
            ← Volver
          </Link>
        </div>
      </div>
    );
  }

  const venta = cobranza.ventas as unknown as {
    total: number;
    descuento: number;
    clientes: { nombre: string } | null;
  } | null;
  const pedido = cobranza.pedidos as unknown as { clientes: { nombre: string } | null } | null;
  const clienteNombre = venta?.clientes?.nombre ?? pedido?.clientes?.nombre ?? "—";

  let saldoDisponible: number | null = null;
  if (cobranza.venta_id && venta) {
    const { data: otrasCobranzas } = await supabase
      .from("cobranzas")
      .select("monto")
      .eq("venta_id", cobranza.venta_id)
      .eq("estado", "activa")
      .neq("id", id);

    const totalReferencia = venta.total - venta.descuento;
    const cobradoSinEsta = (otrasCobranzas ?? []).reduce((acc, c) => acc + c.monto, 0);
    saldoDisponible = Math.round((totalReferencia - cobradoSinEsta) * 100) / 100;
  }

  const volverHref = volver || (cobranza.venta_id ? `/ventas/${cobranza.venta_id}` : "/cobranzas");

  return (
    <div className="p-8">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-gray-900">Editar cobro</h1>
          <Link href={volverHref} className="text-sm font-medium text-gray-600 hover:underline">
            ← Volver
          </Link>
        </div>

        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-8 shadow-sm">
          <EditarCobranzaForm
            action={updateCobranza.bind(null, id, volverHref)}
            error={error}
            clienteNombre={clienteNombre}
            saldoDisponible={saldoDisponible}
            valoresIniciales={{
              fecha: timestampAInputLocalLima(cobranza.fecha),
              monto: cobranza.monto,
              moneda: cobranza.moneda,
              tipoCambioAplicado: cobranza.tipo_cambio_aplicado,
              metodoPago: cobranza.metodo_pago,
              referencia: cobranza.referencia ?? "",
            }}
          />
        </div>
      </div>
    </div>
  );
}
