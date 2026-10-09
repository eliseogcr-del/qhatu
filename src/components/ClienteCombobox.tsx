"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { UserPlus } from "lucide-react";
import ClienteRapidoModal from "./ClienteRapidoModal";

type Cliente = { id: string; nombre: string };

const inputClassDefault =
  "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none";

export default function ClienteCombobox({
  clientes,
  name = "cliente_id",
  defaultClienteId,
  placeholder = "Escribe el nombre del cliente...",
  onChange,
  className = inputClassDefault,
}: {
  clientes: Cliente[];
  name?: string;
  defaultClienteId?: string;
  placeholder?: string;
  // Opcional: para cuando el formulario padre necesita reaccionar a la
  // selección (ej. recalcular precios según el cliente elegido).
  onChange?: (clienteId: string) => void;
  className?: string;
}) {
  const [clientesLocal, setClientesLocal] = useState(clientes);
  const clienteInicial = clientesLocal.find((c) => c.id === defaultClienteId);
  const [query, setQuery] = useState(clienteInicial?.nombre ?? "");
  const [clienteId, setClienteIdState] = useState(defaultClienteId ?? "");
  const setClienteId = (id: string) => {
    setClienteIdState(id);
    onChange?.(id);
  };
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

  // Si se escribió un nombre pero nunca se hizo click en la sugerencia
  // (ej. se tipeó y se mandó el formulario directo), sin esto el campo se
  // veía lleno pero el id detrás quedaba vacío — el formulario fallaba
  // como si no se hubiera elegido ningún cliente. Si lo tipeado matchea
  // uno solo, se asume que es ese; si es ambiguo o no hay texto, no se
  // adivina.
  function resolverAlSalir() {
    if (clienteId) return;
    if (!query.trim()) return;
    if (filtrados.length === 1) {
      setClienteId(filtrados[0].id);
      setQuery(filtrados[0].nombre);
    }
  }

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        resolverAlSalir();
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clienteId, query, filtrados]);

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
        onBlur={() => {
          // Los clicks en una opción de la lista no llegan a disparar este
          // blur (ver onMouseDown implícito del button, que corre antes) —
          // acá cae el caso de salir con Tab u otro foco sin usar el mouse.
          resolverAlSalir();
        }}
        placeholder={placeholder}
        autoComplete="off"
        className={className}
      />
      {open && (
        <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg">
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
                    className="block w-full px-3 py-2 text-left text-sm text-gray-900 hover:bg-emerald-50"
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
