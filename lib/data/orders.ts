import { connection } from "next/server";
import { getCart, clearCart, summarizeCart } from "@/lib/data/cart";
import { findProduct, simulateLatency } from "@/lib/data/products";
import {
  ORDER_STATUS_STEPS,
  type OrderDetail,
  type OrderLine,
  type OrderStatus,
  type OrderSummary,
} from "@/lib/types/ui";

/**
 * Placed orders, for both the buyer's history and the seller's incoming queue.
 *
 * TEMPORARY: module-level state, same lifetime and same swap seam as `cart.ts`.
 *
 * Status lives on the order, not on its items — per the RLS note in
 * `.claude/specs/entity-architecture.md`, a seller updates `Order.status` for
 * orders containing their line items. That is why advancing a status on
 * `/seller/orders` changes what the buyer sees on `/orders/[id]`: one field,
 * one store.
 */

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

const BUYER_ADDRESS: readonly string[] = [
  "Jane Doe",
  "48 Kestrel Lane",
  "Apartment 3B",
  "Portland, OR 97209",
];

let ORDERS: OrderRecord[] = [
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

function hydrateLine(item: OrderItemRecord): OrderLine | null {
  const product = findProduct(item.productId);
  if (!product) return null;

  return {
    id: item.id,
    product,
    quantity: item.quantity,
    priceAtPurchase: item.priceAtPurchase,
  };
}

function orderTotal(record: OrderRecord): number {
  return record.items.reduce(
    (sum, item) => sum + item.priceAtPurchase * item.quantity,
    0,
  );
}

function toSummary(record: OrderRecord): OrderSummary {
  return {
    id: record.id,
    orderNumber: record.orderNumber,
    placedAt: record.placedAt,
    total: orderTotal(record),
    shipTo: record.customerName,
    status: record.status,
  };
}

function toDetail(record: OrderRecord): OrderDetail {
  const lines = record.items
    .map(hydrateLine)
    .filter((line): line is OrderLine => line !== null);

  return {
    ...toSummary(record),
    lines,
    shippingAddress: record.shippingAddress,
    itemCount: lines.reduce((sum, line) => sum + line.quantity, 0),
  };
}

export async function getOrders(): Promise<OrderSummary[]> {
  await connection();
  await simulateLatency();
  return ORDERS.map(toSummary);
}

export async function getOrderById(id: string): Promise<OrderDetail | null> {
  await connection();
  await simulateLatency();
  const record = ORDERS.find((order) => order.id === id);
  return record ? toDetail(record) : null;
}

/** The address checkout reviews, and the one every new order is stamped with. */
export function getCheckoutAddress(): readonly string[] {
  return BUYER_ADDRESS;
}

/** Internal read for the seller queue, which needs item-level detail. */
export function listOrderRecords(): readonly OrderRecord[] {
  return ORDERS;
}

function formatToday(): string {
  return new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Snapshots the current cart into a new order and empties the cart.
 * Returns the new order id so the caller can redirect to its detail page.
 */
export async function createOrderFromCart(): Promise<string | null> {
  const lines = await getCart();
  const { hasBlockedLine } = summarizeCart(lines);

  // An out-of-stock line cannot be ordered; the checkout screen blocks this too.
  if (lines.length === 0 || hasBlockedLine) return null;

  const sequence = 1004 + ORDERS.length;
  const id = `o-${sequence}`;

  ORDERS = [
    {
      id,
      // Offset into 7 digits so generated numbers sit alongside the seeded
      // ones without a run of leading zeros.
      orderNumber: `#112-${1000000 + sequence}`,
      placedAt: formatToday(),
      customerName: "Jane Doe",
      shippingAddress: BUYER_ADDRESS,
      status: "pending",
      items: lines.map((line, index) => ({
        id: `${id}-i-${index + 1}`,
        productId: line.product.id,
        quantity: line.quantity,
        priceAtPurchase: line.product.price,
        sellerId: findProduct(line.product.id)?.seller.id ?? "unknown",
      })),
    },
    ...ORDERS,
  ];

  clearCart();
  return id;
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
