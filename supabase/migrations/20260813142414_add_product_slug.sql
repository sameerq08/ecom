-- Step 06: give products the slug the routes have always assumed.
--
-- /products/[id] routes on a slug ("premium-noise-cancelling-headphones") but
-- products is keyed by uuid. .claude/specs/entity-architecture.md left this
-- open: add a slug column, or move the route to uuids. The column wins, and not
-- only to preserve URLs -- the seed cart and seed orders in lib/data/ still
-- store product ids as slugs and hydrate them synchronously. A uuid catalog
-- beside a slug cart would split the key space and break /cart and /orders,
-- which step 06 must leave working.
--
-- Backfill is mechanical rather than a hand-written mapping: the seed derived
-- every product id as uuid_generate_v5(<namespace>, 'product:' || slug), so
-- recomputing that expression from the slug list matches each row back to its
-- id exactly as the seed's own inserts and joins did.
--
-- No default and no generation logic: v1 has no product-create UI, so nothing
-- inserts a product outside a migration. A seller-facing create form has to
-- supply a slug when it lands.

alter table public.products add column if not exists slug text;

update public.products p
set slug = s.slug
from (values
  ('premium-noise-cancelling-headphones'),
  ('curved-ultrawide-gaming-monitor'),
  ('mechanical-keyboard-hot-swappable'),
  ('smart-indoor-security-camera'),
  ('pour-over-coffee-kettle'),
  ('cast-iron-skillet-12-inch'),
  ('linen-blend-oxford-shirt'),
  ('merino-wool-crew-socks'),
  ('the-pragmatic-shelf-hardback'),
  ('field-notes-pocket-atlas'),
  ('insulated-trail-water-bottle'),
  ('adjustable-resistance-band-set'),
  ('hardwood-building-blocks'),
  ('vitamin-c-daily-serum'),
  ('ceramic-dinner-plate-set'),
  ('smart-video-doorbell'),
  ('motion-sensor-night-light')
) as s(slug)
where p.id = extensions.uuid_generate_v5(
  'b6f0a2c4-5d1e-4a37-9c8b-0e7d2f3a1b45', 'product:' || s.slug
)
  and p.slug is distinct from s.slug;

alter table public.products alter column slug set not null;

alter table public.products add constraint products_slug_key unique (slug);
