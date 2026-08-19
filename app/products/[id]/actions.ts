"use server";

import { revalidatePath } from "next/cache";
import { addToCart } from "@/lib/data/cart";
import { requireProfile } from "@/lib/supabase/session";

/**
 * A Server Action is a public POST endpoint, so every field is untrusted and
 * gets validated here rather than relying on the form that renders it.
 * `requireProfile()` redirects a signed-out submission to `/signin` — the
 * "Add to Cart" button has no other signed-out affordance.
 */
export async function addProductToCart(formData: FormData): Promise<void> {
  await requireProfile();

  const productId = formData.get("productId");
  if (typeof productId !== "string" || productId.length === 0) return;

  const raw = formData.get("quantity");
  const quantity = typeof raw === "string" ? Number(raw) : NaN;
  if (!Number.isInteger(quantity) || quantity < 1) return;

  // `addToCart` clamps to current stock and no-ops for an invalid or
  // out-of-stock product; this only rejects unparseable form input.
  await addToCart(productId, quantity);
  revalidatePath("/", "layout");
}
