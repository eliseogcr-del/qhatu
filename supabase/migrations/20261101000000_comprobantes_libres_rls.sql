-- Un comprobante libre (origen='libre') nace SIN venta_id — se asocia a
-- una venta recién después, si acaso (ver 20260921040000_comprobantes_libres.sql).
-- Pero las policies de "comprobantes" (select/insert/update) nunca se
-- actualizaron para esto: solo dejan pasar a quien puede ver todos los
-- almacenes (admin/logística) o a quien tenga una venta en SU almacén con
-- ese venta_id — con venta_id en null, ese segundo camino nunca se
-- cumple. Por eso cualquier usuario sin rol admin/logística (ej. un
-- vendedor al que se le dio el permiso "/comprobantes-libres" desde
-- Usuarios → Permisos) choca con "new row violates row-level security
-- policy" al intentar emitir un comprobante libre — e incluso si lograra
-- insertarlo, tampoco podría verlo después en el listado.
--
-- La condición adicional es simplemente "es un comprobante libre de mi
-- empresa" — no hay almacén que validar acá porque un comprobante libre,
-- por diseño, no pertenece a ningún almacén. Quién puede llegar a crear
-- uno ya lo filtra la capa de la aplicación (requireComprobantesAcceso +
-- usuario_opciones), esta policy solo evita bloquear al usuario correcto.

drop policy if exists "comprobantes: select por rol" on public.comprobantes;
create policy "comprobantes: select por rol" on public.comprobantes
  for select using (
    empresa_id = public.current_empresa_id()
    and (
      public.puede_ver_todos_almacenes()
      or public.es_contador()
      or comprobantes.origen = 'libre'
      or exists (
        select 1 from public.ventas v
        where v.id = comprobantes.venta_id and v.almacen_id = public.current_almacen_id()
      )
    )
  );

drop policy if exists "comprobantes: insert por rol" on public.comprobantes;
create policy "comprobantes: insert por rol" on public.comprobantes
  for insert with check (
    empresa_id = public.current_empresa_id()
    and (
      public.puede_ver_todos_almacenes()
      or comprobantes.origen = 'libre'
      or exists (
        select 1 from public.ventas v
        where v.id = comprobantes.venta_id and v.almacen_id = public.current_almacen_id()
      )
    )
  );

drop policy if exists "comprobantes: update por rol" on public.comprobantes;
create policy "comprobantes: update por rol" on public.comprobantes
  for update using (
    empresa_id = public.current_empresa_id()
    and (
      public.puede_ver_todos_almacenes()
      or comprobantes.origen = 'libre'
      or exists (
        select 1 from public.ventas v
        where v.id = comprobantes.venta_id and v.almacen_id = public.current_almacen_id()
      )
    )
  )
  with check (
    empresa_id = public.current_empresa_id()
    and (
      public.puede_ver_todos_almacenes()
      or comprobantes.origen = 'libre'
      or exists (
        select 1 from public.ventas v
        where v.id = comprobantes.venta_id and v.almacen_id = public.current_almacen_id()
      )
    )
  );
