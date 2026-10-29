-- Incidente: "duplicate key value violates unique constraint
-- idx_cotizaciones_empresa_numero" al crear una cotización. Misma causa
-- que ya se corrigió para comprobantes (20261015000000) y nota de venta
-- (20261026000000): el número se resolvía con "select max(numero) ...
-- y súmale 1" desde el cliente — dos cotizaciones creadas casi al mismo
-- tiempo pueden leer el mismo máximo antes de que cualquiera inserte su
-- fila, y las dos terminan con el mismo número.
--
-- Mismo patrón: un contador atómico en base de datos, incrementado con
-- INSERT ... ON CONFLICT DO UPDATE, que Postgres serializa con un lock de
-- fila. A diferencia de comprobantes, acá también hay que respetar
-- numero_inicial (configuracion_cotizaciones) — si se sube ese valor
-- después de tener cotizaciones, el siguiente número nunca debe ser menor
-- a ese mínimo configurado, igual que la fórmula original en el cliente
-- (Math.max(ultimo+1, numeroInicial)).

create table public.cotizaciones_correlativo (
  empresa_id uuid not null primary key references public.empresas (id),
  ultimo_numero integer not null default 0
);

-- Se inicializa con el máximo ya usado hoy, para que el primer número que
-- entregue el contador sea el que de verdad sigue — nunca uno ya usado.
insert into public.cotizaciones_correlativo (empresa_id, ultimo_numero)
select empresa_id, max(numero)
from public.cotizaciones
group by empresa_id;

alter table public.cotizaciones_correlativo enable row level security;

create policy "cotizaciones_correlativo: select por empresa" on public.cotizaciones_correlativo
  for select using (empresa_id = public.current_empresa_id());

-- Solo select — igual que comprobantes_correlativos, la reserva pasa
-- siempre por la función de abajo (security definer), nunca por un
-- upsert directo del cliente.
grant select on public.cotizaciones_correlativo to authenticated;

create or replace function public.siguiente_numero_cotizacion(
  p_empresa_id uuid,
  p_numero_inicial integer
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

  insert into public.cotizaciones_correlativo (empresa_id, ultimo_numero)
  values (p_empresa_id, greatest(p_numero_inicial, 1))
  on conflict (empresa_id)
  do update set ultimo_numero = greatest(cotizaciones_correlativo.ultimo_numero + 1, p_numero_inicial)
  returning ultimo_numero into v_numero;

  return v_numero;
end;
$$;

grant execute on function public.siguiente_numero_cotizacion(uuid, integer) to authenticated;
