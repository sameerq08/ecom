# Spec for implement-cart

branch: claude/feature/implement-cart

## Overview

Move the cart off the module-level seed array in `lib/data/cart.ts` and onto the `carts` / `cart_items` tables that step 03 already created and RLS-protected. Today `/cart` reads and writes a single in-memory `LINES` array shared by every visitor and reset on server restart; this step gives each signed-in buyer their own persisted cart, backed by `carts_select_own` / `cart_items_select_own` (and their write-side equivalents) instead of application code enforcing ownership. It also wires up "Add to Cart" on the product detail page, which today is a disabled/inert button per `components/product/BuyBox.tsx`. Checkout, order placement and inventory decrement stay out of scope — `/checkout`, `/orders` and `app/checkout/actions.ts` are untouched, and `createOrderFromCart` in `lib/data/orders.ts` keeps reading whatever cart shape it already reads until the checkout step lands.

This is the first slice of step 04 (`.claude/specs/04-supabase-data-layer-swap.md`) to move off seed data, following the pattern step 06 set for the catalog: same exported helper names and signatures out of `lib/data/cart.ts` wherever possible, so the diff concentrates in that one file and the seam, not the screens. Success is defined the same way step 06 defined it — the seeded cart lines in the demo accounts should render identically to what the seed array renders today, so any difference is a bug in the swap rather than new behavior.

## Depends on

- **Step 03 (`.claude/specs/03-supabase-schema-and-rls.md`)** — the `carts` and `cart_items` tables and their RLS policies (`Cart`/`CartItem`: owner-only read and write, per `.claude/specs/entity-architecture.md`). Complete.
- **Step 05 (`.claude/specs/05-supabase-auth-integration.md`)** — `lib/supabase/session.ts` (`getCurrentProfile`, `requireProfile`) is the session seam this step gates `/cart` and the add-to-cart action through. Complete.
- **Step 06 (`.claude/specs/06-use-supabase-data.md`)** — the live `products.ts`, in particular `getProductById`, which the add-to-cart action needs to validate a product slug and its current stock before inserting a line. Complete.
- **The seed migration** (`20260813101702_seed_marketplace_demo_data.sql`) — seeds `carts`/`cart_items` for at least one demo buyer, which is what a parity comparison against the current seed array is checked against.

## Routes

No new routes. One existing route changes what it reads and gains an auth gate; one existing screen gets a new working control.

- GET `/cart` — now requires a session; a signed-out visitor redirects to `/signin`. Reads and renders the signed-in buyer's own cart from Postgres instead of the shared seed array — **logged-in** (was public/unrestricted)
- POST (Server Action) `/products/[id]` "Add to Cart" — becomes a real mutation, inserting or incrementing a `cart_items` row for the current buyer's cart. Signed-out submission redirects to `/signin` — **logged-in**
- POST (Server Actions) `updateQuantity`, `removeFromCart` in `app/cart/actions.ts` — same actions, now write to `cart_items` scoped to the caller's own cart rather than the seed array — **logged-in**

## Database changes

None. `carts` and `cart_items` already exist with the RLS policies this step relies on (confirmed in `lib/types/database.ts` and `.claude/specs/entity-architecture.md`). No migration, no policy change. If a query in this step needs a policy that isn't already covered by "owner only" read/write on both tables, that is a signal the plan is wrong, not a reason to add a migration.

## Templates

This project has no template directory; the equivalent artifacts are the App Router pages, Server Actions, and the React components that render them.

**Create:**

- An add-to-cart Server Action, called from `components/product/BuyBox.tsx`.

**Modify:**

- `app/cart/page.tsx` — gate on a session (`requireProfile()`), otherwise unchanged: same empty-state branch, same `CartRow`/`CartSummary` composition.
- `app/cart/actions.ts` — `updateQuantity` and `removeFromCart` operate on the caller's own `cart_items` rows instead of the seed array; keep the `revalidatePath("/", "layout")` ending so the header badge stays in sync.
- `components/product/BuyBox.tsx` — the "Add to Cart" button becomes a real `<form action={...}>` submit, disabled exactly when it is today (`!product.inStock`), with the selected quantity passed through.
- `app/layout.tsx` — `getCartCount()` keeps the same signature but now counts the signed-in buyer's own `cart_items`; render 0 (not a redirect) when signed out, since the badge is visible on public pages.

`components/cart/CartRow.tsx`, `components/cart/CartSummary.tsx`, `components/cart/QuantityStepper.tsx`, `app/cart/loading.tsx` and every skeleton are **not modified**. They already render what this step's view-model (`CartLine`, `CartTotals`) promises; needing to change one is a signal the mapping in `lib/data/cart.ts` is wrong.

## Files to change

- `lib/data/cart.ts` — rewritten as the Supabase-backed cart: `getCart`, `getCartCount`, `setLineQuantity`, `removeLine` become real queries scoped to the signed-in buyer's cart, found or lazily created via `carts.profile_id`. `clearCart` stays for the checkout step to call later (not exercised here). `summarizeCart` stays pure and unchanged — totals are still derived per render, never stored. Every mutator becomes async, since a database write cannot stay synchronous the way the seed array's did; callers in `app/cart/actions.ts` and the new add-to-cart action must be updated to await them.
- `app/cart/page.tsx`, `app/cart/actions.ts`, `app/layout.tsx`, `components/product/BuyBox.tsx` — as described under Templates.
- `CLAUDE.md` — update the current-state section: cart is now live, `lib/data/cart.ts` moves from the "still seed data" list to the "live Supabase queries" list, and the seed-catalog import note for cart is removed.

## Files to create

- The add-to-cart Server Action file (e.g. alongside the product routes, following the existing convention of colocating actions with the screen that calls them, as `app/cart/actions.ts` does for `/cart`).

## New dependencies

No new dependencies. `@supabase/supabase-js` and `@supabase/ssr` are already installed and already wired through `lib/supabase/server.ts`.

## Rules for implementation

- Use CSS variables — never hardcode hex values. Semantic token classes only (`bg-canvas`, `bg-surface`, `text-text-muted`, `border-border`, `text-link`, `text-success`, `text-error`) and the custom type scale (`text-display-lg`, `text-body-md`, `text-label-md`, …), never raw Tailwind palette classes and never paired with `font-*` or `leading-*`. `bg-accent` stays reserved for conversion CTAs (Add to Cart qualifies).
- **`lib/data/` remains the only data-access seam.** No page, component, or Server Action may construct a Supabase client or write a query directly; everything goes through exported helpers in `lib/data/cart.ts`.
- Gate with `getUser()`-backed session helpers (`requireProfile()` for the page, `getCurrentProfile()` inside the Server Actions), never `getSession()`.
- **Do not weaken RLS to make a query work.** If a read or write needs something the existing owner-only policies on `carts`/`cart_items` don't grant, stop and flag it rather than loosening a policy — this step should not need a policy change at all.
- A buyer's cart is found-or-created on first read/write (one row per `profile_id`), not seeded ahead of time for new signups — `carts.profile_id` is unique per the 1–0..1 relationship in `.claude/specs/entity-architecture.md`.
- Adding a product already in the cart increments the existing `cart_items` row's quantity (clamped to stock) rather than inserting a duplicate row for the same product.
- Preserve the existing clamp behavior: quantity is always clamped to `[1, stockQty]`; a stock ceiling of 0 (out of stock) must not be reachable via Add to Cart, matching the current disabled-button behavior in `BuyBox`.
- **Nothing becomes a client component.** `/cart` stays a server component, the add-to-cart control and every cart mutation stay plain `<form action={...}>`, and the whole flow must keep working with JavaScript disabled.
- Keep `revalidatePath("/", "layout")` on every mutating action — layout scope is what keeps the header's cart badge from going stale.
- Distinguish failure modes the way `lib/data/products.ts` does: a query error throws so `app/error.tsx` catches it; an empty cart renders the existing `EmptyState`, not an error. A signed-out visitor to `/cart` redirects to `/signin`, it does not render an error or an empty cart.
- Loading state stays a skeleton shaped like the real content (`app/cart/loading.tsx` already exists and needs no change) — real queries suspend on their own, no `simulateLatency()` call is added here.
- Do not touch `app/checkout/`, `app/orders/`, `app/seller/`, `lib/data/orders.ts`, or `lib/data/seller.ts` beyond what's unavoidable if `lib/data/cart.ts`'s exported shape changes in a way that affects an import elsewhere — and if that happens, it should be an import-only change, not new behavior.
- `lib/data/seed-catalog.ts` is not touched or deleted by this step; other seed modules (`orders.ts`, `seller.ts`) still depend on it.
- Read `node_modules/next/dist/docs/` before writing route or Server Action code — it is authoritative over training data for this Next.js version.
- Strict TypeScript, no `any`. Never hand-write database types; `lib/types/database.ts` is already generated and already carries `carts`/`cart_items` — no regeneration needed unless this step is found to require a schema change (it shouldn't).

## Definition of done

Verified by running the app, not by typecheck alone.

1. `npm run lint` and `npm run typecheck` both pass.
2. `npm run build` succeeds and `/cart` still reports as dynamic.
3. Signed out, visiting `/cart` redirects to `/signin`; submitting "Add to Cart" from a product detail page while signed out also results in a `/signin` redirect, not a silent no-op or a crash.
4. Signed in as a demo buyer with a seeded cart, `/cart` renders the same lines, quantities, and subtotal the current seed array produces for that account, matching the parity bar step 06 set for the catalog.
5. Adding an in-stock product to the cart from its detail page creates or increments a `cart_items` row and the header cart badge updates immediately (via `revalidatePath("/", "layout")`).
6. Adding a product already in the cart increments its existing line's quantity rather than creating a second line for the same product.
7. The Add to Cart control is disabled/inert for an out-of-stock product, matching current `BuyBox` behavior, and no request can add a zero-stock line by bypassing the UI (server-side clamp, not just a disabled button).
8. Updating a line's quantity on `/cart` persists the new value, clamped to `[1, stockQty]`, and survives a page reload.
9. Removing a line from `/cart` deletes the `cart_items` row and the cart re-renders without it, including flipping to the empty state if it was the last line.
10. The empty state (`EmptyState` with "Keep browsing") renders for a buyer with no cart rows, matching the current empty-cart branch in `app/cart/page.tsx`.
11. Cart contents persist across a **server restart** — the regression the seed array's module-level state made impossible — verified by adding a line, restarting `npm run dev`, and confirming the line is still there.
12. Two different signed-in buyers see only their own cart lines; one buyer's `/cart` never shows another's items (owner-only RLS doing the work, not application-level filtering).
13. A broken database connection renders the existing error boundary (`app/error.tsx`) on `/cart` and on an add-to-cart submission — never a silently empty cart.
14. Every cart interaction (`/cart` page, Add to Cart, quantity update, remove) works with JavaScript disabled in the browser.
15. **Regression:** `/`, `/search`, `/products/[id]`, `/checkout`, `/orders`, `/orders/[id]`, `/seller`, `/seller/products`, `/seller/orders` all behave exactly as before this change.
