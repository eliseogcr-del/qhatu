-- Incidente: dos "Nota de venta" con el mismo número (NV01-1216),
-- mismo cliente/almacén/fecha/total. Causa: crearNotaVentaAutomatica
-- (en comprobantes.ts) nunca se migró al contador atómico que ya se
-- usa para factura/boleta/nota de crédito/comprobante libre — seguía
-- resolviendo el número con "select max(numero) ... y súmale 1" desde
-- el cliente, con el mismo riesgo de que dos ventas casi simultáneas
-- (del mismo almacén) lean el mismo máximo antes de que cualquiera
-- inserte su fila, y las dos terminen con el mismo número.
--
-- A diferencia de factura/boleta/NC (una sola serie por empresa), la
-- nota de venta numera por ALMACÉN — varios almacenes suelen compartir
-- el mismo texto de serie ("NV01" por defecto), pero cada uno necesita
-- su propia numeración independiente. Se agrega almacen_id a la llave
-- del contador (fijo en un UUID nulo "00000000-..." para los tipos que
-- no numeran por almacén, que son los que ya venían usando esta tabla).

alter table public.comprobantes_correlativos
  add column almacen_id uuid not null default '00000000-0000-0000-0000-000000000000'::uuid;

alter table public.comprobantes_correlativos drop constraint comprobantes_correlativos_pkey;
alter table public.comprobantes_correlativos
  add primary key (empresa_id, tipo_comprobante, serie, almacen_id);

-- La fila que la migración anterior sembró para tipo_comprobante = 9
-- (nota de venta) mezclaba el máximo de TODOS los almacenes bajo una
-- sola serie, porque nota de venta nunca llegó a usar esta tabla — se
-- descarta y se vuelve a sembrar correctamente, por almacén.
delete from public.comprobantes_correlativos where tipo_comprobante = 9;

insert into public.comprobantes_correlativos (empresa_id, tipo_comprobante, serie, almacen_id, ultimo_numero)
select empresa_id, tipo_comprobante, serie, almacen_id, max(numero)
from public.comprobantes
where tipo_comprobante = 9 and almacen_id is not null
group by empresa_id, tipo_comprobante, serie, almacen_id;

-- Se reemplaza la función (no "create or replace" simple, porque cambia
-- la lista de parámetros y eso crearía una sobrecarga nueva en vez de
-- reemplazar la anterior, dejando la de 3 parámetros rota contra la
-- llave primaria ya ampliada a 4 columnas).
drop function if exists public.siguiente_numero_comprobante(uuid, integer, text);

create or replace function public.siguiente_numero_comprobante(
  p_empresa_id uuid,
  p_tipo_comprobante integer,
  p_serie text,
  p_almacen_id uuid default '00000000-0000-0000-0000-000000000000'::uuid
)
returns integer
language plpgsql
security definer
set search_path = public
volatile
as $$
declare
  v_numero integer;
begin
  if p_empresa_id <> public.current_empresa_id() then
    raise exception 'empresa_id no coincide con el usuario autenticado';
  end if;

  insert into public.comprobantes_correlativos (empresa_id, tipo_comprobante, serie, almacen_id, ultimo_numero)
  values (p_empresa_id, p_tipo_comprobante, p_serie, p_almacen_id, 1)
  on conflict (empresa_id, tipo_comprobante, serie, almacen_id)
  do update set ultimo_numero = comprobantes_correlativos.ultimo_numero + 1
  returning ultimo_numero into v_numero;

  return v_numero;
end;
$$;

grant execute on function public.siguiente_numero_comprobante(uuid, integer, text, uuid) to authenticated;
