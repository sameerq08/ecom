-- Step 03 follow-up: get the RLS helpers out of the PostgREST-exposed schema.
--
-- Anything in `public` is published as /rest/v1/rpc/<name>, so every ownership
-- helper (and the signup trigger function) was callable directly by anon. The
-- database linter flags this as anon_security_definer_function_executable.
-- Policies and triggers bind to functions by OID, so relocating the schema does
-- not disturb them.

create schema if not exists private;

revoke all on schema private from public;
grant usage on schema private to anon, authenticated, service_role, supabase_auth_admin;

alter function public.current_profile_id() set schema private;
alter function public.current_seller_profile_id() set schema private;
alter function public.owns_product(uuid) set schema private;
alter function public.product_is_visible(uuid) set schema private;
alter function public.product_seller_id(uuid) set schema private;
alter function public.owns_cart(uuid) set schema private;
alter function public.owns_order(uuid) set schema private;
alter function public.is_order_seller(uuid) set schema private;
alter function public.can_view_order(uuid) set schema private;
alter function public.handle_new_user() set schema private;

grant execute on function
  private.current_profile_id(),
  private.current_seller_profile_id(),
  private.owns_product(uuid),
  private.product_is_visible(uuid),
  private.product_seller_id(uuid),
  private.owns_cart(uuid),
  private.owns_order(uuid),
  private.is_order_seller(uuid),
  private.can_view_order(uuid)
to anon, authenticated;

grant execute on function private.handle_new_user() to supabase_auth_admin, service_role;
