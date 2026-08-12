"use server";

import { revalidatePath } from "next/cache";
import { removeLine, setLineQuantity } from "@/lib/data/cart";

/**
 * A Server Action is a public POST endpoint, so every field is untrusted and
 * gets validated here rather than relying on the form that renders it.
 *
 * `revalidatePath("/", "layout")` refreshes the root layout as well as the
 * page, which is what keeps the header's cart badge in step with the lines.
 * Page-scoped revalidation would leave the badge stale.
 */

function readString(formData: FormData, key: string): string | null {
  const value = formData.get(key);
  return typeof value === "string" && value.length > 0 ? value : null;
}

export async function updateQuantity(formData: FormData): Promise<void> {
  const lineId = readString(formData, "lineId");
  const raw = readString(formData, "quantity");
  if (!lineId || !raw) return;

  const quantity = Number(raw);
  if (!Number.isInteger(quantity)) return;

  // `setLineQuantity` clamps to [1, stock]; this only rejects unparseable input.
  setLineQuantity(lineId, quantity);
  revalidatePath("/", "layout");
}

export async function removeFromCart(formData: FormData): Promise<void> {
  const lineId = readString(formData, "lineId");
  if (!lineId) return;

  removeLine(lineId);
  revalidatePath("/", "layout");
}
