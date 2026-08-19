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
 * Placed orders.
 *
 * LIVE (this file, below): the buyer-facing reads and the checkout write.
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
 * SEED (bottom of this file, unchanged): `listOrderRecords` and
 * `advanceOrderStatus` still read and write the module-level `ORDERS` array.
 * They serve only `lib/data/seller.ts` / `/seller/orders`, which still key
 * off the seed `CURRENT_SELLER_ID` rather than a real session — migrating
 * them requires the seller auth gate at the same time (RLS requires the
 * caller to actually be the seller), which is separate, tracked work. A
 * **known, temporary consequence** follows directly: an order placed through
 * the real checkout flow below will not appear in `/seller/orders`, because
 * that screen still reads this frozen seed array. This is not a bug to
 * chase — it is the same kind of deliberate seam CLAUDE.md already
 * documents for `CURRENT_SELLER_ID` itself, and it closes when the seller
 * side migrates next.
 */

const BUYER_ADDRESS: readonly string[] = [
  "Jane Doe",
  "48 Kestrel Lane",
  "Apartment 3B",
  "Portland, OR 97209",
];

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

/** No `order_number` column exists (see `.claude/specs/entity-architecture.md`); derived, not stored. */
function orderNumberFor(id: string): string {
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

// ---------------------------------------------------------------------------
// SEED — serves lib/data/seller.ts / `/seller/orders` only. See the module
// comment above for why this half is not migrated in this step.

type OrderItemRecord = {
  id: string;
  productId: string;
  quantity: number;
  /** Snapshot: the catalog price may move afterwards, this must not. */
  priceAtPurchase: number;
  sellerId: string;
};

type OrderRecord = {
  id: string;
  orderNumber: string;
  placedAt: string;
  customerName: string;
  shippingAddress: readonly string[];
  status: OrderStatus;
  items: OrderItemRecord[];
};

const ORDERS: OrderRecord[] = [
  {
    id: "o-1003",
    orderNumber: "#112-9876543",
    placedAt: "May 15, 2026",
    customerName: "Jane Doe",
    shippingAddress: BUYER_ADDRESS,
    status: "pending",
    // Two sellers on one order — the seller queue must show only its own line.
    items: [
      {
        id: "i-1",
        productId: "smart-indoor-security-camera",
        quantity: 1,
        priceAtPurchase: 49.99,
        sellerId: "homesafe",
      },
      {
        id: "i-2",
        productId: "premium-noise-cancelling-headphones",
        quantity: 1,
        priceAtPurchase: 299,
        sellerId: "acoustic",
      },
    ],
  },
  {
    id: "o-1002",
    orderNumber: "#112-4471190",
    placedAt: "May 2, 2026",
    customerName: "Jane Doe",
    shippingAddress: BUYER_ADDRESS,
    status: "shipped",
    items: [
      {
        id: "i-3",
        productId: "cast-iron-skillet-12-inch",
        quantity: 2,
        priceAtPurchase: 34.95,
        sellerId: "homesafe",
      },
    ],
  },
  {
    id: "o-1001",
    orderNumber: "#112-3320087",
    placedAt: "April 18, 2026",
    customerName: "Jane Doe",
    shippingAddress: BUYER_ADDRESS,
    status: "delivered",
    items: [
      {
        id: "i-4",
        productId: "the-pragmatic-shelf-hardback",
        quantity: 1,
        priceAtPurchase: 27.5,
        sellerId: "northpage",
      },
      {
        id: "i-5",
        productId: "pour-over-coffee-kettle",
        quantity: 1,
        priceAtPurchase: 79,
        sellerId: "homesafe",
      },
    ],
  },
];

/** Internal read for the seller queue, which needs item-level detail. */
export function listOrderRecords(): readonly OrderRecord[] {
  return ORDERS;
}

/** Moves one step along `pending → confirmed → shipped → delivered`. Terminal at delivered. */
export function advanceOrderStatus(orderId: string): void {
  const record = ORDERS.find((order) => order.id === orderId);
  if (!record) return;

  const currentIndex = ORDER_STATUS_STEPS.indexOf(record.status);
  const next = ORDER_STATUS_STEPS[currentIndex + 1];
  if (next) {
    record.status = next;
  }
}
