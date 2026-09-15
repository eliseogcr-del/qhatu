"use client";

import Link from "next/link";
import { ArrowLeft, Moon, Sun } from "lucide-react";
import { formatFecha } from "@/lib/fecha";
import { TIPO_COMPROBANTE_LABEL } from "@/lib/comprobante-links";
import { useOscuroVendedorMovil } from "@/hooks/useOscuroVendedorMovil";
import MisVentasFiltroForm from "./MisVentasFiltroForm";
import type { VentaConSaldo } from "@/utils/supabase/ventas";

// Vista de "Mis ventas" con modo oscuro — misma preferencia que Venta
// rápida (ver useOscuroVendedorMovil), para no tener que activarlo dos
// veces. El título, el resumen y la lista de tarjetas viven acá (no en
// page.tsx) para que todo cambie de tema junto con el toggle.
export default function MisVentasView({
  ventas,
  error,
  q,
  desde,
  hasta,
  pendientes,
  hayFiltros,
  monedaResumen,
  totalVendido,
  volverUrl,
}: {
  ventas: VentaConSaldo[];
  error: string | null;
  q: string;
  desde: string;
  hasta: string;
  pendientes: boolean;
  hayFiltros: boolean;
  monedaResumen: string;
  totalVendido: number;
  volverUrl: string;
}) {
  const [oscuro, alternarOscuro] = useOscuroVendedorMovil();

  const claseTitulo = oscuro ? "text-2xl font-bold text-gray-50" : "text-2xl font-bold text-gray-900";
  const claseVolver = oscuro
    ? "flex items-center gap-1 text-sm font-medium text-gray-300 hover:text-white"
    : "flex items-center gap-1 text-sm font-medium text-gray-600 hover:underline";
  const claseToggle = oscuro
    ? "flex h-9 w-9 items-center justify-center rounded-lg border-2 border-gray-600 bg-gray-800 text-amber-300 hover:bg-gray-700"
    : "flex h-9 w-9 items-center justify-center rounded-lg border-2 border-gray-300 bg-white text-gray-600 hover:bg-gray-100";
  const claseResumen = oscuro
    ? "mb-4 rounded-xl border-2 border-emerald-800 bg-emerald-950 p-4 shadow-sm"
    : "mb-4 rounded-xl border-2 border-emerald-200 bg-emerald-50 p-4 shadow-sm";
  const claseResumenTitulo = oscuro ? "text-base font-bold text-emerald-200" : "text-base font-bold text-emerald-900";
  const claseResumenTotal = oscuro
    ? "text-2xl font-extrabold text-emerald-100"
    : "text-2xl font-extrabold text-emerald-900";
  const claseResumenCount = oscuro
    ? "mt-0.5 text-sm font-medium text-emerald-400"
    : "mt-0.5 text-sm font-medium text-emerald-700";
  const claseCard = oscuro
    ? "block rounded-xl border-2 border-gray-700 bg-gray-900 p-4 shadow-sm active:bg-gray-800"
    : "block rounded-xl border-2 border-gray-200 bg-white p-4 shadow-sm active:bg-gray-50";
  const claseCardTitulo = oscuro ? "text-base font-bold text-gray-100" : "text-base font-bold text-gray-900";
  const claseCliente = oscuro ? "text-lg font-bold text-gray-50" : "text-lg font-bold text-gray-900";
  const claseFecha = oscuro ? "mb-2 text-sm font-medium text-gray-400" : "mb-2 text-sm font-medium text-gray-500";
  const claseTotal = oscuro ? "text-xl font-extrabold text-gray-50" : "text-xl font-extrabold text-gray-900";
  const claseVacio = oscuro
    ? "rounded-xl border-2 border-gray-700 bg-gray-900 p-6 text-center text-base font-medium text-gray-500"
    : "rounded-xl border-2 border-gray-200 bg-white p-6 text-center text-base font-medium text-gray-400";

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <h1 className={claseTitulo}>Mis ventas</h1>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={alternarOscuro}
            aria-label={oscuro ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
            title={oscuro ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
            className={claseToggle}
          >
            {oscuro ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <Link href="/dashboard" className={claseVolver}>
            <ArrowLeft size={16} />
            Panel
          </Link>
        </div>
      </div>

      <div className={claseResumen}>
        <div className="flex items-center justify-between">
          <span className={claseResumenTitulo}>Total vendido</span>
          <span className={claseResumenTotal}>
            {monedaResumen} {totalVendido.toFixed(2)}
          </span>
        </div>
        <p className={claseResumenCount}>
          {ventas.length} {ventas.length === 1 ? "venta" : "ventas"}
        </p>
      </div>

      <MisVentasFiltroForm
        q={q}
        desde={desde}
        hasta={hasta}
        pendientes={pendientes}
        hayFiltros={hayFiltros}
        oscuro={oscuro}
      />

      {error && (
        <p
          className={
            oscuro
              ? "mb-4 rounded-lg border border-red-800 bg-red-950 p-3 text-base font-semibold text-red-300"
              : "mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-base font-semibold text-red-700"
          }
        >
          {error}
        </p>
      )}

      <div className="space-y-3">
        {ventas.map((venta) => {
          const pagada = venta.saldo <= 0;
          return (
            <Link
              key={venta.id}
              href={`/ventas/${venta.id}?volver=${encodeURIComponent(volverUrl)}`}
              className={claseCard}
            >
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <span className={claseCardTitulo}>
                  {venta.comprobante_tipo != null
                    ? `${TIPO_COMPROBANTE_LABEL[venta.comprobante_tipo] ?? "Comprobante"} ${venta.comprobante_numero ?? ""}`
                    : "Sin comprobante"}
                </span>
                <span
                  className={
                    venta.estado === "anulada"
                      ? oscuro
                        ? "shrink-0 rounded-full bg-red-950 px-2.5 py-1 text-sm font-bold text-red-300"
                        : "shrink-0 rounded-full bg-red-100 px-2.5 py-1 text-sm font-bold text-red-700"
                      : oscuro
                        ? "shrink-0 rounded-full bg-green-950 px-2.5 py-1 text-sm font-bold text-green-300"
                        : "shrink-0 rounded-full bg-green-100 px-2.5 py-1 text-sm font-bold text-green-700"
                  }
                >
                  {venta.estado === "anulada" ? "Anulada" : "Completado"}
                </span>
              </div>
              <p className={claseCliente}>{venta.cliente_nombre ?? "—"}</p>
              <p className={claseFecha}>{formatFecha(venta.fecha)}</p>
              <div className="flex items-center justify-between">
                <span
                  className={
                    pagada
                      ? oscuro
                        ? "rounded-full bg-gray-800 px-2.5 py-1 text-sm font-bold text-gray-300"
                        : "rounded-full bg-gray-100 px-2.5 py-1 text-sm font-bold text-gray-600"
                      : oscuro
                        ? "rounded-full bg-amber-950 px-2.5 py-1 text-sm font-bold text-amber-300"
                        : "rounded-full bg-amber-100 px-2.5 py-1 text-sm font-bold text-amber-700"
                  }
                >
                  {pagada ? "Pagado" : `Debe ${venta.moneda} ${venta.saldo.toFixed(2)}`}
                </span>
                <span className={claseTotal}>
                  {venta.moneda} {venta.total.toFixed(2)}
                </span>
              </div>
            </Link>
          );
        })}

        {ventas.length === 0 && (
          <p className={claseVacio}>
            {hayFiltros ? "Ninguna venta coincide con los filtros." : "Aún no hay ventas registradas."}
          </p>
        )}
      </div>
    </>
  );
}
