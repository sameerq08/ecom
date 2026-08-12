-- Step 03: cart and order tables.
create table public.carts (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null unique references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.carts enable row level security;

create table public.cart_items (
  id uuid primary key default gen_random_uuid(),
  cart_id uuid not null references public.carts (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  quantity integer not null check (quantity >= 1),
  unique (cart_id, product_id)
);
alter table public.cart_items enable row level security;

-- Restrict on delete: an order is a record, not disposable.
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete restrict,
  status public.order_status not null default 'pending',
  shipping_address text not null,
  created_at timestamptz not null default now()
);
alter table public.orders enable row level security;

-- seller_profile_id is denormalized so a seller can query their own line items
-- across every order without reading the orders they do not own.
create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete restrict,
  seller_profile_id uuid not null references public.seller_profiles (id) on delete restrict,
  quantity integer not null check (quantity >= 1),
  price_at_purchase numeric(10, 2) not null check (price_at_purchase >= 0)
);
alter table public.order_items enable row level security;

-- Append-only status history. orders.status is destructive on every transition;
-- this keeps the timeline's timestamps and attributes who advanced it.
create table public.order_status_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  status public.order_status not null,
  changed_by_profile_id uuid references public.profiles (id) on delete set null,
  note text,
  created_at timestamptz not null default now()
);
alter table public.order_status_events enable row level security;

create index cart_items_cart_id_idx on public.cart_items (cart_id);
create index cart_items_product_id_idx on public.cart_items (product_id);
create index orders_profile_id_idx on public.orders (profile_id);
create index order_items_order_id_idx on public.order_items (order_id);
create index order_items_seller_profile_id_idx on public.order_items (seller_profile_id);
create index order_items_product_id_idx on public.order_items (product_id);
create index order_status_events_order_id_idx on public.order_status_events (order_id);
create index order_status_events_changed_by_profile_id_idx on public.order_status_events (changed_by_profile_id);
