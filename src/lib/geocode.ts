// Free geocoding via OpenStreetMap's Nominatim — matches the OSM/Leaflet
// stack already used for the map. Client-triggered only (debounced typing
// or an explicit button click), never bulk/automated, per Nominatim's
// usage policy: https://operations.osmfoundation.org/policies/nominatim/
export async function geocodeAddress(
  query: string,
): Promise<{ lat: number; lng: number } | null> {
  const trimmed = query.trim();
  if (!trimmed) return null;

  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=pe&q=${encodeURIComponent(trimmed)}`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error("No se pudo consultar el buscador de direcciones.");

  const results: { lat: string; lon: string }[] = await res.json();
  if (!results[0]) return null;

  return { lat: parseFloat(results[0].lat), lng: parseFloat(results[0].lon) };
}
