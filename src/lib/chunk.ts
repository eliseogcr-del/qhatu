// Supabase manda los valores de .in("columna", ids) en la URL de la
// petición — con un filtro amplio (ej. "todas las ventas del mes" sin
// acotar por almacén/vendedor) esa lista puede pasar de cientos de UUIDs
// y la URL se vuelve demasiado larga: PostgREST la rechaza (o, peor, la
// consulta vuelve vacía en silencio) sin que nadie lo note en la
// pantalla. Partir la lista en bloques y mandar varias peticiones más
// chicas evita ese límite sin importar cuántos ids haya.
export function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}
