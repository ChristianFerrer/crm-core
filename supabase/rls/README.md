# RLS multi-tenant — estado y guía de activación

Objetivo: aislar los datos de cada ludoteca (tenant) para poder tener muchos
clientes en el mismo proyecto Supabase sin que unos vean los datos de otros.

## Ya aplicado en producción (no-destructivo, RLS AÚN APAGADO)
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
