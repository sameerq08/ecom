# Entity Architecture — Ecommerce Marketplace (v1)

The v1 data model: 10 required entities, their fields, and relationships.

```mermaid
erDiagram
    PROFILE ||--o| SELLER_PROFILE : "has (if seller)"
    PROFILE ||--o| CART : "has"
    PROFILE ||--o{ ORDER : "places"
    SELLER_PROFILE ||--o{ PRODUCT : "lists"
    CATEGORY ||--o{ PRODUCT : "classifies"
    PRODUCT ||--o{ PRODUCT_IMAGE : "has"
    PRODUCT ||--|| INVENTORY : "tracked by"
    PRODUCT ||--o{ CART_ITEM : "referenced by"
    CART ||--o{ CART_ITEM : "contains"
    ORDER ||--o{ ORDER_ITEM : "contains"
    PRODUCT ||--o{ ORDER_ITEM : "referenced by"
    SELLER_PROFILE ||--o{ ORDER_ITEM : "fulfills"

    PROFILE {
        uuid id PK
        uuid user_id FK "auth.users"
        text display_name
        text role "buyer | seller"
        timestamptz created_at
    }

    SELLER_PROFILE {
        uuid id PK
        uuid profile_id FK
        text store_name
        text bio
        timestamptz created_at
    }

    CATEGORY {
        uuid id PK
        text name
        text slug
    }

    PRODUCT {
        uuid id PK
        uuid seller_profile_id FK
        uuid category_id FK
        text name
        text description
        numeric price
        numeric rating
        boolean is_active
        timestamptz created_at
    }

    PRODUCT_IMAGE {
        uuid id PK
        uuid product_id FK
        text url
        int sort_order
    }

    INVENTORY {
        uuid id PK
        uuid product_id FK
        int stock_qty
        timestamptz updated_at
    }

    CART {
        uuid id PK
        uuid profile_id FK
        timestamptz created_at
    }

    CART_ITEM {
        uuid id PK
        uuid cart_id FK
        uuid product_id FK
        int quantity
    }

    ORDER {
        uuid id PK
        uuid profile_id FK "buyer"
        text status "pending|confirmed|shipped|delivered"
        text shipping_address
        timestamptz created_at
    }

    ORDER_ITEM {
        uuid id PK
        uuid order_id FK
        uuid product_id FK
        uuid seller_profile_id FK "denormalized"
        int quantity
        numeric price_at_purchase
    }
```

## Relationships

| From | To | Cardinality | Notes |
|---|---|---|---|
| Profile | SellerProfile | 1 — 0..1 | Present only when `role = seller` |
| Profile | Cart | 1 — 0..1 | One active cart per buyer |
| Profile | Order | 1 — N | Buyer's order history |
| SellerProfile | Product | 1 — N | A seller's listings |
| Category | Product | 1 — N | Fixed v1 category set |
| Product | ProductImage | 1 — N | Ordered via `sort_order` |
| Product | Inventory | 1 — 1 | Single stock count per product |
| Cart | CartItem | 1 — N | |
| CartItem | Product | N — 1 | |
| Order | OrderItem | 1 — N | |
| OrderItem | Product | N — 1 | Snapshot price at purchase |
| OrderItem | SellerProfile | N — 1 | Denormalized so a seller can query only their line items across all orders |

## RLS Intent (per table)

| Table | Read | Write |
|---|---|---|
| Profile | Own row (+ public display_name via join where needed) | Owner only |
| SellerProfile | Public | Owner only |
| Category | Public | None (admin-seeded, no UI in v1) |
| Product | Public (where `is_active = true`) | Owner (`seller_profile_id` matches caller) |
| ProductImage | Public | Owner of parent Product |
| Inventory | Public (stock/availability display) | Owner of parent Product |
| Cart | Owner only | Owner only |
| CartItem | Owner (via parent Cart) | Owner (via parent Cart) |
| Order | Owner (buyer) | Insert by owner (buyer) at checkout |
| OrderItem | Owner (buyer, via parent Order) **or** seller where `seller_profile_id` matches caller | Insert by buyer at checkout; `status`-relevant updates happen on `Order`, not `OrderItem`, so seller updates target `Order.status` scoped to orders containing their `OrderItem` rows |

## Coverage Check

Screens: Product Home, Search/Filter, Product Detail, Seller Signal/Profile, Cart, Checkout, Customer Order Status, Seller Dashboard, Product Management, Seller Order Status Updates, Supporting Systems — all covered in `visual-architecture.md`.

Entities: Profile, SellerProfile, Category, Product, ProductImage, Inventory, Cart, CartItem, Order, OrderItem — all covered above.
