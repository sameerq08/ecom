-- Step 03: policies for cart and order tables.

-- carts / cart_items: strictly the owner, on every operation.
create policy "carts_select_own" on public.carts
  for select to authenticated
  using (profile_id = (select public.current_profile_id()));

create policy "carts_insert_own" on public.carts
  for insert to authenticated
  with check (profile_id = (select public.current_profile_id()));

create policy "carts_update_own" on public.carts
  for update to authenticated
  using (profile_id = (select public.current_profile_id()))
  with check (profile_id = (select public.current_profile_id()));

create policy "carts_delete_own" on public.carts
  for delete to authenticated
  using (profile_id = (select public.current_profile_id()));

create policy "cart_items_select_own" on public.cart_items
  for select to authenticated
  using ((select public.owns_cart(cart_id)));

create policy "cart_items_insert_own" on public.cart_items
  for insert to authenticated
  with check ((select public.owns_cart(cart_id)));

create policy "cart_items_update_own" on public.cart_items
  for update to authenticated
  using ((select public.owns_cart(cart_id)))
  with check ((select public.owns_cart(cart_id)));

create policy "cart_items_delete_own" on public.cart_items
  for delete to authenticated
  using ((select public.owns_cart(cart_id)));

-- orders: one select policy spanning both audiences (buyer, or a seller with a
-- line item in it) rather than two permissive policies.
create policy "orders_select_participant" on public.orders
  for select to authenticated
  using ((select public.can_view_order(id)));

create policy "orders_insert_own" on public.orders
  for insert to authenticated
  with check (profile_id = (select public.current_profile_id()));

-- Only a seller holding a line item advances status. No delete policy: an order
-- is a record.
create policy "orders_update_status_by_seller" on public.orders
  for update to authenticated
  using ((select public.is_order_seller(id)))
  with check ((select public.is_order_seller(id)));

-- RLS gates rows, not columns, so the update policy above would otherwise let a
-- seller rewrite the buyer's shipping address. Column grants close that.
revoke update on public.orders from anon, authenticated;
grant update (status) on public.orders to authenticated;

-- order_items: immutable purchase record. No update policy, no delete policy.
create policy "order_items_select_participant" on public.order_items
  for select to authenticated
  using ((select public.can_view_order(order_id)));

-- The seller_profile_id check stops a buyer attributing their line to a seller
-- who never sold it.
create policy "order_items_insert_by_buyer" on public.order_items
  for insert to authenticated
  with check (
    (select public.owns_order(order_id))
    and seller_profile_id = (select public.product_seller_id(product_id))
  );

-- order_status_events: append-only. No update policy, no delete policy.
create policy "order_status_events_select_participant" on public.order_status_events
  for select to authenticated
  using ((select public.can_view_order(order_id)));

-- A seller may record any transition they are entitled to make. A buyer may
-- record only the opening 'pending' event written at checkout, so the timeline
-- cannot be forged forward from the buyer's side. Either way the event is
-- stamped with the caller's own profile, never someone else's.
create policy "order_status_events_insert_participant" on public.order_status_events
  for insert to authenticated
  with check (
    changed_by_profile_id = (select public.current_profile_id())
    and (
      (select public.is_order_seller(order_id))
      or (
        (select public.owns_order(order_id))
        and status = 'pending'
      )
    )
  );
