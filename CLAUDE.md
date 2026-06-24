@AGENTS.md

## Contexto del producto

**Nombre:** Watermelon CRM
**Descripción:** CRM para ludotecas (centros de ocio infantil) en España
**Modelo de negocio:** SaaS B2B, 200€/mes por cliente, sin plan anual
**Objetivo de ingresos:** 6.000-8.000€ netos/mes con ~50-75 clientes
**Expansión futura planificada:** peluquerías caninas, academias deportivas, estudios de yoga

---

## Stack técnico

- **Frontend/Backend:** Next.js 16.2.9 App Router (server + client components)
- **Base de datos:** Supabase, proyecto `nylqzrrstmfnwdimldlt`, multi-tenant por `tenant_id`
- **Deploy:** Vercel
- **Estilos:** Tailwind CSS con variables custom: `carbon, surface, surface2, line, line2, snow, fog, mist, lime, iris, mint, amber, rose, cyan-300`
- **Iconos:** lucide-react
- **Gráficos:** Recharts (requiere altura en píxeles explícita en móvil)
- **QR:** QRCodeSVG de qrcode.react
- **Branch activo:** `claude/stoic-brown-tqnz3g`

---

## Patrones de código establecidos

- Scroll interno: `flex flex-col` + `flex-1 overflow-y-auto min-h-0`
- FAB fijo: `fixed bottom-24 right-4 lg:bottom-6 lg:right-6 z-40`
- Badge de nav: hook `useNavBadges` polling cada 60s
- Multi-tenant: todas las queries filtran por `tenant_id`
- RLS activado en Supabase

---

## Decisiones de producto tomadas

- **Precio:** 199.99€/mes, sin opción anual
- **Datos de menores:** nombre + fecha de nacimiento completa con consentimiento explícito del tutor
- **RGPD:** consentimiento registrado en el momento del alta del miembro + T&C firmados con cada ludoteca cliente
- **POS:** no desarrollar propio — integrar Stripe Terminal en fase futura si hay demanda
- **Agenda:** tabs Reservas/Custodia eliminados (no funcionales)

---

## RGPD — pendiente de implementar

```sql
-- Tabla members
ADD COLUMN consent_accepted_at timestamptz
ADD COLUMN consent_version text DEFAULT 'v1.0'

-- Tabla tenants
ADD COLUMN terms_accepted_at timestamptz
ADD COLUMN terms_version text DEFAULT 'v1.0'
```

**UI pendiente:**
- Checkbox de consentimiento obligatorio al crear miembro
- Página /privacidad accesible desde login y registro
- Pantalla de aceptación de T&C en onboarding de nueva ludoteca
- Botón de borrado/anonimización real de miembro
- Exportación de datos de miembro (portabilidad)

---

## Roadmap por fases

**Fase 1 — Base (actual)**
Check-in QR, gestión de miembros, bonos, agenda, panel de oportunidades, alertas

**Fase 2 — Comunicación**
WhatsApp/email automático, notificaciones de cumpleaños, recordatorios de bono bajo

**Fase 3 — Pagos**
Integración Stripe Terminal, registro de cobros, bonos activados automáticamente al pagar

**Fase 4 — Expansión de verticales**
Adaptar producto para peluquerías caninas y academias deportivas

---

## Commits — instrucciones para Claude

- Hacer commit después de cada funcionalidad completa, no acumular cambios
- Mensajes descriptivos en español explicando el QUÉ y el POR QUÉ
- Formato: `[área]: descripción breve` — ejemplo: `[miembros]: añadir checkbox RGPD con timestamp de consentimiento`
- Siempre push a `claude/stoic-brown-tqnz3g`
- Nunca push a main sin confirmación explícita del usuario

---

## Contexto de sesiones anteriores

- Backup disponible en commit `083a83d` (antes de mejoras UX)
- Último commit estable con todas las mejoras UX: `7cbff4d`
- Mejoras UX implementadas: FAB en inicio y miembros, filtros de miembros, QR expandible, reordenación home, alertas de visitas largas, próximas reservas en agenda, top5 clickable, días restantes de bono en ficha de miembro
