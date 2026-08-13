import { getCategoryBySlug } from "@/lib/data/categories";
import type {
  Product,
  ProductDetail,
  SellerListingRow,
  SellerSignal,
} from "@/lib/types/ui";

/**
 * The local seed catalog, and everything that still has to read it.
 *
 * TEMPORARY. Step 06 moved the public catalog (home, search, filters, product
 * detail) onto Postgres, but the cart, orders and seller modules still hold
 * mutable module-level state keyed by product *slug*, and hydrate it through
 * the synchronous `findProduct` below. Until the cart persistence step moves
 * those onto the database too, this file is what keeps them working.
 *
 * It exists as its own module so that leftover has one obvious deletion point
 * rather than sitting tangled up with live queries in `products.ts`. Nothing
 * outside `lib/data/` should import it.
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
  /** Mirrors `Product.is_active`: false hides the listing from every public read. */
  active: boolean;
};

/** The seller whose dashboard `/seller/*` renders, standing in for a session. */
export const CURRENT_SELLER_ID = "homesafe" satisfies keyof typeof SELLERS;

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
    active: true,
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
    active: true,
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
    active: true,
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
    active: true,
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
    active: true,
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
    active: true,
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
    active: true,
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
    active: true,
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
    active: true,
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
    active: true,
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
    active: true,
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
    active: true,
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
    active: true,
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
    active: true,
  },
  {
    id: "ceramic-dinner-plate-set",
    name: "Stoneware Dinner Plate Set, Service for Four",
    description:
      "Reactive-glazed stoneware fired at high temperature, so no two plates share a pattern. Dishwasher and microwave safe.",
    price: 68,
    rating: 4.4,
    images: ["/vercel.svg"],
    sellerId: "homesafe",
    categorySlug: "home-kitchen",
    stockQty: 21,
    featured: false,
    active: true,
  },
  {
    id: "smart-video-doorbell",
    name: "Smart Video Doorbell with Two-Way Talk",
    description:
      "Answer the door from anywhere. Wide-angle 1080p lens, package detection, and wired or battery installation.",
    price: 89.99,
    rating: 4.1,
    images: ["/next.svg", "/window.svg"],
    sellerId: "homesafe",
    categorySlug: "electronics",
    stockQty: 0,
    featured: false,
    active: true,
  },
  {
    id: "motion-sensor-night-light",
    name: "Motion Sensor Night Light, Two Pack",
    description:
      "Warm LED strips that wake on movement and fade out after thirty seconds. Magnetic mount, rechargeable over USB-C.",
    price: 19.5,
    rating: 3.7,
    images: ["/globe.svg"],
    sellerId: "homesafe",
    categorySlug: "home-kitchen",
    stockQty: 34,
    featured: false,
    active: false,
  },
];

/**
 * Seed reads are synchronous, so nothing would ever suspend and `loading.tsx`
 * would never paint. A short development-only delay makes the skeleton states
 * observable while building. Production builds resolve immediately.
 */
export async function simulateLatency(): Promise<void> {
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
    listingCount: countActiveListings(sellerId),
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

/**
 * Synchronous lookup used only by the other `lib/data/*` modules to hydrate a
 * stored product id into renderable fields. Unlike `getProductById` it skips
 * the latency simulation and ignores `active`, because a cart line or a placed
 * order must still render after its listing is deactivated.
 */
export function findProduct(id: string): ProductDetail | null {
  const seed = SEED.find((candidate) => candidate.id === id);
  return seed ? toDetail(seed) : null;
}

/**
 * A seller's own listings, including inactive ones — this is the owner's view.
 *
 * The listings are seed rows but the category *names* are read from the
 * database, so the seller's table cannot disagree with the buyer's screens
 * about what a category is called. The lookup is request-cached, so this costs
 * one query however many rows there are.
 */
export async function getSellerListings(
  sellerId: string,
): Promise<SellerListingRow[]> {
  await simulateLatency();

  const rows = SEED.filter((seed) => seed.sellerId === sellerId);
  const categoryNames = await Promise.all(
    rows.map(async (seed) => (await getCategoryBySlug(seed.categorySlug))?.name),
  );

  return rows.map((seed, index) => ({
    product: toProduct(seed),
    categoryName: categoryNames[index] ?? seed.categorySlug,
    stockQty: seed.stockQty,
    active: seed.active,
  }));
}

/** Count of a seller's live listings, for the dashboard stat tiles. */
export function countActiveListings(sellerId: string): number {
  return SEED.filter((seed) => seed.sellerId === sellerId && seed.active).length;
}
