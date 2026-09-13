-- Registrar un movimiento de kardex hacía "leer stock_actual → calcular el
-- nuevo saldo en el código de la app → escribir" en pasos separados, sin
-- ningún bloqueo entre ellos. Si dos movimientos para el mismo
-- producto+almacén se disparaban casi al mismo tiempo (doble clic, un
-- reintento de red, dos pestañas abiertas), ambos podían leer el mismo
-- stock "viejo" antes de que el otro terminara de escribir, y uno de los
-- dos movimientos se perdía silenciosamente del saldo aunque el kardex
-- sí guardara la fila — esto se confirmó en producción (una venta quedó
-- con saldo_resultante como si el stock anterior fuera 0 en vez del valor
-- real). Un solo `UPDATE ... SET stock = stock + delta` es atómico en
-- Postgres: el motor serializa cualquier escritura concurrente sobre la
-- misma fila, así que ya no hay forma de perder un movimiento por una
-- carrera, sin importar cuántas lleguen al mismo tiempo.
create or replace function public.registrar_movimiento_kardex(
  p_empresa_id uuid,
  p_producto_id uuid,
  p_almacen_id uuid,
  p_tipo_movimiento text,
  p_cantidad numeric,
  p_usuario_id uuid,
  p_referencia_id uuid default null,
  p_detalle text default null
) returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_saldo numeric;
begin
  -- El chequeo de empresa solo aplica cuando hay una sesión de usuario real
  -- detrás (current_empresa_id() lee auth.uid()) — una llamada con el
  -- cliente admin (service_role, sin JWT de usuario) no tiene auth.uid(),
  -- y esos casos ya validaron el permiso en el código de la app antes de
  -- llegar acá (ver traslados/actions.ts).
  if public.current_empresa_id() is not null and p_empresa_id <> public.current_empresa_id() then
    raise exception 'empresa_id no coincide con la sesión actual';
  end if;

  insert into public.inventario (producto_id, almacen_id, stock_actual)
    values (p_producto_id, p_almacen_id, 0)
  on conflict (producto_id, almacen_id) do nothing;

  update public.inventario
    set stock_actual = round(stock_actual + p_cantidad, 2), updated_at = now()
    where producto_id = p_producto_id and almacen_id = p_almacen_id
  returning stock_actual into v_saldo;

  insert into public.kardex_movimientos (
    empresa_id, producto_id, almacen_id, tipo_movimiento, cantidad,
    saldo_resultante, referencia_id, detalle, usuario_id
  ) values (
    p_empresa_id, p_producto_id, p_almacen_id, p_tipo_movimiento, p_cantidad,
    v_saldo, p_referencia_id, p_detalle, p_usuario_id
  );

  return v_saldo;
end;
$$;

grant execute on function public.registrar_movimiento_kardex(
  uuid, uuid, uuid, text, numeric, uuid, uuid, text
) to authenticated;

-- Versión en lote: mismo mecanismo, varios movimientos en una sola llamada
-- (un array jsonb) dentro de una única transacción. Cada fila se sigue
-- actualizando con su propio UPDATE atómico en el orden del array, así que
-- dos movimientos del mismo lote para el mismo producto+almacén (ej. una
-- reversión de traslado) se siguen aplicando en secuencia correctamente.
create or replace function public.registrar_movimientos_kardex(
  p_empresa_id uuid,
  p_usuario_id uuid,
  p_movimientos jsonb
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_mov jsonb;
  v_saldo numeric;
begin
  if public.current_empresa_id() is not null and p_empresa_id <> public.current_empresa_id() then
    raise exception 'empresa_id no coincide con la sesión actual';
  end if;

  for v_mov in select * from jsonb_array_elements(p_movimientos)
  loop
    insert into public.inventario (producto_id, almacen_id, stock_actual)
      values ((v_mov->>'productoId')::uuid, (v_mov->>'almacenId')::uuid, 0)
    on conflict (producto_id, almacen_id) do nothing;

    update public.inventario
      set stock_actual = round(stock_actual + (v_mov->>'cantidad')::numeric, 2), updated_at = now()
      where producto_id = (v_mov->>'productoId')::uuid
        and almacen_id = (v_mov->>'almacenId')::uuid
    returning stock_actual into v_saldo;

    insert into public.kardex_movimientos (
      empresa_id, producto_id, almacen_id, tipo_movimiento, cantidad,
      saldo_resultante, referencia_id, detalle, usuario_id
    ) values (
      p_empresa_id,
      (v_mov->>'productoId')::uuid,
      (v_mov->>'almacenId')::uuid,
      v_mov->>'tipoMovimiento',
      (v_mov->>'cantidad')::numeric,
      v_saldo,
      nullif(v_mov->>'referenciaId', '')::uuid,
      nullif(v_mov->>'detalle', ''),
      p_usuario_id
    );
  end loop;
end;
$$;

grant execute on function public.registrar_movimientos_kardex(uuid, uuid, jsonb) to authenticated;
