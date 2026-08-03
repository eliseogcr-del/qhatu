type Destino = {
  latitud: number | null;
  longitud: number | null;
  direccion: string | null;
};

function destinoParam(destino: Destino): string | null {
  if (destino.latitud != null && destino.longitud != null) {
    return `${destino.latitud},${destino.longitud}`;
  }
  if (destino.direccion) return destino.direccion;
  return null;
}

export function buildGoogleMapsLink(destino: Destino): string | null {
  const param = destinoParam(destino);
  if (!param) return null;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(param)}`;
}

export function buildGoogleMapsMultiStopLink(destinos: Destino[]): string | null {
  const params = destinos.map(destinoParam).filter((p): p is string => !!p);
  if (params.length === 0) return null;
  if (params.length === 1) {
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(params[0])}`;
  }

  const destination = params[params.length - 1];
  const waypoints = params.slice(0, -1).join("|");
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
    destination,
  )}&waypoints=${encodeURIComponent(waypoints)}`;
}
