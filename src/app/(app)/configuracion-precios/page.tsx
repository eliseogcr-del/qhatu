import { Tags, Save } from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import { requireAdmin } from "@/utils/supabase/session";
import SubmitButton from "@/components/SubmitButton";
import ClienteCombobox from "@/components/ClienteCombobox";
import ProductoCombobox from "@/components/ProductoCombobox";
import PreciosEspecialesFiltro from "@/components/PreciosEspecialesFiltro";
import PrecioEspecialRow from "@/components/PrecioEspecialRow";
import {
  actualizarBloqueoPrecios,
  actualizarPrecioEspecial,
  crearPrecioEspecial,
  eliminarPrecioEspecial,
} from "./actions";

export default async function ConfiguracionPreciosPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string;
    guardado?: string;
    cliente_id?: string;
    producto_id?: string;
    q?: string;
  }>;
}) {
  const {
    error,
    guardado,
    cliente_id: clienteIdPrevio,
    producto_id: productoIdPrevio,
    q,
  } = await searchParams;
  const supabase = await createClient();
  const { empresaId } = await requireAdmin(supabase);

  let especialesQuery = supabase
    .from("precios_especiales_cliente")
    .select(
      q
        ? "id, precio, clientes!inner(nombre), productos(nombre), unidades_medida(descripcion)"
        : "id, precio, clientes(nombre), productos(nombre), unidades_medida(descripcion)",
    )
    .order("created_at", { ascending: false });
  if (q) especialesQuery = especialesQuery.ilike("clientes.nombre", `%${q}%`);

  const [
    { data: config },
    { data: clientes },
    { data: productos },
    { data: unidadesMedida },
    { data: especiales },
  ] = await Promise.all([
      supabase
        .from("configuracion_precios")
        .select("precios_bloqueados")
        .eq("empresa_id", empresaId)
        .maybeSingle(),
      supabase.from("clientes").select("id, nombre").eq("activo", true).order("nombre"),
      supabase.from("productos").select("id, nombre").eq("activo", true).order("nombre"),
      supabase
        .from("unidades_medida")
        .select("id, descripcion")
        .eq("activo", true)
        .order("descripcion"),
      especialesQuery,
    ]);

  const preciosBloqueados = config?.precios_bloqueados ?? true;

  return (
    <div className="p-8">
      <div className="mx-auto max-w-3xl space-y-8">
        <div className="flex items-center gap-3">
          <Tags size={24} className="text-emerald-700" />
          <h1 className="text-2xl font-semibold text-gray-900">
            Configuración de precios
          </h1>
        </div>
        <p className="-mt-6 text-sm text-gray-500">
          Cada producto tiene Precio Campo (almacén principal/móviles) y
          Precio Digital (almacén digital). Un cliente con precio especial
          configurado abajo siempre usa ese precio, sin importar el
          almacén. En Pedidos, Ventas y Cotizaciones el precio se calcula
          solo y no se puede editar a mano, salvo que lo desbloquees acá.
        </p>

        {error && (
          <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
        )}
        {guardado && (
          <p className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
            Configuración guardada.
          </p>
        )}

        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-8 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">
            Bloqueo de precios
          </h2>
          <form action={actualizarBloqueoPrecios} className="space-y-4">
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                name="precios_bloqueados"
                defaultChecked={preciosBloqueados}
                className="h-4 w-4 rounded border-gray-300"
              />
              Bloquear el precio en Pedidos, Ventas y Cotizaciones (recomendado)
            </label>
            <p className="text-xs text-gray-500">
              Desmarca esto solo si necesitas volver a permitir que se
              escriba el precio a mano en esos formularios.
            </p>
            <SubmitButton icon={<Save size={16} />}>Guardar</SubmitButton>
          </form>
        </div>

        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-8 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">
            Nuevo precio especial
          </h2>
          <form
            action={crearPrecioEspecial}
            className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_1fr_140px_140px_auto] sm:items-end"
          >
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Cliente
              </label>
              <ClienteCombobox clientes={clientes ?? []} defaultClienteId={clienteIdPrevio} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Producto
              </label>
              <ProductoCombobox
                productos={productos ?? []}
                name="producto_id"
                defaultValue={productoIdPrevio}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Unidad de medida
              </label>
              <select
                name="unidad_medida_id"
                required
                defaultValue=""
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
              >
                <option value="" disabled>
                  Selecciona
                </option>
                {unidadesMedida?.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.descripcion}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Precio especial
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                name="precio"
                required
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
              />
            </div>
            <SubmitButton>Guardar</SubmitButton>
          </form>
          <p className="mt-2 text-xs text-gray-500">
            Indica para qué unidad negociaste ese precio (ej. &quot;S/ 30
            por DOCENA&quot;) — si en el pedido/venta se elige otra unidad,
            el sistema convierte el precio proporcionalmente.
          </p>
        </div>

        <PreciosEspecialesFiltro q={q ?? ""} />

        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="border-b-2 border-sky-200 bg-sky-50 text-gray-700">
              <tr>
                <th className="px-4 py-3 font-bold">Cliente</th>
                <th className="px-4 py-3 font-bold">Producto</th>
                <th className="px-4 py-3 font-bold">Unidad</th>
                <th className="px-4 py-3 font-bold">Precio especial</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {especiales?.map((e) => {
                const cliente = e.clientes as unknown as { nombre: string } | null;
                const producto = e.productos as unknown as { nombre: string } | null;
                const unidad = e.unidades_medida as unknown as { descripcion: string } | null;
                return (
                  <PrecioEspecialRow
                    key={e.id}
                    clienteNombre={cliente?.nombre ?? "—"}
                    productoNombre={producto?.nombre ?? "—"}
                    unidadDescripcion={unidad?.descripcion ?? "—"}
                    precio={e.precio}
                    onActualizar={actualizarPrecioEspecial.bind(null, e.id)}
                    onEliminar={eliminarPrecioEspecial.bind(null, e.id)}
                  />
                );
              })}
              {especiales?.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-gray-400">
                    {q
                      ? "Ningún precio especial coincide con ese cliente."
                      : "Aún no hay precios especiales configurados."}
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
