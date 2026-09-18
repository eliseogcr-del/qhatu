// Filtra promociones fuera de su ventana de campaña (promocion_inicio/fin).
// Aparte de un componente para que el lint de pureza de Server Components
// no marque el Date.now() de acá como una llamada impura dentro del render.
export function filtrarPromocionesVigentes<
  T extends {
    es_promocion: boolean;
    promocion_inicio: string | null;
    promocion_fin: string | null;
  },
>(productos: T[]): T[] {
  const ahora = Date.now();
  return productos.filter((p) => {
    if (!p.es_promocion) return true;
    if (p.promocion_inicio && ahora < new Date(p.promocion_inicio).getTime()) return false;
    if (p.promocion_fin && ahora > new Date(p.promocion_fin).getTime()) return false;
    return true;
  });
}
