import path from "node:path";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@prisma/client";
import catalog from "../src/data/demo-catalog";

const dbPath = path.resolve(process.cwd(), "dev.db");
const adapter = new PrismaBetterSqlite3({ url: `file:${dbPath}` });
const prisma = new PrismaClient({ adapter });

const stores = [
  {
    name: "Asaxiy",
    slug: "asaxiy",
    logoUrl: "/stores/asaxiy-logo.png",
    baseUrl: "https://asaxiy.uz",
    country: "UZ",
  },
  {
    name: "Olcha",
    slug: "olcha",
    logoUrl: "/stores/olcha-logo.png",
    baseUrl: "https://olcha.uz",
    country: "UZ",
  },
];

const categories = [
  { name: "Sofas", slug: "sofas" },
  { name: "Chairs", slug: "chairs" },
  { name: "Tables", slug: "tables" },
  { name: "Beds", slug: "beds" },
  { name: "Shelving", slug: "shelving" },
];

async function main() {
  console.log("Seeding database...");

  for (const s of stores) {
    await prisma.store.upsert({
      where: { slug: s.slug },
      update: {},
      create: s,
    });
  }
  console.log(`Created ${stores.length} stores`);

  const createdCategories: Record<string, string> = {};
  for (const c of categories) {
    const cat = await prisma.category.upsert({
      where: { slug: c.slug },
      update: {},
      create: c,
    });
    createdCategories[c.slug] = cat.id;
  }
  console.log(`Created ${categories.length} categories`);

  const asaxiy = await prisma.store.findUniqueOrThrow({ where: { slug: "asaxiy" } });
  const olcha = await prisma.store.findUniqueOrThrow({ where: { slug: "olcha" } });

  for (const item of catalog) {
    const store = item.store === "asaxiy" ? asaxiy : olcha;
    const categorySlug = item.category;
    const categoryId = createdCategories[categorySlug];

    if (!categoryId) {
      console.warn(`Category "${categorySlug}" not found, skipping ${item.name}`);
      continue;
    }

    const product = await prisma.product.create({
      data: {
        storeId: store.id,
        externalId: item.id,
        name: item.name,
        nameUz: item.nameUz,
        priceUZS: item.priceUZS,
        modelUrl: `/models/${item.id}/low.glb`,
        thumbnailUrl: `/thumbnails/${item.modelFile.replace(".glb", ".svg")}`,
        dimensionW: item.dimensions.w,
        dimensionH: item.dimensions.h,
        dimensionD: item.dimensions.d,
        isActive: true,
        categories: {
          create: { categoryId },
        },
      },
    });
    console.log(`Created product: ${product.name} (${store.name})`);
  }

  console.log(`\nSeeding complete! ${catalog.length} products created.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
