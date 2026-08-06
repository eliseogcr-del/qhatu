// Cliente para Decolecta (https://decolecta.com) — consulta de RUC/DNI
// contra SUNAT/RENIEC, usada para autocompletar nombre/razón social y
// dirección al registrar un cliente por su número de documento.

export type ConsultaDocumento = {
  nombre: string;
  direccion: string | null;
  departamento?: string | null;
  provincia?: string | null;
  distrito?: string | null;
};

async function llamarDecolecta(path: string): Promise<Record<string, unknown>> {
  const token = process.env.DECOLECTA_TOKEN;
  if (!token) {
    throw new Error("Falta configurar DECOLECTA_TOKEN en las variables de entorno.");
  }

  const res = await fetch(`https://api.decolecta.com${path}`, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    if (res.status === 404) throw new Error("No se encontró ese documento.");
    if (res.status === 401 || res.status === 403) {
      throw new Error("El token de Decolecta es inválido o no tiene permisos.");
    }
    if (res.status === 429) {
      throw new Error("Se alcanzó el límite de consultas de Decolecta por ahora.");
    }
    throw new Error(`Decolecta respondió con error ${res.status}.`);
  }

  return res.json();
}

export async function consultarRuc(ruc: string): Promise<ConsultaDocumento> {
  const data = await llamarDecolecta(`/v1/sunat/ruc?numero=${encodeURIComponent(ruc)}`);
  const nombre = String(
    data.razon_social ?? data.nombre_o_razon_social ?? data.nombre ?? "",
  ).trim();
  const direccion = data.direccion ? String(data.direccion).trim() : null;

  if (!nombre) throw new Error("No se encontró información para ese RUC.");
  return {
    nombre,
    direccion: direccion || null,
    departamento: data.departamento ? String(data.departamento).trim() : null,
    provincia: data.provincia ? String(data.provincia).trim() : null,
    distrito: data.distrito ? String(data.distrito).trim() : null,
  };
}

export async function consultarDni(dni: string): Promise<ConsultaDocumento> {
  const data = await llamarDecolecta(`/v1/reniec/dni?numero=${encodeURIComponent(dni)}`);
  const nombre = String(
    data.full_name ??
      data.nombre_completo ??
      [data.nombres, data.apellido_paterno, data.apellido_materno]
        .filter(Boolean)
        .join(" ") ??
      "",
  ).trim();

  if (!nombre) throw new Error("No se encontró información para ese DNI.");
  return { nombre, direccion: null };
}
