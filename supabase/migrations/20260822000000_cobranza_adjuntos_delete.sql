-- cobranza_adjuntos nunca tuvo policy/grant de delete porque hasta ahora
-- solo se creaban evidencias, nunca se borraban. La nueva opción de
-- reemplazar la evidencia de un cobro (en vez de acumular fotos) necesita
-- borrar la fila anterior antes de insertar la nueva.
create policy "cobranza_adjuntos: delete por empresa" on public.cobranza_adjuntos
  for delete using (empresa_id = public.current_empresa_id());

grant delete on public.cobranza_adjuntos to authenticated;
