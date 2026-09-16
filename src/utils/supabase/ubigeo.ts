import { createClient } from "./server";

export type UbigeoRow = {
  codigo: string;
  distrito: string;
  provincia_codigo: string;
  provincia: string;
  departamento_codigo: string;
  departamento: string;
};

// Catálogo completo (~1834 distritos) — se trae entero porque el selector
// en cascada (Departamento → Provincia → Distrito) filtra en el cliente,
// sin ida y vuelta al servidor por cada nivel elegido.
export async function fetchUbigeoCatalogo(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<UbigeoRow[]> {
  const { data } = await supabase
    .from("ubigeo")
    .select("codigo, distrito, provincia_codigo, provincia, departamento_codigo, departamento")
    .order("departamento")
    .order("provincia")
    .order("distrito");
  return data ?? [];
}
