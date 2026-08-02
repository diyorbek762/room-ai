import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@prisma/client";

const adapter = new PrismaBetterSqlite3({ url: "file:./dev.db" });
const prisma = new PrismaClient({ adapter });

interface FetchOptions {
  stores: string[];
  limit: number;
  delayMs: number;
}

function parseArgs(argv: string[]): FetchOptions {
  const options: FetchOptions = {
    stores: ["asaxiy", "olcha"],
    limit: 10,
    delayMs: 1000,
  };

  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--stores" && argv[i + 1]) options.stores = argv[i + 1].split(",");
    if (argv[i] === "--limit" && argv[i + 1]) options.limit = Number(argv[i + 1]);
    if (argv[i] === "--delay" && argv[i + 1]) options.delayMs = Number(argv[i + 1]);
  }

  return options;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface ScrapedProduct {
  externalId: string;
  name: string;
  priceUZS: number;
  thumbnailUrl: string | null;
  productUrl: string;
}

async function fetchFromAsaxiy(limit: number): Promise<ScrapedProduct[]> {
  console.log("Fetching from Asaxiy...");
  console.warn("Note: Asaxiy has no public documented API. Scraping may be blocked.");
  console.warn("Configure a real integration in production (partner API or HTML parsing).");
  return [];
}

async function fetchFromOlcha(limit: number): Promise<ScrapedProduct[]> {
  console.log("Fetching from Olcha...");
  console.warn("Note: Olcha has no public documented API. Scraping may be blocked.");
  console.warn("Configure a real integration in production (partner API or HTML parsing).");
  return [];
}

const FETCHERS: Record<string, (limit: number) => Promise<ScrapedProduct[]>> = {
  asaxiy: fetchFromAsaxiy,
  olcha: fetchFromOlcha,
};

async function upsertProducts(storeSlug: string, products: ScrapedProduct[]): Promise<number> {
  const store = await prisma.store.findUnique({ where: { slug: storeSlug } });
  if (!store) {
    console.warn(`Store "${storeSlug}" not found in DB. Run db:seed first.`);
    return 0;
  }

  let created = 0;
  for (const product of products) {
    const existing = await prisma.product.findFirst({
      where: { storeId: store.id, externalId: product.externalId },
    });

    if (existing) {
      await prisma.product.update({
        where: { id: existing.id },
        data: {
          name: product.name,
          priceUZS: product.priceUZS,
          thumbnailUrl: product.thumbnailUrl,
        },
      });
    } else {
      await prisma.product.create({
        data: {
          storeId: store.id,
          externalId: product.externalId,
          name: product.name,
          priceUZS: product.priceUZS,
          thumbnailUrl: product.thumbnailUrl,
          dimensionW: 1,
          dimensionH: 1,
          dimensionD: 1,
        },
      });
      created++;
    }
  }

  return created;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  console.log(`=== Store Product Fetcher ===`);
  console.log(`Stores: ${options.stores.join(", ")}`);
  console.log(`Limit per store: ${options.limit}`);
  console.log(`Delay between stores: ${options.delayMs}ms\n`);

  for (const storeSlug of options.stores) {
    const fetcher = FETCHERS[storeSlug];
    if (!fetcher) {
      console.warn(`No fetcher configured for store "${storeSlug}".`);
      continue;
    }

    try {
      const products = await fetcher(options.limit);
      if (products.length === 0) {
        console.log(`No products fetched from ${storeSlug}.`);
        continue;
      }
      const created = await upsertProducts(storeSlug, products);
      console.log(`Upserted ${products.length} products (${created} new) for ${storeSlug}.`);
    } catch (err) {
      console.error(`Failed fetching ${storeSlug}: ${(err as Error).message}`);
    }

    await sleep(options.delayMs);
  }

  console.log("\n=== Done. Check database with `npm run db:studio` ===");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
