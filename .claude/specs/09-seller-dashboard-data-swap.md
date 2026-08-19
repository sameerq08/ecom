# Spec for seller-dashboard-data-swap

branch: claude/feature/seller-dashboard-data-swap

## Overview

Finish the seller side of the data-layer swap that steps 04, 06, 07 and 08 left outstanding. `/seller`, `/seller/products` and `/seller/orders` still read `lib/data/seed-catalog.ts` and the frozen, module-level `ORDERS` array in `lib/data/orders.ts`, keyed by the fake identity `CURRENT_SELLER_ID` rather than a real session. This step rewrites `lib/data/seller.ts` and the seller-facing half of `lib/data/orders.ts` (`listOrderRecords`, `advanceOrderStatus`) against the live `orders`, `order_items`, `order_status_events`, `products` and `inventory` tables, gates the three seller routes on a signed-in `role = 'seller'` profile, and makes a status change on `/seller/orders` actually persist and show up on the buyer's `/orders/[id]`.

The buyer-facing half of order status tracking — `/orders`, `/orders/[id]`, the four-step timeline built from `order_status_events` — is already live, per step 08; this step does not touch it except to prove it now reflects seller-made changes. What's currently missing, and what makes this step worth doing on its own, is the "known, temporary consequence" CLAUDE.md documents: an order placed through the real checkout flow does not appear on `/seller/orders`, because that screen still reads seed data. Closing that seam is this step's entire job.

Success is defined the same way step 04 defined it for the rest of the catalog: sameness plus a closed loop. `/seller/products` and `/seller/orders` should render the same shape of data they render today (now sourced from Postgres instead of the seed array), and a status advanced on `/seller/orders` must now be visible moments later on the corresponding buyer's `/orders/[id]` — which was structurally impossible before this step, since the seller side and the buyer side read two disconnected sources.

## Depends on

- Step 03 (`.claude/specs/03-supabase-schema-and-rls.md`) — the `orders`, `order_items`, `order_status_events`, `products`, `inventory` and `seller_profiles` tables and their RLS policies, including the owner-or-participant read policy on `Order`/`OrderItem`, the seller-only `status`-column update on `Order`, and the append-only insert policy on `OrderStatusEvent`. All policies already exist; this step does not change RLS, only starts exercising the seller-side policies for the first time.
- Step 05 (`.claude/specs/05-supabase-auth-integration.md`) — `lib/supabase/session.ts`'s `getCurrentProfile`/`requireProfile`, and the `role` field on `CurrentProfile`, which this step's route gates use directly.
- Step 04 (`.claude/specs/04-supabase-data-layer-swap.md`) — the buyer-side data swap this step completes the remainder of; read its scope-change note, since this spec supersedes the seller-side portion of it.
- Step 06 (`.claude/specs/06-use-supabase-data.md`) — `lib/data/products.ts` and `lib/data/categories.ts`, which this step's seller queries read from (product slug, category name) rather than duplicating.
- Step 08 (`.claude/specs/08-implement-checkout.md`) — the live `lib/data/orders.ts` buyer half (`getOrders`, `getOrderById`) and the `order_status_events` rows a real checkout now writes, which this step's seller queries and status-advance action must agree with.
- The seed data migrations (`20260813101702_seed_marketplace_demo_data.sql`, `20260813101800_backdate_demo_account_created_at.sql`) and the `homesafe@demo.market` / `keyforge@demo.market` demo accounts, used to exercise the seller flow.

## Routes

No new routes. Existing routes keep their paths; what changes is that all three now read Postgres and require a session:

- `GET /seller` — Seller Dashboard — logged-in **and** `role = 'seller'`; a signed-out visitor redirects to `/signin`, a signed-in buyer sees a role-denied empty state rather than a crash or a redirect loop
- `GET /seller/products` — Product listing view — logged-in and `role = 'seller'`, same gating
- `GET /seller/orders`, `GET /seller/orders?status=<step>` — Incoming order queue — logged-in and `role = 'seller'`, same gating
- `POST /seller/orders` (the `advanceStatus` Server Action) — logged-in and `role = 'seller'`; must also verify the caller actually owns a line item on the order being advanced, not just that they hold the seller role

## Database changes

None. Every table and policy this step reads or writes (`orders`, `order_items`, `order_status_events`, `products`, `inventory`, `seller_profiles`) and every RLS policy it relies on (owner-or-participant select on `Order`/`OrderItem`, the seller `status`-only update on `Order`, append-only insert on `OrderStatusEvent`) already exists from step 03. This step is the first to actually exercise the seller-side policies from application code, which is exactly what makes it worth re-running `supabase/tests/rls_verification.sql` and `get_advisors` as a check, not because anything changed.

## Templates

This project has no template directory — screens are React Server Components under `app/`.

Create: none.

Modify:

- `app/seller/page.tsx` — read seller identity and stats from a real session instead of `CURRENT_SELLER_ID`; add or confirm the role-denied and signed-out states
- `app/seller/products/page.tsx` — same, for the listings table
- `app/seller/orders/page.tsx` — same, for the incoming-order queue and its status filter links
- `app/seller/orders/actions.ts` — `advanceStatus` becomes an authenticated, ownership-checked write against `order_status_events`/`orders`, not a mutation of the in-memory array

Every component under `components/seller/` (`ProductTable`, `OrderTable`, `SellerStatCard`) should be untouched — if one needs editing, the rewritten `lib/data/seller.ts` helper is returning a different shape than `lib/types/ui.ts` promises.

## Files to change

- `lib/data/seller.ts` — `getSellerListings`, `getSellerOrderItems`, `getSellerStats` become live queries scoped to the signed-in seller's `seller_profiles` row, replacing the calls into `seed-catalog.ts` and `CURRENT_SELLER_ID`. `getSellerOrderItems` must keep flattening to line-item granularity, filtered to the caller's own `seller_profile_id` — an order spanning two sellers must contribute only this seller's rows, the same guarantee the seed version gave.
- `lib/data/orders.ts` — replace the "SEED" section (`ORDERS`, `listOrderRecords`, `advanceOrderStatus`) with live reads/writes against `orders`, `order_items`, `order_status_events`. `advanceOrderStatus` moves along `pending → confirmed → shipped → delivered` by inserting an `order_status_events` row and updating `orders.status` (through the `update (status)` column grant), attributed to the caller's own `seller_profiles` id, terminal at delivered — matching the seed version's contract so `app/seller/orders/actions.ts` doesn't need to change its calling convention. Update the module's header comment: the SEED/LIVE split it currently documents is what this step closes.
- `lib/data/seed-catalog.ts` — remove `CURRENT_SELLER_ID`, `getSellerListings`, `countActiveListings`, and any other export that only served the now-rewritten `seller.ts`. Leave `findProduct`, `SEED` and `simulateLatency` if any other seed consumer still needs them; delete the file outright if this step empties it, since CLAUDE.md records that as its one deletion point.
- `lib/supabase/session.ts` — if `getSellerProfileId`-style lookup doesn't already fit inside `getCurrentProfile`, extend it (or add a narrow helper) so `lib/data/seller.ts` can resolve the caller's `seller_profiles.id` without a raw query outside `lib/data/`/`lib/supabase/`.
- `app/seller/page.tsx`, `app/seller/products/page.tsx`, `app/seller/orders/page.tsx` — add the `requireProfile()` + role check gating pattern already used by `/cart`, `/checkout`, `/orders` (step 08), extended with the role test.
- `app/seller/orders/actions.ts` — call the session helper before writing; a signed-out or non-owning submission must not advance any status.
- `CLAUDE.md` — the "known, temporary consequence" paragraph, the `lib/data/` split description, and the step-04 "remaining scope" note all describe the seller side as seed; update them once this step lands so they don't contradict the code.
- `.claude/specs/visual-architecture.md` — the caveat in the Auth Requirement section ("the Buyer and Seller rows are still ungated... Step 04 repoints them") no longer applies to the seller rows once this step lands.

## Files to create

None expected. `lib/supabase/client.ts` is still not needed — no new client component.

## New dependencies

No new dependencies. `npm test` remains the `exit 1` stub; nothing in this step may claim tests pass.

## Rules for implementation

- Use CSS variables — never hardcode hex values. Semantic token classes only (`bg-canvas`, `bg-surface`, `text-text-muted`, `border-border`, `text-link`, `text-success`, `text-error`) and the custom type scale (`text-display-lg`, `text-title-lg`, `text-body-md`, `text-label-sm`, …), never paired with `font-*`/`leading-*`. No `tailwind.config.js`. `bg-accent` stays reserved for conversion CTAs. Light mode only, no `dark:` variants.
- No ad hoc `createClient()` in components — all access goes through `lib/data/` and `lib/supabase/`.
- Do not weaken RLS to make a query work. If a seller query only succeeds with elevated privileges, the query (or the session lookup feeding it) is wrong, not the policy. Verify the touched read/write paths against both an authorized seller and an unauthorized caller (a buyer, and a different seller) before calling this done.
- Keep it server-rendered. Nothing in the repo is a client component except `app/error.tsx`; every control is a plain `<form action={...}>`; the app works with JavaScript disabled. The status-filter links and the "advance status" control must keep working without JS.
- Route props come from the generated types (`PageProps<"/seller/orders">`, etc.) — do not hand-write `{ params, searchParams }` types.
- Strict TypeScript, no `any`. Do not hand-write database types; `lib/types/database.ts` is already generated and current — this step needs no schema change, so no regeneration is expected, but confirm the shapes still match before assuming so.
- Loading states are skeletons shaped like the real content, not spinners — match the pattern `ProductCardSkeleton` and the cart/orders loading states already use.
- An order spanning two sellers must let either seller advance the shared `status` independently; the resulting single status is visible to both sellers and to the buyer, per the note in `.claude/specs/entity-architecture.md`. Do not introduce a per-line-item status to work around this — status lives on the order, not the item, by design.
- A seller must never see or act on another seller's line items, and a buyer visiting `/seller/*` must get a role-denied empty state, not a redirect loop or a stack trace.
- Mutations end with `revalidatePath("/", "layout")`, matching every other Server Action in the repo, so the change is visible immediately without a manual refresh.

## Definition of done

1. `grep -r "CURRENT_SELLER_ID" lib/ app/` returns nothing.
2. `npm run lint && npm run typecheck` pass.
3. `npm run build` succeeds; `/seller`, `/seller/products`, `/seller/orders` report dynamic (`ƒ`), not statically prerendered.
4. Signed out, visiting `/seller`, `/seller/products` or `/seller/orders` redirects to `/signin`.
5. Signed in as a buyer (e.g. `jane@demo.market`), visiting any `/seller/*` route shows a role-denied empty state, not a crash.
6. Signed in as `homesafe@demo.market`, `/seller/products` lists exactly HomeSafe's own listings, including any inactive one, sourced from `products`/`inventory` rather than the seed array.
7. Signed in as `homesafe@demo.market`, `/seller/orders` shows only HomeSafe's own line items across all orders — on an order spanning two sellers, only HomeSafe's line appears, not the other seller's.
8. Signed in as `keyforge@demo.market`, KeyForge's `/seller/orders` and `/seller/products` show none of HomeSafe's rows, and vice versa.
9. Placing a real order as a buyer through `/checkout`, then signing in as the seller of one of its lines, shows that order's line item on `/seller/orders` — closing the gap CLAUDE.md currently documents as a known consequence.
10. Advancing a status on `/seller/orders` persists across a server restart (proving it's a database write, not module state) and is reflected on the corresponding buyer's `/orders/[id]` timeline, attributed to the correct seller, without the buyer needing to do anything but reload.
11. Advancing status past "delivered" is not possible; the control reflects a terminal state at delivered.
12. Every seller screen renders a loading skeleton on first load, an empty state when the seller has no listings or no orders (including a filtered empty state on `/seller/orders?status=<step>`), and does not crash into a blank page on a query failure.
13. `supabase/tests/rls_verification.sql` still passes in full, and `mcp__supabase__get_advisors` remains clean for `security` apart from the known `public.rls_auto_enable` platform trigger.
14. `.claude/specs/entity-architecture.md` and `.claude/specs/visual-architecture.md` match what was built; CLAUDE.md's description of `lib/data/seller.ts` and the seller half of `orders.ts` no longer says "seed."
