# V1 Scope — Amazon-Style Ecommerce Marketplace (Physical Goods)

## Context
The repo is currently empty (just a placeholder `package.json`). Before any scaffolding (Next.js + Supabase, per the prior stack decision), the user needs a tight, unambiguous v1 scope so the build stays focused: a physical-goods marketplace where buyers browse/search/cart/checkout/track, and sellers manage listings and order status via a lightweight dashboard — no payments, no reviews, no returns, no seller payouts infrastructure in v1.

This document is the deliverable itself (a scope definition), not a code implementation plan.

---

## 1. Tight V1 Product Scope

**Entities:** Users (role: buyer | seller), Products, Categories, Cart, Cart Items, Orders, Order Items, Order Status.

**In scope (from the required list):**
1. Email/password auth (Supabase Auth) — single account type with a `role` field (buyer/seller); a user can act as a seller if they have a seller profile.
2. Buyer product browsing — paginated/infinite product grid.
3. Product marketplace listings — multi-seller catalog, each product tied to one seller.
4. Search & filters — full-text search by name/description; filters by category, price range, rating (display-only, no review system so rating is a static seed/manual field or omitted — see note below), seller, and availability (in stock/out of stock).
5. Product detail page — images, description, price, stock, seller signal, add-to-cart.
6. Seller profile signal — minimal public seller card (name, member since, # of listings) shown on product detail and listings, not a full storefront.
7. Cart & cart items — persisted per authenticated buyer (Supabase table, RLS-scoped to owner).
8. Checkout — order creation from cart; **no real payment processor** (per exclusions) — v1 checkout is a "place order" action that captures shipping address and creates an order in `pending` status (mock/no-op payment step).
9. Customer order status — buyer-facing order history + status timeline (e.g., pending → confirmed → shipped → delivered).
10. Lightweight seller dashboard — list own products (create/edit/delete/toggle availability), list own incoming orders, update order status via dropdown/buttons.

**Note on "rating" filter:** since reviews are explicitly excluded, "rating" as a filter needs a decision — recommend seeding a simple `rating` numeric field on `products` (manually set or defaulted) purely to support the filter UI in v1, with no review/collection mechanism behind it. Flag this as a decision point for the user.

## 2. Buyer Journey
1. Sign up / log in (email + password).
2. Land on marketplace homepage — browse products, optionally filter by category chips.
3. Search and/or apply filters (category, price, rating, seller, availability).
4. Open a product detail page.
5. Add product to cart (quantity selectable).
6. View cart — adjust quantities, remove items.
7. Checkout — enter/confirm shipping address, place order (no payment gateway; order is created directly).
8. View order confirmation.
9. Track order status from an order history page (list of past orders + current status).

## 3. Seller Workflow
1. Log in (same auth, seller role/profile).
2. Access seller dashboard (separate route, gated by role).
3. **Products tab:** view own listings; create new product (name, description, price, category, stock qty, images); edit/delete; toggle availability.
4. **Orders tab:** view incoming orders containing their products; update order status per order (e.g., pending → confirmed → shipped → delivered).
5. No payout, no KYC, no analytics beyond basic list views in v1.

## 4. Example Product Categories
A small fixed set to keep seed data and filter UI simple:
- Electronics
- Home & Kitchen
- Clothing & Accessories
- Books
- Beauty & Personal Care
- Sports & Outdoors
- Toys & Games

## 5. Out-of-Scope (v1)
- Product reviews/ratings collection
- Returns and refunds
- Tax handling
- Shipping carrier integrations (tracking numbers, label generation)
- Seller KYC/verification
- Content moderation queues
- Subscriptions
- Real payments (Stripe Connect, marketplace payouts, any payment processor)
- Warehouse/inventory operations beyond a simple stock count field

## 6. Safest First Vertical Slice
Build and demo end-to-end before expanding breadth:
1. Auth (sign up/login as buyer or seller).
2. Seller creates 1–2 products from the dashboard.
3. Buyer browses homepage, opens a product detail page, adds to cart.
4. Buyer checks out (no payment) → order created.
5. Seller sees the order in their dashboard and updates its status.
6. Buyer sees the updated status in order history.

This slice exercises every core table (users, products, cart, cart_items, orders, order_items) and both roles without needing search/filters, seller profile polish, or optional features — those layer on once the slice works.

## Open Decision for User
- How should the "rating" filter behave in v1 given reviews are excluded? Recommend: static/manual `rating` field on products, no review UI. Confirm before scaffolding the schema.
