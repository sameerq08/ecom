# UI Architecture — Ecommerce Marketplace (v1)

Design rules derived from the Stitch project **Multi-Vendor Retail Marketplace** ("Marketplace Utility Core" theme), translated for Next.js + Tailwind v4.

Tokens live in `app/globals.css` under `@theme`. Tailwind v4 has no `tailwind.config.js` — do not add one.

## Deviations from the Stitch output
Stitch generated Amazon-style trust signals that are **out of v1 scope** (see `SPEC.md` non-goals) and are intentionally omitted: Prime badges, "FREE Returns", "Buy Now", "Save for later", "Secure transaction", review counts, deal badges, delivery-date promises. Star rating display is kept, backed by the static `Product.rating` field — there is no review collection.

The design is **light-mode only** (Stitch `colorMode: LIGHT`). No dark palette is defined.

## Color tokens

| Token | Value | Use |
|---|---|---|
| `primary` | `#131921` | Header/footer/structural navy |
| `on-primary` | `#ffffff` | Text on navy |
| `accent` | `#ff9900` | Primary CTA only (Add to Cart, Place Order) |
| `accent-hover` | `#ffb86f` | CTA hover |
| `on-accent` | `#111111` | Text on amber |
| `surface` | `#ffffff` | Cards, inputs, containers |
| `canvas` | `#f3f3f3` | Page background |
| `surface-muted` | `#eeeeee` | Image wells, table headers, skeletons |
| `text-main` | `#111111` | Primary text |
| `text-muted` | `#565959` | Secondary/meta text |
| `border` | `#c5c6cb` | 1px container borders |
| `link` | `#007185` | Links / interactive text |
| `success` | `#067d62` | In-stock, delivered, timeline fill |
| `error` | `#ba1a1a` | Errors, destructive, out-of-stock |

Amber is reserved for conversion actions. Never use it for body text or decorative fills.

## Typography scale

Inter, loaded via `next/font/google` in `app/layout.tsx`.

| Class | Size / Line height | Weight | Use |
|---|---|---|---|
| `text-display-lg` | 32 / 40 (-0.02em) | 700 | Page titles, empty-state headlines |
| `text-headline-md` | 20 / 28 | 700 | Section headings |
| `text-title-lg` | 18 / 24 | 600 | Prices, card headers |
| `text-body-lg` | 16 / 24 | 400 | Cart item titles, empty-state body |
| `text-body-md` | 14 / 20 | 400 | Default UI text, product titles |
| `text-body-sm` | 12 / 16 | 400 | Meta text, seller/stock lines |
| `text-label-md` | 13 / 18 (+0.01em) | 600 | Table headers, timeline labels |
| `text-label-sm` | 11 / 14 | 700 | Status badges |

## Spacing & shape

8px base grid. Tokens: `base` 8px, `gutter` 16px, `margin-mobile` 16px, `margin-desktop` 24px, `touch` 44px. Page container capped at `--container-page` (1440px), padded `px-4` mobile / `px-6` desktop.

Radii: `rounded-sm` 2px, `rounded` 4px (buttons, inputs, cards), `rounded-lg` 8px (large containers), `rounded-full` (pills, badges, quantity stepper).

## Component patterns

- **Product card** (`components/product/ProductCard.tsx`) — bordered surface card, full height flex column, `shadow-sm hover:shadow-md`. Square image well (`pt-[100%]` + `object-contain p-4`). Body: title `body-md` `line-clamp-2`, star row, price `title-lg` bold, seller + stock line pinned with `mt-auto`.
- **Product detail layout** — 12-col grid: gallery (~5 cols), description (~4), buy box (~3) as a `sticky top-28` bordered card with price, in-stock line, "Sold by" link, qty select, full-width amber Add to Cart.
- **Cart row** (`components/cart/CartRow.tsx`) — stacks on mobile, horizontal from `sm`. Image 192px wide (128px tall) on desktop, title `body-lg` semibold `line-clamp-2`, price right-aligned `title-lg` bold, stock + seller meta, action row with pill `QuantityStepper` and a `Delete` link. Rows separated by `border-b border-border`; subtotal right-aligned below.
- **Order status** (`components/orders/OrderStatusTimeline.tsx`) — summary card (placed / total / ship to / order #) above a horizontal 4-step timeline: `h-1` muted track with a `success` progress overlay, absolutely positioned node dots (current node larger with a white inner dot), `label-md` labels beneath. Steps map to `OrderStatus`: pending → confirmed → shipped → delivered.
- **Seller dashboard list** (`components/seller/OrderTable.tsx`) — card with `CardHeader` (title + "View All"), then `overflow-x-auto` table: `thead` on `surface-muted` with `label-md` headers, rows `border-b border-border hover:bg-canvas`, order number as a link, amount right-aligned, status as a `Badge` pill. Two configurations off one component: `showItemDetail` adds the product/quantity columns and `showActions` adds the status control, so `/seller` and `/seller/orders` cannot drift apart. It exports `statusTones`, the single `OrderStatus` → `BadgeTone` mapping — import it rather than redeclaring one.
- **Cart summary** (`components/cart/CartSummary.tsx`) — `h-fit` sidebar card, full width below `lg` and `w-[320px]` from `lg`. Receives totals already computed by `summarizeCart`; it never recalculates, so the cart and checkout panels cannot disagree. An out-of-stock line surfaces an `error`-toned blocker line above the action slot.
- **Checkout review** — two columns from `lg`: address card plus a "Review your order" card reusing `CartRow` with `editable={false}` (quantity as text, no stepper or delete), beside the `CartSummary` carrying the amber Place Order submit. No payment fields, no tax or shipping charge lines.
- **Order detail** (`app/orders/[id]`) — meta card (placed / total / items / status) above the shared `OrderStatusTimeline`, then a `[1fr_320px]` grid: items card of `OrderItemRow`s beside the read-only address card. Line prices render from `priceAtPurchase`, never the live catalog. `OrderConfirmationBanner` sits above the title on `?placed=1`, `success`-toned rather than amber.
- **Seller listings table** (`components/seller/ProductTable.tsx`) — same table skeleton as `OrderTable`, with a 48px thumbnail well per row. Inactive rows dim to `opacity-60` and carry a neutral "Inactive" `Badge`; zero stock renders "Out of stock" in `text-error`.
- **Status control** (`components/seller/OrderStatusControl.tsx`) — outline button labelled with the *next* status. Only the order id posts; the server picks the step, so it cannot skip or reverse. At `delivered` it renders a muted "Complete" of the same height, keeping the column aligned.

## Loading, empty, and error states

- **Loading** — skeleton blocks (`components/ui/Skeleton.tsx`, `bg-surface-muted animate-pulse`) shaped like the real content (`ProductCardSkeleton` mirrors the card silhouette). Use skeletons, not spinners, for initial page data.
- **Empty** — `components/ui/EmptyState.tsx`: centered bordered card, 96px circular icon well, `display-lg` headline, `body-lg` muted explainer, up to two actions (outline + primary).
- **Error** — `components/ui/ErrorState.tsx` wraps `EmptyState` with an error-toned icon/headline and a single "Try again" action.

## Safe area & touch targets

- All interactive elements have a ≥44px hit area: `Button` is `h-touch`, icon buttons and stepper controls are `h-touch w-touch`, text-link actions inside rows use `flex h-touch items-center`.
- Sticky/fixed regions (header, footer) use the `safe-px` / `safe-pb` utilities in `globals.css`, which apply `max(1rem, env(safe-area-inset-*))`.
- Wide content (tables) scrolls inside its own `overflow-x-auto` container so the page body never scrolls horizontally.

## Types

`lib/types/ui.ts` holds **temporary presentational view-models** (`Product`, `CartLine`, `CartTotals`, `OrderSummary`, `OrderDetail`, `SellerListingRow`, `SellerOrderItemRow`, `OrderStatus`) plus `formatPrice`. These are not database types — they will be replaced by Supabase-generated types and must stay consistent with `.claude/specs/entity-architecture.md`.
