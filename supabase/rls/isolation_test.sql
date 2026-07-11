-- Test de aislamiento multi-tenant (RLS). NO deja rastro: todo va en una
-- transacción con ROLLBACK y activa RLS solo temporalmente.
-- Si algún assert falla, lanza excepción y aborta (rollback). Sin excepción = OK.
--
-- Ejecutar contra el proyecto con: psql / SQL editor / MCP execute_sql.

begin;
alter table public.tenant_users drop constraint tenant_users_user_id_fkey;

insert into public.tenants(id, name, slug) values
  ('aaaaaaaa-0000-0000-0000-000000000001','RLSTEST A','rlstest-a'),
  ('bbbbbbbb-0000-0000-0000-000000000002','RLSTEST B','rlstest-b');
insert into public.tenant_users(user_id, tenant_id, role) values
  ('11111111-0000-0000-0000-0000000000aa','aaaaaaaa-0000-0000-0000-000000000001','owner'),
  ('22222222-0000-0000-0000-0000000000bb','bbbbbbbb-0000-0000-0000-000000000002','owner');
insert into public.members(tenant_id, name) values
  ('aaaaaaaa-0000-0000-0000-000000000001','RLSTEST miembro de A'),
  ('bbbbbbbb-0000-0000-0000-000000000002','RLSTEST miembro de B');

alter table public.members enable row level security;

-- Logueado como tenant A: ve lo suyo, NO ve lo de B
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-0000-0000-0000-0000000000aa","email":"a@rlstest"}', true);
do $$ declare c_own int; c_other int; begin
  select count(*) into c_own  from public.members where tenant_id='aaaaaaaa-0000-0000-0000-000000000001' and name like 'RLSTEST%';
  select count(*) into c_other from public.members where tenant_id='bbbbbbbb-0000-0000-0000-000000000002' and name like 'RLSTEST%';
  if c_own <> 1 then raise exception 'FALLO: A no ve su propio miembro (vio %)', c_own; end if;
  if c_other <> 0 then raise exception 'FUGA: A ve % miembros de B', c_other; end if;
  raise notice 'OK aislamiento A';
end $$;
reset role;

-- anon (sin sesión): ve 0
set local role anon;
do $$ declare c int; begin
  select count(*) into c from public.members where name like 'RLSTEST%';
  if c <> 0 then raise exception 'FUGA: anon ve % miembros', c; end if;
  raise notice 'OK anon 0';
end $$;
reset role;

rollback;
