create table families (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  email text,
  notes text,
  created_at timestamptz default now()
);

create table children (
  id uuid primary key default gen_random_uuid(),
  family_id uuid references families(id) on delete cascade,
  name text not null,
  birth_date date
);

create table membership_types (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sessions int,
  price numeric,
  validity_days int
);

create table memberships (
  id uuid primary key default gen_random_uuid(),
  family_id uuid references families(id) on delete cascade,
  membership_type_id uuid references membership_types(id),
  sessions_remaining int,
  expires_at date,
  created_at timestamptz default now()
);

create table visits (
  id uuid primary key default gen_random_uuid(),
  family_id uuid references families(id) on delete cascade,
  membership_id uuid references memberships(id),
  checked_in_at timestamptz default now()
);
