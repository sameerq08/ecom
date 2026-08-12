-- Step 03 follow-up: the helpers call each other, and those calls were written
-- `public.`-qualified. After the schema move, and with search_path pinned empty,
-- those inner references no longer resolve. Repoint them at `private`.
-- Policies were unaffected (they bind by OID); only the function bodies broke.

create or replace function private.owns_product(target_product_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.products p
    where p.id = target_product_id
      and p.seller_profile_id = private.current_seller_profile_id()
  );
$$;

create or replace function private.product_is_visible(target_product_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.products p
    where p.id = target_product_id
      and (p.is_active or p.seller_profile_id = private.current_seller_profile_id())
  );
$$;

create or replace function private.owns_cart(target_cart_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.carts c
    where c.id = target_cart_id
      and c.profile_id = private.current_profile_id()
  );
$$;

create or replace function private.owns_order(target_order_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.orders o
    where o.id = target_order_id
      and o.profile_id = private.current_profile_id()
  );
$$;

create or replace function private.is_order_seller(target_order_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.order_items oi
    where oi.order_id = target_order_id
      and oi.seller_profile_id = private.current_seller_profile_id()
  );
$$;

create or replace function private.can_view_order(target_order_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.owns_order(target_order_id) or private.is_order_seller(target_order_id);
$$;
