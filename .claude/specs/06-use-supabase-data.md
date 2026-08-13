# Spec for use-supabase-data

branch: claude/feature/use-supabase-data

## Overview

Point the public catalog at Postgres. Home, search, filters, categories and product detail currently read the seed arrays in `lib/data/products.ts` and `lib/data/categories.ts`; after this step they run real Supabase queries against the eleven tables built in step 03 and populated by the seed migration. Cart, checkout, orders and the seller dashboard stay exactly where they are — on the mutable module-level seed state — until the cart persistence step. This is deliberately the read-only half of the swap: the catalog is public, so every query here runs under `products_select_visible`, `categories_select_public`, `product_images_select_visible` and `inventory_select_visible` as the `anon` role, and no auth gate is introduced. That makes the step verifiable on its own terms — the seed mirrors the database one-for-one, so success is that the screens render identically and any visual difference is a bug in the swap.

**Relationship to step 04.** `.claude/specs/04-supabase-data-layer-swap.md` specs this work plus the cart, order and seller swap and the auth gates that go with it. This step carves out the catalog reads and leaves the rest of 04 outstanding. Nothing here contradicts 04; it is the first slice of it, and the two deferred transactional concerns 04 owns (decrementing `inventory.stock_qty` at checkout, validating `price_at_purchase`) remain out of scope because nothing in this step writes.

## Depends on

- **Step 03 (`.claude/specs/03-supabase-schema-and-rls.md`)** — the `categories`, `products`, `product_images`, `inventory` and `seller_profiles` tables, and the public-read policies this step's queries run under. Complete.
- **Step 05 (`.claude/specs/05-supabase-auth-integration.md`)** — `lib/supabase/server.ts` is the only place a server client is constructed, and this step's queries go through it. Complete. No session is required for any catalog read; the anon key plus RLS is the whole access story here.
- **The seed migrations** (`20260813101702_seed_marketplace_demo_data.sql`, `20260813101800_backdate_demo_account_created_at.sql`) — the 5 sellers, 17 products (16 active), images, stock and the seller join dates the rendered screens are compared against.
- **Steps 01 and 02** — the screens and components being repointed. Their presentational contracts in `lib/types/ui.ts` do not change.

## Routes

No new routes.

Three existing routes change what they read, not their paths, their rendering or their access level. All three are public and stay public:

- GET `/` — featured rail and category chips now read Postgres — public
- GET `/search` — keyword, category, price, rating, seller and availability filtering now execute as a database query — public
- GET `/products/[id]` — product, images, inventory and seller signal now read Postgres — public

The `[id]` segment keeps its current meaning: a product slug such as `premium-noise-cancelling-headphones`, not a uuid. Existing URLs, and the links every `ProductCard` renders, must survive this step unchanged.

## Database changes

One migration, adding the product slug the routing already assumes.

- Add `slug` to `public.products`: `text`, unique. `.claude/specs/entity-architecture.md` records this as an open decision — add a unique `slug` column or move the route to uuids. **Add the column.** Moving to uuids would break every existing product URL, and more importantly the seed cart and seed orders store product ids as slugs and hydrate them synchronously; switching the catalog to uuid keys while cart and orders stay on seed data would split the key space in half and break `/cart` and `/orders` — screens this step is supposed to leave untouched.
- Backfill it deterministically. The seed derived each product id as `uuid_generate_v5(<seed namespace>, 'product:' || slug)`, so the same expression recomputed from a slug list matches each row back to its id exactly as the seed's own inserts and joins do. Backfill from the 17-slug list, then apply `not null` and the unique constraint once every row is populated.
- No default and no generation logic. v1 has no product-create UI, so nothing inserts a product outside a migration; a seller-facing create form is a later step's problem and will have to supply or derive a slug then.
- Leave `is_active`, `rating` and the absent `featured` flag alone. No new columns beyond `slug`, and no policy changes — the existing catalog select policies already permit exactly these reads.
- Regenerate `lib/types/database.ts` after the migration and commit it unmodified.

Apply through `mcp__supabase__apply_migration`, mirror the identical SQL into `supabase/migrations/`, and run `get_advisors` afterwards.

## Templates

This project has no template directory; the equivalent artifacts are the App Router pages and the React components that render them.

**Create:**

- `app/loading.tsx` — the homepage has no loading state today because seed reads were synchronous. Once the featured rail is a network call it needs one: a skeleton shaped like the hero band, the category chip row and a grid of `ProductCardSkeleton`, matching the shape of `app/search/loading.tsx`.

**Modify:**

- `app/page.tsx` — awaits the Supabase-backed featured products and category reads. Layout unchanged.
- `app/search/page.tsx` — passes the fetched category list into `SearchFilters` alongside the seller names it already passes; result count, filter chips, clear-filters link and empty state all keep their current behavior.
- `app/products/[id]/page.tsx` — resolves the slug against Postgres, keeps `notFound()` for a missing or inactive listing, keeps the breadcrumb and the image-index query param.
- `components/product/CategoryChips.tsx` — becomes an async server component that reads the category list instead of importing a constant array. Markup, the "All" chip and `aria-current` behavior are unchanged.
- `components/product/SearchFilters.tsx` — takes `categories` as a prop, the way it already takes `sellers`. It stays a plain GET form with no client component.

`ProductCard`, `ProductGrid`, `ProductImage`, `StarRating`, `SellerSignal`, `BuyBox`, `ProductGallery`, `EmptyState`, `ErrorState` and every skeleton are **not modified**. They already render the card fields this step's acceptance criteria name — name, rating, price, seller store name, stock signal, and the placeholder well for a listing with no image — and if a repointed query returns the right view-model they need no change at all. Needing to edit a presentational component is a signal the mapping is wrong.

## Files to change

- `lib/data/products.ts` — rewritten as the Supabase-backed public catalog: featured products, product-by-slug, search with filters, and the seller store names for the filter dropdown. The seed array and the seed-only helpers move out (see below). `parseProductFilters` and `hasActiveFilters` stay here and stay pure — the query-string contract does not change.
- `lib/data/categories.ts` — `CATEGORIES` and the synchronous `getCategoryBySlug` are replaced by async reads of the `categories` table. Wrap the list read in React `cache()` so a page rendering both the chips and a category lookup issues one query per request.
- `lib/data/cart.ts`, `lib/data/orders.ts`, `lib/data/seller.ts` — import updates only, repointing `findProduct`, `simulateLatency`, `getSellerListings`, `countActiveListings` and `CURRENT_SELLER_ID` at the extracted seed module. **No behavior change.** These three modules stay on seed state.
- `app/page.tsx`, `app/search/page.tsx`, `app/products/[id]/page.tsx`, `components/product/CategoryChips.tsx`, `components/product/SearchFilters.tsx` — as described under Templates.
- `lib/types/database.ts` — regenerated, not hand-edited.
- `.claude/specs/entity-architecture.md` — the "Fields the UI has and the schema does not" section resolves the product-slug question; update it to record that the column now exists, leaving the `featured` and `orderNumber` entries as they are.
- `CLAUDE.md` — update the current-state section: the catalog reads Postgres, cart/orders/seller do not, and `lib/data/` is now a split seam.

## Files to create

- `supabase/migrations/<version>_add_product_slug.sql` — the column, backfill, not-null and unique constraint described above.
- `lib/data/seed-catalog.ts` — the seed arrays and the helpers that must stay synchronous, extracted from `products.ts`: `SELLERS`, the 17-entry `SEED` array, `findProduct`, `simulateLatency`, `getSellerListings`, `countActiveListings` and `CURRENT_SELLER_ID`. This exists to give the remaining seed layer one file with a clear deletion point, rather than leaving it tangled with live queries. Its header comment must say it is temporary and name the step that removes it.
- `app/loading.tsx` — the homepage skeleton.

## New dependencies

No new dependencies. `@supabase/supabase-js` and `@supabase/ssr` are already installed and already wired through `lib/supabase/server.ts`.

## Rules for implementation

- Use CSS variables — never hardcode hex values. Semantic token classes only (`bg-canvas`, `bg-surface`, `text-text-muted`, `border-border`, `text-link`, `text-success`, `text-error`) and the custom type scale (`text-display-lg`, `text-body-md`, `text-label-md`, …), never raw Tailwind palette classes and never paired with `font-*` or `leading-*`. `bg-accent` stays reserved for conversion CTAs.
- **`lib/data/` remains the only data-access seam.** No page or component may construct a Supabase client or write a query. Screens keep calling the same exported helper names with the same signatures wherever possible, so the diff concentrates in `lib/data/`.
- All client construction goes through `createClient()` in `lib/supabase/server.ts`, one per request. Only the anon key is ever used; nothing in this step may read `SUPABASE_SERVICE_ROLE_KEY`.
- **The view-models in `lib/types/ui.ts` do not change.** `lib/data/` maps database rows onto `Product`, `ProductDetail`, `SellerSignal` and `Category`; database types stay behind the seam. `Product.id` continues to carry the **slug**, because that is what the routes and the seed cart both key on.
- **Nothing becomes a client component.** Every screen touched here stays a server component and every control stays a plain `<form>` or `<Link>`; the whole catalog must keep working with JavaScript disabled.
- Preserve `is_active` semantics: a public read never returns an inactive listing, and `/products/<inactive-slug>` must 404. The seller's own view of inactive listings is out of scope and stays on seed data.
- Preserve the filter contract exactly. Same query-param names, same parsing, same coercion of unparseable values to "absent". Keyword search matches name or description case-insensitively; category matches on slug; rating is a floor; the seller filter matches store name; availability filters on `inventory.stock_qty > 0`. A shared URL that works today must return the same products afterwards.
- Filtering and slug resolution happen **in the query, not in JavaScript**. Do not fetch the catalog and filter it in app code — that would defeat the indexes and quietly break as the catalog grows.
- The featured rail stays a presentation concern, per the existing decision in `.claude/specs/entity-architecture.md`: no `featured` column. Drive it from a slug list held in app code and query for those products.
- Delete `simulateLatency()` from every Supabase-backed path. Real queries suspend on their own, so the skeletons now have a real cause; it survives only in `seed-catalog.ts` for the cart and order reads that are still synchronous.
- Distinguish the three failure modes deliberately: a query error must **throw** so `app/error.tsx` catches it, a missing product must return null so the page can `notFound()`, and an empty result set must render the existing `EmptyState`. An error must never be swallowed into an empty grid — a broken database would look like a legitimately empty catalog.
- Keep `connection()` where the seed modules still call it. Do not add it to the Supabase-backed reads; uncached queries are dynamic already.
- Do not touch `app/cart/`, `app/checkout/`, `app/orders/`, `app/seller/` or their actions beyond the import updates named above. `CURRENT_SELLER_ID` survives this step untouched — retiring it belongs to step 04.
- Never edit an applied migration; add a new one. Never hand-edit `lib/types/database.ts`.
- Read `node_modules/next/dist/docs/` before writing route code, and use the generated `PageProps<"/route">` types rather than hand-written prop types.

## Definition of done

Verified by running the app, not by typecheck alone.

1. `npm run lint` and `npm run typecheck` both pass.
2. `npm run build` succeeds and every catalog route still reports as dynamic.
3. The migration is applied, mirrored into `supabase/migrations/`, and `mcp__supabase__get_advisors` reports no new `security` findings.
4. `supabase/tests/rls_verification.sql` runs green end to end — the schema changed, so it is re-run even though no policy did.
5. `lib/types/database.ts` is regenerated and shows `slug` on `products`.
6. **Home** (`/`) renders the 9 featured products, each card showing name, star rating, price, seller store name and an In Stock / Out of Stock signal, with the category chips populated from the database.
7. **Search** (`/search`) with no filters renders all 16 active products — the 17th (`motion-sensor-night-light`, `is_active = false`) appears nowhere.
8. Each filter narrows results correctly on its own and in combination: keyword, category chip, min/max price, rating floor, seller dropdown, and in-stock-only. The result count, the active-filter chips and the "Clear filters" link all reflect the applied filters.
9. A filtered URL that returns nothing (e.g. an impossible price range) renders the existing empty state with its "Clear filters" action, not a blank grid.
10. **Product detail** for a slug such as `premium-noise-cancelling-headphones` renders the gallery, description, category breadcrumb, star rating, buy box and the seller signal — with the seller's join year showing 2018–2022 from the backdated seed, not 2026.
11. `/products/motion-sensor-night-light` and `/products/does-not-exist` both render the 404 page.
12. A product with no images (`linen-blend-oxford-shirt`) renders the placeholder well rather than a broken image, and an out-of-stock product (`mechanical-keyboard-hot-swappable`) shows the Out of Stock signal and a disabled add-to-cart path.
13. Skeletons paint on `/`, `/search` and `/products/[id]` during a real query, and the skeleton shape matches the content that replaces it.
14. Pointing the app at unreachable Supabase credentials renders the error boundary with its "Try again" action on every catalog screen — never an empty product grid.
15. **Regression:** `/cart`, `/checkout`, `/orders`, `/orders/[id]`, `/seller`, `/seller/products` and `/seller/orders` all behave exactly as before, including adding a product to the cart from a detail page and advancing an order status as the seller.
16. Every catalog screen still works with JavaScript disabled in the browser.
17. Signed out and signed in as `homesafe@demo.market`, the catalog screens render identically — this step introduces no session-dependent behavior.
18. Screens are compared against the pre-swap build and match: same products, same order, same copy, same layout.
