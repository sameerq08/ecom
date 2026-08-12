import { connection } from "next/server";
import { listOrderRecords } from "@/lib/data/orders";
import {
  CURRENT_SELLER_ID,
  countActiveListings,
  findProduct,
  getSellerListings as getListingsForSeller,
} from "@/lib/data/products";
import type {
  OrderStatus,
  SellerListingRow,
  SellerOrderItemRow,
  SellerStats,
} from "@/lib/types/ui";

/**
 * The seller-facing view of data that already lives in `products.ts` and
 * `orders.ts`. Everything here is derived — this module stores nothing of its
 * own, so a listing or a status can never disagree between the buyer's screens
 * and the seller's.
 *
 * TEMPORARY: `CURRENT_SELLER_ID` stands in for the session that Supabase Auth
 * will provide. Replacing it is the whole of the seller-side auth swap.
 */

/** A status still awaiting seller action — anything short of delivered. */
function needsAction(status: OrderStatus): boolean {
  return status !== "delivered";
}

export async function getSellerListings(): Promise<SellerListingRow[]> {
  return getListingsForSeller(CURRENT_SELLER_ID);
}

/**
 * The seller's own line items, flattened across every order. An order
 * containing two sellers' products contributes only the rows this seller owns.
 */
export async function getSellerOrderItems(
  status?: OrderStatus,
): Promise<SellerOrderItemRow[]> {
  await connection();

  const rows: SellerOrderItemRow[] = [];

  for (const order of listOrderRecords()) {
    if (status && order.status !== status) continue;

    for (const item of order.items) {
      if (item.sellerId !== CURRENT_SELLER_ID) continue;

      rows.push({
        id: item.id,
        orderId: order.id,
        orderNumber: order.orderNumber,
        placedAt: order.placedAt,
        customerName: order.customerName,
        productName: findProduct(item.productId)?.name ?? "Unavailable listing",
        quantity: item.quantity,
        amount: item.priceAtPurchase * item.quantity,
        status: order.status,
      });
    }
  }

  return rows;
}

export async function getSellerStats(): Promise<SellerStats> {
  const rows = await getSellerOrderItems();
  const pendingOrderIds = new Set(
    rows.filter((row) => needsAction(row.status)).map((row) => row.orderId),
  );

  return {
    activeListings: countActiveListings(CURRENT_SELLER_ID),
    ordersNeedingAction: pendingOrderIds.size,
  };
}
