-- ════════════════════════════════════════════════════════════════════════════
-- Data de demostración de Watermelon CRM
--
-- Regenera familias, bonos, visitas, consumos y reservas de las dos ludotecas
-- demo con cifras de una ludoteca española real.
--
-- Lo que había antes no era de este negocio: una visita cobrada a 8.030 € y
-- otra a 3.520 €, reservas de 21 adultos en una sala de aforo 40, y unas 320
-- reservas por trimestre y ludoteca — tres y pico al día, festivos incluidos.
-- Con 20 familias dadas de alta y ese volumen, los números no cuadraban por
-- ningún lado.
--
-- Precios de referencia (2026):
--   entrada suelta        7-8 € por niño, 5,50-6,50 € el hermano
--   custodia              7-8 € la hora
--   bono 5 / 10 sesiones  40-45 € / 70-80 €
--   cumpleaños            paquete de 10 niños 160-180 €, +8-9 € por invitado
--   taller o grupo        60-70 €
--   consumo de tienda     2-9 € por familia
--
-- Resultado: L'Esbarjo ~2.500 €/mes con 117 familias, Menuts ~1.600 €/mes con
-- 83. Dos tamaños distintos a propósito, para ver el producto con un cliente
-- mediano y con uno pequeño.
--
-- ── Dos trampas de PostgreSQL que costaron un par de intentos ───────────────
--
-- 1. Un `cross join lateral (select random() ...)` sin correlación con la fila
--    exterior se evalúa UNA vez: todas las reservas salían con el mismo
--    importe y el mismo número de invitados. Por eso los valores por fila se
--    derivan de `hashtext(id)`, que sí varía y además es reproducible.
--
-- 2. `ntile(100)` sobre 52 filas solo reparte hasta el bucket 52, así que
--    dejaba a todas las familias en los tres primeros perfiles. Se usa el
--    percentil de verdad: row_number() * 100 / count(*).
--
-- Fecha de referencia: 2026-08-06. Cámbiala en bloque si mueves la demo.
--
--   psql "$DATABASE_URL" -f scripts/seed-demo.sql
-- ════════════════════════════════════════════════════════════════════════════

begin;

select setseed(0.4242);

-- ── 0. Limpieza ─────────────────────────────────────────────────────────────
-- Conserva a quien esté en sala ahora mismo (visitas sin salida) para no
-- romper la demo de aforo, y las reservas que ya generaron una visita.
delete from open_checks;
delete from visits where checked_out_at is not null;
update visits set membership_id = null;
delete from memberships;
delete from bookings where id not in (
  select booking_id from visits where booking_id is not null
);
-- La marca va en `notes`, no en el nombre: un prefijo DEMO se ve en pantalla
-- y ensucia la demo, que es justo lo contrario de lo que busca.
delete from members where notes like '%seed:demo%';
-- Familias que se quedan sin nadie tras borrar las altas generadas
delete from families f where not exists (
  select 1 from members m where m.family_id = f.id
);

-- ── 1. Altas ────────────────────────────────────────────────────────────────
create temp table nom on commit drop as select * from (values
 ('Anna'),('Marc'),('Laia'),('Pau'),('Núria'),('Jordi'),('Clara'),('Oriol'),('Marta'),('Pere'),
 ('Sílvia'),('Albert'),('Gemma'),('Xavier'),('Elena'),('Sergi'),('Rosa'),('Ramon'),('Judit'),('Ivan'),
 ('Berta'),('Guillem'),('Mireia'),('Adrià'),('Carla'),('Roger'),('Alba'),('Dani'),('Ariadna'),('Lluís')
) v(x);

create temp table cog on commit drop as select * from (values
 ('Puig'),('Soler'),('Vidal'),('Roca'),('Serra'),('Mas'),('Ferrer'),('Bosch'),('Riera'),('Vila'),
 ('Costa'),('Prat'),('Sala'),('Font'),('Rius'),('Bonet'),('Camps'),('Grau'),('Pons'),('Aran'),
 ('Solé'),('Nadal'),('Torrent'),('Fabra'),('Ripoll'),('Cortés'),('Miralles'),('Sabaté'),('Ventura'),('Casas')
) v(x);

create temp table nino on commit drop as select * from (values
 ('Aina'),('Bruno'),('Clàudia'),('Dídac'),('Emma'),('Ferran'),('Gina'),('Hugo'),('Iker'),('Jana'),
 ('Kilian'),('Laia'),('Martí'),('Nil'),('Ona'),('Pau'),('Queralt'),('Roc'),('Sara'),('Teo'),
 ('Unai'),('Vera'),('Xavi'),('Zoe'),('Arlet'),('Biel'),('Cesc'),('Duna'),('Èlia'),('Guiu')
) v(x);

-- El perfil de comportamiento va en `notes` porque es lo que decide el ritmo de
-- visitas de cada familia, y quiero poder releerlo al regenerar. Sin perfiles
-- todas visitan igual y el mapa de familias sale plano.
insert into members (tenant_id, name, phone, created_at, children, children_count,
                     marketing_consent_at, consent_accepted_at, notes)
select e.tenant_id, e.nombre, e.phone, e.created_at,
  jsonb_build_array(jsonb_build_object(
    'id', gen_random_uuid(),
    'sex', case when e.h1 < 0.5 then 'F' else 'M' end,
    'name', (select x from nino offset (e.h2 * 29)::int limit 1),
    -- Entre 2 y 9 años: la franja real de una ludoteca
    'birth_date', (date '2026-08-06' - (730 + e.h3 * 2555)::int)::text)),
  1,
  -- Dos de cada tres aceptan marketing. Si dijeran que sí todas, el aviso de
  -- consentimiento de las campañas de publicidad no se vería nunca.
  case when e.h1 < 0.66 then e.created_at else null end,
  e.created_at,
  (case when e.pct <= 8  then 'perfil:campeon'
        when e.pct <= 30 then 'perfil:fiel'
        when e.pct <= 60 then 'perfil:ocasional'
        when e.pct <= 72 then 'perfil:riesgo'
        when e.pct <= 88 then 'perfil:dormido'
        else                  'perfil:nuevo' end) || ' seed:demo'
from (
  select c.tenant_id, n.x || ' ' || g.x as nombre,
    '6' || lpad((10000000 + (abs(hashtext(n.x||g.x||c.tenant_id::text)) % 89999999))::text, 8, '0') as phone,
    -- Antigüedad con más peso en lo reciente: la ludoteca ha ido creciendo
    (date '2026-08-06' - ((abs(hashtext(n.x||g.x)) % 1000)/1000.0 ^ 1.6 * 700)::int)::timestamptz as created_at,
    (abs(hashtext(n.x||g.x||'a')) % 1000)/1000.0 as h1,
    (abs(hashtext(n.x||g.x||'b')) % 1000)/1000.0 as h2,
    (abs(hashtext(n.x||g.x||'c')) % 1000)/1000.0 as h3,
    row_number() over (partition by c.tenant_id order by random()) as k,
    row_number() over (partition by c.tenant_id order by random()) * 100.0
      / (case when c.name = 'Menuts' then 45 else 65 end) as pct,
    case when c.name = 'Menuts' then 45 else 65 end as cupo
  from (select id as tenant_id, name from tenants) c
  cross join nom n cross join cog g
) e
where e.k <= e.cupo
  and not exists (select 1 from members m2 where m2.tenant_id = e.tenant_id and m2.name = e.nombre);

-- Las familias que ya existían también necesitan perfil
with r as (
  select id,
    row_number() over (partition by tenant_id order by random()) * 100.0
      / count(*) over (partition by tenant_id) as pct
  from members where deleted_at is null and notes is null
)
update members m set notes = case
  when r.pct <= 8  then 'perfil:campeon'
  when r.pct <= 30 then 'perfil:fiel'
  when r.pct <= 60 then 'perfil:ocasional'
  when r.pct <= 72 then 'perfil:riesgo'
  when r.pct <= 88 then 'perfil:dormido'
  else                  'perfil:nuevo' end
from r where m.id = r.id;

-- ── 2. Bonos ────────────────────────────────────────────────────────────────
-- Poco más de la mitad de las familias con hábito tienen bono, repartidos en
-- los últimos cinco meses para que «bonos vendidos» del mes no salga a cero.
insert into memberships (member_id, tenant_id, membership_type_id, created_at, expires_at, sessions_remaining)
select b.id, b.tenant_id, mt.id,
  (date '2026-08-06' - (b.x * 150)::int)::timestamptz,
  (date '2026-08-06' - (b.x * 150)::int + 120),
  case when mt.sessions is null then null else 3 + (b.y * (mt.sessions - 3))::int end
from (
  select m.id, m.tenant_id,
    (abs(hashtext(m.id::text))       % 1000)/1000.0 as x,
    (abs(hashtext(m.id::text||'y'))  % 1000)/1000.0 as y,
    1 + (abs(hashtext(m.id::text||'t')) % 3) as t_idx
  from members m
  where m.deleted_at is null
    and m.notes like any (array['perfil:campeon%','perfil:fiel%','perfil:ocasional%','perfil:riesgo%'])
    and (abs(hashtext(m.id::text||'z')) % 100) < 55
) b
join (select id, tenant_id, sessions,
        row_number() over (partition by tenant_id order by price) as t_idx
      from membership_types) mt
  on mt.tenant_id = b.tenant_id and mt.t_idx = b.t_idx;

-- Estado del bono por percentil dentro de cada ludoteca. Sin esto salía todo
-- agotado en una y todo caducado en la otra, y media pantalla de campañas se
-- quedaba vacía.
with r as (
  select ms.id, mt.sessions,
    row_number() over (partition by ms.tenant_id order by random()) * 100.0
      / count(*) over (partition by ms.tenant_id) as pct
  from memberships ms join membership_types mt on mt.id = ms.membership_type_id
)
update memberships ms set
  expires_at = case
    when r.pct <= 12 then date '2026-08-06' - (2 + r.pct)::int        -- caducado hace poco
    when r.pct <= 20 then date '2026-08-06' + (1 + r.pct/5)::int      -- caduca esta semana
    else                  date '2026-08-06' + (25 + r.pct)::int end,
  sessions_remaining = case
    when r.sessions is null then null                                  -- mensual ilimitado
    when r.pct <= 16 then 0                                            -- agotado
    when r.pct <= 34 then 1 + (r.pct/25)::int                          -- a punto de agotarse
    else 3 + (r.pct * (r.sessions - 3) / 100)::int end
from r where ms.id = r.id;

-- ── 3. Visitas ──────────────────────────────────────────────────────────────
-- El ritmo de cada perfil marca la probabilidad diaria, así que las visitas
-- caen irregulares en vez de en una rejilla. El fin de semana pesa el triple.
create temp table dv on commit drop as
select m.id as member_id, m.tenant_id, d::date as dia, extract(isodow from d) as dow
from members m
join (values
  ('perfil:campeon', 6), ('perfil:fiel', 11), ('perfil:ocasional', 22),
  ('perfil:riesgo', 10), ('perfil:dormido', 18)
) as p(perfil, ritmo) on m.notes like p.perfil || '%'
cross join lateral generate_series(
  greatest(m.created_at::date, date '2025-06-01'),
  case
    -- En riesgo: venía seguido y lleva casi tres ritmos sin aparecer
    when m.notes like 'perfil:riesgo%'  then date '2026-08-06' - (p.ritmo * 2.8)::int
    when m.notes like 'perfil:dormido%' then date '2026-08-06' - 130
    else                                     date '2026-08-06' end,
  interval '1 day') as d
where m.deleted_at is null
  and random() < (1.0 / p.ritmo) * (case when extract(isodow from d) >= 6 then 2.4 else 0.85 end);

-- Las nuevas hacen una única visita, que es justo lo que las define
insert into dv
select m.id, m.tenant_id,
  greatest(m.created_at::date, date '2026-08-06' - (5 + random() * 45)::int), 3
from members m where m.deleted_at is null and m.notes like 'perfil:nuevo%';

insert into visits (tenant_id, member_id, checked_in_at, checked_out_at, visit_type,
                    adults_count, children_count, paid_at, paid_amount, payment_method, children_present)
select x.tenant_id, x.member_id, x.entrada,
  x.entrada + make_interval(mins => 55 + (x.r3 * 95)::int),
  'entrada',
  1 + (x.r1 * 0.6)::int,                       -- un adulto, a veces dos
  x.ninos,
  case when x.con_bono then null else x.entrada + interval '2 hours' end,
  case when x.con_bono then null else x.pe + greatest(0, x.ninos - 1) * x.ph end,
  case when x.con_bono then null when x.r2 < 0.7 then 'tarjeta' else 'efectivo' end,
  '[]'::jsonb
from (
  select dv.tenant_id, dv.member_id, dv.dia,
    case when t.name = 'Menuts' then 7.00 else 8.00 end as pe,
    case when t.name = 'Menuts' then 5.50 else 6.50 end as ph,
    1 + (random() * 1.3)::int as ninos,
    random() as r1, random() as r2, random() as r3,
    -- Fin de semana por la mañana, entre semana a la salida del cole
    (dv.dia + case when dv.dow >= 6
       then make_interval(hours => 10, mins => (random() * 210)::int)
       else make_interval(hours => 16, mins => 30 + (random() * 150)::int) end)::timestamptz as entrada,
    -- Con bono vigente ese día no pasa por caja: es lo que hace que el ticket
    -- medio no sea simplemente el precio de la entrada. Sale un 40-60 % de
    -- visitas cobradas, que es lo que se ve en una ludoteca con bonos.
    exists (select 1 from memberships ms
            where ms.member_id = dv.member_id
              and ms.created_at::date <= dv.dia
              and (ms.expires_at is null or ms.expires_at >= dv.dia)) as con_bono
  from dv join tenants t on t.id = dv.tenant_id
) x;

-- ── 4. Consumos de tienda ───────────────────────────────────────────────────
-- Un batido y unas galletas en una de cada tres visitas, no una cuenta de
-- restaurante.
insert into open_checks (tenant_id, visit_id, member_id, member_name, opened_at, closed_at,
                         status, time_minutes, time_cost, products_cost, total, visit_type)
select v.tenant_id, v.id, v.member_id, m.name, v.checked_in_at, v.checked_out_at, 'closed',
  extract(epoch from (v.checked_out_at - v.checked_in_at))::int / 60, 0,
  round((2 + (abs(hashtext(v.id::text)) % 700) / 100.0)::numeric, 2),
  round((2 + (abs(hashtext(v.id::text)) % 700) / 100.0)::numeric, 2),
  'entrada'
from visits v join members m on m.id = v.member_id
where v.checked_out_at is not null
  and (abs(hashtext(v.id::text || 'c')) % 100) < 32;

-- ── 5. Familias ─────────────────────────────────────────────────────────────
-- Poco menos de la mitad de las altas se agrupan en parejas de la misma casa;
-- el resto son familias que solo registran a un adulto, que es lo habitual.
--
-- Los dos adultos comparten los MISMOS hijos, con los mismos identificadores.
-- Eso es lo que da sentido a la familia y lo que permite que el check-in impida
-- que el mismo niño entre dos veces con padres distintos.
create temp table parejas on commit drop as
with candidatos as (
  select m.id, m.tenant_id, m.name, m.children,
    row_number() over (partition by m.tenant_id order by hashtext(m.id::text)) as rn,
    count(*) over (partition by m.tenant_id) as n
  from members m
  where m.deleted_at is null and m.family_id is null and m.notes like '%seed:demo%'
),
elegidos as (
  select *, ((rn - 1) / 2) as pareja from candidatos where rn <= (n * 0.46)::int
)
select tenant_id, pareja,
  (array_agg(id       order by rn) filter (where rn % 2 = 1))[1] as titular,
  (array_agg(id       order by rn) filter (where rn % 2 = 0))[1] as acompanante,
  (array_agg(name     order by rn) filter (where rn % 2 = 1))[1] as nombre_titular,
  (array_agg(children order by rn) filter (where rn % 2 = 1))[1] as hijos
from elegidos
group by tenant_id, pareja
having count(*) = 2;

alter table parejas add column family_id uuid;

-- Una familia por pareja. Ojo: `insert ... returning` no garantiza el orden de
-- las filas devueltas, así que reasociar por row_number() mezcla los nombres —
-- pasó, y salieron familias con el apellido de otra. Se inserta una a una.
do $$
declare p record; nueva uuid;
begin
  for p in select * from parejas loop
    insert into families (tenant_id, name)
    values (p.tenant_id, 'Familia ' || split_part(p.nombre_titular, ' ', 2))
    returning id into nueva;
    update parejas set family_id = nueva
    where tenant_id = p.tenant_id and pareja = p.pareja;
  end loop;
end $$;

update members m set family_id = p.family_id
from parejas p where m.id in (p.titular, p.acompanante);

-- El acompañante hereda los hijos del titular: son los mismos niños
update members m
set children = p.hijos, children_count = jsonb_array_length(p.hijos)
from parejas p where m.id = p.acompanante;

-- ── 6. Reservas ─────────────────────────────────────────────────────────────
-- Cumpleaños de viernes a domingo, custodia entre semana, algún taller suelto.
-- Unas 90 por ludoteca y cuatrimestre, no 320.
create temp table dias on commit drop as
select d::date as dia, extract(isodow from d) as dow
from generate_series(date '2026-06-01', date '2026-09-30', interval '1 day') d;

insert into bookings (tenant_id, date, start_time, end_time, type, title, member_id, status,
                      guests, guest_adults, guest_children, payment_status, amount,
                      deposit_amount, deposit_paid_at, child_name, addons)
select x.tenant_id, x.dia, x.hora, x.hora + interval '2 hours', 'birthday',
  'Cumple de ' || x.nino, x.member_id, 'confirmed',
  0, 0, 0,                                     -- se recalculan más abajo
  case when x.r2 < 0.5 then 'partial' when x.r2 < 0.8 then 'paid' else 'pending' end,
  0, 0,
  case when x.r3 < 0.85 then (x.dia - 12)::timestamptz else null end,
  x.nino, '[]'::jsonb
from (
  select d.dia, t.id as tenant_id,
    (array['11:00','12:30','17:00','17:30'])[1 + (random() * 3)::int]::time as hora,
    m.id as member_id, coalesce(m.children -> 0 ->> 'name', 'Pau') as nino,
    random() as r2, random() as r3
  from dias d
  join tenants t on true
  join lateral (select id, children from members mm
                where mm.tenant_id = t.id and mm.deleted_at is null
                order by random() limit 1) m on true
  where d.dow >= 5 and random() < 0.55
) x;

insert into bookings (tenant_id, date, start_time, end_time, type, title, member_id, status,
                      guests, guest_adults, guest_children, payment_status, amount,
                      deposit_amount, child_name, addons)
select x.tenant_id, x.dia, x.hora, x.hora + interval '2 hours', 'custodia',
  'Custodia de ' || x.nino, x.member_id,
  case when x.dia >= date '2026-08-06' and x.r2 < 0.06 then 'cancelled' else 'confirmed' end,
  0, 0, 0,
  case when x.r3 < 0.7 then 'paid' else 'pending' end,
  0, 0, x.nino, '[]'::jsonb
from (
  select d.dia, t.id as tenant_id,
    (array['09:00','10:00','16:00','17:00','18:00'])[1 + (random() * 4)::int]::time as hora,
    m.id as member_id, coalesce(m.children -> 0 ->> 'name', 'Nil') as nino,
    random() as r2, random() as r3
  from dias d
  join tenants t on true
  join lateral generate_series(1, 1 + (random() * 1.6)::int) rep on true
  join lateral (select id, children from members mm
                where mm.tenant_id = t.id and mm.deleted_at is null
                order by random() limit 1) m on true
  where d.dow <= 5 and random() < 0.6
) x;

insert into bookings (tenant_id, date, start_time, end_time, type, title, member_id, status,
                      guests, guest_adults, guest_children, payment_status, amount,
                      deposit_amount, deposit_paid_at, addons)
select x.tenant_id, x.dia, '18:00'::time, '19:30'::time, 'other', x.titulo, x.member_id, 'confirmed',
  0, 0, 0,
  case when x.r2 < 0.6 then 'paid' else 'pending' end,
  0, 0,
  case when x.r3 < 0.7 then (x.dia - 8)::timestamptz else null end, '[]'::jsonb
from (
  select d.dia, t.id as tenant_id,
    (array['Taller de manualidades','Grupo de juego','Taller de cocina','Cuentacuentos'])[1 + (random()*3)::int] as titulo,
    m.id as member_id, random() as r2, random() as r3
  from dias d
  join tenants t on true
  join lateral (select id from members mm where mm.tenant_id = t.id and mm.deleted_at is null
                order by random() limit 1) m on true
  where d.dow = 3 and random() < 0.5
) x;

-- Invitados e importes por fila, derivados del id. Es la trampa nº 1 del
-- encabezado: puestos en un lateral sin correlacionar, todas las reservas
-- salían idénticas.
with r as (
  select b.id, b.type, t.name as tenant,
    (abs(hashtext(b.id::text))      % 1000) / 1000.0 as x,
    (abs(hashtext(b.id::text||'b')) % 1000) / 1000.0 as y
  from bookings b join tenants t on t.id = b.tenant_id
)
update bookings b set
  guest_children = case b.type
    when 'birthday' then 8 + (r.x * 9)::int
    when 'custodia' then 1 + (r.x * 1.4)::int
    else                 6 + (r.x * 6)::int end,
  guest_adults = case b.type
    when 'birthday' then 4 + (r.y * 6)::int
    when 'custodia' then 0
    else                 2 end,
  amount = case b.type
    when 'birthday' then (case when r.tenant = 'Menuts' then 160 else 180 end)
      + greatest(0, (8 + (r.x * 9)::int) - 10) * (case when r.tenant = 'Menuts' then 8 else 9 end)
    when 'custodia' then (1 + (r.y * 2)::int) * (1 + (r.x * 1.4)::int)
      * (case when r.tenant = 'Menuts' then 7 else 8 end)
    else (case when r.tenant = 'Menuts' then 60 else 70 end) end
from r where b.id = r.id;

update bookings set guests = coalesce(guest_children, 0) + coalesce(guest_adults, 0);

-- Solo el cumpleaños lleva señal; la custodia y el taller se pagan el día
update bookings set deposit_amount =
  case when type = 'birthday' then round(amount * 0.5, 2) else 0 end;

-- ── 7. Acompañantes de cada visita ────────────────────────────────────────
-- Sin esto, `children_present` viene vacío y el historial de la ficha solo
-- puede decir «3 invitados»: los nombres existen en `members.children`, pero no
-- quedan atados a la visita. Se rellenan tantos hijos como `children_count`, y
-- la pareja co-titular cuando la visita trajo más de un adulto.
with v as (
  select v.id, v.adults_count, v.children_count, m.children, m.family_id,
         (select jsonb_agg(jsonb_build_object('name', o.name, 'is_adult', true))
            from members o
           where o.family_id = m.family_id and o.id <> m.id
             and m.family_id is not null and o.deleted_at is null) as pareja
    from visits v join members m on m.id = v.member_id
   where (v.children_present is null or jsonb_array_length(v.children_present) = 0)
     and jsonb_array_length(coalesce(m.children, '[]'::jsonb)) > 0
)
update visits t set children_present =
  case when v.adults_count > 1 and v.pareja is not null
       then jsonb_build_array(v.pareja->0) else '[]'::jsonb end
  || coalesce((
       select jsonb_agg(jsonb_build_object('name', c->>'name', 'birth_date', c->>'birth_date'))
         from (select c from jsonb_array_elements(v.children) c
                limit greatest(0, least(v.children_count, jsonb_array_length(v.children)))) s(c)
     ), '[]'::jsonb)
from v where v.id = t.id;

-- ── 8. Historial de campañas ──────────────────────────────────────────────
-- El «Seguimiento» de la tabla de campañas salía a cero en las siete filas, así
-- que no se veía para qué sirven las cajas. Una campaña activa por plantilla,
-- con los envíos repartidos por el embudo de forma determinista (por `i`), para
-- que la siembra se pueda repetir y dé lo mismo.
do $$
declare tid uuid; cid uuid; p text; m record; i int; n int; est text;
begin
  select id into tid from tenants limit 1;
  foreach p in array array['cumpleanos','bono_bajo','renovacion_caducada',
                           'upsell_bono','reactivacion','valle','segunda_visita']
  loop
    select id into cid from campaigns
     where tenant_id = tid and plantilla = p and estado = 'activa' limit 1;
    if cid is null then
      insert into campaigns (tenant_id, nombre, plantilla, mensaje, canal, estado, enviada_at)
      values (tid, p, p, 'Mensaje de la campaña', 'whatsapp', 'activa', now() - interval '20 days')
      returning id into cid;
    end if;

    n := 6 + (abs(hashtext(p)) % 9);
    i := 0;
    for m in select id from members where deleted_at is null and phone is not null
              order by md5(id::text || p) limit n
    loop
      i := i + 1;
      est := case when i % 5 = 0 then 'convertido'
                  when i % 7 = 0 then 'descartado'
                  when i % 3 = 0 then 'respondido'
                  else 'enviado' end;
      insert into campaign_sends (tenant_id, campaign_id, member_id, estado, enviado_at,
                                  respondido_at, convertido_at, created_at)
      values (tid, cid, m.id, est, now() - (i || ' days')::interval,
              case when est in ('respondido','convertido') then now() - ((i-1) || ' days')::interval end,
              case when est = 'convertido' then now() - ((i-1) || ' days')::interval end,
              now() - (i || ' days')::interval)
      on conflict do nothing;
    end loop;
  end loop;
end $$;

commit;
