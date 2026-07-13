# RLS multi-tenant — estado y guía

Objetivo: aislar los datos de cada ludoteca (tenant) para poder tener muchos
clientes en el mismo proyecto Supabase sin que unos vean los datos de otros.

## ✅ ESTADO: RLS ACTIVO EN PRODUCCIÓN
Activado y verificado a nivel BD:
- Todas las tablas con RLS on; el aviso crítico "Row Level Security is disabled" desapareció.
- El tenant real ve todos sus datos (18 miembros, 46 visitas, 30 reservas, 13 servicios, 19 productos).
- `anon` (sin sesión) ve **0** en todas las tablas.
- Aislamiento probado: un tenant no ve a otro (`isolation_test.sql`).
- Se backfilleó `bookings.tenant_id` (21 filas antiguas tenían NULL) y se puso NOT NULL + DEFAULT.
- Helpers internos (`auth_tenant_id`, `is_super_admin`) sin acceso `anon`.

**Rollback** (si hiciera falta): `DISABLE_RLS_rollback.sql` (revierte en segundos).

**Pendiente de verificar por el usuario** (no accesible desde el sandbox): abrir la
app, **hacer login limpio** (la sesión pasó a cookies) y comprobar que todas las
pantallas cargan. Si alguna sale en blanco → avisar para rollback inmediato.

Nota de config Auth recomendada (no crítica): activar "Leaked Password Protection"
en Supabase Auth.

## Alta de un cliente nuevo (multi-tenant)
`auth_tenant_id()` resuelve el tenant por `tenant_users` o, en su defecto, por
`admin_email`. Flujo para dar de alta un cliente:
1. En `/admin` (como superadmin) crear el tenant con su `admin_email`.
2. El cliente entra en `/login` y **se registra con ese mismo email**.
3. Al entrar, RLS le muestra **solo su tenant** (empieza vacío; configura sus
   servicios/bonos/miembros). Aislado del resto.
Para varios usuarios por ludoteca (staff además del owner), añadir filas en
`tenant_users (user_id → tenant_id)`.

## Infraestructura aplicada
- **Puente auth→tenant**: tablas `tenant_users`, `app_super_admins`; funciones
  `auth_tenant_id()` e `is_super_admin()`.
- **`tenant_id`** añadido y backfilleado en `members, families, memberships,
  membership_types, visits, services` (FK + índice + NOT NULL) con
  `DEFAULT auth_tenant_id()` (los inserts autenticados lo rellenan solos).
- **Alta pública** movida a RPC `SECURITY DEFINER` (`public_tenant_info`,
  `public_register`): el cliente anónimo no toca tablas.
- **Políticas** por tenant creadas en todas las tablas (INERTES mientras RLS off).
- **App migrada a auth por cookies** (`@supabase/ssr`): los server components
  (`/`, `/panel`, `/miembros/[id]`, `/familias/[id]`) ya llevan el token del
  usuario. Nota: los usuarios logueados deberán **volver a iniciar sesión una vez**
  tras el despliegue (la sesión pasa de localStorage a cookies).

## Verificado
- `isolation_test.sql`: prueba (transaccional, con rollback) que un tenant ve solo
  lo suyo y el anon no ve nada. **Pasa.**

## Paso final (pendiente, ejecutar juntos y con margen a la demo)
1. Desplegar la app (rama `claude/stoic-brown-tqnz3g`) y **hacer login** de prueba.
2. Comprobar que **todas** las pantallas cargan (Inicio, Panel, Miembros, ficha de
   miembro, Agenda, Tienda, Histórico, ficha de familia) y que se puede crear
   miembro / reserva / visita / cobrar.
3. Ejecutar `ENABLE_RLS_final.sql`.
4. Re-verificar las mismas pantallas (deben seguir cargando) y correr
   `isolation_test.sql`.
5. Si algo falla → `DISABLE_RLS_rollback.sql` (revierte en segundos).

## Coste
- RLS y Supabase Auth: **sin coste** adicional (nativos / incluidos). Free tier:
  50.000 usuarios activos/mes. Sólo se pagaría el plan Pro (~25 $/mes) por otras
  razones (backups, almacenamiento), no por esto.
