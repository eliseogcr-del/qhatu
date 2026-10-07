"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  Legend,
} from "recharts";
import type { ObjetivosDia, ObjetivosPorDiaSemana, ObjetivosPorSemana } from "@/utils/supabase/objetivos";

const VERDE = "#059669"; // emerald-600, el acento ya usado en el resto de la app
const GRIS_META = "#9ca3af"; // gray-400, referencia neutra (no compite con el dato)

function formatMonto(valor: number) {
  return valor.toLocaleString("es-PE", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

export function GraficoVentasDelMes({ dias, metaDiaria }: { dias: ObjetivosDia[]; metaDiaria: number }) {
  const datos = dias.map((d) => ({ dia: d.dia, monto: d.monto }));
  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={datos} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid stroke="#e5e7eb" strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="dia" tick={{ fontSize: 12, fill: "#6b7280" }} tickLine={false} axisLine={{ stroke: "#e5e7eb" }} />
        <YAxis
          tick={{ fontSize: 12, fill: "#6b7280" }}
          tickLine={false}
          axisLine={false}
          tickFormatter={formatMonto}
          width={56}
        />
        <Tooltip
          formatter={(value) => [Number(value ?? 0).toFixed(2), "Vendido"]}
          labelFormatter={(dia) => `Día ${dia}`}
        />
        {metaDiaria > 0 && (
          <ReferenceLine
            y={metaDiaria}
            stroke={GRIS_META}
            strokeDasharray="4 4"
            label={{ value: "Meta diaria", position: "insideTopRight", fontSize: 11, fill: GRIS_META }}
          />
        )}
        <Line type="monotone" dataKey="monto" stroke={VERDE} strokeWidth={2} dot={{ r: 2 }} name="Vendido" />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function GraficoPorDiaSemana({ datos }: { datos: ObjetivosPorDiaSemana[] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={datos} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid stroke="#e5e7eb" strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="diaSemana"
          tick={{ fontSize: 12, fill: "#6b7280" }}
          tickLine={false}
          axisLine={{ stroke: "#e5e7eb" }}
          interval={0}
        />
        <YAxis
          tick={{ fontSize: 12, fill: "#6b7280" }}
          tickLine={false}
          axisLine={false}
          tickFormatter={formatMonto}
          width={56}
        />
        <Tooltip formatter={(value) => [Number(value ?? 0).toFixed(2), "Total"]} />
        <Bar dataKey="total" fill={VERDE} radius={[4, 4, 0, 0]} name="Total" />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function GraficoPorSemana({ datos, metaSemanal }: { datos: ObjetivosPorSemana[]; metaSemanal: number }) {
  const datosEtiquetados = datos.map((d) => ({ ...d, etiqueta: `Semana ${d.semana}` }));
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={datosEtiquetados} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid stroke="#e5e7eb" strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="etiqueta"
          tick={{ fontSize: 12, fill: "#6b7280" }}
          tickLine={false}
          axisLine={{ stroke: "#e5e7eb" }}
        />
        <YAxis
          tick={{ fontSize: 12, fill: "#6b7280" }}
          tickLine={false}
          axisLine={false}
          tickFormatter={formatMonto}
          width={56}
        />
        <Tooltip formatter={(value) => [Number(value ?? 0).toFixed(2), "Total"]} />
        {metaSemanal > 0 && (
          <ReferenceLine
            y={metaSemanal}
            stroke={GRIS_META}
            strokeDasharray="4 4"
            label={{ value: "Meta semanal", position: "insideTopRight", fontSize: 11, fill: GRIS_META }}
          />
        )}
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="total" fill={VERDE} radius={[4, 4, 0, 0]} name="Total vendido" />
      </BarChart>
    </ResponsiveContainer>
  );
}
