# Atención IA

Plataforma multi-tenant de atención al cliente por WhatsApp + Instagram con
IA. Ver `docs/spec.md` (documento técnico original) para el alcance completo
del MVP y el plan de trabajo de 9 pasos.

**Estado actual: Paso 1 — Setup base.** Proyecto Next.js + Supabase con
esquema multi-tenant, Row Level Security y autenticación básica (registro de
empresa + login). La bandeja de conversaciones, las integraciones de
WhatsApp/Instagram, IA y Google Calendar se construyen en los pasos
siguientes del plan.

## Stack

- Next.js 16 (App Router) + Tailwind CSS
- Supabase (Postgres + Auth), aislamiento multi-tenant vía RLS

## Getting Started

1. Crea un proyecto en [Supabase](https://supabase.com) y aplica las
   migraciones de `supabase/migrations/` (en orden, vía el SQL Editor del
   dashboard o con `supabase db push` si usas la CLI).
2. Copia `.env.example` a `.env.local` y completa las claves de Supabase
   (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`,
   `SUPABASE_SERVICE_ROLE_KEY` — esta última solo se usa en el servidor,
   nunca se expone al cliente).
3. Instala dependencias y levanta el servidor de desarrollo:

   ```bash
   npm install
   npm run dev
   ```

4. Abre [http://localhost:3000](http://localhost:3000) y usa "Regístrala
   aquí" para crear tu primera empresa (tenant) y usuario administrador.

## Modelo de datos

Cada tabla de negocio tiene `tenant_id` desde el día uno, y RLS asegura que
cada tenant solo vea sus propios datos (ver `public.current_tenant_id()` en
`supabase/migrations/20260902000000_base_schema.sql`).

- `tenants` — empresas registradas.
- `usuarios` — perfil 1:1 con `auth.users`, con `tenant_id` y `rol`.
- `tenant_channels` — cuentas de WhatsApp/Instagram conectadas por tenant.
- `clientes` — clientes finales de cada tenant.
- `conversaciones` / `mensajes` — bandeja e historial por canal.
- `tenant_ia_config` — prompt de sistema y reglas de escalamiento por tenant.
- `citas` — agenda ligada a Google Calendar.

## Conectar una cuenta de WhatsApp/Instagram de prueba (sandbox de Meta)

Pendiente de documentar cuando se implemente el paso 2 del plan (onboarding
de tenant + conexión de canales). En resumen, cuando esté listo:

1. Crear una app en [Meta for Developers](https://developers.facebook.com/)
   con los productos WhatsApp y Messenger/Instagram.
2. Usar el número de prueba y la página de Facebook vinculada a Instagram
   que provee el modo sandbox de la app.
3. Configurar el webhook de la app apuntando a
   `/api/webhooks/meta` con el `META_WEBHOOK_VERIFY_TOKEN` definido en
   `.env.local`.
4. Guardar el `phone_number_id` / `page_id` y el access token en
   `tenant_channels` desde el panel de "Conectar canal" del tenant.
