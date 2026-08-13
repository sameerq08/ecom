-- Backdate the demo accounts' created_at to their intended join dates.
--
-- 20260813101702_seed_marketplace_demo_data.sql seeded seller_profiles.created_at
-- from public.profiles.created_at, on the assumption that the profile inherited
-- the auth user's timestamp. It does not: handle_new_user() inserts only
-- (user_id, display_name), so created_at fell to its now() default and every
-- storefront reported a 2026 join year instead of the 2018-2022 years that
-- SellerSignal.memberSince renders on the product detail page.
--
-- auth.users.created_at is the value that was correct all along, so both tables
-- are repaired from it. Scoped to @demo.market so no real signup is touched, and
-- idempotent: re-running it settles on the same timestamps.
update public.profiles p
set created_at = u.created_at
from auth.users u
where u.id = p.user_id
  and u.email like '%@demo.market'
  and p.created_at is distinct from u.created_at;

update public.seller_profiles sp
set created_at = u.created_at
from public.profiles p
join auth.users u on u.id = p.user_id
where p.id = sp.profile_id
  and u.email like '%@demo.market'
  and sp.created_at is distinct from u.created_at;
