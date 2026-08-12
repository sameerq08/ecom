# Spec for order-cart-and-checkout

branch: claude/feature/order-cart-and-checkout

## Overview

Build the post-browse half of the marketplace — cart, checkout, buyer order history and detail, and the three seller-facing screens — as static screens driven by local seed data with in-memory client state. Step 01 delivered the read-only catalog (`/`, `/search`, `/products/[id]`); this step delivers everything downstream of "Add to Cart", so that every route named in `.claude/specs/visual-architecture.md` exists and every screen state is reachable through normal navigation before any backend lands. Wiring Supabase in a later step then becomes a data-source swap plus a session gate, not a UI rebuild.

The existing `/cart`, `/orders`, and `/seller` pages are demo scaffolds: each renders hardcoded placeholder objects inline and pins an extra "Empty state" or "Error state" section onto the bottom of the same page. This feature replaces all three with real screens whose empty and error branches are reached by actual conditions, and adds the four routes that do not exist yet.

Scope is deliberately local-only. Cart mutations, checkout, and seller status changes all operate on client-side React state seeded from local data — they are real interactions that update the screen, but nothing persists across a full page reload, there is no auth gate, and there is no payment step. "Place Order" is a state transition into a confirmation view, not a transaction.

## Depends on

Step 01 (`.claude/specs/01-product-browsing-and-detail.md`) must be complete. This feature builds directly on what it established:

- The local seed catalog and its read helpers in `lib/data/products.ts`, plus `lib/data/categories.ts` — cart lines and order items reference real catalog products by id rather than inventing parallel product data.
- The presentational view-model types and `formatPrice` in `lib/types/ui.ts`, including `CartLine`, `OrderSummary`, `SellerOrderRow`, `OrderStatus`, `ORDER_STATUS_STEPS`, and `ORDER_STATUS_LABELS`.
- The `components/ui/` primitives (`Button`, `Card`, `CardHeader`, `Badge`, `Skeleton`, `EmptyState`, `ErrorState`) and the existing domain components `components/cart/CartRow.tsx`, `components/cart/QuantityStepper.tsx`, `components/orders/OrderStatusTimeline.tsx`, `components/seller/OrderTable.tsx`, `components/product/ProductImage.tsx`.
- The shared shell in `app/layout.tsx` and the Tailwind v4 `@theme` token layer in `app/globals.css`.
- The root error boundary `app/error.tsx`.

## Routes

- GET `/cart` — Cart. Line items with image, title, price, stock and seller meta; per-line quantity stepper and remove action; running item count and subtotal; "Proceed to Checkout". Renders the empty-cart state when no lines remain. Public for now (spec'd as Buyer; the auth gate is a later step).
- GET `/checkout` — Checkout review. Read-only order summary: shipping address block, the cart lines being ordered, item count, and order total. Primary action is "Place Order", which advances to the confirmation view. Redirects to the empty-cart state if there is nothing to check out. Public for now (spec'd as Buyer).
- GET `/orders` — Customer order list. One summary card per order (order number, placed date, total, ship-to) with its status timeline, each linking to the order's detail route. Renders the empty state when the buyer has no orders. Public for now (spec'd as Buyer/owner).
- GET `/orders/[id]` — Customer order detail. Full status timeline, the order's line items with per-item quantity and price at purchase, shipping address, and the order total. Also serves as the post-checkout confirmation view when arrived at from "Place Order". Returns the framework's not-found response for an unknown id. Public for now (spec'd as Buyer/owner).
- GET `/seller` — Seller dashboard. At-a-glance counts (active listings, orders needing action) plus a "Recent Orders" card that links onward to the two management screens. Public for now (spec'd as Seller).
- GET `/seller/products` — Seller product management. Table of the signed-in seller's listings: image, name, category, price, stock, and active/inactive state, with per-row edit and per-page "Add product" affordances rendered but inert. Renders the empty state when the seller has no listings. Public for now (spec'd as Seller/owner).
- GET `/seller/orders` — Seller incoming orders. The seller's order line items across all orders — order number, date, customer, product, quantity, line amount, current status — each row carrying the status control that advances that order along `pending → confirmed → shipped → delivered`. Filterable by status. Public for now (spec'd as Seller/owner).

The `/sellers/[id]` public seller profile from `visual-architecture.md` remains **out of scope**, as in step 01.

Checkout confirmation is not its own route. "Place Order" navigates to `/orders/[id]` for the newly created order, which renders a confirmation banner above the normal order detail when it is the just-placed order. This matches the `Checkout --> OrderStatus` edge in `visual-architecture.md` and avoids a dead-end URL nobody can return to.

## Database changes

None. No Supabase client, no migrations, no environment variables, no auth. Every screen reads from local, in-repo seed modules and mutates React state held in the page. Any work that would install `@supabase/*`, create `supabase/`, or add a payment provider belongs to a later step.

## Templates

**Create**

- `app/checkout/page.tsx` — checkout review screen.
- `app/orders/[id]/page.tsx` — order detail / post-checkout confirmation screen.
- `app/orders/[id]/loading.tsx` — skeleton mirroring the order detail layout.
- `app/seller/products/page.tsx` — seller product management screen.
- `app/seller/orders/page.tsx` — seller incoming orders screen.
- `app/cart/loading.tsx` — skeleton mirroring the cart layout.
- `app/orders/loading.tsx` — skeleton mirroring the order list.

**Modify**

- `app/cart/page.tsx` — full replacement: real seeded lines, working quantity and remove controls, live subtotal, conditional empty state, link to `/checkout`. The pinned "Empty state" demo section is removed.
- `app/orders/page.tsx` — full replacement: seeded order list, each card linking to `/orders/[id]`, conditional empty state. The pinned "Error state" demo section is removed.
- `app/seller/page.tsx` — full replacement: summary counts and a recent-orders card that links to `/seller/products` and `/seller/orders`. The pinned "Empty state" demo section is removed.
- `app/layout.tsx` — add a cart item-count badge to the "Cart" nav link, and add "My listings" / "Orders" entry points under the seller area if the nav is where they belong. Keep the existing header, footer, container, and font setup.
- `components/cart/CartRow.tsx` — accept quantity-change and remove callbacks instead of rendering inert controls; keep the existing silhouette exactly.
- `components/cart/QuantityStepper.tsx` — accept a change callback and min/max bounds; disable decrement at the minimum and increment at available stock.
- `components/seller/OrderTable.tsx` — generalize so the seller dashboard's recent-orders view and the `/seller/orders` working view can both use it, including an optional status-control column.

## Files to change

- `app/cart/page.tsx`, `app/orders/page.tsx`, `app/seller/page.tsx` — as described above.
- `app/layout.tsx` — nav additions only.
- `components/cart/CartRow.tsx`, `components/cart/QuantityStepper.tsx`, `components/seller/OrderTable.tsx` — as described above.
- `lib/types/ui.ts` — extend the view-model layer with the shapes these screens need: an order line item (product reference, quantity, price at purchase, seller), an order detail (summary fields plus line items, shipping address, item count, order total), a seller listing row (product reference, category, price, stock, active flag), and a seller order line row (order number, date, customer, product, quantity, line amount, status). Keep the existing "TEMPORARY — replaced by Supabase-generated types" header comment.
- `.claude/specs/ui-architecture.md` — extend the "Component patterns" section with the checkout summary, order detail, and seller table patterns introduced here, so the doc stays a complete description of the component set.

## Files to create

- `lib/data/cart.ts` — the seeded cart and its read helpers. Lines reference catalog products by id via `lib/data/products.ts`; this module never duplicates product fields.
- `lib/data/orders.ts` — seeded buyer orders and their read helpers (all orders, one order by id). Order items likewise reference catalog products by id.
- `lib/data/seller.ts` — the seeded "signed-in seller" identity, that seller's listings, and their incoming order line items, derived from the catalog and the seeded orders rather than restated.
- `app/checkout/page.tsx`, `app/orders/[id]/page.tsx`, `app/seller/products/page.tsx`, `app/seller/orders/page.tsx` — as described under Templates.
- `app/cart/loading.tsx`, `app/orders/loading.tsx`, `app/orders/[id]/loading.tsx` — as described under Templates.
- `components/cart/CartSummary.tsx` — the subtotal / item-count / primary-action panel shared by the cart sidebar and the checkout summary.
- `components/cart/CartList.tsx` — the client component owning cart line state: renders the rows, handles quantity and remove, computes the running totals, and swaps to the empty state when the last line is removed.
- `components/checkout/ShippingAddressCard.tsx` — read-only shipping address block.
- `components/checkout/PlaceOrderPanel.tsx` — client component holding the order total and the amber "Place Order" action that navigates to the new order's detail route.
- `components/orders/OrderSummaryCard.tsx` — the order list card (placed / total / ship-to / order number header plus timeline), linking to `/orders/[id]`.
- `components/orders/OrderItemRow.tsx` — a single order line item: image, name, seller, quantity, price at purchase.
- `components/orders/OrderConfirmationBanner.tsx` — success banner shown on order detail immediately after checkout.
- `components/orders/OrderDetailSkeleton.tsx` — skeleton matching the order detail layout.
- `components/seller/SellerStatCard.tsx` — dashboard count tile.
- `components/seller/ProductTable.tsx` — seller listings table (image, name, category, price, stock, active state, row actions).
- `components/seller/OrderStatusControl.tsx` — client component advancing a single order's status; renders the current status and the next allowed transition.
- `components/seller/SellerOrderFilters.tsx` — status filter for `/seller/orders`.

## New dependencies

No new dependencies. `next`, `react`, `react-dom`, and Tailwind v4 as already installed cover this entirely.

## Rules for implementation

- Use CSS variables — never hardcode hex values. Every color comes from a `@theme` token class (`bg-canvas`, `bg-surface`, `bg-surface-muted`, `text-text-main`, `text-text-muted`, `border-border`, `text-link`, `text-success`, `text-error`, `bg-accent`). If a needed color has no token, add it to the `@theme` block in `app/globals.css` rather than inlining a hex.
- Use the project type scale only: `text-display-lg`, `text-headline-md`, `text-title-lg`, `text-body-lg`, `text-body-md`, `text-body-sm`, `text-label-md`, `text-label-sm`. Do not use stock Tailwind sizes such as `text-2xl` or `text-sm`, and do not add a `font-weight` utility where the token already carries one.
- Amber (`bg-accent`) is reserved for conversion CTAs. Across these screens that means exactly two buttons: "Proceed to Checkout" on `/cart` and "Place Order" on `/checkout`. Not the quantity stepper, not "Add product", not the seller status control, not "Try again".
- Tailwind v4: all tokens live in the `@theme` block of `app/globals.css`. Do not create a `tailwind.config.js`.
- Light mode only. Do not add `dark:` variants.
- Server Components by default. `"use client"` is confined to the components that genuinely own interactive state — the cart list, the place-order panel, the seller status control, and the seller order filter. Route files (`page.tsx`) stay Server Components that read seed data and pass it down as props; do not mark a whole page `"use client"` to avoid threading props.
- Read the relevant guide in `node_modules/next/dist/docs/` before writing route code. Use the globally-generated typed route props (`PageProps<"/orders/[id]">`) rather than hand-written `params` / `searchParams` types, and treat those props as async where the framework requires it.
- Strict TypeScript, no `any` — use `unknown` plus narrowing. Functional components only.
- Every interactive element needs a ≥44px hit area — `h-touch` / `w-touch`, as `Button` already does. This includes stepper controls, remove links, table row actions, the status control, and filter controls.
- Reuse before creating. `Button`, `Card`, `CardHeader`, `Badge`, `Skeleton`, `EmptyState`, `ErrorState`, `CartRow`, `QuantityStepper`, `OrderStatusTimeline`, `OrderTable`, `ProductImage`, and `formatPrice` all exist and must be used rather than reimplemented. Do not restyle a primitive to fit one screen; extend the primitive.
- Prices and totals render through `formatPrice` — never raw number interpolation. Totals are computed in one place per screen from quantity × price, never hardcoded alongside the lines they describe.
- Order status is derived from the shared `OrderStatus` union, `ORDER_STATUS_STEPS`, and `ORDER_STATUS_LABELS` in `lib/types/ui.ts`. Do not introduce a second status vocabulary, and do not re-map status to a badge tone in more than one place.
- Status transitions only ever move forward through `pending → confirmed → shipped → delivered`. A delivered order has no further action; the control renders as terminal rather than disappearing.
- Cart state is local and honest about it. Quantity and remove actually change what the screen shows, but the state lives in React and resets on reload. Do not add a global store, a context provider, `localStorage`, cookies, or a server action to fake persistence.
- Quantity is bounded: minimum 1 (removing the last unit is the "Remove" action, not decrementing to zero), maximum the product's seeded stock quantity. An out-of-stock line renders its out-of-stock line in `text-error` and blocks checkout for that line rather than silently ordering it.
- No payment step anywhere: no card fields, no payment method selector, no totals labelled tax or shipping cost that imply a charge. Shipping address is display-only seeded text, not an editable form.
- Missing images stay a first-class case. Cart rows, order items, and the seller product table all go through `ProductImage` so a product with no image renders the placeholder well at the right size and never breaks row alignment.
- Loading states are skeletons shaped like the real content, never spinners. Each new `loading.tsx` must match the silhouette of what replaces it.
- Empty states use the existing `EmptyState` component and are reached by real conditions, not pinned as demo sections at the bottom of a populated page. Required: empty cart on `/cart`, no orders on `/orders`, no listings on `/seller/products`, no incoming orders on `/seller/orders`, and no results for a status filter that matches nothing.
- Unknown ids are not crashes: `/orders/<unknown-id>` renders the framework's not-found response.
- The seed data must be varied enough to exercise these screens honestly: at least 3 buyer orders spanning at least three of the four statuses, at least one order containing multiple line items, at least one order containing items from more than one seller, at least 5 seller listings including one inactive and one out of stock, and at least one cart line whose product has no image.
- Seed modules are the only data-access surface. Screens read through exported helpers, never a raw array, and `@/lib/data/*` is not imported anywhere outside these screens and the catalog screens from step 01.
- Wide tables (`ProductTable`, `OrderTable`) scroll inside their own `overflow-x-auto` container so the page body never scrolls horizontally.
- Follow `.claude/specs/ui-architecture.md` for per-component layout: cart rows stack on mobile and go horizontal from `sm` with a 192px image well; the cart summary sits as a `h-fit` sidebar card from `lg`; seller tables use a `surface-muted` `thead` with `label-md` headers and `border-b border-border hover:bg-canvas` rows.

## Definition of done

Verified by running `npm run dev` and exercising the app in a browser, plus a clean `npm run lint && npm run typecheck`:

1. `/cart` renders seeded lines from the step-01 catalog with image, title, price, stock line, and seller — no inline placeholder objects remain in the page file, and no "Empty state" demo section remains at the bottom.
2. Incrementing a cart line's quantity updates that line, the header cart badge, the item count, and the subtotal together and consistently.
3. Decrementing is blocked at quantity 1, and incrementing is blocked at the product's seeded stock quantity, with the disabled control visibly disabled rather than silently inert.
4. Removing a line drops it from the list and recomputes the item count and subtotal; removing the last line renders the `EmptyState` card with a working link back to browsing.
5. "Proceed to Checkout" navigates to `/checkout` and the lines and total shown there match what `/cart` showed.
6. `/checkout` shows the shipping address block, the ordered lines, the item count, and the order total, with no card fields, payment selector, or tax/shipping charge line anywhere on the page.
7. "Place Order" on `/checkout` navigates to `/orders/[id]` for that order and shows the confirmation banner above the order detail.
8. `/orders` lists every seeded order with placed date, total, ship-to, order number, and a status timeline whose filled progress matches that order's status.
9. Clicking an order on `/orders` navigates to its `/orders/[id]` page and shows that order's own line items, quantities, prices at purchase, shipping address, and total — and the confirmation banner is absent when arriving this way.
10. `/orders/<nonexistent-id>` renders the framework's not-found response, not a crash or an empty shell.
11. `/seller` shows the listing and orders-needing-action counts, and its links reach `/seller/products` and `/seller/orders`.
12. `/seller/products` lists the seeded seller's listings with image, name, category, price, stock, and active state; the inactive listing and the out-of-stock listing are each visually distinguishable from a normal row.
13. `/seller/orders` lists the seller's incoming order line items with order number, date, customer, product, quantity, amount, and current status.
14. Advancing an order's status on `/seller/orders` moves it one step forward, updates its badge immediately, and cannot skip a step or move backward.
15. An order already at `delivered` shows a terminal state with no further advance action available.
16. Filtering `/seller/orders` by status narrows the rows to that status, and a filter matching nothing renders the `EmptyState` card rather than a blank table.
17. Navigating to `/cart`, `/orders`, and an order detail page shows a skeleton whose shape matches the content that replaces it, not a spinner.
18. A cart line whose product has no image renders the placeholder well at the same size as a real image, and the row stays aligned with its neighbours.
19. "Proceed to Checkout" and "Place Order" are the only amber elements across all seven screens.
20. At 375px width the cart rows stack, the summary panel drops below the lines, both seller tables scroll inside their own container with no horizontal page scroll, and every control remains tappable at ≥44px.
21. At ≥1024px the cart summary sits as a sidebar beside the lines, and the seller tables render without internal scrolling.
