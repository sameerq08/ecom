-- Step 03: policies for identity + catalog tables.
--
-- Function calls are wrapped in (select ...) so the planner evaluates them once
-- per statement as an initPlan rather than once per row. Roles are always named.
-- Policies are per-operation: "public can read" must never imply "public can write".
--
-- The public.* helper references below follow the functions into the `private`
-- schema automatically: policies bind by OID, not by name.

-- profiles: own row only. Compared against auth.uid() directly rather than
-- through a helper, since a profiles policy that reads profiles would recurse.
create policy "profiles_select_own" on public.profiles
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- No insert policy: handle_new_user() creates the row. No delete policy:
-- profiles die with their auth user, via cascade.

-- seller_profiles: storefronts are public; only the owner writes.
create policy "seller_profiles_select_public" on public.seller_profiles
  for select to anon, authenticated
  using (true);

create policy "seller_profiles_insert_own" on public.seller_profiles
  for insert to authenticated
  with check (profile_id = (select public.current_profile_id()));

create policy "seller_profiles_update_own" on public.seller_profiles
  for update to authenticated
  using (profile_id = (select public.current_profile_id()))
  with check (profile_id = (select public.current_profile_id()));

-- categories: admin-seeded, read-only in v1. Select only, deliberately.
create policy "categories_select_public" on public.categories
  for select to anon, authenticated
  using (true);

-- products: one select policy covering both audiences, rather than two
-- permissive ones. "Active, or mine" keeps a seller's deactivated listings
-- visible on /seller/products.
create policy "products_select_visible" on public.products
  for select to anon, authenticated
  using (
    is_active
    or seller_profile_id = (select public.current_seller_profile_id())
  );

create policy "products_insert_own" on public.products
  for insert to authenticated
  with check (seller_profile_id = (select public.current_seller_profile_id()));

create policy "products_update_own" on public.products
  for update to authenticated
  using (seller_profile_id = (select public.current_seller_profile_id()))
  with check (seller_profile_id = (select public.current_seller_profile_id()));

create policy "products_delete_own" on public.products
  for delete to authenticated
  using (seller_profile_id = (select public.current_seller_profile_id()));

-- product_images / inventory: visibility and ownership both inherit from the
-- parent product.
create policy "product_images_select_visible" on public.product_images
  for select to anon, authenticated
  using ((select public.product_is_visible(product_id)));

create policy "product_images_insert_own" on public.product_images
  for insert to authenticated
  with check ((select public.owns_product(product_id)));

create policy "product_images_update_own" on public.product_images
  for update to authenticated
  using ((select public.owns_product(product_id)))
  with check ((select public.owns_product(product_id)));

create policy "product_images_delete_own" on public.product_images
  for delete to authenticated
  using ((select public.owns_product(product_id)));

create policy "inventory_select_visible" on public.inventory
  for select to anon, authenticated
  using ((select public.product_is_visible(product_id)));

create policy "inventory_insert_own" on public.inventory
  for insert to authenticated
  with check ((select public.owns_product(product_id)));

create policy "inventory_update_own" on public.inventory
  for update to authenticated
  using ((select public.owns_product(product_id)))
  with check ((select public.owns_product(product_id)));

create policy "inventory_delete_own" on public.inventory
  for delete to authenticated
  using ((select public.owns_product(product_id)));
