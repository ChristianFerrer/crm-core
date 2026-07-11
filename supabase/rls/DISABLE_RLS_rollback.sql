-- Rollback inmediato: desactiva RLS en las tablas que activó ENABLE_RLS_final.sql.
-- Deja el resto de la infraestructura (columnas tenant_id, funciones, RPCs) intacta;
-- eso es no-destructivo y puede quedarse.

do $$
declare tbl text;
begin
  foreach tbl in array array[
    'members','families','memberships','membership_types','visits','services',
    'bookings','tenant_sessions','follow_up_leads','birthday_leads',
    'tenants','tenant_users','app_super_admins'
  ] loop
    execute format('alter table public.%I disable row level security', tbl);
  end loop;
end $$;
