-- Habilita editar/reintentar un comprobante libre que quedó en
-- "pendiente" o "error" (nunca llegó a emitirse en Nubefact) — hasta
-- ahora comprobante_libre_detalle solo tenía permiso de insert/select,
-- pensado para una única creación. Un comprobante ya "emitido" nunca se
-- toca por acá (eso ya es un documento real ante SUNAT).

create policy "comprobante_libre_detalle: delete por empresa" on public.comprobante_libre_detalle
  for delete using (
    exists (
      select 1 from public.comprobantes c
      where c.id = comprobante_libre_detalle.comprobante_id
        and c.empresa_id = public.current_empresa_id()
    )
  );

grant delete on public.comprobante_libre_detalle to authenticated;
