-- Seed the demo marketplace: sellers, catalog, inventory, and sample orders.
--
-- This mirrors lib/data/products.ts and lib/data/orders.ts one-for-one, so the
-- step 04 data-layer swap can be verified by comparison: the screens must render
-- identically before and after they start reading from Postgres.
--
-- Every id is derived with uuid_generate_v5 from a fixed namespace plus a stable
-- slug, so the migration is deterministic and every insert can end in
-- `on conflict do nothing` — re-applying it changes nothing.
--
-- The demo accounts share one password: 'demo-marketplace-2026'. That is a
-- documented demo credential for a throwaway dataset, not a secret, and it is
-- deliberately written here rather than hidden in an env var: a seed nobody can
-- sign in to cannot exercise the seller dashboard. It must never be reused for
-- anything real.
--
-- Two fields in the app's view-models have no column to land in, and are left to
-- be derived in app code rather than silently invented here:
--   * SeedProduct.featured   — a homepage presentation flag, not a catalog fact.
--   * OrderRecord.orderNumber — public.orders has no order_number column.

-- ------------------------------------------------------------------ accounts --
-- The on_auth_user_created trigger creates the public.profiles row for each of
-- these, which is why no profiles insert appears below. Token columns are set to
-- '' rather than null because GoTrue scans them as non-null strings.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
select
  '00000000-0000-0000-0000-000000000000',
  extensions.uuid_generate_v5('b6f0a2c4-5d1e-4a37-9c8b-0e7d2f3a1b45', 'user:' || u.email),
  'authenticated', 'authenticated', u.email,
  extensions.crypt('demo-marketplace-2026', extensions.gen_salt('bf')),
  u.joined, u.joined, now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  jsonb_build_object('display_name', u.display_name),
  false, '', '', '', ''
from (values
  ('acoustic@demo.market',     'Acoustic Pro Direct', timestamptz '2019-01-01'),
  ('displayworks@demo.market', 'DisplayWorks',        timestamptz '2021-01-01'),
  ('keyforge@demo.market',     'KeyForge',            timestamptz '2022-01-01'),
  ('homesafe@demo.market',     'HomeSafe',            timestamptz '2020-01-01'),
  ('northpage@demo.market',    'Northpage Books',     timestamptz '2018-01-01'),
  ('jane@demo.market',         'Jane Doe',            timestamptz '2023-01-01')
) as u(email, display_name, joined)
on conflict do nothing;

-- Password sign-in resolves through auth.identities, not auth.users alone.
insert into auth.identities (
  id, user_id, provider_id, provider, identity_data, created_at, updated_at
)
select
  extensions.uuid_generate_v5('b6f0a2c4-5d1e-4a37-9c8b-0e7d2f3a1b45', 'identity:' || u.email),
  u.id, u.id::text, 'email',
  jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
  u.created_at, now()
from auth.users u
where u.email like '%@demo.market'
on conflict do nothing;

-- Five of the six are sellers; Jane stays a buyer on the trigger's default role.
update public.profiles p
set role = 'seller'
from auth.users u
where u.id = p.user_id
  and u.email in ('acoustic@demo.market', 'displayworks@demo.market',
                  'keyforge@demo.market', 'homesafe@demo.market',
                  'northpage@demo.market');

-- Storefronts. created_at carries the SellerSignal.memberSince year the product
-- detail page renders.
insert into public.seller_profiles (id, profile_id, store_name, bio, created_at)
select
  extensions.uuid_generate_v5('b6f0a2c4-5d1e-4a37-9c8b-0e7d2f3a1b45', 'seller:' || s.store_name),
  p.id, s.store_name, s.bio, p.created_at
from (values
  ('Acoustic Pro Direct', 'acoustic@demo.market',
   'Audio specialists since 2019. Headphones, monitors, and everything that carries a signal.'),
  ('DisplayWorks', 'displayworks@demo.market',
   'Screens and gear for desks that get used hard.'),
  ('KeyForge', 'keyforge@demo.market',
   'Enthusiast keyboards, built to be taken apart.'),
  ('HomeSafe', 'homesafe@demo.market',
   'Home security and kitchen essentials, chosen for how long they last.'),
  ('Northpage Books', 'northpage@demo.market',
   'An independent bookshop trading online since 2018.')
) as s(store_name, email, bio)
join auth.users u on u.email = s.email
join public.profiles p on p.user_id = u.id
on conflict do nothing;

-- ------------------------------------------------------------------- catalog --
-- The 17 entries of the SEED array in lib/data/products.ts, in array order.
-- created_at is staggered by that order so "newest" is stable across re-runs.
-- motion-sensor-night-light stays inactive: it is the row that proves
-- products_select_visible hides a deactivated listing from anon.
insert into public.products (
  id, seller_profile_id, category_id, name, description, price, rating,
  is_active, created_at
)
select
  extensions.uuid_generate_v5('b6f0a2c4-5d1e-4a37-9c8b-0e7d2f3a1b45', 'product:' || s.slug),
  sp.id, c.id, s.name, s.description, s.price, s.rating, s.is_active,
  timestamptz '2026-01-01' + (s.ord * interval '1 day')
from (values
  (1, 'premium-noise-cancelling-headphones',
   'Premium Noise Cancelling Wireless Over-Ear Headphones, Black',
   'Forty hours of playback, adaptive noise cancellation, and memory-foam earcups that stay comfortable through a long-haul flight. Folds flat into a hard travel case.',
   299.00, 4.5, 'Acoustic Pro Direct', 'electronics', true),
  (2, 'curved-ultrawide-gaming-monitor',
   '34-Inch Curved Ultrawide Gaming Monitor, 144Hz',
   'A 3440x1440 curved panel with a 144Hz refresh rate and 1ms response time. Height-adjustable stand, two HDMI inputs, and one DisplayPort.',
   449.99, 4.0, 'DisplayWorks', 'electronics', true),
  (3, 'mechanical-keyboard-hot-swappable',
   'Mechanical Keyboard with Hot-Swappable Switches',
   'Swap switches without soldering. Gasket-mounted aluminium body, doubleshot PBT keycaps, and per-key backlighting configurable in the browser.',
   129.50, 4.8, 'KeyForge', 'electronics', true),
  (4, 'smart-indoor-security-camera',
   'Smart Home Indoor Security Camera, 1080p HD Video',
   'Full-HD video with night vision and two-way audio. Motion zones and alerts run on-device, with optional local storage on a microSD card.',
   49.99, 3.5, 'HomeSafe', 'electronics', true),
  (5, 'pour-over-coffee-kettle',
   'Gooseneck Pour-Over Coffee Kettle, 1L Stainless Steel',
   'A counterbalanced handle and precision spout for a controlled pour. Variable temperature to the degree, with a thirty-minute hold.',
   79.00, 4.6, 'HomeSafe', 'home-kitchen', true),
  (6, 'cast-iron-skillet-12-inch',
   'Pre-Seasoned Cast Iron Skillet, 12 Inch',
   'Foundry-seasoned and ready to use. Moves from hob to oven to grill, and improves with every meal cooked in it.',
   34.95, 4.7, 'HomeSafe', 'home-kitchen', true),
  (7, 'linen-blend-oxford-shirt',
   'Linen-Blend Oxford Shirt, Long Sleeve',
   'A breathable linen-cotton weave cut for a relaxed fit. Mother-of-pearl buttons and a single chest pocket.',
   58.00, 4.1, 'KeyForge', 'clothing-accessories', true),
  (8, 'merino-wool-crew-socks',
   'Merino Wool Crew Socks, Three Pack',
   'Temperature-regulating merino with a reinforced heel and toe. Warm in winter, breathable in summer, and machine washable.',
   24.00, 4.4, 'KeyForge', 'clothing-accessories', true),
  (9, 'the-pragmatic-shelf-hardback',
   'The Pragmatic Shelf — Collected Essays, Hardback',
   'Twenty-two essays on craft and attention, collected for the first time. Smyth-sewn binding with a ribbon marker.',
   27.50, 4.9, 'Northpage Books', 'books', true),
  (10, 'field-notes-pocket-atlas',
   'Field Notes Pocket Atlas of Coastal Birds',
   'Two hundred illustrated plates sized for a jacket pocket. Waterproof cover and a quick-reference silhouette index.',
   18.99, 3.8, 'Northpage Books', 'books', true),
  (11, 'insulated-trail-water-bottle',
   'Insulated Trail Water Bottle, 750ml',
   'Double-walled vacuum insulation keeps drinks cold for a full day. Leakproof lid with an integrated carry loop.',
   32.00, 4.3, 'DisplayWorks', 'sports-outdoors', true),
  (12, 'adjustable-resistance-band-set',
   'Adjustable Resistance Band Set with Door Anchor',
   'Five stackable bands from 10 to 50 pounds, with handles, ankle straps, and a door anchor. Packs into the included pouch.',
   41.25, 4.2, 'DisplayWorks', 'sports-outdoors', true),
  (13, 'hardwood-building-blocks',
   'Hardwood Building Blocks, 100 Piece Set',
   'Sanded beech blocks in six shapes, finished with a non-toxic water-based sealant. Stores in a canvas drawstring bag.',
   45.00, 4.6, 'Northpage Books', 'toys-games', true),
  (14, 'vitamin-c-daily-serum',
   'Vitamin C Daily Brightening Serum, 30ml',
   'A 15% stabilised vitamin C serum with hyaluronic acid. Fragrance-free, in an amber pump bottle that limits light exposure.',
   22.40, 3.9, 'Acoustic Pro Direct', 'beauty-personal-care', true),
  (15, 'ceramic-dinner-plate-set',
   'Stoneware Dinner Plate Set, Service for Four',
   'Reactive-glazed stoneware fired at high temperature, so no two plates share a pattern. Dishwasher and microwave safe.',
   68.00, 4.4, 'HomeSafe', 'home-kitchen', true),
  (16, 'smart-video-doorbell',
   'Smart Video Doorbell with Two-Way Talk',
   'Answer the door from anywhere. Wide-angle 1080p lens, package detection, and wired or battery installation.',
   89.99, 4.1, 'HomeSafe', 'electronics', true),
  (17, 'motion-sensor-night-light',
   'Motion Sensor Night Light, Two Pack',
   'Warm LED strips that wake on movement and fade out after thirty seconds. Magnetic mount, rechargeable over USB-C.',
   19.50, 3.7, 'HomeSafe', 'home-kitchen', false)
) as s(ord, slug, name, description, price, rating, store_name, category_slug, is_active)
join public.seller_profiles sp on sp.store_name = s.store_name
join public.categories c on c.slug = s.category_slug
on conflict do nothing;

-- Placeholder art only — the SVGs already in /public. linen-blend-oxford-shirt
-- is deliberately absent, so the imageUrl-null fallback stays exercised.
insert into public.product_images (id, product_id, url, sort_order)
select
  extensions.uuid_generate_v5('b6f0a2c4-5d1e-4a37-9c8b-0e7d2f3a1b45',
                              'image:' || i.slug || ':' || i.sort_order),
  extensions.uuid_generate_v5('b6f0a2c4-5d1e-4a37-9c8b-0e7d2f3a1b45', 'product:' || i.slug),
  i.url, i.sort_order
from (values
  ('premium-noise-cancelling-headphones', '/window.svg', 0),
  ('premium-noise-cancelling-headphones', '/globe.svg',  1),
  ('premium-noise-cancelling-headphones', '/file.svg',   2),
  ('curved-ultrawide-gaming-monitor',     '/globe.svg',  0),
  ('curved-ultrawide-gaming-monitor',     '/next.svg',   1),
  ('mechanical-keyboard-hot-swappable',   '/file.svg',   0),
  ('smart-indoor-security-camera',        '/next.svg',   0),
  ('pour-over-coffee-kettle',             '/vercel.svg', 0),
  ('pour-over-coffee-kettle',             '/window.svg', 1),
  ('cast-iron-skillet-12-inch',           '/file.svg',   0),
  ('merino-wool-crew-socks',              '/globe.svg',  0),
  ('the-pragmatic-shelf-hardback',        '/file.svg',   0),
  ('the-pragmatic-shelf-hardback',        '/vercel.svg', 1),
  ('field-notes-pocket-atlas',            '/window.svg', 0),
  ('insulated-trail-water-bottle',        '/next.svg',   0),
  ('adjustable-resistance-band-set',      '/vercel.svg', 0),
  ('hardwood-building-blocks',            '/globe.svg',  0),
  ('hardwood-building-blocks',            '/file.svg',   1),
  ('hardwood-building-blocks',            '/next.svg',   2),
  ('vitamin-c-daily-serum',               '/window.svg', 0),
  ('ceramic-dinner-plate-set',            '/vercel.svg', 0),
  ('smart-video-doorbell',                '/next.svg',   0),
  ('smart-video-doorbell',                '/window.svg', 1),
  ('motion-sensor-night-light',           '/globe.svg',  0)
) as i(slug, url, sort_order)
on conflict do nothing;

-- One row per product, including the three at zero that drive the
-- out-of-stock UI.
insert into public.inventory (id, product_id, stock_qty)
select
  extensions.uuid_generate_v5('b6f0a2c4-5d1e-4a37-9c8b-0e7d2f3a1b45', 'inventory:' || v.slug),
  extensions.uuid_generate_v5('b6f0a2c4-5d1e-4a37-9c8b-0e7d2f3a1b45', 'product:' || v.slug),
  v.stock_qty
from (values
  ('premium-noise-cancelling-headphones', 24),
  ('curved-ultrawide-gaming-monitor',      8),
  ('mechanical-keyboard-hot-swappable',    0),
  ('smart-indoor-security-camera',        61),
  ('pour-over-coffee-kettle',             15),
  ('cast-iron-skillet-12-inch',           42),
  ('linen-blend-oxford-shirt',            30),
  ('merino-wool-crew-socks',               0),
  ('the-pragmatic-shelf-hardback',        12),
  ('field-notes-pocket-atlas',             5),
  ('insulated-trail-water-bottle',        88),
  ('adjustable-resistance-band-set',      19),
  ('hardwood-building-blocks',            27),
  ('vitamin-c-daily-serum',               53),
  ('ceramic-dinner-plate-set',            21),
  ('smart-video-doorbell',                 0),
  ('motion-sensor-night-light',           34)
) as v(slug, stock_qty)
on conflict do nothing;

-- -------------------------------------------------------------------- orders --
-- The three orders in lib/data/orders.ts, plus one 'confirmed' order so all four
-- values of the order_status enum appear in the data. Order o-1003 keeps its
-- two-seller composition: that is the case proving a seller's queue shows only
-- its own line items.
insert into public.orders (id, profile_id, status, shipping_address, created_at)
select
  extensions.uuid_generate_v5('b6f0a2c4-5d1e-4a37-9c8b-0e7d2f3a1b45', 'order:' || o.key),
  p.id, o.status::public.order_status,
  E'Jane Doe\n48 Kestrel Lane\nApartment 3B\nPortland, OR 97209',
  o.placed_at
from (values
  ('o-1001', 'delivered', timestamptz '2026-04-18 15:10:00+00'),
  ('o-1002', 'shipped',   timestamptz '2026-05-02 09:24:00+00'),
  ('o-1003', 'pending',   timestamptz '2026-05-15 18:02:00+00'),
  ('o-1004', 'confirmed', timestamptz '2026-06-03 11:47:00+00')
) as o(key, status, placed_at)
join auth.users u on u.email = 'jane@demo.market'
join public.profiles p on p.user_id = u.id
on conflict do nothing;

-- price_at_purchase is the snapshot, so it is written from the seed order rather
-- than read back off the product. seller_profile_id is resolved through the
-- product, which is exactly what order_items_insert_by_buyer enforces.
insert into public.order_items (
  id, order_id, product_id, seller_profile_id, quantity, price_at_purchase
)
select
  extensions.uuid_generate_v5('b6f0a2c4-5d1e-4a37-9c8b-0e7d2f3a1b45',
                              'order_item:' || oi.order_key || ':' || oi.slug),
  extensions.uuid_generate_v5('b6f0a2c4-5d1e-4a37-9c8b-0e7d2f3a1b45', 'order:' || oi.order_key),
  pr.id, pr.seller_profile_id, oi.quantity, oi.price_at_purchase
from (values
  ('o-1001', 'the-pragmatic-shelf-hardback',        1, 27.50),
  ('o-1001', 'pour-over-coffee-kettle',             1, 79.00),
  ('o-1002', 'cast-iron-skillet-12-inch',           2, 34.95),
  ('o-1003', 'smart-indoor-security-camera',        1, 49.99),
  ('o-1003', 'premium-noise-cancelling-headphones', 1, 299.00),
  ('o-1004', 'insulated-trail-water-bottle',        2, 32.00),
  ('o-1004', 'hardwood-building-blocks',            1, 45.00)
) as oi(order_key, slug, quantity, price_at_purchase)
join public.products pr
  on pr.id = extensions.uuid_generate_v5('b6f0a2c4-5d1e-4a37-9c8b-0e7d2f3a1b45',
                                         'product:' || oi.slug)
on conflict do nothing;

-- The full timeline, not just the current status. The opening 'pending' event is
-- stamped with the buyer and every advance with a seller holding a line item on
-- that order — the same attribution order_status_events_insert_participant
-- allows, so the seeded history is one a real client could have written.
insert into public.order_status_events (
  id, order_id, status, changed_by_profile_id, note, created_at
)
select
  extensions.uuid_generate_v5('b6f0a2c4-5d1e-4a37-9c8b-0e7d2f3a1b45',
                              'status_event:' || e.order_key || ':' || e.status),
  extensions.uuid_generate_v5('b6f0a2c4-5d1e-4a37-9c8b-0e7d2f3a1b45', 'order:' || e.order_key),
  e.status::public.order_status, p.id, e.note, e.at
from (values
  ('o-1001', 'pending',   'jane@demo.market',     'Order placed.',              timestamptz '2026-04-18 15:10:00+00'),
  ('o-1001', 'confirmed', 'northpage@demo.market','Payment cleared.',           timestamptz '2026-04-18 17:35:00+00'),
  ('o-1001', 'shipped',   'northpage@demo.market','Handed to the carrier.',     timestamptz '2026-04-20 08:12:00+00'),
  ('o-1001', 'delivered', 'northpage@demo.market','Left with the resident.',    timestamptz '2026-04-23 13:48:00+00'),
  ('o-1002', 'pending',   'jane@demo.market',     'Order placed.',              timestamptz '2026-05-02 09:24:00+00'),
  ('o-1002', 'confirmed', 'homesafe@demo.market', 'Stock reserved.',            timestamptz '2026-05-02 12:00:00+00'),
  ('o-1002', 'shipped',   'homesafe@demo.market', 'Dispatched from Portland.',  timestamptz '2026-05-04 07:55:00+00'),
  ('o-1003', 'pending',   'jane@demo.market',     'Order placed.',              timestamptz '2026-05-15 18:02:00+00'),
  ('o-1004', 'pending',   'jane@demo.market',     'Order placed.',              timestamptz '2026-06-03 11:47:00+00'),
  ('o-1004', 'confirmed', 'displayworks@demo.market', 'Packing today.',         timestamptz '2026-06-03 14:20:00+00')
) as e(order_key, status, actor_email, note, at)
join auth.users u on u.email = e.actor_email
join public.profiles p on p.user_id = u.id
on conflict do nothing;
