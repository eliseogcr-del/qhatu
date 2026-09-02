# Documento Técnico — Plataforma Multi-Tenant de Atención al Cliente (WhatsApp + Instagram + IA)

## 1. Resumen del proyecto

Construir un SaaS multi-tenant que permita a pymes:
1. Recibir y responder mensajes de **WhatsApp Business** e **Instagram Direct** desde un único panel.
2. Que un asistente de IA responda consultas frecuentes y califique al cliente.
3. Gestionar el ciclo de venta completo: lead → cotización → cierre → reprogramación → postventa.
4. Mantener historial de conversaciones como CRM básico.

**Objetivo de esta fase:** construir el MVP funcional con el mínimo costo posible, para validar con 1-3 pymes reales antes de invertir en escalar.

**Instrucción general para Claude Code:** priorizar simplicidad y velocidad de entrega sobre arquitectura "perfecta". Monolito modular, no microservicios. Usar servicios gestionados con tier gratuito siempre que exista la opción. No optimizar prematuramente.

---

## 2. Alcance del MVP (Fase 1)

### Incluido
- [ ] Autenticación de usuarios (login por tenant/empresa)
- [ ] Conexión de una cuenta de WhatsApp Business (Cloud API oficial de Meta) por tenant
- [ ] Conexión de una cuenta de Instagram Business (Instagram Messaging API) por tenant
- [ ] Bandeja unificada de conversaciones (inbox) con ambos canales
- [ ] Respuesta manual desde el panel
- [ ] Respuesta automática con IA (modelo económico) para preguntas frecuentes
- [ ] Escalamiento a humano cuando la IA no puede resolver
- [ ] Pipeline de venta simple (Kanban: Nuevo → En conversación → Cotizado → Cerrado → Reprogramado)
- [ ] Reprogramación de citas/pedidos integrada con Google Calendar
- [ ] Historial de conversación por cliente (CRM básico)

### Explícitamente fuera de alcance en esta fase
- Microservicios, colas de mensajes (RabbitMQ/SQS)
- Panel de analítica avanzada
- Facturación/pagos integrados
- Soporte multi-idioma
- App móvil nativa

---

## 3. Stack técnico

| Capa | Tecnología | Motivo |
|---|---|---|
| Frontend | Next.js (React) + Tailwind CSS | Rápido de desarrollar, deploy gratis en Vercel |
| Backend | Next.js API routes o NestJS ligero | Evitar mantener 2 repos separados si se puede en Next.js |
| Base de datos | PostgreSQL vía Supabase | Auth, DB y realtime incluidos en tier gratuito |
| Autenticación | Supabase Auth | Multi-tenant con Row Level Security (RLS) |
| IA | API de Claude (Haiku para respuestas simples, Sonnet para casos complejos) | Costo bajo, fácil de integrar |
| Mensajería WhatsApp | WhatsApp Cloud API (directo con Meta, sin BSP) | Evita markup de intermediarios |
| Mensajería Instagram | Instagram Messaging API (Meta Graph API) | Mismo ecosistema que WhatsApp |
| Calendario | Google Calendar API | No reinventar motor de citas |
| Hosting backend/frontend | Vercel (frontend) + Railway o Render (si backend separado) | Tiers gratuitos/económicos |
| Notificaciones internas | Webhooks + polling simple (sin colas en MVP) | Reducir complejidad inicial |

---

## 4. Arquitectura (MVP)

```
[Meta Webhooks: WhatsApp + Instagram]
        │
        ▼
[API Route: /api/webhooks/meta]  → valida firma, identifica tenant por phone_number_id / page_id
        │
        ▼
[Guarda mensaje en tabla `messages`] → [Dispara lógica de IA si aplica]
        │
        ▼
[Supabase Realtime] → actualiza bandeja en el frontend en vivo
        │
        ▼
[Panel web (Next.js)] → agente humano puede responder manualmente
```

- **Multi-tenancy**: cada fila en las tablas principales tiene `tenant_id`. Se usa Row Level Security de Supabase para que cada tenant solo vea sus propios datos.
- **Ruteo de mensajes entrantes**: el webhook de Meta identifica el tenant según el `phone_number_id` (WhatsApp) o `page_id` (Instagram) recibido en el payload, mapeado a una tabla `tenant_channels`.
- **IA como servicio interno**, no microservicio aparte: una función que recibe el mensaje, el historial de la conversación y devuelve una respuesta o la marca para revisión humana.

---

## 5. Modelo de datos (borrador inicial)

```sql
tenants (
  id, nombre, plan, creado_en
)

tenant_channels (
  id, tenant_id, canal ('whatsapp' | 'instagram'),
  identificador_externo (phone_number_id o page_id),
  access_token, creado_en
)

clientes (
  id, tenant_id, nombre, telefono, instagram_handle,
  canal_preferido, creado_en
)

conversaciones (
  id, tenant_id, cliente_id, canal, estado
  ('nuevo' | 'en_conversacion' | 'cotizado' | 'cerrado' | 'reprogramado'),
  asignado_a (usuario o 'ia'), actualizado_en
)

mensajes (
  id, conversacion_id, remitente ('cliente' | 'ia' | 'agente'),
  contenido, timestamp, metadata_ia (opcional: intención detectada, confianza)
)

usuarios (
  id, tenant_id, nombre, email, rol
)

citas (
  id, tenant_id, conversacion_id, fecha_hora,
  estado ('agendada' | 'reprogramada' | 'cancelada'),
  google_calendar_event_id
)
```

---

## 6. Integraciones — detalles clave

### WhatsApp Cloud API
- Requiere cuenta de Meta Business y número verificado por tenant.
- Webhook único de la app recibe mensajes de todos los tenants; se distingue por `phone_number_id`.
- Ventana de servicio de 24h: dentro de esa ventana se puede responder libre; fuera, se necesita plantilla aprobada.
- **Importante (verificar vigencia en Meta Developer Docs al momento de implementar):** el modelo de precios de Meta ha cambiado varias veces en 2025-2026 (de conversación a por-mensaje, y próximos cambios en octubre 2026 sobre mensajes de servicio). Antes de fijar precios al cliente final, revisar la documentación oficial actualizada.

### Instagram Messaging API
- Requiere página de Facebook vinculada a la cuenta de Instagram Business.
- Mismo Graph API que WhatsApp, distinto endpoint de webhook/página.

### IA (Claude API)
- Prompt de sistema por tenant: cargar tono de voz, catálogo/FAQs del negocio, reglas de escalamiento.
- Flujo sugerido:
  1. Mensaje entra → clasificar intención (consulta simple / queja / venta compleja) con modelo económico (Haiku).
  2. Si es simple → responder directo.
  3. Si es compleja o el cliente lo pide → marcar conversación como `requiere_humano`, notificar al agente.
- Guardar el prompt/contexto de cada tenant en una tabla `tenant_ia_config` para personalización sin tocar código.

### Google Calendar
- OAuth por tenant (cada negocio conecta su propio calendario).
- Reprogramación = actualizar evento existente vía `events.update`, no crear uno nuevo.

---

## 7. Variables de entorno necesarias

```
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
META_APP_ID=
META_APP_SECRET=
META_WEBHOOK_VERIFY_TOKEN=
ANTHROPIC_API_KEY=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
```

---

## 8. Plan de trabajo sugerido (orden de implementación)

1. **Setup base**: proyecto Next.js + Supabase (tablas, RLS, auth básica).
2. **Onboarding de tenant**: registro de empresa + conexión de WhatsApp (webhook + verificación).
3. **Recepción de mensajes de WhatsApp**: guardar en DB, mostrar en bandeja simple.
4. **Respuesta manual desde el panel** (sin IA aún) — validar el ciclo completo funciona.
5. **Integrar Instagram** (mismo patrón que WhatsApp).
6. **Integrar IA** para respuesta automática + lógica de escalamiento.
7. **Pipeline de venta** (Kanban simple sobre `conversaciones.estado`).
8. **Integración de Google Calendar** para citas y reprogramaciones.
9. **Pulido de UI y pruebas con 1 tenant piloto real.**

---

## 9. Notas para Claude Code

- Priorizar código simple y legible sobre abstracciones tempranas.
- No introducir colas de mensajes ni microservicios en esta fase — el volumen esperado (pocos tenants piloto) no lo justifica.
- Todas las tablas deben tener `tenant_id` desde el día uno, aunque el MVP solo se pruebe con un tenant.
- Usar Row Level Security de Supabase para aislar datos entre tenants (no confiar solo en filtros de aplicación).
- Documentar en el README los pasos para conectar una nueva cuenta de WhatsApp/Instagram de prueba (sandbox de Meta).
