-- Kardex y Traslados siempre filtran por empresa_id (RLS) y además ordenan
-- por fecha descendente con un límite (200 y 100 filas respectivamente).
-- Sin un índice que cubra ambas columnas juntas, Postgres tiene que barrer
-- todas las filas de la empresa y ordenarlas en memoria — como
-- kardex_movimientos es un ledger que solo crece (nunca se borra nada),
-- esto se pone cada vez más lento con el tiempo. Un índice compuesto
-- (empresa_id, fecha desc) resuelve el filtro y el orden en un solo paso.
create index if not exists idx_kardex_movimientos_empresa_fecha
  on public.kardex_movimientos (empresa_id, fecha desc);

create index if not exists idx_traslados_empresa_fecha
  on public.traslados (empresa_id, fecha desc);
