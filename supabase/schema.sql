-- Mirrors the in-memory store (server/store.js) for when we move to Supabase.
create table users (
  id uuid primary key default gen_random_uuid(),
  name text not null, email text unique not null,
  role text not null check (role in ('lead','staff','owner'))
);
create table menu_items (
  id text primary key, name text not null,
  price numeric(6,2) not null, cost numeric(6,2) not null, prep_mins numeric(4,1) not null
);
create table slots (
  day date not null, start_time time not null, staff_count int not null check (staff_count between 1 and 5),
  primary key (day, start_time)
);
create table orders (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('group','walkin')),
  ticket int not null,
  share_code text unique,
  group_name text, group_type text, lead_id uuid references users(id), customer_name text,
  slot_day date, slot_time time,
  due_at timestamptz not null, created_at timestamptz not null default now(),
  status text not null check (status in ('open','locked','cooking','ready','picked_up','no_show','released')),
  paid boolean not null default false, pay_ref text, amount numeric(8,2),
  ready_at timestamptz, closed_at timestamptz,
  foreign key (slot_day, slot_time) references slots(day, start_time)
);
create table order_lines (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  person_name text, item_id text not null references menu_items(id),
  qty int not null check (qty between 1 and 10), note text default ''
);
create table order_units (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  item_id text not null references menu_items(id), person_name text, done_at timestamptz
);
-- Capacity check + insert must happen in one transaction (book_group_line function),
-- so two crews can't overbook the same slot at the same moment.
