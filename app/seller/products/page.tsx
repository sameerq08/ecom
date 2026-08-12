import Link from "next/link";
import { ProductTable } from "@/components/seller/ProductTable";
import { Card, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { getSellerListings } from "@/lib/data/seller";

export default async function SellerProductsPage() {
  const listings = await getSellerListings();

  return (
    <div className="flex flex-col gap-6">
      <nav aria-label="Breadcrumb" className="text-body-sm text-text-muted">
        <Link href="/seller" className="text-link hover:underline">
          Seller
        </Link>
        <span className="px-2">/</span>
        <span>Listings</span>
      </nav>

      <h1 className="text-display-lg text-text-main">Your listings</h1>

      {listings.length === 0 ? (
        <EmptyState
          icon={<span className="text-display-lg">📦</span>}
          title="No products yet"
          description="Add your first listing to start selling on the marketplace."
        />
      ) : (
        <Card className="overflow-hidden">
          <CardHeader
            title={`${listings.length} listings`}
            action={
              // Listing management arrives with the backend; the affordance is
              // rendered so the screen reads correctly, but does nothing yet.
              <button
                type="button"
                disabled
                className="inline-flex h-touch items-center justify-center rounded border border-border bg-surface px-4 text-body-md font-bold text-text-main disabled:cursor-not-allowed disabled:opacity-50"
              >
                Add product
              </button>
            }
          />
          <ProductTable listings={listings} />
        </Card>
      )}
    </div>
  );
}
