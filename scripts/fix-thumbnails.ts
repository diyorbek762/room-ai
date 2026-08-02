import path from "node:path";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@prisma/client";

const adapter = new PrismaBetterSqlite3({ url: "file:" + path.resolve(process.cwd(), "dev.db") });
const prisma = new PrismaClient({ adapter });

async function main() {
  const products = await prisma.product.findMany({ select: { id: true, thumbnailUrl: true } });
  let updated = 0;
  for (const product of products) {
    if (product.thumbnailUrl && product.thumbnailUrl.endsWith(".png")) {
      await prisma.product.update({
        where: { id: product.id },
        data: { thumbnailUrl: product.thumbnailUrl.replace(".png", ".svg") },
      });
      updated++;
    }
  }
  console.log(`Updated ${updated} thumbnail URLs to .svg`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
