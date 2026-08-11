import type {
  Product,
  ProductDetail,
  ProductFilters,
  SellerSignal,
} from "@/lib/types/ui";

/**
 * Local seed catalog for the static browsing screens.
 *
 * TEMPORARY: this module is the single data-access seam for the catalog. Every
 * screen reads through the exported helpers, never the arrays, so swapping in
 * Supabase queries later touches only this file.
 */

/** Listing counts are derived from the catalog below, never stored, so they cannot drift. */
const SELLERS = {
  acoustic: { id: "acoustic", storeName: "Acoustic Pro Direct", memberSince: "2019" },
  displayworks: { id: "displayworks", storeName: "DisplayWorks", memberSince: "2021" },
  keyforge: { id: "keyforge", storeName: "KeyForge", memberSince: "2022" },
  homesafe: { id: "homesafe", storeName: "HomeSafe", memberSince: "2020" },
  northpage: { id: "northpage", storeName: "Northpage Books", memberSince: "2018" },
} as const satisfies Record<string, Omit<SellerSignal, "listingCount">>;

type SeedProduct = {
  id: string;
  name: string;
  description: string;
  price: number;
  rating: number;
  images: readonly string[];
  sellerId: keyof typeof SELLERS;
  categorySlug: string;
  stockQty: number;
  featured: boolean;
};

const SEED: readonly SeedProduct[] = [
  {
    id: "premium-noise-cancelling-headphones",
    name: "Premium Noise Cancelling Wireless Over-Ear Headphones, Black",
    description:
      "Forty hours of playback, adaptive noise cancellation, and memory-foam earcups that stay comfortable through a long-haul flight. Folds flat into a hard travel case.",
    price: 299,
    rating: 4.5,
    images: ["/window.svg", "/globe.svg", "/file.svg"],
    sellerId: "acoustic",
    categorySlug: "electronics",
    stockQty: 24,
    featured: true,
  },
  {
    id: "curved-ultrawide-gaming-monitor",
    name: "34-Inch Curved Ultrawide Gaming Monitor, 144Hz",
    description:
      "A 3440x1440 curved panel with a 144Hz refresh rate and 1ms response time. Height-adjustable stand, two HDMI inputs, and one DisplayPort.",
    price: 449.99,
    rating: 4,
    images: ["/globe.svg", "/next.svg"],
    sellerId: "displayworks",
    categorySlug: "electronics",
    stockQty: 8,
    featured: true,
  },
  {
    id: "mechanical-keyboard-hot-swappable",
    name: "Mechanical Keyboard with Hot-Swappable Switches",
    description:
      "Swap switches without soldering. Gasket-mounted aluminium body, doubleshot PBT keycaps, and per-key backlighting configurable in the browser.",
    price: 129.5,
    rating: 4.8,
    images: ["/file.svg"],
    sellerId: "keyforge",
    categorySlug: "electronics",
    stockQty: 0,
    featured: true,
  },
  {
    id: "smart-indoor-security-camera",
    name: "Smart Home Indoor Security Camera, 1080p HD Video",
    description:
      "Full-HD video with night vision and two-way audio. Motion zones and alerts run on-device, with optional local storage on a microSD card.",
    price: 49.99,
    rating: 3.5,
    images: ["/next.svg"],
    sellerId: "homesafe",
    categorySlug: "electronics",
    stockQty: 61,
    featured: true,
  },
  {
    id: "pour-over-coffee-kettle",
    name: "Gooseneck Pour-Over Coffee Kettle, 1L Stainless Steel",
    description:
      "A counterbalanced handle and precision spout for a controlled pour. Variable temperature to the degree, with a thirty-minute hold.",
    price: 79,
    rating: 4.6,
    images: ["/vercel.svg", "/window.svg"],
    sellerId: "homesafe",
    categorySlug: "home-kitchen",
    stockQty: 15,
    featured: true,
  },
  {
    id: "cast-iron-skillet-12-inch",
    name: "Pre-Seasoned Cast Iron Skillet, 12 Inch",
    description:
      "Foundry-seasoned and ready to use. Moves from hob to oven to grill, and improves with every meal cooked in it.",
    price: 34.95,
    rating: 4.7,
    images: ["/file.svg"],
    sellerId: "homesafe",
    categorySlug: "home-kitchen",
    stockQty: 42,
    featured: false,
  },
  {
    id: "linen-blend-oxford-shirt",
    name: "Linen-Blend Oxford Shirt, Long Sleeve",
    description:
      "A breathable linen-cotton weave cut for a relaxed fit. Mother-of-pearl buttons and a single chest pocket.",
    price: 58,
    rating: 4.1,
    images: [],
    sellerId: "keyforge",
    categorySlug: "clothing-accessories",
    stockQty: 30,
    featured: true,
  },
  {
    id: "merino-wool-crew-socks",
    name: "Merino Wool Crew Socks, Three Pack",
    description:
      "Temperature-regulating merino with a reinforced heel and toe. Warm in winter, breathable in summer, and machine washable.",
    price: 24,
    rating: 4.4,
    images: ["/globe.svg"],
    sellerId: "keyforge",
    categorySlug: "clothing-accessories",
    stockQty: 0,
    featured: false,
  },
  {
    id: "the-pragmatic-shelf-hardback",
    name: "The Pragmatic Shelf — Collected Essays, Hardback",
    description:
      "Twenty-two essays on craft and attention, collected for the first time. Smyth-sewn binding with a ribbon marker.",
    price: 27.5,
    rating: 4.9,
    images: ["/file.svg", "/vercel.svg"],
    sellerId: "northpage",
    categorySlug: "books",
    stockQty: 12,
    featured: true,
  },
  {
    id: "field-notes-pocket-atlas",
    name: "Field Notes Pocket Atlas of Coastal Birds",
    description:
      "Two hundred illustrated plates sized for a jacket pocket. Waterproof cover and a quick-reference silhouette index.",
    price: 18.99,
    rating: 3.8,
    images: ["/window.svg"],
    sellerId: "northpage",
    categorySlug: "books",
    stockQty: 5,
    featured: false,
  },
  {
    id: "insulated-trail-water-bottle",
    name: "Insulated Trail Water Bottle, 750ml",
    description:
      "Double-walled vacuum insulation keeps drinks cold for a full day. Leakproof lid with an integrated carry loop.",
    price: 32,
    rating: 4.3,
    images: ["/next.svg"],
    sellerId: "displayworks",
    categorySlug: "sports-outdoors",
    stockQty: 88,
    featured: true,
  },
  {
    id: "adjustable-resistance-band-set",
    name: "Adjustable Resistance Band Set with Door Anchor",
    description:
      "Five stackable bands from 10 to 50 pounds, with handles, ankle straps, and a door anchor. Packs into the included pouch.",
    price: 41.25,
    rating: 4.2,
    images: ["/vercel.svg"],
    sellerId: "displayworks",
    categorySlug: "sports-outdoors",
    stockQty: 19,
    featured: false,
  },
  {
    id: "hardwood-building-blocks",
    name: "Hardwood Building Blocks, 100 Piece Set",
    description:
      "Sanded beech blocks in six shapes, finished with a non-toxic water-based sealant. Stores in a canvas drawstring bag.",
    price: 45,
    rating: 4.6,
    images: ["/globe.svg", "/file.svg", "/next.svg"],
    sellerId: "northpage",
    categorySlug: "toys-games",
    stockQty: 27,
    featured: true,
  },
  {
    id: "vitamin-c-daily-serum",
    name: "Vitamin C Daily Brightening Serum, 30ml",
    description:
      "A 15% stabilised vitamin C serum with hyaluronic acid. Fragrance-free, in an amber pump bottle that limits light exposure.",
    price: 22.4,
    rating: 3.9,
    images: ["/window.svg"],
    sellerId: "acoustic",
    categorySlug: "beauty-personal-care",
    stockQty: 53,
    featured: false,
  },
];

/**
 * Seed reads are synchronous, so nothing would ever suspend and `loading.tsx`
 * would never paint. A short development-only delay makes the skeleton states
 * observable while building. Production builds resolve immediately.
 */
async function simulateLatency(): Promise<void> {
  if (process.env.NODE_ENV !== "development") return;
  await new Promise((resolve) => setTimeout(resolve, 600));
}

function toProduct(seed: SeedProduct): Product {
  return {
    id: seed.id,
    name: seed.name,
    price: seed.price,
    rating: seed.rating,
    imageUrl: seed.images[0] ?? null,
    sellerName: SELLERS[seed.sellerId].storeName,
    inStock: seed.stockQty > 0,
  };
}

function toSellerSignal(sellerId: SeedProduct["sellerId"]): SellerSignal {
  return {
    ...SELLERS[sellerId],
    listingCount: SEED.filter((seed) => seed.sellerId === sellerId).length,
  };
}

function toDetail(seed: SeedProduct): ProductDetail {
  return {
    ...toProduct(seed),
    description: seed.description,
    images: seed.images,
    stockQty: seed.stockQty,
    categorySlug: seed.categorySlug,
    seller: toSellerSignal(seed.sellerId),
  };
}

export async function getFeaturedProducts(): Promise<Product[]> {
  await simulateLatency();
  return SEED.filter((seed) => seed.featured).map(toProduct);
}

export async function getProductById(
  id: string,
): Promise<ProductDetail | null> {
  await simulateLatency();
  const seed = SEED.find((candidate) => candidate.id === id);
  return seed ? toDetail(seed) : null;
}

/** Store names for the seller filter dropdown, alphabetised. */
export async function getSellerNames(): Promise<string[]> {
  return Object.values(SELLERS)
    .map((seller) => seller.storeName)
    .sort((a, b) => a.localeCompare(b));
}

type RawSearchParams = Record<string, string | string[] | undefined>;

function firstValue(raw: string | string[] | undefined): string | undefined {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function numberValue(raw: string | string[] | undefined): number | undefined {
  const value = firstValue(raw);
  if (value === undefined) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

/** Turns a raw `searchParams` object into validated filters, dropping anything unparseable. */
export function parseProductFilters(params: RawSearchParams): ProductFilters {
  return {
    q: firstValue(params.q),
    category: firstValue(params.category),
    minPrice: numberValue(params.minPrice),
    maxPrice: numberValue(params.maxPrice),
    rating: numberValue(params.rating),
    seller: firstValue(params.seller),
    inStock: firstValue(params.inStock) === "on",
  };
}

export function hasActiveFilters(filters: ProductFilters): boolean {
  return Object.values(filters).some(
    (value) => value !== undefined && value !== false && value !== "",
  );
}

export async function searchProducts(
  filters: ProductFilters,
): Promise<Product[]> {
  await simulateLatency();

  const keyword = filters.q?.trim().toLowerCase();

  return SEED.filter((seed) => {
    if (
      keyword &&
      !seed.name.toLowerCase().includes(keyword) &&
      !seed.description.toLowerCase().includes(keyword)
    ) {
      return false;
    }
    if (filters.category && seed.categorySlug !== filters.category) {
      return false;
    }
    if (filters.minPrice !== undefined && seed.price < filters.minPrice) {
      return false;
    }
    if (filters.maxPrice !== undefined && seed.price > filters.maxPrice) {
      return false;
    }
    if (filters.rating !== undefined && seed.rating < filters.rating) {
      return false;
    }
    if (
      filters.seller &&
      SELLERS[seed.sellerId].storeName !== filters.seller
    ) {
      return false;
    }
    if (filters.inStock && seed.stockQty <= 0) {
      return false;
    }
    return true;
  }).map(toProduct);
}
