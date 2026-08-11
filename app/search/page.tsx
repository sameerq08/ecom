import Link from "next/link";
import { CategoryChips } from "@/components/product/CategoryChips";
import { ProductGrid } from "@/components/product/ProductGrid";
import { SearchFilters } from "@/components/product/SearchFilters";
import { EmptyState } from "@/components/ui/EmptyState";
import { getCategoryBySlug } from "@/lib/data/categories";
import {
  getSellerNames,
  hasActiveFilters,
  parseProductFilters,
  searchProducts,
} from "@/lib/data/products";
import { formatPrice, type ProductFilters } from "@/lib/types/ui";

function describeFilters(filters: ProductFilters): string[] {
  const summary: string[] = [];

  if (filters.q) summary.push(`“${filters.q}”`);
  if (filters.category) {
    summary.push(getCategoryBySlug(filters.category)?.name ?? filters.category);
  }
  if (filters.minPrice !== undefined && filters.maxPrice !== undefined) {
    summary.push(
      `${formatPrice(filters.minPrice)} – ${formatPrice(filters.maxPrice)}`,
    );
  } else if (filters.minPrice !== undefined) {
    summary.push(`From ${formatPrice(filters.minPrice)}`);
  } else if (filters.maxPrice !== undefined) {
    summary.push(`Up to ${formatPrice(filters.maxPrice)}`);
  }
  if (filters.rating !== undefined) summary.push(`${filters.rating} stars & up`);
  if (filters.seller) summary.push(filters.seller);
  if (filters.inStock) summary.push("In stock only");

  return summary;
}

export default async function SearchPage(props: PageProps<"/search">) {
  const filters = parseProductFilters(await props.searchParams);
  const [products, sellers] = await Promise.all([
    searchProducts(filters),
    getSellerNames(),
  ]);

  const active = describeFilters(filters);
  const isFiltered = hasActiveFilters(filters);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <h1 className="text-display-lg text-text-main">Search</h1>
        <CategoryChips activeSlug={filters.category} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_1fr]">
        <aside>
          <SearchFilters filters={filters} sellers={sellers} />
        </aside>

        <section className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-body-md text-text-muted">
              {products.length} {products.length === 1 ? "result" : "results"}
            </p>
            {isFiltered ? (
              <Link
                href="/search"
                className="flex h-touch items-center text-body-md text-link hover:underline"
              >
                Clear filters
              </Link>
            ) : null}
          </div>

          {active.length > 0 ? (
            <ul className="flex flex-wrap items-center gap-2">
              {active.map((entry) => (
                <li
                  key={entry}
                  className="rounded-full border border-border bg-surface-muted px-3 py-1 text-body-sm text-text-muted"
                >
                  {entry}
                </li>
              ))}
            </ul>
          ) : null}

          <ProductGrid
            products={products}
            emptyState={
              <EmptyState
                icon={<span className="text-display-lg">?</span>}
                title="No matching products"
                description={
                  active.length > 0
                    ? `Nothing matched ${active.join(", ")}. Try widening the price range or clearing a filter.`
                    : "Nothing matched this search. Try a different keyword."
                }
                actions={
                  <Link
                    href="/search"
                    className="inline-flex h-touch w-full items-center justify-center rounded border border-border bg-surface px-4 text-body-md font-bold text-text-main transition-colors hover:bg-surface-muted"
                  >
                    Clear filters
                  </Link>
                }
              />
            }
          />
        </section>
      </div>
    </div>
  );
}
