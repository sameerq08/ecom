"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createOrderFromCart } from "@/lib/data/orders";

/**
 * Snapshots the cart into an order, then hands off to that order's detail page
 * with `?placed=1` so it can render the confirmation banner.
 *
 * There is no payment step: this is a state transition, not a transaction.
 */
export async function placeOrder(): Promise<void> {
  const orderId = await createOrderFromCart();

  // Revalidation must precede the redirect — `redirect` throws, so nothing
  // after it runs, and the destination needs the new order to be visible.
  revalidatePath("/", "layout");

  // Null means the cart was empty or held an out-of-stock line. Send the buyer
  // back to the cart, which explains the blockage, rather than to a dead end.
  redirect(orderId ? `/orders/${orderId}?placed=1` : "/cart");
}
