import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const navLinks = [
  { href: "/shop", label: "Shop" },
  { href: "/cart", label: "Cart" },
  { href: "/orders", label: "Orders" },
  { href: "/seller", label: "Seller" },
];

export const metadata: Metadata = {
  title: "Marketplace",
  description: "Ecommerce marketplace",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans">
        <header className="bg-primary text-on-primary">
          <nav className="mx-auto flex max-w-(--container-page) items-center gap-6 safe-px py-3">
            <Link href="/" className="text-title-lg font-bold">
              Marketplace
            </Link>
            <div className="flex items-center gap-1">
              {navLinks.map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  className="flex h-touch items-center rounded px-3 text-body-md hover:bg-white/10"
                >
                  {label}
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
