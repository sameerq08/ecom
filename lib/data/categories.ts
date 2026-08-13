import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Category } from "@/lib/types/ui";

/**
 * The fixed v1 category set, read from the database. Admin-seeded with no
 * management UI, per `.claude/specs/entity-architecture.md`, so this is
 * read-only: `categories` carries a select policy and nothing else.
 *
 * Wrapped in React `cache()` because a single render usually needs the list
 * twice — the chips and a slug lookup — and this collapses that into one query
 * per request. The cache is per-request, so an admin change still shows up on
 * the next load.
 */
/**
 * Display order for the chips and the filter dropdown, which is curated rather
 * than alphabetical — `20260812153720_seed_categories.sql` inserted them in
 * this order and `categories` has no sort column to record it. Ordering by
 * name in SQL would quietly reshuffle the chip row, so the order lives here,
 * the same call made for the homepage's `featured` flag. A category missing
 * from this list sorts to the end rather than disappearing.
 */
const CATEGORY_ORDER: readonly string[] = [
  "electronics",
  "home-kitchen",
  "clothing-accessories",
  "books",
  "beauty-personal-care",
  "sports-outdoors",
  "toys-games",
];

function displayRank(slug: string): number {
  const index = CATEGORY_ORDER.indexOf(slug);
  return index === -1 ? CATEGORY_ORDER.length : index;
}

export const getCategories = cache(async (): Promise<Category[]> => {
  const supabase = await createClient();

  const { data, error } = await supabase.from("categories").select("slug, name");

  // Throw rather than fall back to an empty list: empty would render as "this
  // marketplace has no categories", which is a lie the error boundary should
  // be telling instead.
  if (error) {
    throw new Error(`Failed to load categories: ${error.message}`);
  }

  return [...data].sort(
    (a, b) => displayRank(a.slug) - displayRank(b.slug) || a.name.localeCompare(b.name),
  );
});

export async function getCategoryBySlug(
  slug: string,
): Promise<Category | undefined> {
  const categories = await getCategories();
  return categories.find((category) => category.slug === slug);
}
