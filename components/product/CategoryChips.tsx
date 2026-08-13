import Link from "next/link";
import { getCategories } from "@/lib/data/categories";

/**
 * Category filter entry points. These are links, not buttons, so filtering
 * works without JavaScript and every category view has a shareable URL.
 *
 * Reads the category list itself rather than taking it as a prop: it is used on
 * more than one screen and needs no other data, and `getCategories` is
 * request-cached so rendering it beside a category lookup is still one query.
 */
export async function CategoryChips({ activeSlug }: { activeSlug?: string }) {
  const categories = await getCategories();
  const chipBase =
    "flex h-touch items-center whitespace-nowrap rounded-full border px-4 text-body-md transition-colors";

  return (
    <nav aria-label="Product categories" className="-mx-1 overflow-x-auto">
      <ul className="flex items-center gap-2 px-1 pb-1">
        <li>
          <Link
            href="/search"
            aria-current={activeSlug ? undefined : "page"}
            className={`${chipBase} ${
              activeSlug
                ? "border-border bg-surface text-text-main hover:bg-surface-muted"
                : "border-primary bg-primary text-on-primary"
            }`}
          >
            All
          </Link>
        </li>
        {categories.map((category) => {
          const isActive = category.slug === activeSlug;
          return (
            <li key={category.slug}>
              <Link
                href={`/search?category=${category.slug}`}
                aria-current={isActive ? "page" : undefined}
                className={`${chipBase} ${
                  isActive
                    ? "border-primary bg-primary text-on-primary"
                    : "border-border bg-surface text-text-main hover:bg-surface-muted"
                }`}
              >
                {category.name}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
