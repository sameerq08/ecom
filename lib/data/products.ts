import { createClient } from "@/lib/supabase/server";
import type {
  Product,
  ProductDetail,
  ProductFilters,
  SellerSignal,
} from "@/lib/types/ui";

/**
 * The public catalog, read from Postgres.
 *
 * This is the data-access seam for browsing: screens call the helpers below and
 * never build a query themselves. Every read here is public and runs as `anon`
 * under `products_select_visible`, so `is_active = false` rows are filtered out
 * by RLS rather than by anything in this file — the seller's own view of their
 * inactive listings is a different policy and a different screen.
 *
 * `Product.id` carries the product **slug**, not the uuid. The routes are
 * `/products/<slug>`, and the seed cart and seed orders in `seed-catalog.ts`
 * still key on slugs; the uuid stays behind this seam.
 *
 * Errors throw. A failed query must reach `app/error.tsx` rather than degrade
 * into an empty grid, which would render as "no such products" — a broken
 * database is not an empty catalog.
 */

/**
 * The homepage rail. `featured` is a presentation flag, not a catalog fact, so
 * per `.claude/specs/entity-architecture.md` it stays in app code instead of
 * becoming a column. These are the 17-item seed's featured entries, in order.
 */
const FEATURED_SLUGS: readonly string[] = [
  "premium-noise-cancelling-headphones",
  "curved-ultrawide-gaming-monitor",
  "mechanical-keyboard-hot-swappable",
  "smart-indoor-security-camera",
  "pour-over-coffee-kettle",
  "linen-blend-oxford-shirt",
  "the-pragmatic-shelf-hardback",
  "insulated-trail-water-bottle",
  "hardwood-building-blocks",
];

/**
 * Columns every card needs, minus the seller embed. `created_at` is selected
 * but not rendered: it is the ordering key, staggered by the seed in catalog
 * order.
 *
 * The seller embed is appended per query rather than shared, because PostgREST
 * rejects a select that names the same embedded table twice — the detail view
 * needs more seller columns than the card, not a second copy of it.
 */
const BASE_COLUMNS =
  "slug, name, price, rating, created_at, product_images (url, sort_order), inventory (stock_qty)";

const CARD_COLUMNS = `${BASE_COLUMNS}, seller_profiles (store_name)`;

const DETAIL_COLUMNS = `${BASE_COLUMNS}, description, categories (slug), seller_profiles (id, store_name, created_at)`;

/** The row shape the select strings above produce. */
type CardRow = {
  slug: string;
  name: string;
  price: number;
  rating: number;
  product_images: { url: string; sort_order: number }[];
  inventory: { stock_qty: number } | null;
  seller_profiles: { store_name: string } | null;
};

type DetailRow = CardRow & {
  description: string;
  categories: { slug: string } | null;
  seller_profiles:
    | { id: string; store_name: string; created_at: string }
    | null;
};

function toImageUrls(row: CardRow): string[] {
  return [...row.product_images]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((image) => image.url);
}

function toProduct(row: CardRow): Product {
  return {
    id: row.slug,
    name: row.name,
    price: row.price,
    rating: row.rating,
    imageUrl: toImageUrls(row)[0] ?? null,
    sellerName: row.seller_profiles?.store_name ?? "Unknown seller",
    inStock: (row.inventory?.stock_qty ?? 0) > 0,
  };
}

/**
 * `%` and `_` are LIKE wildcards and `,` `(` `)` are PostgREST's own filter
 * delimiters, so an unescaped keyword does not just fail to match — it changes
 * what the filter means. Anything unsafe is stripped before interpolation.
 */
function sanitizeKeyword(keyword: string): string {
  return keyword.replace(/[%_,().*\\]/g, " ").trim();
}

export async function getFeaturedProducts(): Promise<Product[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("products")
    .select(CARD_COLUMNS)
    .in("slug", FEATURED_SLUGS)
    .order("created_at");

  if (error) {
    throw new Error(`Failed to load featured products: ${error.message}`);
  }

  return (data as unknown as CardRow[]).map(toProduct);
}

/**
 * One listing by slug, or null when it does not exist or is not publicly
 * visible. Null is the page's cue to render `notFound()`; an inactive listing
 * is indistinguishable from a missing one to anyone but its owner, which is
 * what the select policy already enforces.
 */
export async function getProductById(
  id: string,
): Promise<ProductDetail | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("products")
    .select(DETAIL_COLUMNS)
    .eq("slug", id)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load product "${id}": ${error.message}`);
  }
  if (!data) return null;

  const row = data as unknown as DetailRow;
  const seller = row.seller_profiles;

  return {
    ...toProduct(row),
    description: row.description,
    images: toImageUrls(row),
    stockQty: row.inventory?.stock_qty ?? 0,
    categorySlug: row.categories?.slug ?? "",
    seller: seller
      ? await toSellerSignal(seller.id, seller.store_name, seller.created_at)
      : { id: "", storeName: "Unknown seller", memberSince: "—", listingCount: 0 },
  };
}

/**
 * The public seller signal. `listingCount` is a count-only query rather than a
 * fetched list — the number is all the card renders.
 */
async function toSellerSignal(
  sellerProfileId: string,
  storeName: string,
  createdAt: string,
): Promise<SellerSignal> {
  const supabase = await createClient();

  // `is_active` is filtered explicitly rather than left to RLS: the policy also
  // shows a seller their *own* inactive listings, which would make this public
  // number read higher for the owner than for everyone else.
  const { count, error } = await supabase
    .from("products")
    .select("id", { count: "exact", head: true })
    .eq("seller_profile_id", sellerProfileId)
    .eq("is_active", true);

  if (error) {
    throw new Error(`Failed to count listings for ${storeName}: ${error.message}`);
  }

  return {
    id: sellerProfileId,
    storeName,
    memberSince: new Date(createdAt).getUTCFullYear().toString(),
    listingCount: count ?? 0,
  };
}

/**
 * Resolves a slug to the product's database id and current stock. The uuid
 * otherwise stays behind this seam — `Product.id` is always the slug — but
 * the cart's `cart_items.product_id` foreign key needs the real id, so this
 * is the one deliberate exception. Null for a missing or inactive slug, same
 * visibility as `getProductById`.
 */
export async function getProductRef(
  slug: string,
): Promise<{ id: string; stockQty: number } | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("products")
    .select("id, inventory (stock_qty)")
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to resolve product "${slug}": ${error.message}`);
  }
  if (!data) return null;

  return { id: data.id, stockQty: data.inventory?.stock_qty ?? 0 };
}

/** Store names for the seller filter dropdown, alphabetised. */
export async function getSellerNames(): Promise<string[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("seller_profiles")
    .select("store_name")
    .order("store_name");

  if (error) {
    throw new Error(`Failed to load seller names: ${error.message}`);
  }

  return data.map((seller) => seller.store_name);
}

type RawSearchParams = Record<string, string | string[] | undefined>;

function firstValue(raw: string | string[] | undefined): string | undefined {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function numberValue(raw: string | string[] | undefined): number | undefined {
  const value = firstValue(raw);
  if (value === undefined) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

/** Turns a raw `searchParams` object into validated filters, dropping anything unparseable. */
export function parseProductFilters(params: RawSearchParams): ProductFilters {
  return {
    q: firstValue(params.q),
    category: firstValue(params.category),
    minPrice: numberValue(params.minPrice),
    maxPrice: numberValue(params.maxPrice),
    rating: numberValue(params.rating),
    seller: firstValue(params.seller),
    inStock: firstValue(params.inStock) === "on",
  };
}

export function hasActiveFilters(filters: ProductFilters): boolean {
  return Object.values(filters).some(
    (value) => value !== undefined && value !== false && value !== "",
  );
}

/**
 * Every filter is applied in the query, never in JavaScript — filtering a
 * fetched array would ignore the indexes and quietly break as the catalog
 * grows.
 *
 * The embedded filters need `!inner`: without it PostgREST filters the
 * *embedded rows* and still returns the parent, so an out-of-stock product
 * would come back with an empty `inventory` instead of being excluded.
 */
export async function searchProducts(
  filters: ProductFilters,
): Promise<Product[]> {
  const supabase = await createClient();

  const needsCategoryJoin = Boolean(filters.category);
  const needsSellerJoin = Boolean(filters.seller);
  const needsStockJoin = Boolean(filters.inStock);

  const columns = [
    "slug, name, price, rating, created_at",
    "product_images (url, sort_order)",
    `inventory${needsStockJoin ? "!inner" : ""} (stock_qty)`,
    `seller_profiles${needsSellerJoin ? "!inner" : ""} (store_name)`,
    needsCategoryJoin ? "categories!inner (slug)" : null,
  ]
    .filter(Boolean)
    .join(", ");

  let query = supabase.from("products").select(columns);

  const keyword = filters.q ? sanitizeKeyword(filters.q) : "";
  if (keyword) {
    query = query.or(`name.ilike.%${keyword}%,description.ilike.%${keyword}%`);
  }
  if (filters.category) {
    query = query.eq("categories.slug", filters.category);
  }
  if (filters.minPrice !== undefined) {
    query = query.gte("price", filters.minPrice);
  }
  if (filters.maxPrice !== undefined) {
    query = query.lte("price", filters.maxPrice);
  }
  if (filters.rating !== undefined) {
    query = query.gte("rating", filters.rating);
  }
  if (filters.seller) {
    query = query.eq("seller_profiles.store_name", filters.seller);
  }
  if (filters.inStock) {
    query = query.gt("inventory.stock_qty", 0);
  }

  const { data, error } = await query.order("created_at");

  if (error) {
    throw new Error(`Product search failed: ${error.message}`);
  }

  return (data as unknown as CardRow[]).map(toProduct);
}
