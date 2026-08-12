# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Amazon-style multi-vendor ecommerce marketplace for physical goods. Buyers browse/search/cart/checkout/track; sellers manage listings and order status. No payments, reviews, or fulfillment in v1.

Intended stack: Next.js 16 (App Router, React 19, TypeScript) + Tailwind v4 + Supabase (Auth, Postgres, RLS, Storage).

## Current state — read this first

**The backend does not exist yet.** There is no `supabase` dependency, no `lib/supabase/`, no `supabase/migrations/`, no `.env*` files, no auth, and no payment processing. Every screen is driven by local seed data in `lib/data/`.

Routes that exist: `/`, `/search`, `/products/[id]`, `/cart`, `/checkout`, `/orders`, `/orders/[id]`, `/seller`, `/seller/products`, `/seller/orders`. Only `/sellers/[id]` (the public seller profile) from `.claude/specs/visual-architecture.md` is still unbuilt.

Steps completed: `01-product-browsing-and-detail` (catalog), `02-order-cart-and-checkout` (cart, checkout, orders, seller dashboard).

**`lib/data/` is the only data-access seam.** Screens call its exported helpers, never a raw array — swapping in Supabase should touch these four files and nothing else:

- `products.ts` — the seed catalog. `active: false` hides a listing from every public read; `findProduct` is the synchronous, `active`-ignoring lookup the other data modules hydrate through, and is not for use outside `lib/data/`.
- `cart.ts`, `orders.ts` — **mutable module-level state**. It survives navigation but resets when the server process restarts. Both call `connection()` from `next/server` before reading, which keeps the mutable reads out of the prerender pass; without it every screen would be baked at build time and frozen on the seed. This is why every route reports as dynamic (`ƒ`) in `next build`.
- `seller.ts` — derives the seller's view from the other two. `CURRENT_SELLER_ID` stands in for the session; replacing it is the whole seller-side auth swap.

Mutations go through Server Actions (`app/cart/actions.ts`, `app/checkout/actions.ts`, `app/seller/orders/actions.ts`), each ending in `revalidatePath("/", "layout")` — layout scope, because the header's cart badge would otherwise go stale. Every control is a plain `<form action={...}>`, so **nothing in the repo is a client component** except `app/error.tsx`, which the framework requires, and all interaction works with JavaScript disabled.

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
- Use the **custom type scale**, not Tailwind's: `text-display-lg`, `text-headline-md`, `text-title-lg`, `text-body-lg/md/sm`, `text-label-md/sm`. Each token bakes in its own weight and line-height. `app/page.tsx` still uses stock `text-2xl`/`text-sm` — that's the un-migrated stub, not the pattern to copy.
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
- Once Supabase exists: never hand-write DB types, regenerate via `supabase gen types typescript`.

## When the backend is added

These rules are not yet exercised by any code, but hold for the Supabase work:

- Data access goes through `lib/supabase/` helpers — no ad hoc `createClient()` calls in components.
- Client-exposed vars must be `NEXT_PUBLIC_` prefixed and may only ever carry the **anon** key. `SUPABASE_SERVICE_ROLE_KEY` must never take that prefix and must never be reachable from a client component or the browser bundle; it's for trusted server contexts that intentionally bypass RLS.
- Declare env vars in `.env.local` (gitignored) and document names-only in `.env.example`. A committed secret is a compromised secret: rotate in Supabase first, then scrub history.
- Every touched RLS policy must be verified against **both** an authorized and an unauthorized role before the change is called done.
- Cross-check new/changed entities against `.claude/specs/entity-architecture.md` and update that file if the schema diverges.

## Verification before reporting a change complete

1. `npm run lint` and `npm run typecheck` pass.
2. For UI changes, exercise the affected flow in the running dev server — not just type/lint checks.
3. RLS and entity checks above, once those layers exist.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
