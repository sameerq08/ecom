import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Link from "next/link";
import { getCartCount } from "@/lib/data/cart";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const navLinks = [
  { href: "/", label: "Shop" },
  { href: "/search", label: "Search" },
  { href: "/cart", label: "Cart" },
  { href: "/orders", label: "Orders" },
  { href: "/seller", label: "Seller" },
  { href: "/seller/products", label: "Listings" },
  { href: "/seller/orders", label: "Sales" },
];

export const metadata: Metadata = {
  title: "Marketplace",
  description: "Ecommerce marketplace",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Server Actions revalidate the layout, which is what keeps this badge in
  // step with the cart rather than going stale after a quantity change.
  const cartCount = await getCartCount();

  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans">
        <header className="bg-primary text-on-primary">
          <nav className="mx-auto flex max-w-(--container-page) items-center gap-6 safe-px py-3">
            <Link href="/" className="text-title-lg font-bold">
              Marketplace
            </Link>
            <div className="flex flex-wrap items-center gap-1">
              {navLinks.map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  className="flex h-touch items-center gap-2 rounded px-3 text-body-md hover:bg-white/10"
                >
                  {label}
                  {href === "/cart" && cartCount > 0 ? (
                    <span
                      aria-label={`${cartCount} items in cart`}
                      // Not amber: the badge is a count, not a conversion CTA.
                      className="inline-flex min-w-5 items-center justify-center rounded-full bg-surface px-1.5 text-label-sm text-primary"
                    >
                      {cartCount}
                    </span>
                  ) : null}
                </Link>
              ))}
            </div>
          </nav>
        </header>

        <main className="mx-auto w-full max-w-(--container-page) flex-1 px-4 py-6 md:px-6">
          {children}
        </main>

        <footer className="mt-12 bg-primary text-on-primary">
          <div className="mx-auto max-w-(--container-page) safe-px py-6 text-body-sm text-white/70">
            Marketplace — v1 scaffold
          </div>
        </footer>
      </body>
    </html>
  );
}
