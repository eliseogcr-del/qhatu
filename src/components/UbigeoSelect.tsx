"use client";

import { useMemo, useState } from "react";
import type { UbigeoRow } from "@/utils/supabase/ubigeo";

const inputClass =
  "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none";

// Selector en cascada Departamento → Provincia → Distrito para elegir un
// código de ubigeo (INEI) sin arriesgarse a tipear mal el código de 6
// dígitos que exige Nubefact para la guía de remisión. El catálogo llega
// completo por props (ver fetchUbigeoCatalogo) y el filtrado es en el
// cliente, sin ida y vuelta al servidor por cada nivel elegido.
export default function UbigeoSelect({
  catalogo,
  name = "ubigeo",
  defaultValue,
}: {
  catalogo: UbigeoRow[];
  name?: string;
  defaultValue?: string | null;
}) {
  const inicial = catalogo.find((u) => u.codigo === defaultValue);
  const [departamentoCodigo, setDepartamentoCodigo] = useState(inicial?.departamento_codigo ?? "");
  const [provinciaCodigo, setProvinciaCodigo] = useState(inicial?.provincia_codigo ?? "");
  const [distritoCodigo, setDistritoCodigo] = useState(defaultValue ?? "");

  const departamentos = useMemo(() => {
    const vistos = new Map<string, string>();
    for (const u of catalogo) {
      if (!vistos.has(u.departamento_codigo)) vistos.set(u.departamento_codigo, u.departamento);
    }
    return [...vistos.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [catalogo]);

  const provincias = useMemo(() => {
    if (!departamentoCodigo) return [];
    const vistos = new Map<string, string>();
    for (const u of catalogo) {
      if (u.departamento_codigo === departamentoCodigo && !vistos.has(u.provincia_codigo)) {
        vistos.set(u.provincia_codigo, u.provincia);
      }
    }
    return [...vistos.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [catalogo, departamentoCodigo]);

  const distritos = useMemo(() => {
    if (!provinciaCodigo) return [];
    return catalogo
      .filter((u) => u.provincia_codigo === provinciaCodigo)
      .sort((a, b) => a.distrito.localeCompare(b.distrito));
  }, [catalogo, provinciaCodigo]);

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <input type="hidden" name={name} value={distritoCodigo} />
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Departamento</label>
        <select
          value={departamentoCodigo}
          onChange={(e) => {
            setDepartamentoCodigo(e.target.value);
            setProvinciaCodigo("");
            setDistritoCodigo("");
          }}
          className={inputClass}
        >
          <option value="">Selecciona...</option>
          {departamentos.map(([codigo, nombre]) => (
            <option key={codigo} value={codigo}>
              {nombre}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Provincia</label>
        <select
          value={provinciaCodigo}
          disabled={!departamentoCodigo}
          onChange={(e) => {
            setProvinciaCodigo(e.target.value);
            setDistritoCodigo("");
          }}
          className={`${inputClass} disabled:bg-gray-50 disabled:text-gray-400`}
        >
          <option value="">Selecciona...</option>
          {provincias.map(([codigo, nombre]) => (
            <option key={codigo} value={codigo}>
              {nombre}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Distrito</label>
        <select
          value={distritoCodigo}
          disabled={!provinciaCodigo}
          onChange={(e) => setDistritoCodigo(e.target.value)}
          className={`${inputClass} disabled:bg-gray-50 disabled:text-gray-400`}
        >
          <option value="">Selecciona...</option>
          {distritos.map((d) => (
            <option key={d.codigo} value={d.codigo}>
              {d.distrito}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
