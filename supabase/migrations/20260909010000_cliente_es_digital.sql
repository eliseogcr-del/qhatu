-- Igual que almacenes.es_digital: marca clientes que compran por el canal
-- digital, para poder darle acceso a Clientes (filtrado a solo estos) al
-- perfil vendedor que opera desde un almacén digital.
alter table public.clientes
  add column es_digital boolean not null default false;
