-- service_role se salta RLS, pero NO se salta los GRANT de tabla normales
-- (son dos mecanismos distintos en Postgres). usuarios solo tenia
-- "grant select ... to authenticated" (20260803000100_grants.sql); al crear
-- el modulo de gestion de usuarios, que inserta/actualiza esta tabla desde
-- un cliente admin (service_role), faltaba el grant de escritura para ese
-- rol y las operaciones fallaban con "permission denied for table usuarios".

grant select, insert, update on public.usuarios to service_role;
