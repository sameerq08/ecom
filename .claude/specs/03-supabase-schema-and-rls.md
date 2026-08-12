# Spec for supabase-schema-and-rls

branch: claude/feature/supabase-schema-and-rls

## Overview

Stand up the Supabase backend that every screen built in steps 01 and 02 will eventually read from: email/password auth, the eleven marketplace tables, and the row-level security policies that enforce the access rules in `.claude/specs/entity-architecture.md`. Today the whole app runs on local seed modules in `lib/data/` with mutable module-level state that resets on every server restart, and there is no notion of a user at all — `CURRENT_SELLER_ID` is a hardcoded string standing in for a session. This step creates the database that replaces that.

Scope is deliberately **backend-only**. This step creates schema, policies, and the documented environment variable names; it does **not** install a Supabase client, does not add `lib/supabase/` helpers, does not touch a single screen or Server Action, and does not migrate `lib/data/` off its seed arrays. Every route keeps rendering exactly what it renders today. Splitting it this way means the RLS policies can be proven correct against both an authorized and an unauthorized role *before* any UI depends on them, which is the order `SPEC.md`'s verification plan asks for. The application swap — clients, session handling, auth screens, and rewriting the four `lib/data/` modules against real queries — is the next step and has its own spec.

The target Supabase project (`xzurhfeetpwthaswutnc`, already wired up in the gitignored `.mcp.json`) is currently empty: no tables in `public`, no migration history, and no registered users. Every change here is therefore additive against a clean slate, applied through the `mcp__supabase__apply_migration` tool.

## Depends on

- Step 01 (`.claude/specs/01-product-browsing-and-detail.md`) and step 02 (`.claude/specs/02-order-cart-and-checkout.md`) — both complete. Their seed shapes in `lib/data/` and the view-models in `lib/types/ui.ts` define the columns this schema has to be able to serve. Notably: `Product` (name, description, price, rating, images, stock, active flag, seller, category), `CartLine`, `OrderDetail`, `SellerListingRow`, and the `OrderStatus` union `pending | confirmed | shipped | delivered`.
- `.claude/specs/entity-architecture.md` — the authoritative ERD and per-table RLS intent. This spec implements it and extends it by one table (see "Divergence from the ERD" below).
- `.claude/specs/visual-architecture.md` — the per-screen "Auth Requirement" column, which is what the policies must ultimately enforce.
- An authenticated Supabase MCP connection to the project. All DDL goes through it.

No npm-level dependency is required, because no application code changes.

## Routes

No new routes. No existing route changes behavior. This step adds no pages, no Server Actions, and no route handlers.

## Database changes

This is the entirety of the step. All DDL is applied via `mcp__supabase__apply_migration` (never `execute_sql`, which is for reads and verification only), one migration per logical concern so that a failure is easy to isolate and re-apply.

### Auth

Email/password only. No OAuth providers, no magic links, no phone auth in v1. Supabase Auth owns `auth.users`; the app never writes to it directly and never reads from it outside of policy predicates and the signup trigger.

A profile row must exist for every user. Rather than making the client responsible for creating it (which would need an insert policy on `profiles` that is awkward to scope safely), a `SECURITY DEFINER` trigger on new `auth.users` rows creates the matching `profiles` row automatically, defaulting `role` to `buyer` and taking `display_name` from the signup metadata when present. Becoming a seller is a separate, later action that creates a `seller_profiles` row and flips the role.

### Tables

Eleven tables in `public`. All primary keys are `uuid` defaulting to a generated value; all foreign keys are declared with explicit `on delete` behavior; all timestamps are `timestamptz` defaulting to now.

| Table | Purpose | Key columns beyond `id` | Delete behavior |
|---|---|---|---|
| `profiles` | One row per auth user | `user_id` → `auth.users` (unique), `display_name`, `role` (`buyer` \| `seller`), `created_at` | Cascade from user |
| `seller_profiles` | Present only for sellers | `profile_id` → `profiles` (unique), `store_name`, `bio`, `created_at` | Cascade from profile |
| `categories` | Fixed v1 category set | `name`, `slug` (unique) | Restrict if products reference it |
| `products` | Listings | `seller_profile_id`, `category_id`, `name`, `description`, `price`, `rating`, `is_active`, `created_at` | Cascade from seller profile |
| `product_images` | Ordered gallery | `product_id`, `url`, `sort_order` | Cascade from product |
| `inventory` | One stock count per product | `product_id` (unique), `stock_qty`, `updated_at` | Cascade from product |
| `carts` | One active cart per buyer | `profile_id` (unique), `created_at` | Cascade from profile |
| `cart_items` | Cart lines | `cart_id`, `product_id`, `quantity`, unique on (`cart_id`, `product_id`) | Cascade from cart |
| `orders` | Placed orders | `profile_id` (buyer), `status`, `shipping_address`, `created_at` | Restrict — orders are records, not disposable |
| `order_items` | Order lines | `order_id`, `product_id`, `seller_profile_id` (denormalized), `quantity`, `price_at_purchase` | Cascade from order |
| `order_status_events` | Append-only status history | `order_id`, `status`, `changed_by_profile_id`, `note`, `created_at` | Cascade from order |

Constraints that matter for correctness, expressed as database checks rather than left to application code: `quantity` and `stock_qty` are non-negative, `price` and `price_at_purchase` are non-negative, `rating` falls within 0–5, and `status` is constrained to the four-value `OrderStatus` union. Order status is modelled as a Postgres enum type so that an invalid transition target fails at the database boundary. Indexes are added on every foreign key that policies or list screens filter by — in particular `products.seller_profile_id`, `products.category_id`, `order_items.seller_profile_id`, and `order_items.order_id` — because each of those is on the hot path of a policy predicate.

### Divergence from the ERD

`order_status_events` is an **eleventh** table; `.claude/specs/entity-architecture.md` documents ten. It exists because order status is a single field on `orders` that sellers mutate, which means the previous value is destroyed on every transition and there is no record of who advanced it. An append-only event row per transition gives the buyer's status timeline a real source of timestamps instead of inferred ones, and gives the seller-side update path an audit trail.

Per the CLAUDE.md rule on schema divergence, `.claude/specs/entity-architecture.md` must be updated in this step: add the entity to the ERD and the relationship table, add its row to the RLS intent table, and correct the "10 required entities" line and the Coverage Check. `SPEC.md`'s "Minimum Entities" line is left alone — it lists the *minimum*, and the ten it names are all still present.

A known limitation to record rather than solve: status lives on the order, not the line item, so in an order containing two sellers' products either seller advances the status for the whole order. This is inherited from the ERD's RLS note and is accepted for v1. `order_status_events.changed_by_profile_id` at least makes it attributable.

### RLS policies

RLS is enabled on all eleven tables, with **no** table left permissive by default — a table with RLS enabled and zero policies denies everything, which is the correct failure mode while policies are being built up.

Policies are written per-operation (separate select / insert / update / delete) rather than as one blanket `for all`, so that "public can read" never accidentally implies "public can write". Ownership is resolved through `SECURITY DEFINER` helper functions that map the current JWT subject to the caller's `profiles.id` and, where relevant, their `seller_profiles.id`. Using helpers rather than inline sub-selects is a hard requirement: a policy on `profiles` that queries `profiles` re-enters RLS and recurses infinitely, and the helper's definer rights break that cycle. The helpers must be schema-qualified with an empty or fixed `search_path` so they cannot be hijacked.

| Table | Select | Insert / Update / Delete |
|---|---|---|
| `profiles` | Own row | Update own row only. No client insert — the signup trigger owns creation. No delete. |
| `seller_profiles` | Public | Owner (the profile it belongs to) may insert and update their own; no delete |
| `categories` | Public | None — admin-seeded, no client write path in v1 |
| `products` | Public where `is_active`; owning seller sees their own regardless of the flag | Owning seller only |
| `product_images` | Public, where the parent product is publicly visible | Owner of the parent product |
| `inventory` | Public, where the parent product is publicly visible | Owner of the parent product |
| `carts` | Owner | Owner |
| `cart_items` | Owner via parent cart | Owner via parent cart |
| `orders` | Buyer who owns it; a seller may read orders containing their line items | Insert by the buyer at checkout. Update restricted to `status`, and only by a seller with a line item in that order. No delete. |
| `order_items` | Buyer via parent order, or seller where `seller_profile_id` matches | Insert by the buyer at checkout, only into their own order. No update, no delete — line items are an immutable purchase record. |
| `order_status_events` | Same audience as the parent order (buyer, or a seller with a line item in it) | Insert only by someone entitled to change that order's status. No update, no delete — append-only. |

The seller-visibility rule on `products` deserves a note: a plain "public where `is_active`" policy would make a seller's own deactivated listings vanish from `/seller/products`, which is exactly the screen that has to show them. The select policy therefore reads as "active, or mine".

Two things this step explicitly does **not** enforce in RLS, because they are transactional rather than row-scoped: decrementing `inventory.stock_qty` at checkout, and validating that `price_at_purchase` matches the product's current price. Both belong in a database function in the application-wiring step. This spec notes them so they are not mistaken for oversights.

### Seed data

`categories` is seeded with the seven fixed categories already hardcoded in `lib/data/categories.ts`, using the same slugs, so that the later data-layer swap does not have to reconcile two different category vocabularies. No products, profiles, or orders are seeded — those arrive with real signups, and the local seed catalog keeps driving the UI until the next step.

### Environment variables

Names only. **No secret values are written to any file in the repo, printed to the terminal, or committed.** `.env.example` documents the names with empty or placeholder values; `.env.local` is created by the developer and is already covered by the gitignored `.env*` pattern.

- `NEXT_PUBLIC_SUPABASE_URL` — project URL, safe to expose to the browser.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — anon/publishable key, safe to expose; RLS is what protects the data behind it.
- `SUPABASE_SERVICE_ROLE_KEY` — server-only, bypasses RLS entirely. Never `NEXT_PUBLIC_`-prefixed, never imported into a client component, never referenced from anything reachable by the browser bundle. Not used by any code in this step; documented now so the boundary is established before there is a temptation to reach for it.

## Templates

No templates. This step renders nothing — there are no new or modified `.tsx` files, no components, and no styling work.

## Files to change

- `.claude/specs/entity-architecture.md` — add `order_status_events` to the ERD, the relationships table, and the RLS intent table; correct the entity count and Coverage Check.
- `CLAUDE.md` — update "Current state — read this first" so it no longer says the backend does not exist. Record that the schema and RLS are live but that `lib/data/` still drives every screen, and add the migration workflow (apply via MCP `apply_migration`, mirror the SQL into `supabase/migrations/`). Add step 03 to the completed-steps line.
- `.gitignore` — confirm the existing `.env*` pattern covers `.env.local`, and add an explicit negation for `.env.example` so the documented names can be committed.

## Files to create

- `supabase/migrations/<timestamp>_<name>.sql` — one file per applied migration, mirroring exactly what was sent through `apply_migration`. The MCP tool records migration history remotely; committing the SQL keeps the repo the readable source of truth and makes the schema reviewable in a diff.
- `.env.example` — the three variable names above, with **empty values**.
- `lib/types/database.ts` — types generated by `mcp__supabase__generate_typescript_types`, committed unmodified. Never hand-edited; regenerated whenever the schema changes. Nothing imports it yet.

No `lib/supabase/` directory is created in this step — there is no client to configure yet, and an unused helper file would be dead code inviting ad hoc use.

## New dependencies

No new dependencies. `@supabase/supabase-js` and `@supabase/ssr` are needed by the *next* step, when application code first talks to the database. Installing them here would add unused packages to the bundle graph.

## Rules for implementation

- Use CSS variables — never hardcode hex values. (No UI work falls in this step; the rule stands for any incidental markup.)
- All DDL goes through `mcp__supabase__apply_migration`. `execute_sql` is for verification queries only. Every migration is idempotent-safe to re-run where practical and is mirrored into `supabase/migrations/` in the same change.
- Never print, echo, log, or write a real key, connection string, or password. Secret *names* only. If a value is ever surfaced by a tool, do not copy it into a file or the transcript.
- Enable RLS on every table in the same migration that creates it, so no table is ever briefly readable by the world.
- Ownership predicates use `SECURITY DEFINER` helper functions with a pinned `search_path`, not inline sub-selects against RLS-protected tables. Recursive policies are the single most likely failure mode here.
- Write separate policies per operation. Do not use a blanket `for all` policy on any table.
- Prefer database-level constraints (checks, enums, unique, foreign keys) over trusting application code, since the application layer is being rewritten in the next step and the constraints must survive that.
- Do not modify anything under `lib/data/`, `app/`, or `components/`. If a screen changes behavior, the step has overreached.
- Run `mcp__supabase__get_advisors` for both `security` and `performance` after the final migration, and resolve or explicitly justify every finding.
- Cross-check the finished schema against `.claude/specs/entity-architecture.md` and update that spec wherever they diverge — do not silently let them drift.
- `npm run lint` and `npm run typecheck` must pass, including with the generated `lib/types/database.ts` present.

## Definition of done

1. `mcp__supabase__list_tables` on `public` returns all eleven tables, each reporting `rls_enabled: true`.
2. `mcp__supabase__list_migrations` shows the applied migrations, and the same SQL exists under `supabase/migrations/` in the working tree.
3. A user can be created with email and password, and a matching `profiles` row appears automatically with `role = 'buyer'` — verified by querying the profile after signup, not by assuming the trigger fired.
4. **Anonymous role:** can select `categories`, `seller_profiles`, active `products`, and their `product_images` and `inventory`. Cannot select any row of `profiles`, `carts`, `cart_items`, `orders`, `order_items`, or `order_status_events`. Cannot insert or update anything, in any table.
5. **Buyer A (authenticated):** can read and update their own profile, their own cart and cart items, and their own orders, order items, and status events. Reading Buyer B's equivalents returns zero rows rather than an error. Attempting to insert a cart item into Buyer B's cart, or an order under Buyer B's profile, is rejected.
6. **Seller (authenticated):** can insert, update, and read their own products, product images, and inventory, including listings with `is_active = false`. Cannot modify another seller's product, image, or inventory row. Can read the orders and order items containing their own products and no others — an order containing only another seller's items is invisible to them.
7. **Seller status update:** a seller with a line item in an order can advance that order's `status` and insert the corresponding `order_status_events` row. A seller with no line item in that order cannot. No role can update or delete an existing `order_status_events` row, or delete an `order_items` row.
8. Each of items 4–7 is verified against **both** an allowed and a denied role, per `SPEC.md`'s verification plan. A policy is not considered done on the strength of the happy path alone.
9. `mcp__supabase__get_advisors` returns no unresolved `security` findings; any remaining `performance` finding is recorded with a reason.
10. `categories` contains the seven rows matching the slugs in `lib/data/categories.ts`.
11. `.env.example` lists the three variable names with no values, and `git log -p` for this branch contains no secret.
12. `npm run lint` and `npm run typecheck` pass, and `npm run dev` serves every existing route exactly as it did before this step — the app is still running entirely on `lib/data/` seed data.
