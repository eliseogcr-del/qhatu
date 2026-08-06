import Link from "next/link";
import { FolderDown, ShieldCheck, Trash2, ImageOff, Search, X } from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import { requireAdmin } from "@/utils/supabase/session";
import {
  LIMITE_STORAGE_BYTES,
  UMBRAL_AVISO_BYTES,
  UMBRAL_BLOQUEO_BYTES,
} from "@/lib/cobranza-adjuntos";
import ConfirmFormButton from "@/components/ConfirmFormButton";
import { confirmarLiberarEspacio } from "./actions";

function formatMB(bytes: number) {
  return (bytes / (1024 * 1024)).toFixed(0);
}

export default async function EvidenciasPagoPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; desde?: string; hasta?: string }>;
}) {
  const { q, desde, hasta } = await searchParams;
  const supabase = await createClient();
  const { empresaId } = await requireAdmin(supabase);

  let query = supabase
    .from("cobranza_adjuntos")
    .select(
      "id, nombre_archivo, storage_path, tamano_bytes, ruta_local, archivado_en, cobranzas!inner(fecha, pedidos!inner(clientes!inner(nombre)))",
    )
    .eq("empresa_id", empresaId)
    .order("created_at", { ascending: false });

  if (q) query = query.ilike("cobranzas.pedidos.clientes.nombre", `%${q}%`);
  if (desde) query = query.gte("cobranzas.fecha", desde);
  if (hasta) query = query.lte("cobranzas.fecha", `${hasta}T23:59:59`);

  const hayFiltros = !!(q || desde || hasta);

  const [{ data: bytesUsadosRaw }, { data: adjuntos, error }] = await Promise.all([
    supabase.rpc("total_storage_usado_bytes"),
    query,
  ]);

  const bytesUsados = bytesUsadosRaw ?? 0;
  const porcentaje = Math.min(100, Math.round((bytesUsados / LIMITE_STORAGE_BYTES) * 100));
  const nivel =
    bytesUsados >= UMBRAL_BLOQUEO_BYTES
      ? "bloqueado"
      : bytesUsados >= UMBRAL_AVISO_BYTES
        ? "aviso"
        : "ok";

  const enLaNube = (adjuntos ?? []).filter((a) => a.storage_path);
  const signedUrls = new Map<string, string>();
  for (const a of enLaNube) {
    const { data } = await supabase.storage
      .from("cobranza-adjuntos")
      .createSignedUrl(a.storage_path as string, 60 * 60);
    if (data?.signedUrl) signedUrls.set(a.id, data.signedUrl);
  }

  return (
    <div className="p-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex items-center gap-3">
          <ShieldCheck size={24} className="text-emerald-700" />
          <h1 className="text-2xl font-semibold text-gray-900">Evidencias de pago</h1>
        </div>
        <p className="mb-6 text-sm text-gray-500">
          Fotos de comprobantes (Yape, Plin, etc.) adjuntas a los cobros. Solo
          visible para administradores.
        </p>

        <form
          className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
          method="get"
        >
          <div className="min-w-[200px] flex-1">
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Cliente
            </label>
            <div className="relative">
              <Search
                size={16}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                type="text"
                name="q"
                defaultValue={q ?? ""}
                placeholder="Buscar por nombre..."
                className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Desde
            </label>
            <input
              type="date"
              name="desde"
              defaultValue={desde ?? ""}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Hasta
            </label>
            <input
              type="date"
              name="hasta"
              defaultValue={hasta ?? ""}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <button
            type="submit"
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Filtrar
          </button>
          {hayFiltros && (
            <Link
              href="/evidencias-pago"
              className="flex items-center gap-1 text-sm font-medium text-gray-500 hover:underline"
            >
              <X size={14} />
              Limpiar
            </Link>
          )}
        </form>

        <div className="mb-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="font-medium text-gray-700">
              Almacenamiento usado (pedidos + cobranzas)
            </span>
            <span
              className={
                nivel === "bloqueado"
                  ? "font-semibold text-red-600"
                  : nivel === "aviso"
                    ? "font-semibold text-amber-600"
                    : "font-medium text-gray-600"
              }
            >
              {formatMB(bytesUsados)} MB / {formatMB(LIMITE_STORAGE_BYTES)} MB
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
            <div
              className={
                nivel === "bloqueado"
                  ? "h-full bg-red-500"
                  : nivel === "aviso"
                    ? "h-full bg-amber-500"
                    : "h-full bg-emerald-500"
              }
              style={{ width: `${porcentaje}%` }}
            />
          </div>
          {nivel !== "ok" && (
            <p
              className={`mt-3 text-sm ${nivel === "bloqueado" ? "text-red-700" : "text-amber-700"}`}
            >
              {nivel === "bloqueado"
                ? "Se alcanzó el límite: ya no se aceptan fotos nuevas en cobranzas. Descarga y libera espacio para seguir adjuntando evidencias."
                : "El almacenamiento se está por llenar. Cuando puedas, descarga y libera espacio."}
            </p>
          )}

          <div className="mt-4 flex flex-wrap gap-3">
            <a
              href="/evidencias-pago/descargar"
              className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <FolderDown size={16} />
              Descargar todo (ZIP)
            </a>
            <ConfirmFormButton
              action={confirmarLiberarEspacio}
              confirmMessage="¿Ya descargaste el ZIP con las imágenes? Esto las borra de la nube (quedan solo referenciadas como archivadas en D:\FotosSistemaQhatu)."
              icon={<Trash2 size={16} />}
              pendingLabel="Liberando espacio..."
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
            >
              Confirmar y liberar espacio
            </ConfirmFormButton>
          </div>
        </div>

        {error && (
          <p className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error.message}
          </p>
        )}

        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-gray-200 bg-gray-50 text-gray-500">
              <tr>
                <th className="px-4 py-3 font-medium">Cliente</th>
                <th className="px-4 py-3 font-medium">Fecha de pago</th>
                <th className="px-4 py-3 font-medium">Archivo</th>
                <th className="px-4 py-3 font-medium">Tamaño</th>
                <th className="px-4 py-3 font-medium">Estado</th>
              </tr>
            </thead>
            <tbody>
              {adjuntos?.map((a) => {
                const cobranza = a.cobranzas as unknown as {
                  fecha: string;
                  pedidos: { clientes: { nombre: string } | null } | null;
                } | null;
                const cliente = cobranza?.pedidos?.clientes?.nombre ?? "—";
                const signedUrl = signedUrls.get(a.id);

                return (
                  <tr key={a.id} className="border-b border-gray-100 last:border-0">
                    <td className="px-4 py-3 font-medium text-gray-900">{cliente}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {cobranza ? new Date(cobranza.fecha).toLocaleDateString("es-PE") : "—"}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{a.nombre_archivo}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {(a.tamano_bytes / 1024).toFixed(0)} KB
                    </td>
                    <td className="px-4 py-3">
                      {signedUrl ? (
                        <a
                          href={signedUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium text-emerald-700 hover:underline"
                        >
                          Ver imagen (en la nube)
                        </a>
                      ) : a.ruta_local ? (
                        <span className="flex items-center gap-1.5 text-gray-500">
                          <ImageOff size={14} />
                          Archivada localmente en: {a.ruta_local}
                        </span>
                      ) : (
                        <span className="text-gray-400">Imagen no disponible</span>
                      )}
                    </td>
                  </tr>
                );
              })}

              {adjuntos?.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-gray-400">
                    {hayFiltros
                      ? "Ninguna evidencia coincide con los filtros."
                      : "Aún no hay evidencias de pago registradas."}
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
