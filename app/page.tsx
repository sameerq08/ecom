import Link from "next/link";
import { CategoryChips } from "@/components/product/CategoryChips";
import { ProductGrid } from "@/components/product/ProductGrid";
import { getFeaturedProducts } from "@/lib/data/products";

export default async function HomePage() {
  const products = await getFeaturedProducts();

  return (
    <div className="flex flex-col gap-8">
      <section className="rounded-lg border border-border bg-surface p-6 md:p-8">
        <h1 className="text-display-lg text-text-main">
          Everything from independent sellers
        </h1>
        <p className="mt-2 max-w-2xl text-body-lg text-text-muted">
          Browse the marketplace by category, or search across every listing.
        </p>
        <Link
          href="/search"
          className="mt-4 inline-flex h-touch items-center text-body-md text-link hover:underline"
        >
          Search all products
        </Link>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-headline-md text-text-main">Shop by category</h2>
        <CategoryChips />
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-headline-md text-text-main">Featured products</h2>
        <ProductGrid products={products} />
      </section>
    </div>
  );
}
