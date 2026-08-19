import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/supabase/session";
import {
  ORDER_STATUS_STEPS,
  type OrderDetail,
  type OrderLine,
  type OrderStatus,
  type OrderSummary,
} from "@/lib/types/ui";

/**
 * Placed orders — buyer-facing reads, the checkout write, and the
 * seller-facing status advance.
 *
 * `getOrders`, `getOrderById`, and `getCheckoutAddress` read `orders` /
 * `order_items`, scoped by the owner-or-order-seller RLS from step 03
 * (`orders_select_participant`). `createOrderFromCart` is a single call to
 * the `checkout_cart` database function (`supabase/migrations/
 * 20260819135253_checkout_function.sql`) rather than a sequence of writes —
 * see `.claude/specs/08-implement-checkout.md` for why the write has to be
 * one atomic, privileged transaction: a buyer's session cannot legally write
 * `inventory` (sellers own it per RLS), so the stock decrement can only
 * happen inside a `SECURITY DEFINER` function, and doing the whole write
 * there is what keeps two concurrent checkouts on the last unit from
 * overselling it.
 *
 * `advanceOrderStatus` is the seller-facing write, used by
 * `lib/data/seller.ts` / `/seller/orders`. Unlike checkout it needs no
 * privileged function: a seller's own session already has direct RLS grants
 * for both statements it performs — `orders_update_status_by_seller` (plus
 * the `update (status)` column grant) and `order_status_events_insert_
 * participant` — so a plain two-step authenticated write is sufficient.
 */

const BUYER_ADDRESS: readonly string[] = [
  "Jane Doe",
  "48 Kestrel Lane",
  "Apartment 3B",
  "Portland, OR 97209",
];

/** Shared with `lib/data/seller.ts`, which formats the same `orders.created_at`. */
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * No `order_number` column exists (see `.claude/specs/entity-architecture.md`);
 * derived, not stored. Shared with `lib/data/seller.ts`.
 */
export function orderNumberFor(id: string): string {
  return `#${id.slice(0, 8).toUpperCase()}`;
}

type OrderSummaryRow = {
  id: string;
  status: OrderStatus;
  created_at: string;
  order_items: { quantity: number; price_at_purchase: number }[];
};

function toOrderSummary(row: OrderSummaryRow, shipTo: string): OrderSummary {
  return {
    id: row.id,
    orderNumber: orderNumberFor(row.id),
    placedAt: formatDate(row.created_at),
    total: row.order_items.reduce(
      (sum, item) => sum + item.price_at_purchase * item.quantity,
      0,
    ),
    shipTo,
    status: row.status,
  };
}

/** The signed-in buyer's own orders, newest first. Empty (not an error) when signed out. */
export async function getOrders(): Promise<OrderSummary[]> {
  const profile = await getCurrentProfile();
  if (!profile) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("orders")
    .select("id, status, created_at, order_items (quantity, price_at_purchase)")
    .eq("profile_id", profile.profileId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to load orders: ${error.message}`);
  }

  const shipTo = profile.displayName ?? "You";
  return (data as unknown as OrderSummaryRow[]).map((row) =>
    toOrderSummary(row, shipTo),
  );
}

const ORDER_DETAIL_COLUMNS =
  "id, status, created_at, shipping_address, order_items (id, quantity, price_at_purchase, products (slug, name, price, rating, product_images (url, sort_order), inventory (stock_qty), seller_profiles (store_name)))";

type OrderItemRow = {
  id: string;
  quantity: number;
  price_at_purchase: number;
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

type OrderDetailRow = {
  id: string;
  status: OrderStatus;
  created_at: string;
  shipping_address: string;
  order_items: OrderItemRow[];
};

/** A line whose product embed came back null is dropped, same as `cart.ts`'s `toCartLine`. */
function toOrderLine(row: OrderItemRow): OrderLine | null {
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
    priceAtPurchase: row.price_at_purchase,
  };
}

function toOrderDetail(row: OrderDetailRow, shipTo: string): OrderDetail {
  const lines = row.order_items
    .map(toOrderLine)
    .filter((line): line is OrderLine => line !== null);

  return {
    ...toOrderSummary(
      {
        id: row.id,
        status: row.status,
        created_at: row.created_at,
        order_items: row.order_items,
      },
      shipTo,
    ),
    lines,
    shippingAddress: row.shipping_address.split("\n"),
    itemCount: lines.reduce((sum, line) => sum + line.quantity, 0),
  };
}

/**
 * One order, or null when it doesn't exist or the caller can't see it —
 * RLS (`orders_select_participant`) already scopes this to the buyer who
 * placed it or a seller with a line item in it, so the two cases are
 * indistinguishable on purpose: an id belonging to another buyer can't be
 * probed by response shape.
 */
export async function getOrderById(id: string): Promise<OrderDetail | null> {
  const profile = await getCurrentProfile();
  if (!profile) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("orders")
    .select(ORDER_DETAIL_COLUMNS)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load order "${id}": ${error.message}`);
  }
  if (!data) return null;

  return toOrderDetail(data as unknown as OrderDetailRow, profile.displayName ?? "You");
}

/** The address checkout reviews, and the one every new order is stamped with. */
export function getCheckoutAddress(): readonly string[] {
  return BUYER_ADDRESS;
}

/**
 * Snapshots the current cart into a new order via the `checkout_cart`
 * database function and returns the new order id, or null when there was
 * nothing to order (empty cart or a line whose stock came up short between
 * the cart and this click) — the same "nothing to order" contract the seed
 * version had, so `placeOrder` doesn't need to change how it handles it. Any
 * other failure throws.
 */
export async function createOrderFromCart(): Promise<string | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("checkout_cart", {
    p_shipping_address: BUYER_ADDRESS.join("\n"),
  });

  if (error) {
    if (error.message.includes("empty_cart") || error.message.includes("insufficient_stock")) {
      return null;
    }
    throw new Error(`Checkout failed: ${error.message}`);
  }

  return data;
}

/**
 * Moves one order one step along `pending → confirmed → shipped →
 * delivered`, attributed to `changedByProfileId` (the caller's own
 * `profiles.id`, never someone else's). No-op, not an error, when the order
 * doesn't exist, is already `delivered`, or the caller isn't a seller on it
 * — the last case is enforced by RLS: the update below matches zero rows
 * rather than raising, since `orders_update_status_by_seller` silently
 * denies a non-participant seller rather than throwing.
 */
export async function advanceOrderStatus(
  changedByProfileId: string,
  orderId: string,
): Promise<void> {
  const supabase = await createClient();

  const { data: order, error: fetchError } = await supabase
    .from("orders")
    .select("status")
    .eq("id", orderId)
    .maybeSingle();

  if (fetchError) {
    throw new Error(`Failed to load order "${orderId}": ${fetchError.message}`);
  }
  if (!order) return;

  const next = ORDER_STATUS_STEPS[ORDER_STATUS_STEPS.indexOf(order.status) + 1];
  if (!next) return;

  const { data: updated, error: updateError } = await supabase
    .from("orders")
    .update({ status: next })
    .eq("id", orderId)
    .select("id")
    .maybeSingle();

  if (updateError) {
    throw new Error(`Failed to advance order "${orderId}": ${updateError.message}`);
  }
  if (!updated) return;

  const { error: insertError } = await supabase.from("order_status_events").insert({
    order_id: orderId,
    status: next,
    changed_by_profile_id: changedByProfileId,
  });

  if (insertError) {
    throw new Error(`Failed to record status event for "${orderId}": ${insertError.message}`);
  }
}
