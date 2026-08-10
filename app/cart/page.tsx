import { CartRow } from "@/components/cart/CartRow";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatPrice, type CartLine } from "@/lib/types/ui";

// PLACEHOLDER DATA — replaced by Supabase queries in a later step.
const sampleLines: CartLine[] = [
  {
    id: "l1",
    quantity: 1,
    product: {
      id: "1",
      name: "Premium Noise Cancelling Wireless Over-Ear Headphones, Black",
      price: 299,
      rating: 4.5,
      imageUrl: "/window.svg",
      sellerName: "Acoustic Pro Direct",
      inStock: true,
    },
  },
  {
    id: "l2",
    quantity: 2,
    product: {
      id: "4",
      name: "Smart Home Indoor Security Camera, 1080p HD Video",
      price: 49.99,
      rating: 3.5,
      imageUrl: "/next.svg",
      sellerName: "HomeSafe",
      inStock: true,
    },
  },
];

export default function CartPage() {
  const itemCount = sampleLines.reduce((sum, line) => sum + line.quantity, 0);
  const subtotal = sampleLines.reduce(
    (sum, line) => sum + line.product.price * line.quantity,
    0,
  );

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-display-lg">Cart</h1>

      <div className="flex flex-col gap-6 lg:flex-row">
        <Card className="flex-grow p-5">
          {sampleLines.map((line) => (
            <CartRow key={line.id} line={line} />
          ))}
          <div className="pt-4 text-right">
            <span className="text-body-lg text-text-main">
              Subtotal ({itemCount} items):{" "}
            </span>
            <span className="text-title-lg font-bold text-text-main">
              {formatPrice(subtotal)}
            </span>
          </div>
        </Card>

        <Card className="h-fit w-full flex-shrink-0 p-5 lg:w-[320px]">
          <div className="mb-4 text-body-lg text-text-main">
            Subtotal ({itemCount} items):{" "}
            <span className="font-bold">{formatPrice(subtotal)}</span>
          </div>
          <Button fullWidth>Proceed to Checkout</Button>
        </Card>
      </div>

      <section className="flex flex-col gap-4">
        <h2 className="text-headline-md">Empty state</h2>
        <EmptyState
          icon={<span className="text-4xl">🛒</span>}
          title="Your cart is empty"
          description="Browse the marketplace to find products from our sellers."
          actions={
            <>
              <Button variant="outline" fullWidth>
                Keep browsing
              </Button>
              <Button fullWidth>Shop now</Button>
            </>
          }
        />
      </section>
    </div>
  );
}
