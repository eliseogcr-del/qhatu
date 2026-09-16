import Link from "next/link";
import { FileText, RefreshCw, Send } from "lucide-react";
import { formatFecha, formatFechaHora } from "@/lib/fecha";
import { notFound } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import RepartoForm from "@/components/RepartoForm";
import SubmitButton from "@/components/SubmitButton";
import { updateReparto, generarGuiaRemision, consultarGuiaRemision } from "../../actions";

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

export default async function EditarRepartoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; volver?: string; guia_generada?: string }>;
}) {
  const { id } = await params;
  const { error, volver, guia_generada: guiaGenerada } = await searchParams;

  const supabase = await createClient();
  const [{ data: reparto }, { data: pedidosData }, { data: usuarios }, { data: guia }] =
    await Promise.all([
      supabase.from("repartos").select("*").eq("id", id).single(),
      supabase
        .from("pedidos")
        .select("id, fecha, clientes(nombre)")
        .order("fecha", { ascending: false }),
      supabase.from("usuarios").select("id, nombre").eq("activo", true),
      supabase
        .from("guias_remision")
        .select(
          "id, serie, numero, estado, sunat_description, error_mensaje, enlace_pdf, created_at",
        )
        .eq("reparto_id", id)
        .maybeSingle(),
    ]);

  if (!reparto) notFound();

  const pedidos = (pedidosData ?? []).map((p) => {
    const cliente = p.clientes as unknown as { nombre: string } | null;
    const fecha = formatFecha(p.fecha);
    return { id: p.id, label: `${cliente?.nombre ?? "—"} — ${fecha}` };
  });

  return (
    <div className="p-8">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-gray-900">
            Editar reparto
          </h1>
          <Link
            href={volver || "/repartos"}
            className="text-sm font-medium text-gray-600 hover:underline"
          >
            ← Volver al listado
          </Link>
        </div>

        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-8 shadow-sm">
          <RepartoForm
            action={updateReparto.bind(null, id)}
            initialValues={{
              pedido_id: reparto.pedido_id,
              fecha_reparto: reparto.fecha_reparto,
              tipo_transporte: reparto.tipo_transporte,
              transportista_nombre: reparto.transportista_nombre,
              repartidor_id: reparto.repartidor_id,
              estado: reparto.estado,
              placaNumero: reparto.placa_numero,
              pesoBrutoTotal: reparto.peso_bruto_total,
              numeroDeBultos: reparto.numero_de_bultos,
              transportistaRuc: reparto.transportista_ruc,
            }}
            error={error}
            submitLabel="Guardar cambios"
            pedidos={pedidos}
            usuarios={usuarios ?? []}
          />
        </div>

        <div className="mt-8 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-1 text-lg font-semibold text-gray-900">Guía de remisión</h2>
          <p className="mb-4 text-sm text-gray-500">
            Documento electrónico ante SUNAT del traslado de esta mercadería —
            guarda primero los cambios de arriba si acabas de completar la placa,
            el peso, los bultos o el conductor.
          </p>

          {guiaGenerada === "1" && (
            <p className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
              Guía enviada a Nubefact. SUNAT puede tardar unos segundos o
              minutos en aceptarla — usa &quot;Actualizar estado&quot; para
              revisar.
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
                  <form action={consultarGuiaRemision.bind(null, guia.id, id)}>
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
            <form action={generarGuiaRemision.bind(null, id)}>
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
      </div>
    </div>
  );
}
