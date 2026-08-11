import { CATEGORIES } from "@/lib/data/categories";
import type { ProductFilters } from "@/lib/types/ui";

const RATING_OPTIONS = [4, 3, 2] as const;

const fieldClass =
  "h-touch w-full rounded border border-border bg-surface px-3 text-body-md text-text-main";
const labelClass = "text-label-md text-text-main";

/**
 * A plain GET form. Submitting serialises every control into the query string,
 * which is the only place filter state lives — so results are shareable,
 * survive a reload, and work with JavaScript disabled.
 */
export function SearchFilters({
  filters,
  sellers,
}: {
  filters: ProductFilters;
  sellers: readonly string[];
}) {
  return (
    <form
      action="/search"
      method="get"
      className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-5"
      aria-label="Filter products"
    >
      <div className="flex flex-col gap-1">
        <label className={labelClass} htmlFor="filter-q">
          Keyword
        </label>
        <input
          id="filter-q"
          name="q"
          type="search"
          defaultValue={filters.q ?? ""}
          placeholder="Search products"
          className={fieldClass}
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className={labelClass} htmlFor="filter-category">
          Category
        </label>
        <select
          id="filter-category"
          name="category"
          defaultValue={filters.category ?? ""}
          className={fieldClass}
        >
          <option value="">All categories</option>
          {CATEGORIES.map((category) => (
            <option key={category.slug} value={category.slug}>
              {category.name}
            </option>
          ))}
        </select>
      </div>

      <fieldset className="flex flex-col gap-1">
        <legend className={labelClass}>Price range</legend>
        <div className="flex items-center gap-2">
          <input
            name="minPrice"
            type="number"
            min="0"
            step="1"
            inputMode="numeric"
            defaultValue={filters.minPrice ?? ""}
            placeholder="Min"
            aria-label="Minimum price"
            className={fieldClass}
          />
          <span className="text-body-sm text-text-muted">to</span>
          <input
            name="maxPrice"
            type="number"
            min="0"
            step="1"
            inputMode="numeric"
            defaultValue={filters.maxPrice ?? ""}
            placeholder="Max"
            aria-label="Maximum price"
            className={fieldClass}
          />
        </div>
      </fieldset>

      <div className="flex flex-col gap-1">
        <label className={labelClass} htmlFor="filter-rating">
          Minimum rating
        </label>
        <select
          id="filter-rating"
          name="rating"
          defaultValue={filters.rating?.toString() ?? ""}
          className={fieldClass}
        >
          <option value="">Any rating</option>
          {RATING_OPTIONS.map((rating) => (
            <option key={rating} value={rating}>
              {rating} stars & up
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label className={labelClass} htmlFor="filter-seller">
          Seller
        </label>
        <select
          id="filter-seller"
          name="seller"
          defaultValue={filters.seller ?? ""}
          className={fieldClass}
        >
          <option value="">All sellers</option>
          {sellers.map((seller) => (
            <option key={seller} value={seller}>
              {seller}
            </option>
          ))}
        </select>
      </div>

      <label
        htmlFor="filter-in-stock"
        className="flex h-touch items-center gap-2 text-body-md text-text-main"
      >
        <input
          id="filter-in-stock"
          name="inStock"
          type="checkbox"
          defaultChecked={filters.inStock}
          className="h-5 w-5 rounded border-border accent-primary"
        />
        In stock only
      </label>

      <button
        type="submit"
        className="inline-flex h-touch items-center justify-center rounded bg-primary px-4 text-body-md font-bold text-on-primary transition-colors hover:bg-primary/90"
      >
        Apply filters
      </button>
    </form>
  );
}
