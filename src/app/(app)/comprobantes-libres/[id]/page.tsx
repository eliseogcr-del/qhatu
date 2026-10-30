import Link from "next/link";
import { ArrowLeft, FileText, RefreshCw, Send, Truck } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { requireComprobantesAcceso } from "@/utils/supabase/session";
import { formatFechaHora } from "@/lib/fecha";
import { TIPO_COMPROBANTE_LABEL, enlacePdfComprobante } from "@/lib/comprobante-links";
import { TIPOS_TRANSPORTE, TIPO_TRANSPORTE_LABEL } from "@/lib/reparto-estados";
import SubmitButton from "@/components/SubmitButton";
import { generarGuiaRemisionLibre } from "../guia-actions";
import { consultarGuiaRemision } from "../../repartos/actions";

const ESTADO_GUIA_LABEL: Record<string, string> = {
  pendiente: "Pendiente de aceptación en SUNAT",
  aceptada: "Aceptada por SUNAT",
  rechazada: "Rechazada",
  error: "Error al generarla",
};

const ESTADO_GUIA_BADGE: Record<string, string> = {
  pendiente: "bg-amber-100 text-amber-700",
  aceptada: "bg-green-100 text-green-700",
  rechazada: "bg-red-100 text-red-700",
  error: "bg-red-100 text-red-700",
};

export default async function VerComprobanteLibrePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; guia_generada?: string }>;
}) {
  const { id } = await params;
  const { error, guia_generada: guiaGenerada } = await searchParams;
  const supabase = await createClient();
  await requireComprobantesAcceso(supabase, "/comprobantes-libres");

  const { data: comprobante } = await supabase
    .from("comprobantes")
    .select(
      "id, tipo_comprobante, serie, numero, estado, fecha_emision, enlace_pdf, clientes(nombre)",
    )
    .eq("id", id)
    .eq("origen", "libre")
    .maybeSingle();

  if (!comprobante) notFound();

  // Esta pantalla es para un comprobante ya emitido (o anulado, solo de
  // consulta) — uno pendiente/error todavía se edita y reintenta desde
  // Editar, no tiene nada que mostrar acá todavía.
  if (comprobante.estado === "pendiente" || comprobante.estado === "error") {
    redirect(`/comprobantes-libres/${id}/editar`);
  }

  const cliente = comprobante.clientes as unknown as { nombre: string } | null;
  const pdf = enlacePdfComprobante(comprobante);

  const [{ data: lineas }, { data: almacenes }, { data: usuarios }, { data: guia }] =
    await Promise.all([
      supabase
        .from("comprobante_libre_detalle")
        .select("descripcion, cantidad, precio_unitario, subtotal")
        .eq("comprobante_id", id),
      supabase.from("almacenes").select("id, nombre").eq("activo", true).order("nombre"),
      supabase.from("usuarios").select("id, nombre").eq("activo", true),
      supabase
        .from("guias_remision")
        .select(
          "id, serie, numero, estado, sunat_description, error_mensaje, enlace_pdf, created_at",
        )
        .eq("comprobante_id", id)
        .maybeSingle(),
    ]);

  return (
    <div className="p-8">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-gray-900">
            {TIPO_COMPROBANTE_LABEL[comprobante.tipo_comprobante]} {comprobante.serie}-
            {comprobante.numero}
          </h1>
          <Link
            href="/comprobantes-libres"
            className="flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:underline"
          >
            <ArrowLeft size={16} />
            Volver al listado
          </Link>
        </div>

        {error && (
          <p className="mb-6 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
        )}

        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-4 grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-400">Cliente</p>
              <p className="font-medium text-gray-900">{cliente?.nombre ?? "—"}</p>
            </div>
            <div>
              <p className="text-gray-400">Fecha de emisión</p>
              <p className="font-medium text-gray-900">{formatFechaHora(comprobante.fecha_emision)}</p>
            </div>
          </div>

          <table className="w-full text-left text-sm">
            <thead className="border-b border-gray-200 text-gray-500">
              <tr>
                <th className="py-2 font-medium">Descripción</th>
                <th className="py-2 text-right font-medium">Cantidad</th>
                <th className="py-2 text-right font-medium">Precio</th>
                <th className="py-2 text-right font-medium">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {(lineas ?? []).map((l, i) => (
                <tr key={i} className="border-b border-gray-100 last:border-0">
                  <td className="py-2 text-gray-900">{l.descripcion}</td>
                  <td className="py-2 text-right text-gray-600">{l.cantidad}</td>
                  <td className="py-2 text-right text-gray-600">{l.precio_unitario.toFixed(2)}</td>
                  <td className="py-2 text-right text-gray-600">{l.subtotal.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {pdf && (
            <a
              href={pdf}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 flex items-center gap-1.5 text-sm font-medium text-emerald-700 hover:underline"
            >
              <FileText size={16} />
              Ver PDF del comprobante
            </a>
          )}
        </div>

        {comprobante.estado === "emitido" && (
          <div className="mt-8 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="mb-1 flex items-center gap-2">
              <Truck size={18} className="text-gray-500" />
              <h2 className="text-lg font-semibold text-gray-900">Guía de remisión</h2>
            </div>
            <p className="mb-4 text-sm text-gray-500">
              Documento electrónico ante SUNAT del traslado de la mercadería de este
              comprobante.
            </p>

            {guiaGenerada === "1" && (
              <p className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
                Guía enviada a Nubefact. SUNAT puede tardar unos segundos o minutos en
                aceptarla — usa &quot;Actualizar estado&quot; para revisar.
              </p>
            )}

            {guia ? (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="font-mono text-sm text-gray-700">
                    {guia.serie}-{guia.numero}
                  </span>
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-medium ${ESTADO_GUIA_BADGE[guia.estado] ?? "bg-gray-100 text-gray-600"}`}
                  >
                    {ESTADO_GUIA_LABEL[guia.estado] ?? guia.estado}
                  </span>
                  <span className="text-xs text-gray-400">
                    Generada {formatFechaHora(guia.created_at)}
                  </span>
                </div>

                {guia.sunat_description && (
                  <p className="text-sm text-gray-600">SUNAT: {guia.sunat_description}</p>
                )}
                {guia.error_mensaje && (
                  <p className="text-sm text-red-600">{guia.error_mensaje}</p>
                )}

                <div className="flex flex-wrap items-center gap-3">
                  {guia.enlace_pdf ? (
                    <a
                      href={guia.enlace_pdf}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-sm font-medium text-emerald-700 hover:underline"
                    >
                      <FileText size={16} />
                      Ver PDF
                    </a>
                  ) : (
                    <form
                      action={consultarGuiaRemision.bind(null, guia.id, `/comprobantes-libres/${id}`)}
                    >
                      <SubmitButton
                        icon={<RefreshCw size={16} />}
                        pendingLabel="Consultando..."
                        className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                      >
                        Actualizar estado
                      </SubmitButton>
                    </form>
                  )}
                </div>
              </div>
            ) : (
              <form action={generarGuiaRemisionLibre.bind(null, id)} className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Almacén de origen
                    </label>
                    <select
                      name="almacen_id"
                      required
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
                    >
                      <option value="">Selecciona</option>
                      {(almacenes ?? []).map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.nombre}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Tipo de transporte
                    </label>
                    <select
                      name="tipo_transporte"
                      defaultValue="repartidor_propio"
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
                    >
                      {TIPOS_TRANSPORTE.map((t) => (
                        <option key={t} value={t}>
                          {TIPO_TRANSPORTE_LABEL[t]}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Placa del vehículo
                    </label>
                    <input
                      name="placa_numero"
                      placeholder="ABC123"
                      required
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Peso bruto total (kg)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      name="peso_bruto_total"
                      required
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      N° de bultos
                    </label>
                    <input
                      type="number"
                      step="1"
                      min="1"
                      name="numero_de_bultos"
                      required
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Repartidor / conductor
                  </label>
                  <select
                    name="repartidor_id"
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
                  >
                    <option value="">Selecciona un repartidor</option>
                    {(usuarios ?? []).map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.nombre ?? u.id}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-gray-400">
                    Necesario solo para transporte privado (sus datos de DNI/licencia se
                    completan en Usuarios). Para delivery subcontratado, completa el
                    transportista abajo en su lugar.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Nombre del delivery / transportista
                    </label>
                    <input
                      name="transportista_nombre"
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      RUC del transportista
                    </label>
                    <input
                      name="transportista_ruc"
                      maxLength={11}
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>

                <SubmitButton
                  icon={<Send size={16} />}
                  pendingLabel="Generando..."
                  className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
                >
                  Generar guía de remisión
                </SubmitButton>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
