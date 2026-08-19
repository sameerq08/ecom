"use server";

import { revalidatePath } from "next/cache";
import { advanceOrderStatus } from "@/lib/data/orders";
import { requireSellerProfile } from "@/lib/supabase/session";

/**
 * Moves an order one step along `pending → confirmed → shipped → delivered`.
 * The step itself is chosen in `advanceOrderStatus`, never sent by the client,
 * so a crafted POST cannot skip ahead or move a status backwards.
 *
 * `requireSellerProfile()` redirects a signed-out submission to `/signin`
 * before any write runs; a signed-in buyer's submission simply no-ops here,
 * and a seller submitting an order they don't hold a line item in is caught
 * by RLS inside `advanceOrderStatus`.
 */
export async function advanceStatus(formData: FormData): Promise<void> {
  const seller = await requireSellerProfile();
  if (!seller) return;

  const orderId = formData.get("orderId");
  if (typeof orderId !== "string" || orderId.length === 0) return;

  await advanceOrderStatus(seller.profileId, orderId);
  revalidatePath("/", "layout");
}
