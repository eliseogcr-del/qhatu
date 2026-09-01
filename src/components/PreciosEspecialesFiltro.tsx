"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Search, X } from "lucide-react";

export default function PreciosEspecialesFiltro({ q }: { q: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [query, setQuery] = useState(q);
  const primerRender = useRef(true);

  useEffect(() => {
    if (primerRender.current) {
      primerRender.current = false;
      return;
    }
    const timeout = setTimeout(() => {
      const usp = new URLSearchParams();
      if (query) usp.set("q", query);
      router.push(`${pathname}${usp.toString() ? `?${usp.toString()}` : ""}`);
    }, 400);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  return (
    <div className="max-w-xs">
      <label className="mb-1 block text-sm font-medium text-gray-700">
        Filtrar por cliente
      </label>
      <div className="relative">
        <Search
          size={16}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
        />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por cliente..."
          className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-9 pr-8 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X size={14} />
          </button>
        )}
      </div>
    </div>
  );
}
