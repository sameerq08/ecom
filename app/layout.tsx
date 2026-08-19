import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Link from "next/link";
import { getCartCount } from "@/lib/data/cart";
import { getCurrentProfile } from "@/lib/supabase/session";
import { signOut } from "@/app/signout/actions";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const buyerNavLinks = [
  { href: "/", label: "Shop" },
  { href: "/search", label: "Search" },
  { href: "/cart", label: "Cart" },
  { href: "/orders", label: "Orders" },
];

const sellerNavLinks = [
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
  // step with the cart rather than going stale after a quantity change. The
  // auth actions revalidate at layout scope for the same reason — the nav
  // below now renders the session as well.
  //
  // The seller links are shown only to a signed-in seller: the routes behind
  // them are gated on `role = 'seller'`, so surfacing them to a buyer would
  // just be a link to a role-denied page.
  const [cartCount, profile] = await Promise.all([
    getCartCount(),
    getCurrentProfile(),
  ]);

  const navLinks =
    profile?.role === "seller"
      ? [...buyerNavLinks, ...sellerNavLinks]
      : buyerNavLinks;

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

            <div className="ml-auto flex items-center gap-1">
              {profile ? (
                <>
                  <Link
                    href="/account"
                    className="flex h-touch items-center rounded px-3 text-body-md hover:bg-white/10"
                  >
                    {profile.displayName ?? "Account"}
                  </Link>
                  <form action={signOut}>
                    <button
                      type="submit"
                      className="flex h-touch items-center rounded px-3 text-body-md hover:bg-white/10"
                    >
                      Sign out
                    </button>
                  </form>
                </>
              ) : (
                <Link
                  href="/signin"
                  className="flex h-touch items-center rounded px-3 text-body-md hover:bg-white/10"
                >
                  Sign in
                </Link>
              )}
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
