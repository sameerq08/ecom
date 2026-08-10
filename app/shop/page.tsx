import { ProductCard } from "@/components/product/ProductCard";
import { ProductCardSkeleton } from "@/components/product/ProductCardSkeleton";
import type { Product } from "@/lib/types/ui";

// PLACEHOLDER DATA — replaced by Supabase queries in a later step.
const sampleProducts: Product[] = [
  {
    id: "1",
    name: "Premium Noise Cancelling Wireless Over-Ear Headphones, Black",
    price: 299,
    rating: 4.5,
    imageUrl: "/window.svg",
    sellerName: "Acoustic Pro Direct",
    inStock: true,
  },
  {
    id: "2",
    name: "34-Inch Curved Ultrawide Gaming Monitor, 144Hz",
    price: 449.99,
    rating: 4,
    imageUrl: "/globe.svg",
    sellerName: "DisplayWorks",
    inStock: true,
  },
  {
    id: "3",
    name: "Mechanical Keyboard with Hot-Swappable Switches",
    price: 129.5,
    rating: 4.8,
    imageUrl: "/file.svg",
    sellerName: "KeyForge",
    inStock: false,
  },
  {
    id: "4",
    name: "Smart Home Indoor Security Camera, 1080p HD Video",
    price: 49.99,
    rating: 3.5,
    imageUrl: "/next.svg",
    sellerName: "HomeSafe",
    inStock: true,
  },
];

export default function ShopPage() {
  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-display-lg">Shop</h1>

      <section className="flex flex-col gap-4">
        <h2 className="text-headline-md">Products</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {sampleProducts.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-headline-md">Loading state</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {[0, 1, 2, 3].map((index) => (
            <ProductCardSkeleton key={index} />
          ))}
        </div>
      </section>
    </div>
  );
}
