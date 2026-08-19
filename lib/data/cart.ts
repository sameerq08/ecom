import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/supabase/session";
import { getProductRef } from "@/lib/data/products";
import type { CartLine, CartTotals } from "@/lib/types/ui";

/**
 * The buyer's cart, read from Postgres.
 *
 * One `carts` row per signed-in profile (`carts.profile_id` is unique), found
 * on read and created lazily on the first write. `cart_items` carries only
 * `{ id, cart_id, product_id, quantity }`; every other field is hydrated
 * through the embedded `products` join, so nothing here can drift from the
 * catalog. Every read and write is scoped by the owner-only RLS policies from
 * step 03 (`carts_*_own`, `cart_items_*_own`) — the queries below rely on
 * that rather than re-checking ownership in application code.
 *
 * There is no session-less cart: `getCart`/`getCartCount` return an empty
 * result when signed out rather than throwing, since the header badge and
 * `/checkout` (not yet gated) both call through here on every request.
 */

const LINE_COLUMNS =
  "id, quantity, products (slug, name, price, rating, product_images (url, sort_order), inventory (stock_qty), seller_profiles (store_name))";

type LineRow = {
  id: string;
  quantity: number;
  products: {
    slug: string;
    name: string;
    price: number;
    rating: number;
    product_images: { url: string; sort_order: number }[];
    inventory: { stock_qty: number } | null;
    seller_profiles: { store_name: string } | null;
  } | null;
};

/**
 * A line whose product embed came back null — the product was deleted or
 * deactivated since it was added — is dropped rather than rendered broken.
 */
function toCartLine(row: LineRow): CartLine | null {
  const product = row.products;
  if (!product) return null;

  const image = [...product.product_images].sort(
    (a, b) => a.sort_order - b.sort_order,
  )[0];
  const stockQty = product.inventory?.stock_qty ?? 0;

  return {
    id: row.id,
    product: {
      id: product.slug,
      name: product.name,
      price: product.price,
      rating: product.rating,
      imageUrl: image?.url ?? null,
      sellerName: product.seller_profiles?.store_name ?? "Unknown seller",
      inStock: stockQty > 0,
    },
    quantity: row.quantity,
    maxQuantity: stockQty,
  };
}

/**
 * The caller's `carts.id`, or null when signed out or no cart exists yet.
 * Pass `create: true` to lazily insert one on first write — reads never
 * create a cart just by looking at it.
 */
async function resolveCartId(options: { create: boolean }): Promise<string | null> {
  const profile = await getCurrentProfile();
  if (!profile) return null;

  const supabase = await createClient();

  const { data: existing, error: selectError } = await supabase
    .from("carts")
    .select("id")
    .eq("profile_id", profile.profileId)
    .maybeSingle();

  if (selectError) {
    throw new Error(`Failed to load cart: ${selectError.message}`);
  }
  if (existing) return existing.id;
  if (!options.create) return null;

  const { data: created, error: insertError } = await supabase
    .from("carts")
    .insert({ profile_id: profile.profileId })
    .select("id")
    .single();

  if (insertError) {
    throw new Error(`Failed to create cart: ${insertError.message}`);
  }
  return created.id;
}

export async function getCart(): Promise<CartLine[]> {
  const cartId = await resolveCartId({ create: false });
  if (!cartId) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cart_items")
    .select(LINE_COLUMNS)
    .eq("cart_id", cartId);

  if (error) {
    throw new Error(`Failed to load cart items: ${error.message}`);
  }

  return (data as unknown as LineRow[])
    .map(toCartLine)
    .filter((line): line is CartLine => line !== null);
}

export async function getCartCount(): Promise<number> {
  const cartId = await resolveCartId({ create: false });
  if (!cartId) return 0;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cart_items")
    .select("quantity")
    .eq("cart_id", cartId);

  if (error) {
    throw new Error(`Failed to load cart count: ${error.message}`);
  }
  return data.reduce((sum, row) => sum + row.quantity, 0);
}

/** Pure — totals are derived per render, never stored alongside the lines. */
export function summarizeCart(lines: readonly CartLine[]): CartTotals {
  return {
    itemCount: lines.reduce((sum, line) => sum + line.quantity, 0),
    subtotal: lines.reduce(
      (sum, line) => sum + line.product.price * line.quantity,
      0,
    ),
    hasBlockedLine: lines.some((line) => !line.product.inStock),
  };
}

/** Clamped to [1, stock]. Quantity never reaches zero — that is `removeLine`. */
export async function setLineQuantity(
  lineId: string,
  quantity: number,
): Promise<void> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("cart_items")
    .select("products (inventory (stock_qty))")
    .eq("id", lineId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load cart line "${lineId}": ${error.message}`);
  }
  if (!data) return;

  const row = data as unknown as {
    products: { inventory: { stock_qty: number } | null } | null;
  };
  const ceiling = Math.max(1, row.products?.inventory?.stock_qty ?? 1);
  const clamped = Math.min(Math.max(1, quantity), ceiling);

  const { error: updateError } = await supabase
    .from("cart_items")
    .update({ quantity: clamped })
    .eq("id", lineId);

  if (updateError) {
    throw new Error(`Failed to update cart line "${lineId}": ${updateError.message}`);
  }
}

export async function removeLine(lineId: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("cart_items").delete().eq("id", lineId);

  if (error) {
    throw new Error(`Failed to remove cart line "${lineId}": ${error.message}`);
  }
}

export async function clearCart(): Promise<void> {
  const cartId = await resolveCartId({ create: false });
  if (!cartId) return;

  const supabase = await createClient();
  const { error } = await supabase.from("cart_items").delete().eq("cart_id", cartId);

  if (error) {
    throw new Error(`Failed to clear cart: ${error.message}`);
  }
}

/**
 * Adds a product to the caller's cart, or increments its existing line if
 * it's already there — clamped to the product's current stock either way. A
 * signed-out caller, an unresolvable slug, or a zero-stock product are all
 * silent no-ops: the calling Server Action is responsible for the signed-out
 * redirect, and `BuyBox` already keeps a zero-stock product out of this path,
 * so this is the defensive floor, not the primary guard.
 */
export async function addToCart(
  productSlug: string,
  quantity: number,
): Promise<void> {
  const profile = await getCurrentProfile();
  if (!profile) return;

  const ref = await getProductRef(productSlug);
  if (!ref || ref.stockQty <= 0) return;

  const cartId = await resolveCartId({ create: true });
  if (!cartId) return;

  const supabase = await createClient();
  const desired = Math.max(1, quantity);

  const { data: existing, error: selectError } = await supabase
    .from("cart_items")
    .select("id, quantity")
    .eq("cart_id", cartId)
    .eq("product_id", ref.id)
    .maybeSingle();

  if (selectError) {
    throw new Error(
      `Failed to load cart line for "${productSlug}": ${selectError.message}`,
    );
  }

  if (existing) {
    const newQuantity = Math.min(existing.quantity + desired, ref.stockQty);
    const { error } = await supabase
      .from("cart_items")
      .update({ quantity: newQuantity })
      .eq("id", existing.id);

    if (error) {
      throw new Error(
        `Failed to update cart line for "${productSlug}": ${error.message}`,
      );
    }
    return;
  }

  const { error } = await supabase.from("cart_items").insert({
    cart_id: cartId,
    product_id: ref.id,
    quantity: Math.min(desired, ref.stockQty),
  });

  if (error) {
    throw new Error(`Failed to add "${productSlug}" to cart: ${error.message}`);
  }
}
