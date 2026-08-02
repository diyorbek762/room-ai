import { prisma } from "@/lib/prisma";

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

export async function getProducts(filters?: {
  categorySlug?: string;
  storeSlug?: string;
}): Promise<ProductDTO[]> {
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

export async function getCategories() {
  return prisma.category.findMany({
    orderBy: { name: "asc" },
    select: { id: true, slug: true, name: true },
  });
}

export async function getStores() {
  return prisma.store.findMany({
    orderBy: { name: "asc" },
    select: { id: true, slug: true, name: true, logoUrl: true },
  });
}
