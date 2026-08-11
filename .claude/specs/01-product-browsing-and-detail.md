# Spec for product-browsing-and-detail

branch: claude/feature/product-browsing-and-detail

## Overview

Build the buyer-facing catalog surface of the marketplace — product home, search/filter, and product detail — as fully static screens driven by local seed data. This is step 01 of the roadmap: it establishes the real routes, the shared catalog data shape, and every presentational state (loaded, loading, empty, error, missing image) before any backend exists, so that wiring Supabase in a later step is a data-source swap rather than a UI rebuild. Today the repo only has a `/shop` demo grid that renders four hardcoded products and a separate "Loading state" section on the same page; this feature replaces that demo with the three routes named in `.claude/specs/visual-architecture.md` and makes each state reachable through normal navigation instead of being pinned side by side on one page.

Scope is deliberately read-only browsing. Add-to-cart renders as a control but performs no state change, and the seller signal on the detail page is display-only text, not a link to a seller storefront.

## Depends on

No previous spec steps. This builds directly on what already exists on `main`:

- The Tailwind v4 token layer in `app/globals.css` (`@theme` block) — colors, type scale, spacing, radii.
- The shared shell in `app/layout.tsx` (header nav, page container, footer).
- The existing primitives in `components/ui/` (`Button`, `Card`, `CardHeader`, `Badge`, `Skeleton`, `EmptyState`, `ErrorState`) and `components/product/` (`ProductCard`, `ProductCardSkeleton`, `StarRating`).
- The presentational view-model types and `formatPrice` in `lib/types/ui.ts`.

## Routes

- GET `/` — Product Home. Hero/intro strip, category chip row, and a responsive grid of featured products. Public.
- GET `/search` — Search & filter results. Reads `q`, `category`, `minPrice`, `maxPrice`, `rating`, `seller`, and `inStock` from the URL query string; renders the filter controls, an active-filter summary, a result count, and the matching product grid. Public.
- GET `/products/[id]` — Product Detail. Gallery, description, buy box, seller signal, availability. Public.

`/shop` is retired — its demo content is superseded by `/` and `/search`. Remove the route and repoint the header's "Shop" nav link at `/`.

The `/sellers/[id]` seller profile route from `visual-architecture.md` is **out of scope** for this step. The detail page shows seller name and a "Sold by" line as plain text, not a link.

Filter state lives entirely in the URL. All three routes stay Server Components; navigation happens through `Link` chips and a plain GET form, so no client-side filter state is introduced.

## Database changes

None. No Supabase client, no migrations, no environment variables. All screens read from a local, in-repo seed module. Any work that would install `@supabase/*` or create `supabase/` belongs to a later step.

## Templates

**Create**

- `app/page.tsx` — replace the current navigation stub with the Product Home screen.
- `app/search/page.tsx` — search and filter results screen.
- `app/products/[id]/page.tsx` — product detail screen.
- `app/search/loading.tsx` — skeleton grid shown while results resolve.
- `app/products/[id]/loading.tsx` — skeleton mirroring the detail layout.
- `app/error.tsx` — root error boundary rendering `ErrorState` with a working retry.

**Modify**

- `app/layout.tsx` — repoint the "Shop" nav item from `/shop` to `/`.
- `components/product/ProductCard.tsx` — link the card to its detail route and handle products with no image.

**Delete**

- `app/shop/page.tsx` — demo grid, superseded.

## Files to change

- `app/layout.tsx` — nav link target only; header, footer, container, and font setup stay as they are.
- `app/page.tsx` — full replacement (currently a placeholder stub still using stock Tailwind classes `text-2xl` / `text-sm`; the replacement must use the project type-scale tokens).
- `components/product/ProductCard.tsx` — wrap in a `Link` to `/products/[id]`, and fall back to the shared image placeholder when `imageUrl` is absent. Keep the existing card silhouette, hover shadow, `line-clamp-2` title, star row, price, and pinned seller/stock line exactly as they are.
- `lib/types/ui.ts` — extend the view-model layer: make `imageUrl` nullable on `Product`, and add types for a category, a seller signal, a product detail (description, image list, stock count, category reference), and the filter/query shape used by `/search`. Keep the existing "TEMPORARY — replaced by Supabase-generated types" header comment, and fix its stale `specs/entity-architecture.md` path to `.claude/specs/entity-architecture.md`.

## Files to create

- `lib/data/products.ts` — the local seed catalog and the only data-access surface for these screens. Exposes read helpers for: all products, featured/home products, a single product by id, and a filtered search. Every screen goes through these helpers, never through the raw array, so the Supabase swap has one seam. Helpers are async so the loading states are real.
- `lib/data/categories.ts` — the fixed v1 category set from `plan/define-the-scope-for-optimized-sonnet.md`: Electronics, Home & Kitchen, Clothing & Accessories, Books, Beauty & Personal Care, Sports & Outdoors, Toys & Games. Each with a display name and slug.
- `app/search/page.tsx`, `app/products/[id]/page.tsx`, `app/search/loading.tsx`, `app/products/[id]/loading.tsx`, `app/error.tsx` — as described under Templates.
- `components/product/ProductGrid.tsx` — the shared responsive grid wrapper (1 / 2 / 3 / 4 columns at base / sm / md / lg) used by home and search, including the empty-result branch.
- `components/product/ProductImage.tsx` — image well with placeholder fallback, shared by card, gallery, and any future row.
- `components/product/ProductGallery.tsx` — detail-page gallery: main image well plus thumbnail strip.
- `components/product/BuyBox.tsx` — detail-page sticky purchase card.
- `components/product/CategoryChips.tsx` — horizontal category chip row, links into `/search?category=`.
- `components/product/SearchFilters.tsx` — the filter panel (keyword, price range, rating, seller, availability).
- `components/product/SellerSignal.tsx` — "Sold by" block: seller name, member-since, listing count.
- `components/product/ProductDetailSkeleton.tsx` — skeleton matching the detail layout for its `loading.tsx`.

## New dependencies

No new dependencies. `next`, `react`, `react-dom`, and Tailwind v4 as already installed cover this entirely.

## Rules for implementation

- Use CSS variables — never hardcode hex values. Every color comes from a `@theme` token class (`bg-canvas`, `bg-surface`, `bg-surface-muted`, `text-text-main`, `text-text-muted`, `border-border`, `text-link`, `text-success`, `text-error`, `bg-accent`). If a needed color has no token, add it to the `@theme` block in `app/globals.css` rather than inlining a hex.
- Use the project type scale only: `text-display-lg`, `text-headline-md`, `text-title-lg`, `text-body-lg`, `text-body-md`, `text-body-sm`, `text-label-md`, `text-label-sm`. Do not use stock Tailwind sizes such as `text-2xl` or `text-sm`, and do not add a `font-weight` utility where the token already carries one.
- Amber (`bg-accent`) is reserved for conversion CTAs. On these screens that means the Add to Cart button and nothing else — not chips, not filter buttons, not the retry action. The one existing exception to preserve is the star glyph color in `StarRating`.
- Tailwind v4: all tokens live in the `@theme` block of `app/globals.css`. Do not create a `tailwind.config.js`.
- Light mode only. Do not add `dark:` variants.
- Server Components throughout. The only `"use client"` file this feature may introduce is `app/error.tsx`, which the framework requires to be a client component. Filters must work with JavaScript disabled — chips are links, the keyword/price/rating panel is a GET form whose fields serialize into the query string.
- Read the relevant guide in `node_modules/next/dist/docs/` before writing route code. Use the globally-generated typed route props (`PageProps<"/products/[id]">`) rather than hand-written `params` / `searchParams` types, and treat those props as async where the framework requires it.
- Strict TypeScript, no `any`. Functional components only.
- Every interactive element needs a ≥44px hit area — `h-touch` / `w-touch`, as `Button` already does. This includes category chips and filter controls.
- Reuse before creating. `ProductCard`, `ProductCardSkeleton`, `StarRating`, `Skeleton`, `EmptyState`, `ErrorState`, `Card`, `CardHeader`, `Badge`, and `formatPrice` all exist and must be used rather than reimplemented. Do not restyle a primitive to fit one screen; extend the primitive.
- Prices render through `formatPrice` — never raw number interpolation.
- Availability is derived from stock count in one place, not recomputed per screen: in stock renders in `text-success`, out of stock in `text-error`, and an out-of-stock product's Add to Cart is disabled.
- Missing images are a first-class case, not a crash. A product with no `imageUrl` renders the placeholder well (`bg-surface-muted`, centered neutral icon, same aspect ratio as a real image) so grid alignment never breaks. At least one seed product must have no image and one must have several.
- Loading states are skeletons shaped like the real content, never spinners. The search and detail skeletons must match the silhouette of what replaces them.
- Empty and error states use the existing `EmptyState` / `ErrorState` components. Empty search results explain what was searched and offer a "Clear filters" action back to unfiltered `/search`.
- The seed catalog must be large and varied enough to exercise the filters honestly: at least 12 products, spanning at least four categories and at least three sellers, with a spread of prices and ratings, and at least two out of stock.
- No add-to-cart behavior. The button renders and is correctly enabled/disabled, but wiring it is a later step. Do not add cart state, context, or local storage.
- Do not import from `@/lib/data/*` anywhere outside these catalog screens, and do not scatter the seed array into components.
- Follow `.claude/specs/ui-architecture.md` for per-component layout: the detail page is a 12-column grid — gallery ~5 columns, description ~4, buy box ~3 as a `sticky top-28` bordered card.

## Definition of done

Verified by running `npm run dev` and exercising the app in a browser, plus a clean `npm run lint && npm run typecheck`:

1. `/` renders a category chip row and a product grid from the seed catalog, with no placeholder/lorem text and no stock Tailwind size classes remaining in the file.
2. The header "Shop" link goes to `/`; navigating to `/shop` no longer resolves to the old demo grid.
3. Clicking any product card anywhere navigates to that product's `/products/[id]` page and shows that product's data.
4. Clicking a category chip lands on `/search?category=<slug>`, and the result grid contains only products in that category.
5. Submitting the filter form with a keyword, a price range, a minimum rating, a seller, and the in-stock toggle narrows the results correctly, and every applied filter is visible in the URL query string.
6. Reloading a filtered `/search` URL directly reproduces the same results — no filter state is lost, because none of it lives in client memory.
7. Filters still work with JavaScript disabled in the browser.
8. A filter combination that matches nothing renders the `EmptyState` card with a working "Clear filters" action, not a blank grid.
9. Navigating to `/search` and to a product detail page shows the skeleton layout before content appears, and the skeleton's shape matches the content that replaces it.
10. Navigating to `/products/<nonexistent-id>` renders the framework's not-found response, not a crash or an empty shell.
11. Forcing a throw inside a catalog page renders `app/error.tsx` with `ErrorState` and a retry control that recovers the page.
12. The seed product with no image renders the placeholder well at the same size as a real image, and its grid row stays aligned with its neighbours.
13. A product with multiple images shows a thumbnail strip, and selecting a thumbnail changes the main image.
14. The detail page shows name, gallery, description, `formatPrice`-formatted price, star rating, category, availability line, and the "Sold by" seller signal.
15. An out-of-stock product shows the out-of-stock line in `text-error` and a visibly disabled Add to Cart button; an in-stock product shows `text-success` and an enabled amber button.
16. Add to Cart is the only amber element on any of these screens.
17. At 375px width the grid is single-column, the detail page stacks, no element requires horizontal page scrolling, and all controls remain tappable at ≥44px.
18. At ≥1024px the grid is four columns and the detail buy box sticks to the viewport while the description scrolls past it.
