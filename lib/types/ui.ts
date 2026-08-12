/**
 * Presentational view-model types for the UI layer.
 *
 * TEMPORARY: these describe what components render, not the database schema.
 * They will be replaced by Supabase-generated types once the backend is wired up.
 * Keep them consistent with `.claude/specs/entity-architecture.md`.
 */

export type OrderStatus = "pending" | "confirmed" | "shipped" | "delivered";

export const ORDER_STATUS_STEPS: readonly OrderStatus[] = [
  "pending",
  "confirmed",
  "shipped",
  "delivered",
];

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending: "Ordered",
  confirmed: "Confirmed",
  shipped: "Shipped",
  delivered: "Delivered",
};

export type Category = {
  slug: string;
  name: string;
};

export type SellerSignal = {
  id: string;
  storeName: string;
  memberSince: string;
  listingCount: number;
};

export type Product = {
  id: string;
  name: string;
  price: number;
  rating: number;
  /** Null when the listing has no image — render the placeholder well. */
  imageUrl: string | null;
  sellerName: string;
  inStock: boolean;
};

/**
 * Everything the detail screen needs, on top of the card-level `Product`.
 * `images` is ordered; an empty array means "no imagery at all".
 */
export type ProductDetail = Product & {
  description: string;
  images: readonly string[];
  stockQty: number;
  categorySlug: string;
  seller: SellerSignal;
};

/** Parsed, validated `/search` query string. */
export type ProductFilters = {
  q?: string;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  rating?: number;
  seller?: string;
  inStock?: boolean;
};

export type CartLine = {
  id: string;
  product: Product;
  quantity: number;
  /** Stock ceiling for this line's product — the quantity stepper's upper bound. */
  maxQuantity: number;
};

/** Derived totals for a set of cart lines. Computed once, never stored. */
export type CartTotals = {
  itemCount: number;
  subtotal: number;
  /** True when at least one line is out of stock, which blocks checkout. */
  hasBlockedLine: boolean;
};

export type OrderSummary = {
  id: string;
  orderNumber: string;
  placedAt: string;
  total: number;
  shipTo: string;
  status: OrderStatus;
};

/** A single line of a placed order. `priceAtPurchase` is a snapshot, not a live price. */
export type OrderLine = {
  id: string;
  product: Product;
  quantity: number;
  priceAtPurchase: number;
};

export type OrderDetail = OrderSummary & {
  lines: readonly OrderLine[];
  shippingAddress: readonly string[];
  itemCount: number;
};

/** One row of the seller's own listings table. Includes inactive listings. */
export type SellerListingRow = {
  product: Product;
  categoryName: string;
  stockQty: number;
  active: boolean;
};

export type SellerOrderRow = {
  id: string;
  orderNumber: string;
  placedAt: string;
  customerName: string;
  amount: number;
  status: OrderStatus;
};

/** One of the seller's line items across all orders. `status` belongs to the parent order. */
export type SellerOrderItemRow = SellerOrderRow & {
  orderId: string;
  productName: string;
  quantity: number;
};

export type SellerStats = {
  activeListings: number;
  ordersNeedingAction: number;
};

export function formatPrice(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
}
