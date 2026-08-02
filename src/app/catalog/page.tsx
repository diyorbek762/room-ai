import { getProducts, getCategories } from "@/lib/products";
import { CatalogClient } from "./CatalogClient";

export default async function CatalogPage() {
  const [products, categories] = await Promise.all([
    getProducts(),
    getCategories(),
  ]);

  return (
    <CatalogClient
      products={products}
      categories={categories.map((c) => ({ slug: c.slug, name: c.name }))}
    />
  );
}
