import { createClient } from "@/lib/supabase/server";
import { formatDate, orderNumberFor } from "@/lib/data/orders";
import type {
  OrderStatus,
  Product,
  SellerListingRow,
  SellerOrderItemRow,
  SellerStats,
} from "@/lib/types/ui";

/**
 * The seller-facing view of data that lives in `products.ts` and `orders.ts`.
 * Everything here is derived — this module stores nothing of its own, so a
 * listing or a status can never disagree between the buyer's screens and the
 * seller's.
 *
 * Every export takes the caller's own `sellerProfileId`, resolved once by
 * `requireSellerProfile()` in `lib/supabase/session.ts`. RLS
 * (`products_select_visible`, `order_items_select_participant`) scopes each
 * query to that seller's own rows regardless, but the explicit filter keeps
 * intent visible here rather than relying on the policy alone.
 */

/** A status still awaiting seller action — anything short of delivered. */
function needsAction(status: OrderStatus): boolean {
  return status !== "delivered";
}

type ListingRow = {
  slug: string;
  name: string;
  price: number;
  rating: number;
  is_active: boolean;
  product_images: { url: string; sort_order: number }[];
  inventory: { stock_qty: number } | null;
  categories: { name: string } | null;
};

function toProduct(row: ListingRow, storeName: string): Product {
  const image = [...row.product_images].sort(
    (a, b) => a.sort_order - b.sort_order,
  )[0];

  return {
    id: row.slug,
    name: row.name,
    price: row.price,
    rating: row.rating,
    imageUrl: image?.url ?? null,
    sellerName: storeName,
    inStock: (row.inventory?.stock_qty ?? 0) > 0,
  };
}

/** A seller's own listings, including inactive ones — this is the owner's view. */
export async function getSellerListings(
  sellerProfileId: string,
  storeName: string,
): Promise<SellerListingRow[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("products")
    .select(
      "slug, name, price, rating, is_active, product_images (url, sort_order), inventory (stock_qty), categories (name)",
    )
    .eq("seller_profile_id", sellerProfileId)
    .order("created_at");

  if (error) {
    throw new Error(`Failed to load listings: ${error.message}`);
  }

  return (data as unknown as ListingRow[]).map((row) => ({
    product: toProduct(row, storeName),
    categoryName: row.categories?.name ?? "Uncategorized",
    stockQty: row.inventory?.stock_qty ?? 0,
    active: row.is_active,
  }));
}

type OrderItemQueryRow = {
  id: string;
  order_id: string;
  quantity: number;
  price_at_purchase: number;
  products: { name: string } | null;
  orders: {
    status: OrderStatus;
    created_at: string;
    shipping_address: string;
  };
};

/** The shipping recipient's name is the first line of the joined address (see `getCheckoutAddress`). */
function customerNameFrom(shippingAddress: string): string {
  return shippingAddress.split("\n")[0] || "Customer";
}

/**
 * The seller's own line items, flattened across every order, newest first.
 * An order containing two sellers' products contributes only the rows this
 * seller owns.
 */
export async function getSellerOrderItems(
  sellerProfileId: string,
  status?: OrderStatus,
): Promise<SellerOrderItemRow[]> {
  const supabase = await createClient();

  // `orders!inner` because filtering `orders.status` without it would filter
  // the embedded row but still return the parent `order_items` row.
  let query = supabase
    .from("order_items")
    .select(
      "id, order_id, quantity, price_at_purchase, products (name), orders!inner (status, created_at, shipping_address)",
    )
    .eq("seller_profile_id", sellerProfileId);

  if (status) {
    query = query.eq("orders.status", status);
  }

  const { data, error } = await query.order("created_at", {
    foreignTable: "orders",
    ascending: false,
  });

  if (error) {
    throw new Error(`Failed to load seller orders: ${error.message}`);
  }

  return (data as unknown as OrderItemQueryRow[]).map((row) => ({
    id: row.id,
    orderId: row.order_id,
    orderNumber: orderNumberFor(row.order_id),
    placedAt: formatDate(row.orders.created_at),
    customerName: customerNameFrom(row.orders.shipping_address),
    productName: row.products?.name ?? "Unavailable listing",
    quantity: row.quantity,
    amount: row.price_at_purchase * row.quantity,
    status: row.orders.status,
  }));
}

export async function getSellerStats(
  sellerProfileId: string,
): Promise<SellerStats> {
  const supabase = await createClient();

  const { count, error } = await supabase
    .from("products")
    .select("id", { count: "exact", head: true })
    .eq("seller_profile_id", sellerProfileId)
    .eq("is_active", true);

  if (error) {
    throw new Error(`Failed to count listings: ${error.message}`);
  }

  const rows = await getSellerOrderItems(sellerProfileId);
  const pendingOrderIds = new Set(
    rows.filter((row) => needsAction(row.status)).map((row) => row.orderId),
  );

  return {
    activeListings: count ?? 0,
    ordersNeedingAction: pendingOrderIds.size,
  };
}
