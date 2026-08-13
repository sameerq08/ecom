import { connection } from "next/server";
import { findProduct, simulateLatency } from "@/lib/data/seed-catalog";
import type { CartLine, CartTotals } from "@/lib/types/ui";

/**
 * The buyer's cart.
 *
 * TEMPORARY: state lives in a module-level array, so it survives navigation but
 * resets whenever the server process restarts. This is the single data-access
 * seam for the cart — swapping in Supabase replaces the array and the mutators
 * below without changing a signature, exactly as `products.ts` is set up to be.
 *
 * Rows store only `{ id, productId, quantity }`. Product fields are hydrated
 * through `findProduct` on every read, so nothing here can drift from the
 * catalog.
 */

type CartRecord = {
  id: string;
  productId: string;
  quantity: number;
};

function seedCart(): CartRecord[] {
  return [
    { id: "line-1", productId: "premium-noise-cancelling-headphones", quantity: 1 },
    // No image on this listing — exercises the placeholder well in a cart row.
    { id: "line-2", productId: "linen-blend-oxford-shirt", quantity: 2 },
    { id: "line-3", productId: "pour-over-coffee-kettle", quantity: 1 },
    // Out of stock — makes the blocked-checkout branch reachable from a fresh
    // load. Removing this line is what unblocks the CTA.
    { id: "line-4", productId: "smart-video-doorbell", quantity: 1 },
  ];
}

let LINES: CartRecord[] = seedCart();

function hydrate(record: CartRecord): CartLine | null {
  const product = findProduct(record.productId);
  if (!product) return null;

  return {
    id: record.id,
    product,
    quantity: record.quantity,
    maxQuantity: product.stockQty,
  };
}

/**
 * `connection()` keeps reads of the mutable array out of the prerender pass.
 * Without it every screen would be baked at build time and frozen on the seed.
 * Calling it here rather than per-page keeps the seam in one file.
 */
export async function getCart(): Promise<CartLine[]> {
  await connection();
  // Dev-only delay, as in `products.ts`: without it nothing suspends and
  // `app/cart/loading.tsx` would never paint.
  await simulateLatency();
  return LINES.map(hydrate).filter((line): line is CartLine => line !== null);
}

/** No latency here — the header badge blocks every page's shell. */
export async function getCartCount(): Promise<number> {
  await connection();
  return LINES.reduce((sum, line) => sum + line.quantity, 0);
}

/** Pure — totals are derived per render, never stored alongside the lines. */
export function summarizeCart(lines: readonly CartLine[]): CartTotals {
  return {
    itemCount: lines.reduce((sum, line) => sum + line.quantity, 0),
    subtotal: lines.reduce(
      (sum, line) => sum + line.product.price * line.quantity,
      0,
    ),
    hasBlockedLine: lines.some((line) => !line.product.inStock),
  };
}

/** Clamped to [1, stock]. Quantity never reaches zero — that is `removeLine`. */
export function setLineQuantity(lineId: string, quantity: number): void {
  const record = LINES.find((line) => line.id === lineId);
  if (!record) return;

  const product = findProduct(record.productId);
  const ceiling = Math.max(1, product?.stockQty ?? 1);
  record.quantity = Math.min(Math.max(1, quantity), ceiling);
}

export function removeLine(lineId: string): void {
  LINES = LINES.filter((line) => line.id !== lineId);
}

export function clearCart(): void {
  LINES = [];
}
