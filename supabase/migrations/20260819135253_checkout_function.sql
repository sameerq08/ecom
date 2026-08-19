-- Step 08: the checkout transaction.
--
-- A buyer's session cannot legally write `inventory` (sellers own it per RLS),
-- so the decrement can only happen inside a privileged function -- which also
-- happens to be exactly what makes the whole checkout atomic and race-safe
-- under concurrent checkouts on the last unit. Follows the same public
-- wrapper / private body split as the RLS helpers in
-- 20260812154148_move_rls_helpers_to_private_schema.sql.

create function private.checkout(p_profile_id uuid, p_shipping_address text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cart_id uuid;
  v_order_id uuid;
  v_line record;
begin
  select id into v_cart_id from public.carts where profile_id = p_profile_id;

  if v_cart_id is null then
    raise exception 'empty_cart';
  end if;

  -- Lock the stock rows for the duration of the transaction so a concurrent
  -- checkout on the same product can't read a stale stock_qty.
  if not exists (
    select 1
    from public.cart_items ci
    join public.inventory inv on inv.product_id = ci.product_id
    where ci.cart_id = v_cart_id
    for update of inv
  ) then
    raise exception 'empty_cart';
  end if;

  for v_line in
    select
      ci.product_id,
      ci.quantity,
      p.price,
      p.seller_profile_id,
      inv.stock_qty
    from public.cart_items ci
    join public.products p on p.id = ci.product_id
    join public.inventory inv on inv.product_id = ci.product_id
    where ci.cart_id = v_cart_id
    for update of inv
  loop
    if v_line.quantity > v_line.stock_qty then
      raise exception 'insufficient_stock: %', v_line.product_id;
    end if;
  end loop;

  insert into public.orders (profile_id, status, shipping_address)
  values (p_profile_id, 'pending', p_shipping_address)
  returning id into v_order_id;

  insert into public.order_items (order_id, product_id, seller_profile_id, quantity, price_at_purchase)
  select v_order_id, ci.product_id, p.seller_profile_id, ci.quantity, p.price
  from public.cart_items ci
  join public.products p on p.id = ci.product_id
  where ci.cart_id = v_cart_id;

  insert into public.order_status_events (order_id, status, changed_by_profile_id)
  values (v_order_id, 'pending', p_profile_id);

  update public.inventory inv
  set stock_qty = inv.stock_qty - ci.quantity
  from public.cart_items ci
  where ci.cart_id = v_cart_id
    and inv.product_id = ci.product_id
    and inv.stock_qty >= ci.quantity;

  delete from public.cart_items where cart_id = v_cart_id;

  return v_order_id;
end;
$$;

create function public.checkout_cart(p_shipping_address text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile_id uuid;
begin
  v_profile_id := private.current_profile_id();

  if v_profile_id is null then
    raise exception 'not_authenticated';
  end if;

  return private.checkout(v_profile_id, p_shipping_address);
end;
$$;

revoke all on function public.checkout_cart(text) from public, anon;
grant execute on function public.checkout_cart(text) to authenticated;
