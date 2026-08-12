"use server";

import { revalidatePath } from "next/cache";
import { advanceOrderStatus } from "@/lib/data/orders";

/**
 * Moves an order one step along `pending → confirmed → shipped → delivered`.
 * The step itself is chosen in `advanceOrderStatus`, never sent by the client,
 * so a crafted POST cannot skip ahead or move a status backwards.
 */
export async function advanceStatus(formData: FormData): Promise<void> {
  const orderId = formData.get("orderId");
  if (typeof orderId !== "string" || orderId.length === 0) return;

  advanceOrderStatus(orderId);
  revalidatePath("/", "layout");
}
