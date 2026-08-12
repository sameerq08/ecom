-- Step 03: identity tables + signup trigger.
-- Status is an enum so an invalid transition target fails at the database
-- boundary. Values mirror the OrderStatus union in lib/types/ui.ts.
create type public.order_status as enum ('pending', 'confirmed', 'shipped', 'delivered');

create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  display_name text,
  role text not null default 'buyer' check (role in ('buyer', 'seller')),
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

-- Present only when role = 'seller'.
create table public.seller_profiles (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null unique references public.profiles (id) on delete cascade,
  store_name text not null,
  bio text,
  created_at timestamptz not null default now()
);
alter table public.seller_profiles enable row level security;

-- The trigger owns profile creation, which is why `profiles` gets no client
-- insert policy: there is no path that needs one.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (user_id, display_name)
  values (new.id, new.raw_user_meta_data ->> 'display_name');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
