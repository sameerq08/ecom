-- Step 03: ownership predicates for RLS policies.
--
-- These are SECURITY DEFINER on purpose. A policy on `profiles` that sub-selects
-- `profiles` re-enters RLS and recurses forever; the definer's rights break that
-- cycle. search_path is pinned empty so the bodies cannot be hijacked by a
-- caller-controlled path.
--
-- NOTE: these are created in `public` here and relocated to `private` by
-- 20260812154148_move_rls_helpers_to_private_schema.sql. Kept as applied so the
-- history replays faithfully.

create function public.current_profile_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select id from public.profiles where user_id = auth.uid();
$$;

-- Null for buyers, which makes every seller-ownership comparison below fail
-- closed without needing an explicit role check.
create function public.current_seller_profile_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select sp.id
  from public.seller_profiles sp
  join public.profiles p on p.id = sp.profile_id
  where p.user_id = auth.uid();
$$;

create function public.owns_product(target_product_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.products p
    where p.id = target_product_id
      and p.seller_profile_id = public.current_seller_profile_id()
  );
$$;

-- "Active, or mine." A plain is_active check would hide a seller's own
-- deactivated listings from /seller/products, the screen that must show them.
create function public.product_is_visible(target_product_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.products p
    where p.id = target_product_id
      and (p.is_active or p.seller_profile_id = public.current_seller_profile_id())
  );
$$;

create function public.product_seller_id(target_product_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select seller_profile_id from public.products where id = target_product_id;
$$;

create function public.owns_cart(target_cart_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.carts c
    where c.id = target_cart_id
      and c.profile_id = public.current_profile_id()
  );
$$;

create function public.owns_order(target_order_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.orders o
    where o.id = target_order_id
      and o.profile_id = public.current_profile_id()
  );
$$;

-- A seller "has" an order when they own at least one of its line items.
create function public.is_order_seller(target_order_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.order_items oi
    where oi.order_id = target_order_id
      and oi.seller_profile_id = public.current_seller_profile_id()
  );
$$;

create function public.can_view_order(target_order_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.owns_order(target_order_id) or public.is_order_seller(target_order_id);
$$;

revoke execute on function
  public.current_profile_id(),
  public.current_seller_profile_id(),
  public.owns_product(uuid),
  public.product_is_visible(uuid),
  public.product_seller_id(uuid),
  public.owns_cart(uuid),
  public.owns_order(uuid),
  public.is_order_seller(uuid),
  public.can_view_order(uuid)
from public;

grant execute on function
  public.current_profile_id(),
  public.current_seller_profile_id(),
  public.owns_product(uuid),
  public.product_is_visible(uuid),
  public.product_seller_id(uuid),
  public.owns_cart(uuid),
  public.owns_order(uuid),
  public.is_order_seller(uuid),
  public.can_view_order(uuid)
to anon, authenticated;
