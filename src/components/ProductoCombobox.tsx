"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Producto = { id: string; nombre: string };

// Filtra por productos cuyo nombre EMPIEZA con lo escrito (no "contiene")
// porque en este rubro los nombres suelen empezar con el código/tipo de
// producto (PP, QQ, TRIPLE...) y buscar por inicio reduce mucho más rápido
// la lista que un buscador por coincidencia en cualquier parte del nombre.
function filtrarProductos(productos: Producto[], query: string): Producto[] {
  const q = query.trim().toLowerCase();
  if (!q) return productos.slice(0, 20);
  const empiezanCon = productos.filter((p) => p.nombre.toLowerCase().startsWith(q));
  if (empiezanCon.length > 0) return empiezanCon.slice(0, 20);
  return productos.filter((p) => p.nombre.toLowerCase().includes(q)).slice(0, 20);
}

export default function ProductoCombobox({
  productos,
  value,
  onChange,
  defaultValue = "",
  name = "producto_id[]",
  placeholder = "Escribe el nombre del producto...",
  className,
}: {
  productos: Producto[];
  // Controlado (value+onChange) para líneas dentro de un array manejado
  // por el formulario padre. Si se omite `value`, el combobox maneja su
  // propia selección internamente (para un único campo suelto en el
  // formulario) y solo la expone vía el input oculto `name`.
  value?: string;
  onChange?: (productoId: string) => void;
  defaultValue?: string;
  name?: string;
  placeholder?: string;
  className?: string;
}) {
  const [internalValue, setInternalValue] = useState(defaultValue);
  const controlado = value !== undefined;
  const valorActual = controlado ? value : internalValue;

  const seleccionado = productos.find((p) => p.id === valorActual);
  const [query, setQuery] = useState(seleccionado?.nombre ?? "");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  function elegir(productoId: string) {
    if (!controlado) setInternalValue(productoId);
    onChange?.(productoId);
  }

  // El texto mostrado sigue al valor real solo cuando ese valor cambia
  // desde afuera (ej. se eligió el producto, o se resetearon las líneas al
  // cambiar de almacén) — mientras el usuario escribe no se toca `value`
  // así que este efecto no le pisa lo que está tipeando.
  useEffect(() => {
    const p = productos.find((pr) => pr.id === valorActual);
    // Sincroniza el texto mostrado con el valor real solo cuando ese
    // valor cambia desde afuera del propio input — no hay forma de hacer
    // esto sin un efecto porque depende de un prop que cambia por fuera.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setQuery(p?.nombre ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valorActual]);

  const filtrados = useMemo(() => filtrarProductos(productos, query), [query, productos]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        // Si cerró sin elegir nada, se descarta lo tipeado y vuelve a
        // mostrar el producto realmente seleccionado (o vacío).
        const p = productos.find((pr) => pr.id === valorActual);
        setQuery(p?.nombre ?? "");
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [valorActual, productos]);

  return (
    <div ref={containerRef} className="relative">
      <input type="hidden" name={name} value={valorActual} />
      <input
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && filtrados.length > 0) {
            e.preventDefault();
            elegir(filtrados[0].id);
            setOpen(false);
          }
        }}
        placeholder={placeholder}
        autoComplete="off"
        className={className}
      />
      {open && (
        <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg">
          {filtrados.length > 0 ? (
            <ul className="max-h-56 overflow-auto">
              {filtrados.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => {
                      elegir(p.id);
                      setOpen(false);
                    }}
                    className="block w-full px-3 py-2 text-left text-sm hover:bg-emerald-50"
                  >
                    {p.nombre}
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
        </div>
      )}
    </div>
  );
}
