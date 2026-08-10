# SPEC.md

## Product Goal
A focused, Amazon-style ecommerce marketplace for physical goods where multiple independent sellers list products and buyers browse, search, purchase, and track orders — without payments, reviews, or fulfillment infrastructure in v1.

## Target Users
- **Buyers** — browse/search products, manage a cart, place orders, track order status.
- **Sellers** — list and manage their own products, view and update the status of orders containing their items.

## Core Screens
- Product Home
- Search / Filter (category, price, rating, seller, availability)
- Product Detail
- Seller Signal / Profile
- Cart
- Checkout
- Customer Order Status
- Seller Dashboard
- Product Management (seller)
- Seller Order Status Updates

(Full navigation and system map: `specs/visual-architecture.md`.)

## Minimum Entities
Profile, SellerProfile, Category, Product, ProductImage, Inventory, Cart, CartItem, Order, OrderItem.

(Full ERD, fields, relationships, RLS intent: `specs/entity-architecture.md`.)

## Non-Goals (v1)
- Product reviews/ratings collection
- Returns and refunds
- Tax handling
- Shipping carrier integrations
- Seller KYC/verification
- Content moderation queues
- Subscriptions
- Real payments (Stripe/Stripe Connect, marketplace payouts)
- Warehouse/inventory operations beyond a simple stock count

## Acceptance Criteria
- A buyer can sign up/log in, browse the home page, search and filter products, open a product detail page, add an item to cart, complete checkout (no payment gateway), and see the resulting order with status in their order history.
- A seller can log in, create/edit/deactivate a product listing from the dashboard, and view/update the status of orders containing their products.
- All data access is enforced by Supabase RLS matching `specs/entity-architecture.md` (public read on catalog data, owner-scoped read/write on cart/order data).
- No screen or flow outside the Core Screens list is required to ship v1.

## Verification Plan
- **Type/lint:** `npm run typecheck` and `npm run lint` clean on every change.
- **RLS:** for each table, confirm an unauthorized user is denied and the rightful owner (or public, where applicable) is allowed — via manual SQL/API checks or automated tests.
- **End-to-end vertical slice:** seller creates a product → buyer finds it via search, opens detail, adds to cart, checks out → seller sees the order and updates its status → buyer sees the updated status. This flow must work before adding polish (wishlist, category chips, empty/loading states).
- **Manual UI pass:** exercise buyer and seller flows in the running dev server after any UI change, not just automated checks.
