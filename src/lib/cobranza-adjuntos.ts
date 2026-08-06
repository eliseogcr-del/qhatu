// Plan free de Supabase: 1GB de storage total, compartido entre
// pedido-adjuntos y cobranza-adjuntos. Dos umbrales: uno de aviso (para
// que el admin sepa que se acerca el límite) y otro de bloqueo (deja de
// aceptar fotos nuevas, pero nunca bloquea el registro del cobro en sí).
export const LIMITE_STORAGE_BYTES = 1024 * 1024 * 1024; // 1GB
export const UMBRAL_AVISO_BYTES = 800 * 1024 * 1024; // 800MB
export const UMBRAL_BLOQUEO_BYTES = 950 * 1024 * 1024; // 950MB

export const RUTA_LOCAL_ARCHIVO = "D:\\FotosSistemaQhatu";

function sinAcentosNiEspacios(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "");
}

// Formato pedido: NroCobranza_NombreCliente_Fecha_correlativo.ext
export function buildNombreArchivoCobranza({
  codigoCobranza,
  clienteNombre,
  fecha,
  correlativo,
  extension,
}: {
  codigoCobranza: string;
  clienteNombre: string;
  fecha: string; // YYYY-MM-DD
  correlativo: number;
  extension: string;
}): string {
  const cliente = sinAcentosNiEspacios(clienteNombre) || "Cliente";
  const ext = extension.replace(/[^a-zA-Z0-9]/g, "") || "jpg";
  return `${codigoCobranza}_${cliente}_${fecha}_${correlativo}.${ext}`;
}

export function buildRutaLocal(nombreArchivo: string): string {
  return `${RUTA_LOCAL_ARCHIVO}\\${nombreArchivo}`;
}
