# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Amazon-style multi-vendor ecommerce marketplace for physical goods. Buyers browse/search/cart/checkout/track; sellers manage listings and order status. No payments, reviews, or fulfillment in v1.

Intended stack: Next.js 16 (App Router, React 19, TypeScript) + Tailwind v4 + Supabase (Auth, Postgres, RLS, Storage).

## Current state — read this first

**The database exists, but nothing in the app talks to it yet.** Step 03 created the schema, auth and RLS on the remote Supabase project; the application is still driven entirely by local seed data in `lib/data/`. So there is a real Postgres backend *and* no `supabase` npm dependency, no `lib/supabase/`, no client, no session, and no payment processing. Both halves of that sentence matter — do not assume a screen reads from the database, and do not re-create schema that already exists.

Routes that exist: `/`, `/search`, `/products/[id]`, `/cart`, `/checkout`, `/orders`, `/orders/[id]`, `/seller`, `/seller/products`, `/seller/orders`. Only `/sellers/[id]` (the public seller profile) from `.claude/specs/visual-architecture.md` is still unbuilt.

Steps completed: `01-product-browsing-and-detail` (catalog), `02-order-cart-and-checkout` (cart, checkout, orders, seller dashboard), `03-supabase-schema-and-rls` (11 tables, email/password auth, RLS).

The database is also **populated**: `20260813101702_seed_marketplace_demo_data.sql` transcribes `lib/data/` into it one-for-one — the same 5 sellers, 17 products, images, stock and orders, plus one extra order so all four `order_status` values appear. Six demo accounts back it (`*@demo.market`, password in the migration header; see `.env.example`), `homesafe@demo.market` being the seller `CURRENT_SELLER_ID` stands in for. That mirroring is the point: after the step 04 swap the screens should render identically, so any visual difference is a bug in the swap. Product ids are `uuid_generate_v5` of the seed slug, so the mapping stays mechanical — but the app routes on slugs and `products` has no `slug` column, which step 04 must resolve either way (see the closing section of `.claude/specs/entity-architecture.md`).

Step 04 is the swap: install `@supabase/supabase-js` + `@supabase/ssr`, add `lib/supabase/` helpers, auth screens and session handling, then rewrite the `lib/data/` modules against real queries. Two things were deliberately deferred to it, and are decisions rather than gaps: decrementing `inventory.stock_qty` at checkout, and validating `price_at_purchase` against the live price. Both are transactional rather than row-scoped and belong in a database function.

**`lib/data/` is the only data-access seam.** Screens call its exported helpers, never a raw array — swapping in Supabase should touch these five files and nothing else:

- `products.ts` — the seed catalog, plus the `SELLERS` map. `active: false` hides a listing from every public read; `findProduct` is the synchronous, `active`-ignoring lookup the other data modules hydrate through, and is not for use outside `lib/data/`. Also exports `CURRENT_SELLER_ID` (`"homesafe"`), which stands in for the seller session — replacing it is the whole seller-side auth swap.
- `cart.ts`, `orders.ts` — **mutable module-level state**. It survives navigation but resets when the server process restarts. Their async reads call `connection()` from `next/server` first, which keeps the mutable reads out of the prerender pass; without it every screen would be baked at build time and frozen on the seed. This is why every route reports as dynamic (`ƒ`) in `next build`.
- `seller.ts` — derives the seller's view from the other two and stores nothing of its own, so a listing or status can never disagree between buyer and seller screens.
- `categories.ts` — the fixed v1 category set (`CATEGORIES`, `getCategoryBySlug`). Admin-seeded, no management UI.

Seed reads are synchronous, so nothing would suspend and `loading.tsx` would never paint. `simulateLatency()` in `products.ts` inserts a 600ms delay **in development only** to make the skeletons observable; production resolves immediately. It disappears with the seed layer.

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

`components/ui/` holds the primitives (`Button`, `Card`, `Badge`, `Skeleton`, `EmptyState`, `ErrorState`); `components/product|cart|orders|seller/` hold domain components. Compose from these rather than restyling from scratch — `.claude/specs/ui-architecture.md` documents the intended layout of each.

Loading states use **skeletons shaped like the real content** (`ProductCardSkeleton`), not spinners.

## TypeScript conventions

- Strict mode; no `any` — use `unknown` plus narrowing.
- Functional components only.
- Never hand-write DB types. `lib/types/database.ts` is generated (see "When the backend is added"); `lib/types/ui.ts` holds the separate, temporary presentational view-models.

## When the backend is added

A Supabase MCP server is wired up in `.mcp.json` (project `xzurhfeetpwthaswutnc`), so schema and log inspection go through the `mcp__supabase__*` tools — `list_tables` before any schema change, `apply_migration` (not `execute_sql`) for DDL, `get_advisors` after. It points at the **remote** project; there is no local Supabase stack and no Supabase CLI.

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
- Declare env vars in `.env.local` (gitignored) and document names-only in `.env.example`. A committed secret is a compromised secret: rotate in Supabase first, then scrub history.
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
