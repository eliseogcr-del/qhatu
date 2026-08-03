-- RLS policies alone don't grant access — PostgREST still enforces normal
-- Postgres table privileges first. These were missing after the base
-- migration, causing "permission denied for table clientes" (42501) for
-- authenticated requests even though RLS policies were correct.

grant usage on schema public to authenticated;

grant select on public.empresas to authenticated;
grant select on public.usuarios to authenticated;
grant select, insert, update on public.clientes to authenticated;
grant select on public.cliente_vendedor to authenticated;
