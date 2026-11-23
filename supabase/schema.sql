-- =====================================================================
-- Bilhikma Purchasing — skema database Supabase
-- Jalankan sekali di Supabase: SQL Editor → New query → tempel → Run.
-- Aman dijalankan ulang (idempotent).
-- =====================================================================

-- ---------- Pengguna & peran ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  email text,
  name text,
  role text not null default 'viewer' check (role in ('owner','purchasing','viewer')),
  created_at timestamptz not null default now()
);

create or replace function public.my_role() returns text
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid()
$$;

-- Pendaftar pertama otomatis jadi owner, berikutnya viewer (owner yang menaikkan perannya).
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, name, role)
  values (
    new.id, new.email,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    case when exists (select 1 from public.profiles) then 'viewer' else 'owner' end
  );
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- Master data ----------
create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null default 'bahan' check (type in ('bahan','konveksi','aksesoris','lainnya')),
  contact text, phone text, address text, notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.materials (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  supplier_id uuid references public.suppliers on delete set null,
  price_per_yard numeric not null default 0,
  roll_length numeric not null default 100,   -- isi 1 rol (yard)
  width text, notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.articles (
  id uuid primary key default gen_random_uuid(),
  prefix text not null unique,                 -- prefix SKU, mis. SHK
  name text not null,
  material_id uuid references public.materials on delete set null,
  usage jsonb not null default '{}',           -- {"M": 1.4, "L": 1.4} yard per pcs
  waste_pct numeric not null default 0,
  sewing_cost numeric not null default 0,      -- ongkos jahit (CMT) per pcs
  accessory_cost numeric not null default 0,   -- kancing, resleting, label, dll
  other_cost numeric not null default 0,       -- packing, ongkir bahan, dll
  sell_price numeric not null default 0,
  notes text,
  created_at timestamptz not null default now()
);

-- ---------- Purchase Order ----------
create table if not exists public.purchase_orders (
  id uuid primary key default gen_random_uuid(),
  number text not null unique,
  type text not null check (type in ('bahan','produksi')),
  supplier_id uuid references public.suppliers on delete set null,
  status text not null default 'draft' check (status in ('draft','dipesan','sebagian','diterima','batal')),
  order_date date not null default current_date,
  due_date date,
  notes text,
  items jsonb not null default '[]',           -- [{sku,description,color,size,qty,unit,price,received}]
  created_by uuid references auth.users on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- Row Level Security ----------
alter table public.profiles        enable row level security;
alter table public.suppliers       enable row level security;
alter table public.materials       enable row level security;
alter table public.articles        enable row level security;
alter table public.purchase_orders enable row level security;

drop policy if exists "profiles read"   on public.profiles;
drop policy if exists "profiles owner"  on public.profiles;
create policy "profiles read"  on public.profiles for select to authenticated using (true);
create policy "profiles owner" on public.profiles for update to authenticated
  using (public.my_role() = 'owner') with check (public.my_role() = 'owner');

do $$
declare t text;
begin
  foreach t in array array['suppliers','materials','articles','purchase_orders'] loop
    execute format('drop policy if exists "read" on public.%I', t);
    execute format('drop policy if exists "write" on public.%I', t);
    execute format('create policy "read" on public.%I for select to authenticated using (true)', t);
    execute format($p$create policy "write" on public.%I for all to authenticated
      using (public.my_role() in ('owner','purchasing'))
      with check (public.my_role() in ('owner','purchasing'))$p$, t);
  end loop;
end $$;
