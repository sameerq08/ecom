# Spec for supabase-data-layer-swap

branch: claude/feature/supabase-data-layer-swap

## Overview

Point the application at the database. Steps 01 and 02 built every screen against local seed modules in `lib/data/`; step 03 built the schema, auth and RLS; the seed commit filled that schema with the same marketplace those modules describe. This step closes the loop: install the Supabase client, add session handling and the auth screens the app has never had, and rewrite the five `lib/data/` modules so their exported helpers run real queries instead of reading arrays.

The seam was designed for exactly this. Screens call `lib/data/` helpers and never touch an array directly, so the swap should change those five files, add `lib/supabase/`, and leave the components alone. Two things make it more than a mechanical rewrite. First, there is no session today — `CURRENT_SELLER_ID` is the string `"homesafe"`, and cart and order state live in mutable module-level variables that reset when the server restarts; replacing both means the app finally has real users, and every RLS policy written in step 03 starts doing load-bearing work. Second, two operations deliberately deferred from step 03 come due here: decrementing `inventory.stock_qty` at checkout and validating `price_at_purchase` against the live price. Both are transactional rather than row-scoped, so neither belongs in a policy or in a sequence of client calls.

Success is defined by sameness. The seed data mirrors `lib/data/` one-for-one, so once the swap lands the screens should render what they render today. Any visual difference is a bug in the swap, not new behavior — which is why this spec asks for a before/after comparison rather than only a green typecheck.

> **Scope change — auth moved to step 05.** This spec was written before
> `.claude/specs/05-supabase-auth-integration.md` existed and originally owned
> the whole auth swap. Step 05 has since taken it: the `@supabase/*`
> dependencies, `lib/supabase/server.ts`, `lib/supabase/session.ts`, `proxy.ts`,
> the `/signup`, `/signin`, `/signout` and `/account` routes, and the header's
> auth state are all **built already** and are not this step's work. What
> remains here is the data swap itself. Sections below that still describe
> creating auth screens or session helpers are superseded by step 05; where
> this spec says "add session handling", read "use the session helpers step 05
> built".

## Depends on

- **Step 05 (`.claude/specs/05-supabase-auth-integration.md`) — the session this step's queries run as.** `getCurrentProfile()` and `requireProfile()` in `lib/supabase/session.ts` are the seam to extend with a seller-profile lookup when replacing `CURRENT_SELLER_ID`.
- Step 01 (`.claude/specs/01-product-browsing-and-detail.md`) and step 02 (`.claude/specs/02-order-cart-and-checkout.md`) — the screens and the `lib/data/` seam being rewritten.
- Step 03 (`.claude/specs/03-supabase-schema-and-rls.md`) — the eleven tables, the signup trigger, and the policies this step's queries run under.
- The seed commit (`supabase/migrations/20260813101702_seed_marketplace_demo_data.sql` and `20260813101800_backdate_demo_account_created_at.sql`) — the rows the rewritten helpers read, and the six `*@demo.market` accounts used to exercise the signed-in paths. **Note this branch was cut from `claude/feature/seed-marketplace-demo-data`, not from `main`, because that work is not yet merged.**
- `lib/types/database.ts` — already generated and committed in step 03. It must be regenerated only if this step changes the schema.
- A populated `.env.local` carrying the project URL and anon key. Names are documented in `.env.example`.

## Routes

Existing routes keep their paths and their rendering. What changes is that reads hit Postgres and the buyer-scoped ones now require a session.

New: none. `/signin`, `/signup`, `/signout` and `/account` were built in step 05.

Access levels for existing routes, per the Auth Requirement column in `.claude/specs/visual-architecture.md`:

- `/`, `/search`, `/products/[id]` — public, unchanged
- `/cart`, `/checkout`, `/orders`, `/orders/[id]` — logged-in; unauthenticated visitors redirect to `/signin`
- `/seller`, `/seller/products`, `/seller/orders` — logged-in **and** `role = 'seller'`; buyers get a 403-style empty state rather than a redirect loop

`/sellers/[id]`, the public seller profile, remains the one screen in `.claude/specs/visual-architecture.md` never built. It is **out of scope here** — this step is the data swap, not new screens — and should be its own step.

The auth routes are already recorded in `.claude/specs/visual-architecture.md`, added by step 05.

## Database changes

No new tables and no policy changes. Two additions, both because the operation spans rows and must be atomic:

- **A checkout function.** Placing an order currently writes an order, its items, and an opening status event, and must also decrement `inventory.stock_qty` and confirm each line's price still matches the product. Done as separate client calls, a concurrent order can oversell stock, and a price change between cart and confirmation is invisible. This belongs in one `SECURITY DEFINER` function that takes the cart, re-reads prices, checks stock, writes all four row sets, and fails the whole thing if any line is short. It must live in `private` and be exposed deliberately, not dropped into `public` where PostgREST publishes it to `anon` — the constraint CLAUDE.md records and `20260812154148_move_rls_helpers_to_private_schema.sql` exists to fix. Pin `search_path = ''` and qualify every reference.
- **A product slug.** `/products/[id]` routes on slugs like `premium-noise-cancelling-headphones`, but `products` is keyed by uuid. Add a unique `slug` column and backfill it, or move the route to uuids. Adding the column is preferred: the URLs are already public and readable, and the seed derived each uuid as `uuid_generate_v5` of the slug, so the backfill is verifiable rather than guesswork. Whichever way, `.claude/specs/entity-architecture.md` records this as an open decision and must be updated to match.

Both go through `mcp__supabase__apply_migration`, mirrored into `supabase/migrations/`. Run `supabase/tests/rls_verification.sql` and `get_advisors` afterwards; regenerate `lib/types/database.ts` and commit it unmodified.

## Templates

This project has no template directory — screens are React Server Components under `app/`.

Create:

- `app/signin/page.tsx`, `app/signup/page.tsx` — email/password forms, plain `<form action={...}>` like every other control in the repo
- `app/signin/actions.ts`, `app/signup/actions.ts`, `app/signout/actions.ts` — the auth Server Actions

Modify:

- `app/layout.tsx` — the header gains auth state: display name and sign-out when signed in, a sign-in link when not. Header, nav and footer stay inline here; do not extract a `components/layout/`.
- `app/seller/page.tsx`, `app/seller/products/page.tsx`, `app/seller/orders/page.tsx` — read the seller from the session instead of `CURRENT_SELLER_ID`
- `app/cart/page.tsx`, `app/checkout/page.tsx`, `app/orders/page.tsx`, `app/orders/[id]/page.tsx` — gate on a session
- `app/products/[id]/page.tsx` — only if the slug decision changes how the param resolves

Every other component under `components/` should be untouched. Needing to edit one is a signal the rewritten helper is returning a different shape than the view-model promised.

## Files to change

- `lib/data/products.ts` — replace `SEED` and `SELLERS` with queries. `getProductById`, `searchProducts` and `getFeaturedProducts` filter on `is_active`; `getSellerListings` returns the owner's view including inactive rows. `simulateLatency()` disappears with the seed layer — real queries suspend on their own, so `loading.tsx` paints without help. `findProduct` was the synchronous internal lookup other modules hydrated through; it cannot stay synchronous and its callers must change with it. `featured` has no column: keep it derived in app code, per the closing section of `.claude/specs/entity-architecture.md`.
- `lib/data/cart.ts` — module-level state becomes `carts` / `cart_items` scoped to the signed-in profile. The `connection()` call that kept mutable reads out of the prerender pass is no longer needed for that reason, but reads are still per-user and must not be statically cached.
- `lib/data/orders.ts` — same, against `orders`, `order_items` and `order_status_events`. `createOrderFromCart` becomes a call to the checkout function above. `getCheckoutAddress` currently returns a hardcoded address constant; decide whether the address comes from the profile or stays a form field, and say so.
- `lib/data/seller.ts` — derives from the other two and stores nothing; it should need the least work, but its inputs are now async.
- `lib/data/categories.ts` — `CATEGORIES` and `getCategoryBySlug` read from the `categories` table. Both are currently synchronous and used as such.
- `app/cart/actions.ts`, `app/checkout/actions.ts`, `app/seller/orders/actions.ts` — keep the `revalidatePath("/", "layout")` ending; layout scope is what stops the header's cart badge going stale.
- `lib/types/ui.ts` — the view-models stay as the presentational layer, but the header comment describing them as temporary stand-ins for database types needs revisiting now that `lib/types/database.ts` is real. It also still references the old `specs/` path.
- `.env.example`, `CLAUDE.md`, `.claude/specs/visual-architecture.md`, `.claude/specs/entity-architecture.md` — documentation.

## Files to create

- `supabase/migrations/<version>_<name>.sql` — one per change in "Database changes"

`lib/supabase/server.ts`, `lib/supabase/session.ts` and `proxy.ts` already exist (step 05) — extend them, do not recreate them. `lib/supabase/client.ts` was deliberately not created: nothing in the repo is a client component except `app/error.tsx`. Do not add it speculatively.

## New dependencies

None. `@supabase/supabase-js` and `@supabase/ssr` were installed in step 05. No test runner is added here; `npm test` remains the `exit 1` stub, and nothing in this step may claim tests pass.

## Rules for implementation

- **Use CSS variables — never hardcode hex values.** Semantic token classes only (`bg-canvas`, `bg-surface`, `text-text-muted`, `border-border`, `text-link`, `text-success`, `text-error`) and the custom type scale (`text-title-lg`, `text-body-md`, `text-label-sm`, …), which bakes in its own weight and line-height, so never pair it with `font-*` or `leading-*`. There is no `tailwind.config.js` in Tailwind v4 and none may be created. `bg-accent` stays reserved for conversion CTAs. Light mode only — no `dark:` variants. The new auth screens are the risk here: they are the first new screens since the design system was written.
- **No ad hoc `createClient()`.** All access goes through `lib/supabase/`.
- **The anon key is the only key the browser may ever see.** `SUPABASE_SERVICE_ROLE_KEY` must never take a `NEXT_PUBLIC_` prefix, never be imported into a client component, and never appear in the browser bundle. Prefer never needing it: if a query only works with the service role, the policy is probably wrong.
- **Do not weaken RLS to make a query work.** Every touched policy is verified against both an authorized and an unauthorized role before the change is called done.
- **Keep it server-rendered.** Nothing in the repo is a client component except `app/error.tsx`, every control is a plain `<form action={...}>`, and the whole app works with JavaScript disabled. Auth must not break that — no client-side redirect-on-mount session handling.
- **Route props come from the generated types** (`PageProps<"/products/[id]">`, `LayoutProps<"/">`); do not hand-write `{ params }` types.
- Strict TypeScript, no `any`. Never hand-write database types — regenerate `lib/types/database.ts` and commit it unmodified, with no added header comments.
- Read `node_modules/next/dist/docs/` before writing route, proxy, or auth code. It is authoritative over training data, and this is a version with renamed conventions.
- Loading states stay skeletons shaped like the real content, never spinners.
- One migration per logical concern, applied via `apply_migration` and mirrored into `supabase/migrations/`. Never edit an applied migration.

## Definition of done

Data layer:

1. `grep -r "SEED\|CURRENT_SELLER_ID\|simulateLatency" lib/ app/` returns nothing — the seed arrays and the fake session are gone, not merely unused.
2. `npm run lint && npm run typecheck` pass.
3. `npm run build` succeeds and every route still reports dynamic (`ƒ`); no buyer-scoped page is statically prerendered.

Parity — run the dev server and compare against the current seed-driven screens:

4. `/` shows the same featured products in the same order.
5. `/search` with no filters lists 16 products; `motion-sensor-night-light` never appears. Filtering by category, price, rating, seller and in-stock each return what they return today.
6. `/products/premium-noise-cancelling-headphones` (or its post-slug-decision URL) shows £299, 4.5 stars, 3 gallery images, seller "Acoustic Pro Direct", member since 2019, in stock.
7. The Linen-Blend Oxford Shirt detail page renders its no-image fallback rather than a broken image.
8. The three zero-stock products still show as out of stock and cannot be added to the cart.

Auth gating (the auth *mechanism* itself was proven in step 05; what remains is applying it to the existing screens):

9. ~~Signing up creates an `auth.users` row and one `profiles` row at role `buyer`.~~ — done in step 05.
10. ~~Signing in as `homesafe@demo.market` shows the display name in the header.~~ — done in step 05.
11. Visiting `/cart`, `/checkout`, `/orders` or `/orders/[id]` signed out redirects to `/signin`. **Still outstanding** — step 05 deliberately left these ungated while they read the seed layer.
12. A signed-in buyer visiting `/seller` gets a role-denied state, not a crash and not a redirect loop. **Still outstanding**, same reason.

Buyer flow, signed in as `jane@demo.market`:

13. Adding to the cart persists across a **server restart** — the regression the module-level state made impossible.
14. `/orders` lists her four seeded orders with statuses pending, confirmed, shipped and delivered; each total matches the seed (106.50, 69.90, 348.99, 109.00).
15. `/orders/[id]` for the delivered order shows a four-step timeline built from `order_status_events`, not inferred from the current status.
16. Placing a real order decrements `inventory.stock_qty` by the ordered quantity, verified by querying `inventory` before and after.
17. Two concurrent checkouts of the last remaining unit result in one success and one clean failure — never negative stock.

Seller flow, signed in as `homesafe@demo.market`:

18. `/seller/products` lists 6 listings including the inactive Motion Sensor Night Light; signed out, `/search` still shows only 16 products.
19. `/seller/orders` shows only HomeSafe's own line items — on the two-seller pending order, the security camera and not the headphones.
20. Advancing a status there changes what `/orders/[id]` shows for Jane, and appends an `order_status_events` row attributed to HomeSafe.
21. Signed in as `keyforge@demo.market`, HomeSafe's listings are not editable and its orders are not visible.

Database:

22. `supabase/tests/rls_verification.sql` passes in full.
23. `mcp__supabase__get_advisors` is clean for `security`, apart from the known `public.rls_auto_enable` platform trigger.
24. `.claude/specs/entity-architecture.md` and `.claude/specs/visual-architecture.md` match what was built — the slug decision recorded, the auth routes added.
