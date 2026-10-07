import Link from "next/link";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import { requireAdmin } from "@/utils/supabase/session";
import { mesActualLima } from "@/lib/fecha";
import { fetchObjetivosData, type ObjetivosModo } from "@/utils/supabase/objetivos";
import ObjetivosFiltroForm from "@/components/ObjetivosFiltroForm";
import ObjetivosMetaForm from "@/components/ObjetivosMetaForm";
import { GraficoVentasDelMes, GraficoPorDiaSemana, GraficoPorSemana } from "@/components/ObjetivosCharts";
import { guardarMetaVentas } from "./actions";

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

function nombrePeriodo(periodo: string) {
  const [anio, mes] = periodo.split("-").map(Number);
  return `${MESES[mes - 1]} ${anio}`;
}

export default async function ObjetivosPage({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string; vendedor_id?: string; modo?: string; error?: string; guardado?: string }>;
}) {
  const { periodo: periodoParam, vendedor_id: vendedorId, modo: modoParam, error: errorParam, guardado } =
    await searchParams;
  const supabase = await createClient();
  const { empresaId } = await requireAdmin(supabase);

  const periodo = periodoParam && /^\d{4}-\d{2}$/.test(periodoParam) ? periodoParam : mesActualLima();
  const modo: ObjetivosModo = modoParam === "total" ? "total" : "cobrado";
  const vendedorIdEfectivo = vendedorId ?? "";

  const [datos, { data: vendedores }] = await Promise.all([
    fetchObjetivosData(supabase, empresaId, { periodo, vendedorId: vendedorIdEfectivo || null, modo }),
    supabase
      .from("usuarios")
      .select("id, nombre")
      .in("rol", ["vendedor", "admin", "logistica"])
      .eq("activo", true)
      .not("username", "eq", "eliseogcr")
      .not("nombre", "ilike", "%prueba%")
      .order("nombre"),
  ]);

  const vendedorSeleccionado = (vendedores ?? []).find((v) => v.id === vendedorIdEfectivo);
  const etiquetaMeta = vendedorSeleccionado ? vendedorSeleccionado.nombre : "toda la empresa";

  const cards = [
    { label: "Meta del mes", value: datos.meta.toFixed(2) },
    { label: "Vendido", value: datos.vendido.toFixed(2) },
    { label: "% de avance", value: `${(datos.porcentajeAvance * 100).toFixed(1)}%` },
    { label: "Meta diaria", value: datos.metaDiaria.toFixed(2) },
    { label: "Falta para la meta", value: datos.saldoParaMeta.toFixed(2) },
  ];

  return (
    <div className="p-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-gray-900">
            Objetivos — {nombrePeriodo(periodo)}
          </h1>
          <Link
            href="/reportes"
            className="flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:underline"
          >
            <ArrowLeft size={16} />
            Volver a reportes
          </Link>
        </div>

        <ObjetivosFiltroForm
          periodo={periodo}
          vendedorId={vendedorIdEfectivo}
          modo={modo}
          vendedores={vendedores ?? []}
        />

        {errorParam && (
          <p className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {errorParam}
          </p>
        )}
        {guardado === "1" && (
          <p className="mb-4 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
            <CheckCircle2 size={16} />
            Meta guardada.
          </p>
        )}
        {datos.error && (
          <p className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {datos.error}
          </p>
        )}

        <ObjetivosMetaForm
          action={guardarMetaVentas}
          periodo={periodo}
          vendedorId={vendedorIdEfectivo}
          modo={modo}
          metaActual={datos.meta}
          etiqueta={etiquetaMeta}
        />

        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {cards.map((card) => (
            <div key={card.label} className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <p className="text-sm text-gray-500">{card.label}</p>
              <p className="mt-1 text-2xl font-semibold text-gray-900">{card.value}</p>
            </div>
          ))}
        </div>

        <div className="mb-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold text-gray-700">Ventas del mes</h2>
          <GraficoVentasDelMes dias={datos.dias} metaDiaria={datos.metaDiaria} />
        </div>

        <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-sm font-semibold text-gray-700">Ventas por día de la semana</h2>
            <GraficoPorDiaSemana datos={datos.porDiaSemana} />
            <table className="mt-4 w-full text-left text-sm">
              <thead className="border-b border-gray-200 text-gray-500">
                <tr>
                  <th className="py-2 font-medium">Día</th>
                  <th className="py-2 text-right font-medium">Total</th>
                  <th className="py-2 text-right font-medium">Promedio</th>
                  <th className="py-2 text-right font-medium">% Ventas</th>
                </tr>
              </thead>
              <tbody>
                {datos.porDiaSemana.map((f) => (
                  <tr key={f.diaSemana} className="border-b border-gray-100 last:border-0">
                    <td className="py-2 text-gray-900">{f.diaSemana}</td>
                    <td className="py-2 text-right text-gray-600">{f.total.toFixed(2)}</td>
                    <td className="py-2 text-right text-gray-600">{f.promedio.toFixed(2)}</td>
                    <td className="py-2 text-right text-gray-600">{(f.porcentaje * 100).toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-sm font-semibold text-gray-700">Ventas por semana</h2>
            <GraficoPorSemana datos={datos.porSemana} metaSemanal={datos.metaSemanal} />
            <table className="mt-4 w-full text-left text-sm">
              <thead className="border-b border-gray-200 text-gray-500">
                <tr>
                  <th className="py-2 font-medium">Semana</th>
                  <th className="py-2 text-right font-medium">Ventas</th>
                  <th className="py-2 text-right font-medium">% Avance</th>
                </tr>
              </thead>
              <tbody>
                {datos.porSemana.map((f) => (
                  <tr key={f.semana} className="border-b border-gray-100 last:border-0">
                    <td className="py-2 text-gray-900">Semana {f.semana}</td>
                    <td className="py-2 text-right text-gray-600">{f.total.toFixed(2)}</td>
                    <td className="py-2 text-right text-gray-600">{(f.porcentaje * 100).toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {!vendedorIdEfectivo && datos.porVendedor.length > 0 && (
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-sm font-semibold text-gray-700">Por vendedor</h2>
            <table className="w-full text-left text-sm">
              <thead className="border-b-2 border-sky-200 bg-sky-50 text-gray-700">
                <tr>
                  <th className="px-4 py-3 font-bold">Vendedor</th>
                  <th className="px-4 py-3 text-right font-bold">Vendido</th>
                  <th className="px-4 py-3 text-right font-bold">Meta</th>
                  <th className="px-4 py-3 text-right font-bold">% Avance</th>
                </tr>
              </thead>
              <tbody>
                {datos.porVendedor.map((f) => (
                  <tr key={f.vendedorId} className="border-b-2 border-gray-200 last:border-0">
                    <td className="px-4 py-3 font-medium text-gray-900">{f.vendedorNombre}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{f.vendido.toFixed(2)}</td>
                    <td className="px-4 py-3 text-right text-gray-600">
                      {f.meta > 0 ? f.meta.toFixed(2) : "Sin meta cargada"}
                    </td>
                    <td
                      className={`px-4 py-3 text-right font-medium ${
                        f.meta > 0 && f.porcentaje >= 1 ? "text-green-600" : "text-gray-600"
                      }`}
                    >
                      {f.meta > 0 ? `${(f.porcentaje * 100).toFixed(1)}%` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
