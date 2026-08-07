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

## Módulo de Reservas y Pagos (implementado)

Flujo de creación (en `HomeClient.tsx`): `BookingSearchAndTypeModal` (titular + tipo) → `BookingFormModal` (formulario). El mismo flujo se dispara desde el calendario con `/?nueva=1&date=...`.

**Tipos de reserva dinámicos:** la lista de tipos se genera desde los servicios marcados como `reservable`. Categoría `cumpleanos` → flujo Cumpleaños; `custodia` → flujo Custodia; cualquier otra categoría reservable → flujo genérico ("Otro") con su paquete. Modelo elegido: **especiales + genéricos** (Cumpleaños y Custodia conservan UX propia).

**Precio:**
- **Cumpleaños:** precio FIJO del paquete por capacidad. Al elegir servicio se precarga la capacidad dividida 50/50 adultos/niños (editable, no altera el precio).
- **Custodia:** precio fijo contratado.
- **Otro:** recálculo en vivo — invitados que exceden la capacidad incluida se cobran (tarifa por invitado del servicio, o tarifa de "entrada libre" como fallback).
- **Adelanto (señal):** `deposit_pct` del servicio (default 50%), editable. Estado de pago derivado: `pending` / `partial` / `paid`.
- **Sub-servicios:** categoría `subservicios` (Tarta, Decoración, Catering, Globos…). Se suman al total. Campo `applies_to` (jsonb) define a qué tipos de reserva pueden agregarse.

**Título:** Cumpleaños = `Cumple de {niño}`; Custodia = `Custodia de {menor(es)}`.

**Detalle de reserva** (popup en agenda) alineado con el formulario: Titular, Menor, Fecha, Horario, Invitados (adultos/niños), Pagos (paquete, sub-servicios, total, adelanto, pendiente, estado), Notas.

### Esquema de BD relevante

```sql
-- bookings
service_id uuid REFERENCES services(id)
amount numeric              -- total de la reserva
deposit_amount numeric      -- adelanto pagado
deposit_paid_at timestamptz
payment_status text         -- pending | partial | paid (sin CHECK)
addons jsonb DEFAULT '[]'   -- sub-servicios: [{name, price}]
guest_adults int, guest_children int
notes text
-- CHECK type IN ('birthday','custodia','other')
-- CHECK status IN ('pending','confirmed','cancelled')

-- services
category text               -- entrada|bono|cumpleanos|custodia|otros|subservicios|general
reservable boolean          -- aparece como tipo al crear reserva
included_guests int         -- personas cubiertas por el precio
deposit_pct numeric DEFAULT 50
price_per_guest_adult numeric, price_per_guest_child numeric
applies_to jsonb            -- (subservicios) tipos a los que aplica
```

Config de servicios en `/panel/servicios` (CRUD + categorías en localStorage `wm_service_categories`, eliminadas en `wm_service_categories_deleted`).

## Seguridad

RLS **activado con políticas en las 20 tablas** (verificado 2026-08-07). El
aislamiento entre ludotecas es por `tenant_id` a nivel de base de datos, no de
aplicación.

Borrado de miembros: **anonimiza, no elimina** — obligación fiscal de conservar
el histórico 5 años. La marca es `members.deleted_at`, y todas las consultas de
listado filtran por `is('deleted_at', null)`.

## Dinero en el panel

El Resumen **no muestra ninguna cifra en euros**. La razón no es de diseño: los
ingresos salen de sumar lo que se haya registrado en la aplicación, y basta con
un cumpleaños cobrado por Bizum sin anotar para que la cifra salga baja. Una
cifra de caja equivocada, cada mañana y en la primera pantalla, arrastra la
credibilidad del resto del panel — y además compite con el cierre de mes del
gestor, que ya lo tiene y lo tiene bien.

- **Resumen**: actividad y conducta (visitas, niños, repetición, renovación,
  franja punta, familias en riesgo). Son cifras que el CRM sí conoce con
  certeza porque no dependen de que se registre el cobro.
- **Campañas**: se ordenan por el importe en juego, pero se ENSEÑA el precio
  configurado por la ludoteca («paquete desde 180 €»), no una estimación
  nuestra. Un precio que ha tecleado el cliente no se puede discutir.
- **Tendencias**: aquí sí viven los ingresos, con el aviso de que solo suman lo
  registrado en la app y son un mínimo, no el cierre de caja.

Si algún día el cobro pasa por la aplicación (pasarela de pago), esta decisión
se puede revisar.

## Pruebas

```
npm test              # dominio + pantallas
npm run test:dominio  # cálculos: ingresos, segmentos, campañas
npm run test:pantallas
```

Las pruebas de pantalla usan Playwright contra el build de producción. La parte
autenticada se salta sin credenciales:

```
E2E_EMAIL=... E2E_PASSWORD=... npm test
```

Que la suite pase en verde sin credenciales **no** significa que el panel
funcione: solo se habrá comprobado la parte pública y la puerta de acceso.

## Contexto de sesiones anteriores

- Backup disponible en commit `083a83d` (antes de mejoras UX)
- Último commit estable con todas las mejoras UX: `7cbff4d`
- Módulo de reservas/pagos/sub-servicios: hasta commit `1f4ac6a` (rama `claude/stoic-brown-tqnz3g`)
- Mejoras UX implementadas: FAB en inicio y miembros, filtros de miembros, QR expandible, reordenación home, alertas de visitas largas, próximas reservas en agenda, top5 clickable, días restantes de bono en ficha de miembro
