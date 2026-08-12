-- RLS verification for step 03 (.claude/specs/03-supabase-schema-and-rls.md).
--
-- Run through the Supabase MCP `execute_sql` tool, or any psql session with
-- rights to insert into auth.users. Everything runs inside one transaction that
-- ends in ROLLBACK, so no fixture survives — re-runnable against a live project.
--
-- Every policy is checked from both sides: the role that should be allowed and
-- the role that should be denied, per the verification plan in SPEC.md.

begin;

create temp table rls_results (
  seq serial,
  check_name text,
  expected text,
  actual text,
  pass boolean
) on commit drop;

-- Switch identity. anon = no claims; otherwise an authenticated JWT subject.
create function pg_temp.as_role(claims text) returns void language plpgsql as $fn$
begin
  reset role;
  if claims is null then
    perform set_config('request.jwt.claims', '', true);
    execute 'set local role anon';
  else
    perform set_config('request.jwt.claims', claims, true);
    execute 'set local role authenticated';
  end if;
end $fn$;

create function pg_temp.jwt(uid uuid) returns text language sql as $fn$
  select json_build_object('sub', uid::text, 'role', 'authenticated')::text;
$fn$;

-- Assert a read returns exactly N rows under the given identity.
create function pg_temp.assert_count(label text, claims text, q text, expected bigint)
returns void language plpgsql as $fn$
declare actual bigint;
begin
  perform pg_temp.as_role(claims);
  execute q into actual;
  reset role;
  insert into rls_results (check_name, expected, actual, pass)
  values (label, expected::text, actual::text, actual = expected);
exception when others then
  reset role;
  insert into rls_results (check_name, expected, actual, pass)
  values (label, expected::text, 'ERROR: ' || sqlerrm, false);
end $fn$;

-- Assert a write is refused: either an outright error, or zero rows touched
-- because the USING clause matched nothing. A "does not exist" error is a
-- wiring bug, not a policy denial, and must not be allowed to read as a pass.
create function pg_temp.assert_denied(label text, claims text, stmt text)
returns void language plpgsql as $fn$
declare n bigint;
begin
  perform pg_temp.as_role(claims);
  execute stmt;
  get diagnostics n = row_count;
  reset role;
  insert into rls_results (check_name, expected, actual, pass)
  values (label, 'denied', n || ' rows affected', n = 0);
exception when others then
  reset role;
  insert into rls_results (check_name, expected, actual, pass)
  values (label, 'denied', 'denied: ' || left(sqlerrm, 60),
          sqlerrm not ilike '%does not exist%');
end $fn$;

-- Assert a write succeeds and touches the expected number of rows.
create function pg_temp.assert_allowed(label text, claims text, stmt text, expected bigint)
returns void language plpgsql as $fn$
declare n bigint;
begin
  perform pg_temp.as_role(claims);
  execute stmt;
  get diagnostics n = row_count;
  reset role;
  insert into rls_results (check_name, expected, actual, pass)
  values (label, expected || ' rows', n || ' rows', n = expected);
exception when others then
  reset role;
  insert into rls_results (check_name, expected, actual, pass)
  values (label, expected || ' rows', 'ERROR: ' || left(sqlerrm, 60), false);
end $fn$;

-- ---------------------------------------------------------------- fixtures --
insert into auth.users
  (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
   created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin)
values
  ('00000000-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111',
   'authenticated', 'authenticated', 'buyer-a@rls.test', 'x-not-a-real-hash', now(),
   now(), now(), '{"provider":"email"}', '{"display_name":"Buyer A"}', false),
  ('00000000-0000-0000-0000-000000000000', '22222222-2222-2222-2222-222222222222',
   'authenticated', 'authenticated', 'buyer-b@rls.test', 'x-not-a-real-hash', now(),
   now(), now(), '{"provider":"email"}', '{"display_name":"Buyer B"}', false),
  ('00000000-0000-0000-0000-000000000000', '33333333-3333-3333-3333-333333333333',
   'authenticated', 'authenticated', 'seller-a@rls.test', 'x-not-a-real-hash', now(),
   now(), now(), '{"provider":"email"}', '{"display_name":"Seller A"}', false),
  ('00000000-0000-0000-0000-000000000000', '44444444-4444-4444-4444-444444444444',
   'authenticated', 'authenticated', 'seller-b@rls.test', 'x-not-a-real-hash', now(),
   now(), now(), '{"provider":"email"}', '{"display_name":"Seller B"}', false);

-- The signup trigger should have produced four buyer profiles.
insert into rls_results (check_name, expected, actual, pass)
select 'trigger: profile auto-created per auth user', '4', count(*)::text, count(*) = 4
from public.profiles
where user_id in (
  '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222',
  '33333333-3333-3333-3333-333333333333', '44444444-4444-4444-4444-444444444444'
);

insert into rls_results (check_name, expected, actual, pass)
select 'trigger: display_name + role from signup metadata', 'Buyer A/buyer',
       display_name || '/' || role, display_name = 'Buyer A' and role = 'buyer'
from public.profiles where user_id = '11111111-1111-1111-1111-111111111111';

-- Promote the two sellers.
update public.profiles set role = 'seller'
where user_id in ('33333333-3333-3333-3333-333333333333',
                  '44444444-4444-4444-4444-444444444444');

insert into public.seller_profiles (profile_id, store_name)
select id, 'Store ' || display_name from public.profiles
where user_id in ('33333333-3333-3333-3333-333333333333',
                  '44444444-4444-4444-4444-444444444444');

-- Catalog: Seller A gets one active and one inactive listing; Seller B one active.
insert into public.products (id, seller_profile_id, category_id, name, price, is_active)
values
  ('aaaaaaaa-0000-0000-0000-000000000001',
   (select sp.id from public.seller_profiles sp join public.profiles p on p.id = sp.profile_id
    where p.user_id = '33333333-3333-3333-3333-333333333333'),
   (select id from public.categories where slug = 'electronics'), 'A Active', 10.00, true),
  ('aaaaaaaa-0000-0000-0000-000000000002',
   (select sp.id from public.seller_profiles sp join public.profiles p on p.id = sp.profile_id
    where p.user_id = '33333333-3333-3333-3333-333333333333'),
   (select id from public.categories where slug = 'books'), 'A Inactive', 20.00, false),
  ('bbbbbbbb-0000-0000-0000-000000000001',
   (select sp.id from public.seller_profiles sp join public.profiles p on p.id = sp.profile_id
    where p.user_id = '44444444-4444-4444-4444-444444444444'),
   (select id from public.categories where slug = 'books'), 'B Active', 30.00, true);

insert into public.inventory (product_id, stock_qty)
values ('aaaaaaaa-0000-0000-0000-000000000001', 5),
       ('aaaaaaaa-0000-0000-0000-000000000002', 5),
       ('bbbbbbbb-0000-0000-0000-000000000001', 5);

insert into public.product_images (product_id, url, sort_order)
values ('aaaaaaaa-0000-0000-0000-000000000001', '/file.svg', 0),
       ('aaaaaaaa-0000-0000-0000-000000000002', '/file.svg', 0),
       ('bbbbbbbb-0000-0000-0000-000000000001', '/file.svg', 0);

-- Carts: one each for the two buyers.
insert into public.carts (id, profile_id)
values ('cccccccc-0000-0000-0000-00000000000a',
        (select id from public.profiles where user_id = '11111111-1111-1111-1111-111111111111')),
       ('cccccccc-0000-0000-0000-00000000000b',
        (select id from public.profiles where user_id = '22222222-2222-2222-2222-222222222222'));

insert into public.cart_items (cart_id, product_id, quantity)
values ('cccccccc-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-000000000001', 1),
       ('cccccccc-0000-0000-0000-00000000000b', 'bbbbbbbb-0000-0000-0000-000000000001', 1);

-- Orders: A's order holds a Seller A line; B's order holds only a Seller B line,
-- so Seller A must never see it.
insert into public.orders (id, profile_id, shipping_address)
values ('dddddddd-0000-0000-0000-00000000000a',
        (select id from public.profiles where user_id = '11111111-1111-1111-1111-111111111111'),
        '1 A Street'),
       ('dddddddd-0000-0000-0000-00000000000b',
        (select id from public.profiles where user_id = '22222222-2222-2222-2222-222222222222'),
        '2 B Street');

insert into public.order_items (order_id, product_id, seller_profile_id, quantity, price_at_purchase)
values ('dddddddd-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-000000000001',
        (select seller_profile_id from public.products where id = 'aaaaaaaa-0000-0000-0000-000000000001'), 1, 10.00),
       ('dddddddd-0000-0000-0000-00000000000b', 'bbbbbbbb-0000-0000-0000-000000000001',
        (select seller_profile_id from public.products where id = 'bbbbbbbb-0000-0000-0000-000000000001'), 1, 30.00);

insert into public.order_status_events (id, order_id, status, changed_by_profile_id)
values ('eeeeeeee-0000-0000-0000-00000000000a', 'dddddddd-0000-0000-0000-00000000000a', 'pending',
        (select id from public.profiles where user_id = '11111111-1111-1111-1111-111111111111'));

-- ------------------------------------------------------------------- anon --
select pg_temp.assert_count('anon reads categories', null,
  'select count(*) from public.categories', 7);
select pg_temp.assert_count('anon reads seller_profiles', null,
  'select count(*) from public.seller_profiles', 2);
select pg_temp.assert_count('anon reads only active products', null,
  'select count(*) from public.products', 2);
select pg_temp.assert_count('anon reads images of active products only', null,
  'select count(*) from public.product_images', 2);
select pg_temp.assert_count('anon reads inventory of active products only', null,
  'select count(*) from public.inventory', 2);
select pg_temp.assert_count('anon blocked from profiles', null,
  'select count(*) from public.profiles', 0);
select pg_temp.assert_count('anon blocked from carts', null,
  'select count(*) from public.carts', 0);
select pg_temp.assert_count('anon blocked from cart_items', null,
  'select count(*) from public.cart_items', 0);
select pg_temp.assert_count('anon blocked from orders', null,
  'select count(*) from public.orders', 0);
select pg_temp.assert_count('anon blocked from order_items', null,
  'select count(*) from public.order_items', 0);
select pg_temp.assert_count('anon blocked from order_status_events', null,
  'select count(*) from public.order_status_events', 0);
select pg_temp.assert_denied('anon cannot insert a category', null,
  $q$insert into public.categories (name, slug) values ('Hacked', 'hacked')$q$);
select pg_temp.assert_denied('anon cannot insert a product', null,
  $q$insert into public.products (seller_profile_id, category_id, name, price)
     select seller_profile_id, category_id, 'Hacked', 1 from public.products limit 1$q$);
select pg_temp.assert_denied('anon cannot update a product', null,
  $q$update public.products set name = 'Hacked'$q$);
select pg_temp.assert_denied('anon cannot update inventory', null,
  $q$update public.inventory set stock_qty = 999$q$);

-- ----------------------------------------------------------------- buyer A --
select pg_temp.assert_count('buyer A sees own profile only', pg_temp.jwt('11111111-1111-1111-1111-111111111111'),
  'select count(*) from public.profiles', 1);
select pg_temp.assert_count('buyer A sees own cart only', pg_temp.jwt('11111111-1111-1111-1111-111111111111'),
  'select count(*) from public.carts', 1);
select pg_temp.assert_count('buyer A sees own cart items only', pg_temp.jwt('11111111-1111-1111-1111-111111111111'),
  'select count(*) from public.cart_items', 1);
select pg_temp.assert_count('buyer A sees own order only', pg_temp.jwt('11111111-1111-1111-1111-111111111111'),
  'select count(*) from public.orders', 1);
select pg_temp.assert_count('buyer A sees own order items only', pg_temp.jwt('11111111-1111-1111-1111-111111111111'),
  'select count(*) from public.order_items', 1);
select pg_temp.assert_count('buyer A sees own status events only', pg_temp.jwt('11111111-1111-1111-1111-111111111111'),
  'select count(*) from public.order_status_events', 1);
select pg_temp.assert_allowed('buyer A updates own profile', pg_temp.jwt('11111111-1111-1111-1111-111111111111'),
  $q$update public.profiles set display_name = 'Buyer A Renamed'$q$, 1);
select pg_temp.assert_denied('buyer A cannot update buyer B profile', pg_temp.jwt('11111111-1111-1111-1111-111111111111'),
  $q$update public.profiles set display_name = 'Hacked'
     where user_id = '22222222-2222-2222-2222-222222222222'$q$);
select pg_temp.assert_denied('buyer A cannot insert into buyer B cart', pg_temp.jwt('11111111-1111-1111-1111-111111111111'),
  $q$insert into public.cart_items (cart_id, product_id, quantity)
     values ('cccccccc-0000-0000-0000-00000000000b', 'aaaaaaaa-0000-0000-0000-000000000001', 1)$q$);
select pg_temp.assert_denied('buyer A cannot order under buyer B profile', pg_temp.jwt('11111111-1111-1111-1111-111111111111'),
  $q$insert into public.orders (profile_id, shipping_address)
     select id, 'stolen' from public.profiles where user_id = '22222222-2222-2222-2222-222222222222'$q$);
select pg_temp.assert_denied('buyer A cannot forge a delivered status event', pg_temp.jwt('11111111-1111-1111-1111-111111111111'),
  $q$insert into public.order_status_events (order_id, status, changed_by_profile_id)
     select 'dddddddd-0000-0000-0000-00000000000a', 'delivered', id
     from public.profiles where user_id = '11111111-1111-1111-1111-111111111111'$q$);
select pg_temp.assert_denied('buyer A cannot advance own order status', pg_temp.jwt('11111111-1111-1111-1111-111111111111'),
  $q$update public.orders set status = 'delivered'$q$);

-- ---------------------------------------------------------------- seller A --
select pg_temp.assert_count('seller A sees own inactive listing', pg_temp.jwt('33333333-3333-3333-3333-333333333333'),
  $q$select count(*) from public.products where is_active = false$q$, 1);
select pg_temp.assert_count('seller A sees own 2 + B active 1', pg_temp.jwt('33333333-3333-3333-3333-333333333333'),
  'select count(*) from public.products', 3);
select pg_temp.assert_count('seller A sees own order only', pg_temp.jwt('33333333-3333-3333-3333-333333333333'),
  'select count(*) from public.orders', 1);
select pg_temp.assert_count('seller A sees own order items only', pg_temp.jwt('33333333-3333-3333-3333-333333333333'),
  'select count(*) from public.order_items', 1);
select pg_temp.assert_count('seller A blocked from buyer carts', pg_temp.jwt('33333333-3333-3333-3333-333333333333'),
  'select count(*) from public.carts', 0);
select pg_temp.assert_allowed('seller A updates own product', pg_temp.jwt('33333333-3333-3333-3333-333333333333'),
  $q$update public.products set name = 'A Renamed'
     where id = 'aaaaaaaa-0000-0000-0000-000000000001'$q$, 1);
select pg_temp.assert_allowed('seller A updates own inventory', pg_temp.jwt('33333333-3333-3333-3333-333333333333'),
  $q$update public.inventory set stock_qty = 9
     where product_id = 'aaaaaaaa-0000-0000-0000-000000000001'$q$, 1);
select pg_temp.assert_allowed('seller A adds image to own product', pg_temp.jwt('33333333-3333-3333-3333-333333333333'),
  $q$insert into public.product_images (product_id, url)
     values ('aaaaaaaa-0000-0000-0000-000000000001', '/extra.svg')$q$, 1);
select pg_temp.assert_denied('seller A cannot update B product', pg_temp.jwt('33333333-3333-3333-3333-333333333333'),
  $q$update public.products set name = 'Hacked'
     where id = 'bbbbbbbb-0000-0000-0000-000000000001'$q$);
select pg_temp.assert_denied('seller A cannot update B inventory', pg_temp.jwt('33333333-3333-3333-3333-333333333333'),
  $q$update public.inventory set stock_qty = 999
     where product_id = 'bbbbbbbb-0000-0000-0000-000000000001'$q$);
select pg_temp.assert_denied('seller A cannot add image to B product', pg_temp.jwt('33333333-3333-3333-3333-333333333333'),
  $q$insert into public.product_images (product_id, url)
     values ('bbbbbbbb-0000-0000-0000-000000000001', '/hack.svg')$q$);
select pg_temp.assert_denied('seller A cannot list under B seller id', pg_temp.jwt('33333333-3333-3333-3333-333333333333'),
  $q$insert into public.products (seller_profile_id, category_id, name, price)
     select seller_profile_id, category_id, 'Impersonated', 1
     from public.products where id = 'bbbbbbbb-0000-0000-0000-000000000001'$q$);

-- ------------------------------------------------------------ order status --
select pg_temp.assert_allowed('seller A advances own order status', pg_temp.jwt('33333333-3333-3333-3333-333333333333'),
  $q$update public.orders set status = 'shipped'
     where id = 'dddddddd-0000-0000-0000-00000000000a'$q$, 1);
select pg_temp.assert_allowed('seller A records the matching event', pg_temp.jwt('33333333-3333-3333-3333-333333333333'),
  $q$insert into public.order_status_events (order_id, status, changed_by_profile_id)
     select 'dddddddd-0000-0000-0000-00000000000a', 'shipped', id
     from public.profiles where user_id = '33333333-3333-3333-3333-333333333333'$q$, 1);
select pg_temp.assert_denied('seller B cannot touch order A status', pg_temp.jwt('44444444-4444-4444-4444-444444444444'),
  $q$update public.orders set status = 'delivered'
     where id = 'dddddddd-0000-0000-0000-00000000000a'$q$);
select pg_temp.assert_denied('seller A cannot touch order B status', pg_temp.jwt('33333333-3333-3333-3333-333333333333'),
  $q$update public.orders set status = 'delivered'
     where id = 'dddddddd-0000-0000-0000-00000000000b'$q$);
select pg_temp.assert_denied('seller A cannot rewrite shipping address', pg_temp.jwt('33333333-3333-3333-3333-333333333333'),
  $q$update public.orders set shipping_address = 'Diverted'
     where id = 'dddddddd-0000-0000-0000-00000000000a'$q$);
select pg_temp.assert_denied('status events are append-only (no update)', pg_temp.jwt('33333333-3333-3333-3333-333333333333'),
  $q$update public.order_status_events set status = 'delivered'$q$);
select pg_temp.assert_denied('status events are append-only (no delete)', pg_temp.jwt('33333333-3333-3333-3333-333333333333'),
  $q$delete from public.order_status_events$q$);
select pg_temp.assert_denied('order items are immutable (no update)', pg_temp.jwt('11111111-1111-1111-1111-111111111111'),
  $q$update public.order_items set quantity = 99$q$);
select pg_temp.assert_denied('order items are immutable (no delete)', pg_temp.jwt('11111111-1111-1111-1111-111111111111'),
  $q$delete from public.order_items$q$);
select pg_temp.assert_denied('buyer cannot misattribute a line to another seller', pg_temp.jwt('11111111-1111-1111-1111-111111111111'),
  $q$insert into public.order_items (order_id, product_id, seller_profile_id, quantity, price_at_purchase)
     select 'dddddddd-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-000000000001',
            seller_profile_id, 1, 10.00
     from public.products where id = 'bbbbbbbb-0000-0000-0000-000000000001'$q$);

select seq, check_name, expected, actual,
       case when pass then 'PASS' else 'FAIL' end as result
from rls_results order by seq;

rollback;
