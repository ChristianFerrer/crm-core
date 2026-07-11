-- ⚠️ PASO FINAL — activa RLS en producción. Ejecutar SOLO tras verificar la app
-- con un login real (todas las pantallas cargan) y con margen respecto a la demo.
-- Requisitos ya cumplidos: puente auth→tenant, tenant_id backfilleado, RPCs
-- públicas, políticas creadas (inertes), y app migrada a auth por cookies (SSR).
--
-- Rollback inmediato si algo falla: ver DISABLE_RLS_rollback.sql

do $$
declare tbl text;
begin
  foreach tbl in array array[
    'members','families','memberships','membership_types','visits','services',
    'bookings','tenant_sessions','follow_up_leads','birthday_leads',
    'tenants','tenant_users','app_super_admins'
  ] loop
    execute format('alter table public.%I enable row level security', tbl);
  end loop;
end $$;

-- products, open_checks, open_check_items ya tienen RLS activado con sus políticas.
