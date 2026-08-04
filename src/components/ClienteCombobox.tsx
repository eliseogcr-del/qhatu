"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Cliente = { id: string; nombre: string };

export default function ClienteCombobox({
  clientes,
  name = "cliente_id",
  defaultClienteId,
  placeholder = "Escribe el nombre del cliente...",
}: {
  clientes: Cliente[];
  name?: string;
  defaultClienteId?: string;
  placeholder?: string;
}) {
  const clienteInicial = clientes.find((c) => c.id === defaultClienteId);
  const [query, setQuery] = useState(clienteInicial?.nombre ?? "");
  const [clienteId, setClienteId] = useState(defaultClienteId ?? "");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const filtrados = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = q
      ? clientes.filter((c) => c.nombre.toLowerCase().includes(q))
      : clientes;
    return base.slice(0, 20);
  }, [query, clientes]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <input type="hidden" name={name} value={clienteId} />
      <input
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setClienteId("");
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        autoComplete="off"
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
      />
      {open && filtrados.length > 0 && (
        <ul className="absolute z-10 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg">
          {filtrados.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => {
                  setClienteId(c.id);
                  setQuery(c.nombre);
                  setOpen(false);
                }}
                className="block w-full px-3 py-2 text-left text-sm hover:bg-emerald-50"
              >
                {c.nombre}
              </button>
            </li>
          ))}
        </ul>
      )}
      {open && query.trim() && filtrados.length === 0 && (
        <div className="absolute z-10 mt-1 w-full rounded-lg border border-gray-200 bg-white p-3 text-sm text-gray-400 shadow-lg">
          Sin resultados
        </div>
      )}
    </div>
  );
}
