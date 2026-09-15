"use client";

import { useEffect, useState } from "react";

const OSCURO_KEY = "qhatu-vendedor-movil-oscuro";

// Preferencia de modo oscuro compartida entre las pantallas hechas a
// medida para el vendedor de almacén móvil (Venta rápida, Mis ventas) —
// cambiarlo en una se refleja en la otra, sin activarlo dos veces.
// Arranca en claro y recién en el cliente se ajusta según lo guardado,
// para no depender de cookies solo por esto.
export function useOscuroVendedorMovil(): [boolean, () => void] {
  const [oscuro, setOscuro] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(OSCURO_KEY) === "1") {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setOscuro(true);
      }
    } catch {
      // Almacenamiento no disponible (modo privado, etc.) — se queda en claro.
    }
  }, []);

  function alternar() {
    setOscuro((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(OSCURO_KEY, next ? "1" : "0");
      } catch {
        // Sin persistencia disponible, igual cambia para esta sesión.
      }
      return next;
    });
  }

  return [oscuro, alternar];
}
