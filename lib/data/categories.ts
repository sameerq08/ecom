import type { Category } from "@/lib/types/ui";

/**
 * The fixed v1 category set. Admin-seeded with no management UI, per
 * `.claude/specs/entity-architecture.md`.
 */
export const CATEGORIES: readonly Category[] = [
  { slug: "electronics", name: "Electronics" },
  { slug: "home-kitchen", name: "Home & Kitchen" },
  { slug: "clothing-accessories", name: "Clothing & Accessories" },
  { slug: "books", name: "Books" },
  { slug: "beauty-personal-care", name: "Beauty & Personal Care" },
  { slug: "sports-outdoors", name: "Sports & Outdoors" },
  { slug: "toys-games", name: "Toys & Games" },
];

export function getCategoryBySlug(slug: string): Category | undefined {
  return CATEGORIES.find((category) => category.slug === slug);
}
