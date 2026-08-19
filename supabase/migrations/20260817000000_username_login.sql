-- Login por "Usuario" en vez de correo electrónico. Supabase Auth sigue
-- exigiendo un email internamente (no hay forma de evitarlo sin cambiar de
-- proveedor de auth), así que se agrega un `username` en el perfil que el
-- usuario ve/usa para entrar, y una función que lo traduce al email real
-- (o sintético, si no se cargó uno) para el sign-in — el email deja de ser
-- lo que la persona escribe para ingresar.

alter table public.usuarios
  add column username text;

-- Backfill: usuarios existentes toman como username la parte local de su
-- correo actual, desduplicando si dos correos comparten esa parte local.
with ranked as (
  select
    u.id,
    split_part(au.email, '@', 1) as base_username,
    row_number() over (
      partition by lower(split_part(au.email, '@', 1))
      order by u.id
    ) as rn
  from public.usuarios u
  join auth.users au on au.id = u.id
  where u.username is null and au.email is not null
)
update public.usuarios u
set username = case when r.rn = 1 then r.base_username else r.base_username || r.rn::text end
from ranked r
where r.id = u.id;

alter table public.usuarios
  alter column username set not null;

create unique index if not exists usuarios_username_unique_idx
  on public.usuarios (lower(username));

-- Traduce un username al email real detrás de esa cuenta, para poder
-- llamar signInWithPassword con lo que Supabase Auth realmente entiende.
-- security definer porque esto se llama ANTES de autenticarse (desde el
-- formulario de login), cuando la sesión todavía no existe y por lo tanto
-- ninguna policy de `usuarios` aplicaría.
create or replace function public.email_por_username(p_username text)
returns text
language sql
security definer
set search_path = public
stable
as $$
  select au.email
  from public.usuarios u
  join auth.users au on au.id = u.id
  where lower(u.username) = lower(p_username)
  limit 1;
$$;

grant execute on function public.email_por_username(text) to anon, authenticated;
