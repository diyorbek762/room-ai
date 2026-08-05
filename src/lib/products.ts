import { prisma } from "@/lib/prisma";
import demoCatalog from "@/data/demo-catalog";

export interface ProductDTO {
  id: string;
  name: string;
  nameUz: string | null;
  priceUZS: number;
  storeSlug: string;
  storeName: string;
  modelUrl: string | null;
  thumbnailUrl: string | null;
  categorySlug: string | null;
  dimensions: { w: number; h: number; d: number };
  isPlaceholder: boolean;
}

const STATIC_STORES = [
  { id: "store-asaxiy", slug: "asaxiy", name: "Asaxiy", logoUrl: "/stores/asaxiy-logo.png" },
  { id: "store-olcha", slug: "olcha", name: "Olcha", logoUrl: "/stores/olcha-logo.png" },
];

const STATIC_CATEGORIES = [
  { id: "cat-sofas", slug: "sofas", name: "Sofas" },
  { id: "cat-chairs", slug: "chairs", name: "Chairs" },
  { id: "cat-tables", slug: "tables", name: "Tables" },
  { id: "cat-beds", slug: "beds", name: "Beds" },
  { id: "cat-shelving", slug: "shelving", name: "Shelving" },
];

function getStaticProducts(filters?: { categorySlug?: string; storeSlug?: string }): ProductDTO[] {
  return demoCatalog
    .filter((item) => {
      if (filters?.storeSlug && item.store !== filters.storeSlug) return false;
      if (filters?.categorySlug && item.category !== filters.categorySlug) return false;
      return true;
    })
    .map((item) => ({
      id: item.id,
      name: item.name,
      nameUz: item.nameUz,
      priceUZS: item.priceUZS,
      storeSlug: item.store,
      storeName: item.store === "asaxiy" ? "Asaxiy" : "Olcha",
      modelUrl: `/models/${item.id}/low.glb`,
      thumbnailUrl: `/thumbnails/${item.modelFile.replace(".glb", ".svg")}`,
      categorySlug: item.category,
      dimensions: item.dimensions,
      isPlaceholder: false,
    }));
}

export async function getProducts(filters?: {
  categorySlug?: string;
  storeSlug?: string;
}): Promise<ProductDTO[]> {
  try {
    const products = await prisma.product.findMany({
      where: {
        isActive: true,
        ...(filters?.storeSlug && {
          store: { slug: filters.storeSlug },
        }),
        ...(filters?.categorySlug && {
          categories: {
            some: { category: { slug: filters.categorySlug } },
          },
        }),
      },
      include: {
        store: true,
        categories: { include: { category: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    if (products.length > 0) {
      return products.map((p) => ({
        id: p.id,
        name: p.name,
        nameUz: p.nameUz,
        priceUZS: p.priceUZS,
        storeSlug: p.store.slug,
        storeName: p.store.name,
        modelUrl: p.modelUrl,
        thumbnailUrl: p.thumbnailUrl,
        categorySlug: p.categories[0]?.category.slug ?? null,
        dimensions: { w: p.dimensionW, h: p.dimensionH, d: p.dimensionD },
        isPlaceholder: !p.modelUrl,
      }));
    }
  } catch (err) {
    console.warn("[Prisma DB fallback to static catalog]:", err);
  }

  return getStaticProducts(filters);
}

export async function getCategories() {
  try {
    const categories = await prisma.category.findMany({
      orderBy: { name: "asc" },
      select: { id: true, slug: true, name: true },
    });
    if (categories.length > 0) return categories;
  } catch (err) {
    console.warn("[Prisma DB fallback to static categories]:", err);
  }
  return STATIC_CATEGORIES;
}

export async function getStores() {
  try {
    const stores = await prisma.store.findMany({
      orderBy: { name: "asc" },
      select: { id: true, slug: true, name: true, logoUrl: true },
    });
    if (stores.length > 0) return stores;
  } catch (err) {
    console.warn("[Prisma DB fallback to static stores]:", err);
  }
  return STATIC_STORES;
}
