-- Incidente: "Nubefact rechazó el comprobante: Este documento ya existe
-- en NubeFacT". Causa: el número de cada comprobante se resolvía con
-- "select max(numero) ... y súmale 1" desde el cliente — si dos
-- emisiones para el mismo empresa_id+tipo_comprobante+serie corrían casi
-- al mismo tiempo (ej. una venta y un comprobante libre, que a propósito
-- comparten la misma serie), ambas podían leer el mismo máximo antes de
-- que cualquiera insertara su fila, y las dos intentaban emitir con el
-- mismo número — Nubefact acepta la primera y rechaza la segunda por
-- duplicada.
--
-- Se reemplaza por un contador atómico en base de datos: una fila por
-- empresa_id+tipo_comprobante+serie, incrementada con INSERT ... ON
-- CONFLICT DO UPDATE, que Postgres serializa con un lock de fila — dos
-- llamadas simultáneas nunca pueden salir con el mismo número, sin
-- importar cuántas lleguen a la vez.

create table public.comprobantes_correlativos (
  empresa_id uuid not null references public.empresas (id),
  tipo_comprobante integer not null,
  serie text not null,
  ultimo_numero integer not null default 0,
  primary key (empresa_id, tipo_comprobante, serie)
);

-- Se inicializa con el máximo ya usado hoy en comprobantes, para que el
-- primer número que entregue el contador sea el que de verdad sigue —
-- nunca uno ya usado.
insert into public.comprobantes_correlativos (empresa_id, tipo_comprobante, serie, ultimo_numero)
select empresa_id, tipo_comprobante, serie, max(numero)
from public.comprobantes
group by empresa_id, tipo_comprobante, serie;

alter table public.comprobantes_correlativos enable row level security;

create policy "comprobantes_correlativos: select por empresa" on public.comprobantes_correlativos
  for select using (empresa_id = public.current_empresa_id());

-- Solo select — insert/update directo desde el cliente no hace falta
-- (ni se le da permiso): la reserva pasa siempre por la función de abajo
-- (security definer), nunca por un UPSERT directo del cliente.
grant select on public.comprobantes_correlativos to authenticated;

-- security definer: hace falta para que el UPSERT corra con permisos
-- propios y no dependa de que el usuario tenga insert/update directo
-- sobre comprobantes_correlativos (que a propósito no se le dio). Por
-- eso valida a mano que p_empresa_id sea la del usuario autenticado —
-- si no, cualquiera podría pasar el empresa_id de otro tenant.
create or replace function public.siguiente_numero_comprobante(
  p_empresa_id uuid,
  p_tipo_comprobante integer,
  p_serie text
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

  insert into public.comprobantes_correlativos (empresa_id, tipo_comprobante, serie, ultimo_numero)
  values (p_empresa_id, p_tipo_comprobante, p_serie, 1)
  on conflict (empresa_id, tipo_comprobante, serie)
  do update set ultimo_numero = comprobantes_correlativos.ultimo_numero + 1
  returning ultimo_numero into v_numero;

  return v_numero;
end;
$$;

grant execute on function public.siguiente_numero_comprobante(uuid, integer, text) to authenticated;
