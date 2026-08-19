# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Amazon-style multi-vendor ecommerce marketplace for physical goods. Buyers browse/search/cart/checkout/track; sellers manage listings and order status. No payments, reviews, or fulfillment in v1.

Intended stack: Next.js 16 (App Router, React 19, TypeScript) + Tailwind v4 + Supabase (Auth, Postgres, RLS, Storage).

## Current state — read this first

**Everything talks to the database now — auth, the public catalog, the cart, buyer checkout, and the seller side.** Step 05 connected Supabase Auth — there is a real session, cookie-backed and refreshed in `proxy.ts` — step 06 repointed the public catalog (home, search, filters, categories, product detail) at Postgres, step 07 moved the cart onto the `carts`/`cart_items` tables with a real "Add to Cart", step 08 moved buyer checkout and order history onto `orders`/`order_items`/`order_status_events` with a real, atomic "Place Order", and step 09 finished the loop: `/seller`, `/seller/products`, `/seller/orders`, `lib/data/seller.ts`, and the seller-facing half of `lib/data/orders.ts` now run live queries too, gated on a signed-in `role = 'seller'` profile. Do not assume a screen reads from seed data, and do not re-create the schema, the auth layer, the catalog queries, the cart queries, or the checkout function, which already exist.

`CURRENT_SELLER_ID` and `lib/data/seed-catalog.ts` are gone — step 09 was the last consumer. A user signed in as `homesafe@demo.market` now sees `/seller` list HomeSafe's products because the session says so, resolved through `requireSellerProfile()` in `lib/supabase/session.ts`.

**`lib/data/` is now entirely live Supabase queries** — no seed modules remain:

- `products.ts`, `categories.ts`, `cart.ts` — public catalog reads run as `anon`, filtered by RLS rather than application code; cart reads and writes run as `authenticated`, scoped by the owner-only `carts`/`cart_items` policies from step 03.
- `orders.ts` — the buyer-facing half (`getOrders`, `getOrderById`, `getCheckoutAddress`, `createOrderFromCart`) and the seller-facing half (`advanceOrderStatus`) are both live, described below.
- `seller.ts` — live, described below.

Routes that exist: `/`, `/search`, `/products/[id]`, `/cart`, `/checkout`, `/orders`, `/orders/[id]`, `/seller`, `/seller/products`, `/seller/orders`, plus `/signin`, `/signup`, `/account` and the `/signout` action. Only `/sellers/[id]` (the public seller profile) from `.claude/specs/visual-architecture.md` is still unbuilt.

Steps completed: `01-product-browsing-and-detail` (catalog), `02-order-cart-and-checkout` (cart, checkout, orders, seller dashboard), `03-supabase-schema-and-rls` (11 tables, email/password auth, RLS), `05-supabase-auth-integration` (client, session, auth screens, profile shell), `06-use-supabase-data` (public catalog reads on Postgres, `products.slug`), `07-implement-cart` (cart reads/writes on Postgres, gated `/cart`, working "Add to Cart"), `08-implement-checkout` (buyer checkout and order history on Postgres, gated `/checkout` `/orders` `/orders/[id]`, atomic "Place Order" via the `checkout_cart` database function), `09-seller-dashboard-data-swap` (seller listings and order queue on Postgres, gated `/seller` `/seller/products` `/seller/orders`, a persisted seller status advance reflected on the buyer's `/orders/[id]`). **Step 04 is now fully absorbed** — it was specced before 05 and originally owned the auth work; step 06 took its catalog half, step 07 took its cart half, step 08 took the buyer half of orders, and step 09 took the seller half it was left with. See the scope-change note at the top of `.claude/specs/04-supabase-data-layer-swap.md`.

The database is also **populated**: `20260813101702_seed_marketplace_demo_data.sql` transcribes the original seed one-for-one — the same 5 sellers, 17 products, images, stock and orders, plus one extra order so all four `order_status` values appear. Six demo accounts back it (`*@demo.market`, shared password in the migration header). A follow-up migration, `20260813101800_backdate_demo_account_created_at.sql`, repairs `profiles.created_at` and `seller_profiles.created_at` from `auth.users.created_at`, because the signup trigger writes only `(user_id, display_name)` and left every storefront reporting a 2026 join year; it is idempotent and scoped to `@demo.market`. Product ids are `uuid_generate_v5` of the seed slug, so the mapping stays mechanical. Step 06 resolved the slug question by adding `products.slug` (`20260813142414_add_product_slug.sql`), backfilled by recomputing that same expression: the routes keep their slugs and the uuid stays behind the `lib/data/` seam.

**The catalog layer, added in step 06:**

- `lib/data/products.ts` — `getFeaturedProducts`, `getProductById` (the id is a **slug**), `searchProducts`, `getSellerNames`, `getProductRef`, plus the pure filter parsing. `Product.id` carries the slug, never the uuid, because the routes and `lib/data/cart.ts` both key on it — `getProductRef` is the one deliberate exception, resolving a slug to the real database id for `cart_items.product_id`.
- Every filter runs **in the query**. Embedded filters need `!inner` or PostgREST filters the embedded rows and still returns the parent — an out-of-stock product would come back with an empty `inventory` instead of being excluded. A keyword goes through `sanitizeKeyword` first: `%` and `_` are LIKE wildcards and `,` `(` `)` are PostgREST's own filter delimiters, so an unescaped keyword changes what the filter *means*.
- A select may not name the same embedded table twice — the card and detail views need different `seller_profiles` columns, so the embed is appended per query rather than shared.
- Ordering is `created_at`, which the seed staggered in catalog order. Two things that look like data are deliberately **not** columns and live in app code: the homepage `featured` list, and `CATEGORY_ORDER` (the chip row is curated, not alphabetical). See the closing section of `.claude/specs/entity-architecture.md`.
- Query errors **throw** so `app/error.tsx` catches them; a missing product returns null so the page can `notFound()`. Never let a failure degrade into an empty grid — a broken database must not render as an empty catalog.
- `app/loading.tsx` exists because the homepage now suspends on a real query.

**The cart layer, added in step 07:**

- `lib/data/cart.ts` — `getCart`, `getCartCount`, `setLineQuantity`, `removeLine`, `clearCart`, and `addToCart` (new — the button was previously inert). One `carts` row per profile (`carts.profile_id` is unique), found on read and created lazily on the first write; `getCart`/`getCartCount` return an empty result when signed out rather than throwing, since `/checkout` isn't gated yet and still calls through here.
- Adding a product already in the cart increments its existing `cart_items` row (`unique (cart_id, product_id)`) rather than inserting a duplicate; every quantity write clamps to `[1, inventory.stock_qty]` server-side, not just via the disabled "Add to Cart" button.
- Every read and write relies on the owner-only RLS from step 03 (`carts_*_own`, `cart_items_*_own`, bound through `owns_cart()`) rather than an application-level ownership check.
- `/cart` gates on `requireProfile()`, same pattern as `/account`; the cart Server Actions (`app/cart/actions.ts`, `app/products/[id]/actions.ts`) each call it too, so a signed-out submission redirects to `/signin` before any mutator runs.

**The checkout layer, added in step 08:**

- The write is a single Postgres function, not a sequence of `lib/data/` calls: `private.checkout(profile_id, shipping_address)` locks the cart's `inventory` rows (`for update`), fails the whole transaction if any line's quantity exceeds current stock, then inserts the `orders`/`order_items`/opening `order_status_events` rows, decrements `inventory.stock_qty`, and deletes the `cart_items` — all or nothing. A buyer's session cannot legally write `inventory` (sellers own it per RLS), so the decrement can only happen inside a `SECURITY DEFINER` function; doing the whole write there is what keeps two concurrent checkouts on the last unit from overselling it. `public.checkout_cart(shipping_address)` is the thin, deliberately-exposed wrapper — it resolves the caller's own profile from `private.current_profile_id()`, never from a client-supplied id, and `EXECUTE` is granted to `authenticated` only. Both live in `supabase/migrations/20260819135253_checkout_function.sql`.
- `lib/data/orders.ts#createOrderFromCart` is a single `supabase.rpc("checkout_cart", …)` call. A stock-shortfall or empty-cart failure from the function is the existing "nothing to order" case (returns null, same as before); anything else throws.
- `price_at_purchase` is read from `products` inside the function, never passed in — a later price change cannot rewrite what a buyer is charged for an in-flight checkout, and there is nothing to validate against a stale client value because none is ever sent.
- `getOrders`/`getOrderById` are live reads scoped by the owner-or-order-seller RLS from step 03 (`orders_select_participant`); an order belonging to another buyer and a nonexistent order id are indistinguishable — both return null so the page can `notFound()`.
- No `order_number` column exists (see `.claude/specs/entity-architecture.md`); `orderNumber` is derived from the order id (`#` + its first 8 hex characters), not stored. `shipping_address` is a single `text` column, so the four-line `BUYER_ADDRESS` display constant is joined with `"\n"` on write and split back on read — display-only, not a new address system.
- `/checkout`, `/orders`, `/orders/[id]` gate on `requireProfile()`; `placeOrder` in `app/checkout/actions.ts` calls it too, so a signed-out submission redirects to `/signin` before the transaction runs.

**The seller layer, added in step 09:**

- `lib/supabase/session.ts#requireSellerProfile` — calls `requireProfile()` first (redirect to `/signin` when signed out), then returns `null` when `role !== 'seller'` rather than redirecting, so `/seller`, `/seller/products`, `/seller/orders` can render `SellerAccessDenied` instead of a redirect loop for a signed-in buyer. On success it resolves the caller's own `seller_profiles` row (`id`, `store_name`) in the same call, since every seller query needs `sellerProfileId`.
- `lib/data/seller.ts` — `getSellerListings`, `getSellerOrderItems`, `getSellerStats`, all taking `sellerProfileId` explicitly rather than reading it from a module constant. Stores nothing of its own, so a listing or a status can never disagree between the buyer's screens and the seller's. `getSellerListings` reads a seller's own `products` rows including inactive ones (`products_select_visible` already permits this for the owner); `getSellerOrderItems` reads `order_items` filtered to the caller's `seller_profile_id`, flattened to line-item granularity so an order spanning two sellers contributes only this seller's rows.
- **The seller's queue needs the buyer's name, but can't read their `profiles` row** — `profiles_select_own` RLS means a seller may only ever see their own profile. `customerName` is instead the first line of `orders.shipping_address` (the recipient name `BUYER_ADDRESS[0]` is joined into it at checkout, per the checkout layer above), which the seller can already read as an order participant. No new policy was needed for this step.
- `lib/data/orders.ts#advanceOrderStatus(changedByProfileId, orderId)` — a plain two-step authenticated write, not a privileged function like checkout: a seller's own session already has direct RLS grants for both statements (`orders_update_status_by_seller` plus the `update (status)` column grant, and `order_status_events_insert_participant`). It selects the current status, computes the next step, updates `orders.status` with `.select().maybeSingle()` so a zero-row result (RLS silently denying a non-participant) is a no-op rather than an error, then inserts the `order_status_events` row.
- `/seller`, `/seller/products`, `/seller/orders` gate on `requireSellerProfile()`; `advanceStatus` in `app/seller/orders/actions.ts` calls it too. `app/layout.tsx`'s nav only shows the seller links to a signed-in seller.

**The auth layer, added in step 05:**

- `lib/supabase/server.ts` — the only place a server client is constructed, one per request. Its `setAll` swallows the cookie-write failure that a Server Component render always produces; that is safe *only because* `proxy.ts` refreshes on every request.
- `lib/supabase/session.ts` — `getSessionUser`, `getCurrentProfile`, `requireProfile`, and `requireSellerProfile` (step 09, described below). Always `getUser()`, never `getSession()`, for anything gating access: the latter trusts the cookie without verifying it.
- `proxy.ts` — session refresh only, never authorization. Next 16 renamed `middleware.ts` to `proxy.ts`, the export is `proxy`, and setting a `runtime` key **throws**. Supabase's published SSR guides still say middleware and are wrong here. Server Actions are POSTs to their own route, so a matcher exclusion silently skips them — every real gate lives in the page or action.
- Auth screens are plain `<form action={...}>` with no client component, so they work with JavaScript off. Failures redirect with an *opaque* code (`?error=invalid`) rather than using `useActionState`, which would require going client-side; sign-in gives one message for both wrong-password and no-such-user so it cannot be used to enumerate accounts.
- `.env` and `.env.example` carry only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`. No application code reads `SUPABASE_SERVICE_ROLE_KEY`, and none should.

**`lib/data/` is the only data-access seam.** Screens call its exported helpers, never a raw array and never a query of their own — no page or component may construct a Supabase client:

- `products.ts` — **live.** The public catalog, described above.
- `categories.ts` — **live.** The fixed v1 category set (`getCategories`, `getCategoryBySlug`, both async now). Admin-seeded, read-only, no management UI. `getCategories` is wrapped in React `cache()` so a page rendering both the chips and a slug lookup issues one query per request.
- `cart.ts` — **live.** The buyer's cart, described above.
- `orders.ts` — **live.** `getOrders`, `getOrderById`, `getCheckoutAddress`, `createOrderFromCart` (buyer-facing) and `advanceOrderStatus` (seller-facing), both described above. `/orders`, `/orders/[id]`, `/seller/orders` report dynamic (`ƒ`) in `next build` because their reads are live queries.
- `seller.ts` — **live.** `getSellerListings`, `getSellerOrderItems`, `getSellerStats`, described above. Derives the seller's view from `products`, `order_items` and `orders`, and stores nothing of its own, so a listing or status can never disagree between buyer and seller screens.

Nothing in `lib/data/` reads seed data any more — `lib/data/seed-catalog.ts` was deleted in step 09 once `lib/data/seller.ts` was its last consumer. The live catalog, cart and seller reads all suspend on their own; no `loading.tsx` needs a manual delay.

Mutations go through Server Actions (`app/cart/actions.ts`, `app/checkout/actions.ts`, `app/seller/orders/actions.ts`), each ending in `revalidatePath("/", "layout")` — layout scope, because the header's cart badge would otherwise go stale. Header, nav, and footer are written inline in `app/layout.tsx`; there is no `components/layout/`. Every control is a plain `<form action={...}>`, so **nothing in the repo is a client component** except `app/error.tsx`, which the framework requires, and all interaction works with JavaScript disabled.

Order status lives on the order, not on its line items, per the RLS note in `.claude/specs/entity-architecture.md`. That is why a seller advancing a status on `/seller/orders` changes what the buyer sees on `/orders/[id]`.

`lib/types/ui.ts` holds temporary presentational view-models (`Product`, `CartLine`, `OrderDetail`, `SellerListingRow`, `OrderStatus`, …) plus `formatPrice`. These are *not* database types; they get replaced by Supabase-generated types when the backend lands.

## Commands

```bash
npm run dev        # dev server
npm run build      # production build
npm run start      # serve production build
npm run lint       # ESLint (flat config, eslint-config-next)
npm run typecheck  # tsc --noEmit
```

Run `npm run lint && npm run typecheck` before considering any change complete.

**There is no test suite.** `npm test` is the default `exit 1` stub — do not run it or claim tests pass. If you add tests, wire up a real runner and update this section.

## Specs are the source of truth for unbuilt work

Before any structural change, read the relevant spec. They are detailed and authoritative:

- `SPEC.md` — product scope, non-goals, acceptance criteria, verification plan
- `.claude/specs/visual-architecture.md` — every screen, its route, entities touched, and auth requirement
- `.claude/specs/entity-architecture.md` — full ERD: 10 entities, fields, relationships, RLS intent
- `.claude/specs/ui-architecture.md` — design tokens, type scale, and per-component layout rules
- `plan/` — scoping documents behind the specs

The numbered step specs in `.claude/specs/` are the per-step contracts. `01`–`03` and `05`–`09` are built. `04-supabase-data-layer-swap.md` **overlapped** spec 05 — spec 04 was written first and originally claimed the auth work (sign-in/up/out routes, `lib/supabase/`, `proxy.ts`); spec 05 later carved that out. Spec 04's own remaining scope (the seller-side data swap) was in turn absorbed piece by piece into 06, 07, 08 and finally `09-seller-dashboard-data-swap.md`, which closed it out. Read spec 04's scope-change note for the full history if working near this seam.

Note: `SPEC.md` and the header comment in `lib/types/ui.ts` still reference the old `specs/` path; these files moved to `.claude/specs/` in commit `a0c666b`.

New feature specs are created via the `/create-spec` slash command (`.claude/commands/create-spec.md`), which cuts a `claude/feature/<slug>` branch and writes `.claude/specs/<step>-<slug>.md` from `.claude/specs/template.md`. It aborts if the working tree is dirty.

## Next.js 16 specifics

The `node_modules/next/dist/docs/` guides are authoritative over training data — read them before writing route code.

- Route components use the **globally-generated typed props**: `LayoutProps<"/">`, `PageProps<"/route">`. See `app/layout.tsx`. Do not hand-write `{ params, children }` prop types.
- Server Components by default; `"use client"` only where interactivity requires it. Nothing in the repo is a client component yet.
- Prefer server-side data fetching over client `useEffect` for initial page data.
- Import alias is `@/*` → repo root (e.g. `@/components/product/ProductCard`, `@/lib/types/ui`).

## Styling — Tailwind v4, tokens only

**Tailwind v4 has no `tailwind.config.js`. Do not create one.** All design tokens are CSS variables in the `@theme` block of `app/globals.css`, which generates the utility classes.

Consequences for writing markup:

- Use **semantic token classes**, not raw Tailwind palette: `bg-canvas`, `bg-surface`, `text-text-muted`, `border-border`, `text-link`, `text-success`, `text-error`. There is no `bg-gray-100` in this design system.
- Use the **custom type scale**, not Tailwind's: `text-display-lg`, `text-headline-md`, `text-title-lg`, `text-body-lg/md/sm`, `text-label-md/sm`. Each token bakes in its own weight and line-height, so do not pair them with `font-*` or `leading-*` utilities.
- `bg-accent` (amber `#ff9900`) is **reserved for conversion CTAs only** (Add to Cart, Place Order). Never for body text or decorative fill.
- Design is **light-mode only**. No dark palette exists; do not add `dark:` variants.
- Every interactive element needs a ≥44px hit area — use `h-touch` / `w-touch`. `Button` already does.
- Sticky/fixed regions use the `safe-px` / `safe-pb` utilities defined in `globals.css`.
- Page width is capped via `max-w-(--container-page)` (1440px) with `px-4` mobile / `md:px-6` desktop.

## Components

`components/ui/` holds the primitives (`Button`, `Card`, `Badge`, `Skeleton`, `EmptyState`, `ErrorState`, `Field` — the labelled input the auth forms use, whose `id` prop is required so labels always have a target); `components/product|cart|orders|seller/` hold domain components. Compose from these rather than restyling from scratch — `.claude/specs/ui-architecture.md` documents the intended layout of each.

Loading states use **skeletons shaped like the real content** (`ProductCardSkeleton`), not spinners.

## TypeScript conventions

- Strict mode; no `any` — use `unknown` plus narrowing.
- Functional components only.
- Never hand-write DB types. `lib/types/database.ts` is generated from the live schema and already committed (step 03) — regenerate it, don't edit it (see "When the backend is added"). `lib/types/ui.ts` holds the separate, temporary presentational view-models. `lib/supabase/server.ts` types its client with `Database` from `lib/types/database.ts`; every `lib/data/` module goes through that client, so the generated types are load-bearing end to end.

## When the backend is added

A Supabase MCP server is wired up in `.mcp.json` (project `xzurhfeetpwthaswutnc`). Note that `.gitignore` lists `.mcp.json`, so it is **not checked in** — a fresh clone has no MCP server until the file is recreated locally. Schema and log inspection go through the `mcp__supabase__*` tools — `list_tables` before any schema change, `apply_migration` (not `execute_sql`) for DDL, `get_advisors` after. It points at the **remote** project; there is no local Supabase stack and no Supabase CLI.

**Migration workflow.** Apply through `apply_migration`, then mirror the exact SQL into `supabase/migrations/<version>_<name>.sql` in the same change — the tool records history remotely, and committing the SQL is what makes the schema reviewable in a diff. Never edit an applied migration; add a new one.

**Schema facts worth knowing before you touch it:**

- Ownership predicates live in `private`, not `public`. Anything in `public` is published by PostgREST as `/rest/v1/rpc/<name>`, so a helper there is callable by `anon` — the linter flags it. Their bodies pin `search_path = ''` and so must qualify every reference, including calls to each other.
- RLS policies bind functions by OID, so they survive a schema move; function *bodies* do not, because their inner calls are written by name. That is what `20260812154313_repoint_rls_helper_bodies_to_private.sql` exists to fix.
- Policies are per-operation and name their roles, and every helper call is wrapped as `(select fn())` so the planner caches it as an initPlan instead of running per row. Both are `get_advisors` findings if you skip them.
- `orders` carries a column grant (`update (status)` only), because RLS gates rows and not columns. Without it the seller update policy would also permit rewriting `shipping_address`.
- `get_advisors` still reports `public.rls_auto_enable` — that is Supabase's own platform event-trigger, not ours, and not ours to remove.

`supabase/tests/rls_verification.sql` proves all 51 allow/deny cases. It runs inside a single transaction ending in `ROLLBACK`, creating and discarding its own `auth.users` fixtures, so it is safe to re-run against the live project. Run it after any policy change. Note that a denial assertion treats an error as a pass, so it deliberately fails on `does not exist` — otherwise a broken reference would masquerade as good security.

- Data access goes through `lib/supabase/` helpers — no ad hoc `createClient()` calls in components.
- Never hand-write DB types. Regenerate `lib/types/database.ts` via `mcp__supabase__generate_typescript_types` and commit it unmodified — no header comments, so the next regeneration is a clean overwrite.
- Client-exposed vars must be `NEXT_PUBLIC_` prefixed and may only ever carry the **anon** key. `SUPABASE_SERVICE_ROLE_KEY` must never take that prefix and must never be reachable from a client component or the browser bundle; it's for trusted server contexts that intentionally bypass RLS.
- Env vars live in `.env` in this repo (not `.env.local`). `.gitignore` matches `.env*` with a single negation for `!.env.example`, the names-only template, which step 05 recreated after `36c0837` deleted it — it is checked in and is the record of which names are required. A committed secret is a compromised secret: rotate in Supabase first, then scrub history.
- Every touched RLS policy must be verified against **both** an authorized and an unauthorized role before the change is called done.
- Cross-check new/changed entities against `.claude/specs/entity-architecture.md` and update that file if the schema diverges.

## Verification before reporting a change complete

1. `npm run lint` and `npm run typecheck` pass.
2. For UI changes, exercise the affected flow in the running dev server — not just type/lint checks.
3. For schema changes: `supabase/tests/rls_verification.sql` fully passing, `get_advisors` clean for `security`, and `.claude/specs/entity-architecture.md` updated to match.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
