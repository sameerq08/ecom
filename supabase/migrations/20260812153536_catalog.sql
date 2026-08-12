-- Step 03: catalog tables.
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique
);
alter table public.categories enable row level security;

create table public.products (
  id uuid primary key default gen_random_uuid(),
  seller_profile_id uuid not null references public.seller_profiles (id) on delete cascade,
  -- Restrict: a category with live listings must not be deletable out from under them.
  category_id uuid not null references public.categories (id) on delete restrict,
  name text not null,
  description text not null default '',
  price numeric(10, 2) not null check (price >= 0),
  rating numeric(2, 1) not null default 0 check (rating >= 0 and rating <= 5),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.products enable row level security;

create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  url text not null,
  sort_order integer not null default 0
);
alter table public.product_images enable row level security;

-- One stock count per product.
create table public.inventory (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null unique references public.products (id) on delete cascade,
  stock_qty integer not null default 0 check (stock_qty >= 0),
  updated_at timestamptz not null default now()
);
alter table public.inventory enable row level security;

-- Both columns sit on the hot path of a policy predicate or a list screen.
create index products_seller_profile_id_idx on public.products (seller_profile_id);
create index products_category_id_idx on public.products (category_id);
create index product_images_product_id_idx on public.product_images (product_id);
