import Link from "next/link";
import { notFound } from "next/navigation";
import { BuyBox } from "@/components/product/BuyBox";
import { ProductGallery } from "@/components/product/ProductGallery";
import { SellerSignal } from "@/components/product/SellerSignal";
import { StarRating } from "@/components/product/StarRating";
import { getCategoryBySlug } from "@/lib/data/categories";
import { getProductById } from "@/lib/data/products";

function resolveImageIndex(
  raw: string | string[] | undefined,
  imageCount: number,
): number {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed >= imageCount) {
    return 0;
  }
  return parsed;
}

export default async function ProductDetailPage(
  props: PageProps<"/products/[id]">,
) {
  const { id } = await props.params;
  const product = await getProductById(id);

  if (!product) {
    notFound();
  }

  const searchParams = await props.searchParams;
  const activeIndex = resolveImageIndex(searchParams.image, product.images.length);
  const category = await getCategoryBySlug(product.categorySlug);

  return (
    <div className="flex flex-col gap-6">
      <nav aria-label="Breadcrumb" className="text-body-sm text-text-muted">
        <Link href="/" className="text-link hover:underline">
          Home
        </Link>
        {category ? (
          <>
            <span className="px-2">/</span>
            <Link
              href={`/search?category=${category.slug}`}
              className="text-link hover:underline"
            >
              {category.name}
            </Link>
          </>
        ) : null}
      </nav>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <ProductGallery
            productId={product.id}
            name={product.name}
            images={product.images}
            activeIndex={activeIndex}
          />
        </div>

        <div className="flex flex-col gap-4 lg:col-span-4">
          <h1 className="text-headline-md text-text-main">{product.name}</h1>
          <StarRating rating={product.rating} />
          <hr className="border-border" />
          <p className="text-body-md text-text-muted">{product.description}</p>
          {category ? (
            <p className="text-body-sm text-text-muted">
              Category:{" "}
              <Link
                href={`/search?category=${category.slug}`}
                className="text-link hover:underline"
              >
                {category.name}
              </Link>
            </p>
          ) : null}
          <SellerSignal seller={product.seller} />
        </div>

        <div className="lg:col-span-3">
          <BuyBox product={product} />
        </div>
      </div>
    </div>
  );
}
