"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createOrderFromCart } from "@/lib/data/orders";
import { requireProfile } from "@/lib/supabase/session";

/**
 * Snapshots the cart into an order via the `checkout_cart` database
 * function, then hands off to that order's detail page with `?placed=1` so
 * it can render the confirmation banner. `requireProfile()` redirects a
 * signed-out submission to `/signin` before the transaction runs — RLS would
 * also reject it, but this avoids a wasted round trip.
 *
 * There is no payment step: placing an order records it and decrements
 * stock; it does not charge anything.
 */
export async function placeOrder(): Promise<void> {
  await requireProfile();
  const orderId = await createOrderFromCart();

  // Revalidation must precede the redirect — `redirect` throws, so nothing
  // after it runs, and the destination needs the new order to be visible.
  revalidatePath("/", "layout");

  // Null means the cart was empty or held an out-of-stock line. Send the buyer
  // back to the cart, which explains the blockage, rather than to a dead end.
  redirect(orderId ? `/orders/${orderId}?placed=1` : "/cart");
}
