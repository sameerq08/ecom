# Spec for implement-checkout

branch: claude/feature/implement-checkout

## Overview

Move checkout off the module-level seed array in `lib/data/orders.ts` and onto the `orders` / `order_items` / `order_status_events` tables step 03 created and RLS-protected. Today "Place Order" snapshots the signed-in-agnostic seed cart into an in-memory `ORDERS` array shared by every visitor and reset on server restart; this step gives a real signed-in buyer a real, persisted order, and finally exercises the two operations step 03 deliberately deferred: decrementing `inventory.stock_qty` and trusting a live price rather than a client-supplied one.

Placing an order touches five things at once — read the cart, write the order, write its items, decrement stock, clear the cart — and none of it may partially happen. A buyer is not the owner of `inventory` (sellers are, per RLS), so a buyer's session cannot decrement stock directly even with correct policies, and driving this as a sequence of separate client calls leaves a window where two buyers can oversell the last unit or a stale page can order at a price that already moved. This step's core decision is therefore to do the write as one Postgres function rather than a sequence of `lib/data/` calls: a `private`-schema function, `SECURITY DEFINER` so it can cross the buyer/inventory ownership boundary safely, exposed through a thin `public` wrapper that resolves the caller's own profile from `auth.uid()` (never from a client-supplied id) and is granted to `authenticated` only, following the exact `public` wrapper / `private` body split CLAUDE.md already documents for the RLS helpers. This is chosen over a Supabase Edge Function: nothing in this repo is deployed as an Edge Function today, the RPC-function pattern is already established, and a single Postgres transaction gives atomicity a sequence of Edge Function → REST calls cannot.

**Inventory is decremented immediately at checkout, not reserved-and-expired.** A hold/reservation system with a timeout is a larger feature this spec's scope (and SPEC.md's non-goals) doesn't ask for; "confirm order or reserve inventory safely" is satisfied here by doing the check-and-decrement atomically under a row lock, which is what actually prevents overselling.

**Status is never written ahead of the transaction it belongs to.** There is no "pending" order, no "reserved" stock, and no cleared cart until the checkout function commits in full. `createOrderFromCart` either returns a real, fully-written order id or nothing happened at all — the confirmation banner on `/orders/[id]` (the "print" the buyer sees) only ever reflects a transaction that already succeeded, never one assumed to succeed.

**Scope boundary — the seller queue stays on seed for one more step.** `lib/data/seller.ts` derives its order view from `lib/data/orders.ts`'s `listOrderRecords()`, filtered by `CURRENT_SELLER_ID`, a seed-catalog string with no relationship to a Supabase session. Moving that view onto `orders`/`order_items` would require the RLS-correct thing to also be true — that whoever is viewing `/seller/orders` is actually signed in as that seller — which means applying the seller auth gate at the same time. CLAUDE.md already records that gate as outstanding, separate work, and folding it into a checkout spec would blow past what was asked here. So `listOrderRecords()` and `advanceOrderStatus()` keep reading and writing the seed `ORDERS` array exactly as they do today, `lib/data/orders.ts` ends this step with a live half and a seed half in the same file, and a **known, temporary consequence** follows directly from that split: an order placed through the real checkout flow will not appear in `/seller/orders`, because that screen still reads the frozen seed array. This is not a bug to fix here — it's the same kind of deliberate, documented seam CLAUDE.md already uses for `CURRENT_SELLER_ID` itself, and it closes when the seller side migrates next.

## Depends on

- **Step 03 (`.claude/specs/03-supabase-schema-and-rls.md`)** — the `orders`, `order_items`, `order_status_events`, and `inventory` tables and their RLS policies. Complete.
- **Step 05 (`.claude/specs/05-supabase-auth-integration.md`)** — `lib/supabase/session.ts` (`getCurrentProfile`, `requireProfile`) is the session seam `/checkout`, `/orders`, and `/orders/[id]` gate through. Complete.
- **Step 06 (`.claude/specs/06-use-supabase-data.md`)** — the live `products.ts`, whose `products.slug` and pricing the checkout function reads. Complete.
- **Step 07 (`.claude/specs/07-implement-cart.md`)** — the live `cart.ts`. The checkout function reads the same `carts`/`cart_items` rows this step already persists, and `clearCart`'s role is absorbed into the checkout function itself (see Database changes). Complete.
- **The seed migration** (`20260813101702_seed_marketplace_demo_data.sql`) — seeds a cart for at least one demo buyer, which is what this step's flow is exercised against.

## Routes

No new routes. Three existing routes gain an auth gate, and one existing action becomes a real transaction.

- GET `/checkout` — now requires a session; a signed-out visitor redirects to `/signin`. Otherwise unchanged: reads and totals the signed-in buyer's own cart — **logged-in** (was public/unrestricted)
- POST (Server Action) `placeOrder` in `app/checkout/actions.ts` — becomes a real transaction via the checkout database function instead of an in-memory snapshot. Signed-out submission redirects to `/signin` — **logged-in**
- GET `/orders` — now requires a session; reads the signed-in buyer's own orders from Postgres instead of the shared seed array — **logged-in** (was public/unrestricted)
- GET `/orders/[id]` — now requires a session; reads the order from Postgres, scoped by ownership. An id that exists but belongs to another buyer renders the same not-found response as an id that doesn't exist at all, so ownership can't be probed — **logged-in** (was public/unrestricted)

`/seller`, `/seller/products`, `/seller/orders` are unchanged by this step — see the scope boundary in Overview.

## Database changes

Two additions, both in a single migration:

- **A checkout function**, in two parts:
  - `private.checkout(p_profile_id uuid, p_shipping_address text) returns uuid` — `SECURITY DEFINER`, `search_path = ''`, qualifying every reference. Given a buyer's profile id and a shipping address, it: locks the buyer's cart lines together with their `inventory` rows (`SELECT ... FOR UPDATE`); fails the whole transaction if the cart is empty or any line's requested quantity exceeds its current locked stock; inserts one `orders` row (`status = 'pending'`); inserts one `order_items` row per line, reading `price_at_purchase` and `seller_profile_id` from `products` at the moment of checkout rather than accepting either from the caller; inserts one opening `order_status_events` row (`status = 'pending'`, `changed_by_profile_id = p_profile_id`); decrements each line's `inventory.stock_qty`, guarded by `WHERE stock_qty >= quantity` as a second line of defense under the row lock already held; deletes the buyer's `cart_items`; and returns the new order id. Any failure raises, rolling back every write in the transaction — there is no partial order, no partial decrement, and no half-cleared cart.
  - `public.checkout_cart(p_shipping_address text) returns uuid` — a thin `SECURITY DEFINER` wrapper, `search_path = ''`, that resolves the caller's own `profiles.id` from `auth.uid()` and calls `private.checkout` with it. This is the one deliberately-exposed entry point, following the constraint CLAUDE.md already states: nothing meant only for internal use goes in `public`, where PostgREST would publish it to `anon`. `EXECUTE` is granted to `authenticated` only and revoked from `anon`/`public`, so an unauthenticated caller cannot invoke it at all — the profile-resolution step is defense in depth, not the only gate.
- No new tables and no policy changes on the existing `orders`/`order_items`/`order_status_events`/`inventory`/`carts`/`cart_items` policies — the function needs `SECURITY DEFINER` specifically because the correct RLS (buyers don't own `inventory`) would otherwise correctly block the decrement, not because a policy is wrong.

Goes through `mcp__supabase__apply_migration`, mirrored into `supabase/migrations/`. Run `supabase/tests/rls_verification.sql` and `get_advisors` afterwards — the new functions must not appear as a `security` advisory finding (correct `search_path`, correct grants), and existing RLS behavior must be unaffected.

## Templates

This project has no template directory; the equivalent artifacts are the App Router pages, Server Actions, and the SQL function above.

**Create:** none — every screen this step touches already exists.

**Modify:**

- `app/checkout/page.tsx` — gate on `requireProfile()`. Otherwise unchanged: same `CartRow`/`CartSummary`/`ShippingAddressCard` composition, same empty-cart branch.
- `app/checkout/actions.ts` — `placeOrder` calls `requireProfile()` before doing anything, matching the pattern `app/cart/actions.ts` already set; the redirect logic (`orderId ? "/orders/{id}?placed=1" : "/cart"`) is unchanged.
- `app/orders/page.tsx`, `app/orders/[id]/page.tsx` — gate on `requireProfile()`.

Every component under `components/cart/`, `components/checkout/`, and `components/orders/` is **not modified**. They already render what this step's view-models (`OrderSummary`, `OrderDetail`, `OrderLine`) promise; needing to change one is a signal the mapping in `lib/data/orders.ts` is wrong.

## Files to change

- `lib/data/orders.ts` — split, documented with a clear comment separating the two halves:
  - **Live:** `getOrders`, `getOrderById`, `getCheckoutAddress`, `createOrderFromCart`. The first two query `orders`/`order_items` (embedded with `products` for name/slug/image, mirroring the join style `cart.ts` already uses) scoped to the signed-in buyer; `getCheckoutAddress` keeps returning the existing fixed demo address unchanged — no address form, no profile column, matching the "display-only, not editable" rule step 02 already set. `createOrderFromCart` becomes a single call to `supabase.rpc("checkout_cart", …)`; a stock-shortfall failure from the function is treated as the existing "nothing to order" case (returns null, same as an empty or blocked cart today), any other failure throws.
  - **Seed, unchanged:** `listOrderRecords`, `advanceOrderStatus`, and the `ORDERS` array stay exactly as they are, serving `lib/data/seller.ts` only. See the scope boundary in Overview.
- `app/checkout/page.tsx`, `app/checkout/actions.ts`, `app/orders/page.tsx`, `app/orders/[id]/page.tsx` — as described under Templates.
- `CLAUDE.md` — update the current-state section: checkout and buyer order reads are now live; document the live/seed split inside `lib/data/orders.ts` the same way the top of the file already documents the two-way split of `lib/data/` itself; note the seller-queue consequence from Overview explicitly, so nobody mistakes the empty `/seller/orders` entry for a bug later.

## Files to create

- `supabase/migrations/<version>_checkout_function.sql` — the migration described under Database changes.

## New dependencies

None. `@supabase/supabase-js` and `@supabase/ssr` are already installed and already wired through `lib/supabase/server.ts`.

## Rules for implementation

- Use CSS variables — never hardcode hex values. This step touches no styled markup, but any incidental change (e.g. an error message) must still use semantic token classes and the custom type scale, never raw Tailwind palette classes.
- **`lib/data/` remains the only data-access seam.** No page, component, or Server Action may construct a Supabase client or call `.rpc(...)` directly; that call lives inside `lib/data/orders.ts`.
- Gate with `getUser()`-backed session helpers (`requireProfile()` for the three pages, `getCurrentProfile()`/`requireProfile()` inside `placeOrder`), never `getSession()`.
- **The checkout write is one database function, not a sequence of client calls.** Do not decompose it into separate `lib/data/` calls (insert order, then insert items, then update inventory, then clear cart) — that is exactly the non-atomic sequence this spec exists to replace.
- **No client-supplied price or profile id crosses the trust boundary.** `price_at_purchase` is read from `products` inside the function; the profile id is resolved from `auth.uid()` inside `public.checkout_cart`, never passed in from `lib/data/orders.ts`.
- **No status or row is written before the transaction that produces it commits.** There is no optimistic "pending" order created before the function returns, and the confirmation banner is only reachable via a redirect to a real order id the function actually returned.
- Stock safety is enforced with an explicit row lock (`FOR UPDATE`) plus a guarded decrement (`WHERE stock_qty >= quantity`), not merely a pre-check followed by an unconditional update — the pre-check alone is exactly the race two concurrent checkouts would exploit.
- **Do not weaken RLS to make this work.** The function crosses the buyer/inventory ownership boundary via `SECURITY DEFINER`, deliberately and narrowly — it does not loosen the underlying `inventory`, `orders`, `order_items`, or `cart_items` policies, which stay exactly as step 03 and step 07 left them.
- **Nothing becomes a client component.** `/checkout`'s "Place Order" stays a plain `<form action={...}>`, and the whole flow must keep working with JavaScript disabled.
- Keep `revalidatePath("/", "layout")` on `placeOrder` — layout scope is what keeps the header's cart badge in sync once the cart is cleared server-side.
- Distinguish failure modes the way `lib/data/cart.ts` and `lib/data/products.ts` do: an unexpected database error throws so `app/error.tsx` catches it; a stock-shortfall or empty-cart failure from checkout is the existing "nothing to order" case and redirects to `/cart`, it is not rendered as an error.
- Do not touch `app/seller/`, `lib/data/seller.ts`, `listOrderRecords`, or `advanceOrderStatus` — the scope boundary in Overview is deliberate, not an oversight to "fix while you're in the file."
- `lib/data/seed-catalog.ts` is not touched or deleted by this step; `lib/data/seller.ts` still depends on it.
- One migration, applied via `apply_migration` and mirrored into `supabase/migrations/`. Never edit an applied migration.
- Read `node_modules/next/dist/docs/` before writing route or Server Action code — it is authoritative over training data for this Next.js version.
- Strict TypeScript, no `any`. Never hand-write database types; regenerate `lib/types/database.ts` via `mcp__supabase__generate_typescript_types` and commit it unmodified, since this step adds functions the generated file must reflect.

## Definition of done

Verified by running the app, not by typecheck alone.

1. `npm run lint` and `npm run typecheck` both pass.
2. `npm run build` succeeds and `/checkout`, `/orders`, and `/orders/[id]` still report as dynamic.
3. Signed out, visiting `/checkout`, `/orders`, or `/orders/[id]` redirects to `/signin`; submitting `placeOrder` while signed out also redirects to `/signin` rather than silently no-opping.
4. Signed in as a demo buyer with a seeded cart, `/checkout` shows the same lines and total `/cart` shows.
5. Clicking "Place Order" with sufficient stock creates one new row each in `orders`, `order_items` (one per cart line), and `order_status_events` (`status = 'pending'`), all attributed to the signed-in buyer's profile — verified by querying the tables before and after.
6. The same click decrements `inventory.stock_qty` by exactly the ordered quantity for each line, verified by querying `inventory` before and after.
7. The same click deletes every `cart_items` row in the buyer's cart; `/cart` immediately after shows the empty state, and the header cart badge reads 0.
8. The buyer is redirected to `/orders/[id]?placed=1` for the new order and sees the confirmation banner; navigating to `/orders` afterward lists the new order alongside their existing history with the correct total.
9. Placing an order for a line whose quantity exceeds current stock (simulate by editing another line's stock down between cart and checkout) blocks the order: no `orders`, `order_items`, or `order_status_events` row is created, `inventory.stock_qty` is unchanged, and the cart is not cleared — the buyer lands back on `/cart`.
10. Two concurrent checkouts against the last remaining unit of a product result in exactly one success and one clean failure — never negative stock, verified by querying `inventory.stock_qty` afterward (never below 0).
11. A signed-in buyer cannot view another buyer's order by guessing its `/orders/[id]` URL — it renders the same not-found response as a nonexistent id.
12. `/seller/orders` is unaffected by this step: it still lists only the seed orders it listed before, and a newly placed real order does not appear there — the documented, temporary consequence of the scope boundary, not a regression to chase.
13. **Regression:** `/`, `/search`, `/products/[id]`, `/cart`, `/seller`, `/seller/products` all behave exactly as before this change.
14. `supabase/tests/rls_verification.sql` passes in full.
15. `mcp__supabase__get_advisors` is clean for `security`, apart from the known `public.rls_auto_enable` platform trigger.
16. `.claude/specs/entity-architecture.md` is checked against what was built (no schema shape changed, so likely no edit needed — confirm rather than skip).
