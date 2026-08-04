"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { UserPlus } from "lucide-react";
import ClienteRapidoModal from "./ClienteRapidoModal";

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
  const [clientesLocal, setClientesLocal] = useState(clientes);
  const clienteInicial = clientesLocal.find((c) => c.id === defaultClienteId);
  const [query, setQuery] = useState(clienteInicial?.nombre ?? "");
  const [clienteId, setClienteId] = useState(defaultClienteId ?? "");
  const [open, setOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const filtrados = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = q
      ? clientesLocal.filter((c) => c.nombre.toLowerCase().includes(q))
      : clientesLocal;
    return base.slice(0, 20);
  }, [query, clientesLocal]);

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
      {open && (
        <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg">
          {filtrados.length > 0 ? (
            <ul className="max-h-56 overflow-auto">
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
          ) : (
            query.trim() && (
              <p className="px-3 py-2 text-sm text-gray-400">
                No se encontró &quot;{query.trim()}&quot;.
              </p>
            )
          )}
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="flex w-full items-center gap-1.5 border-t border-gray-100 px-3 py-2 text-left text-sm font-medium text-emerald-700 hover:bg-emerald-50"
          >
            <UserPlus size={14} />
            Registrar nuevo cliente
          </button>
        </div>
      )}

      {modalOpen && (
        <ClienteRapidoModal
          nombreInicial={query.trim()}
          onClose={() => setModalOpen(false)}
          onCreated={(nuevo) => {
            setClientesLocal((prev) => [...prev, nuevo]);
            setClienteId(nuevo.id);
            setQuery(nuevo.nombre);
            setModalOpen(false);
            setOpen(false);
          }}
        />
      )}
    </div>
  );
}
