import { getProducts, getCategories } from "@/lib/products";
import { HomeClient } from "./HomeClient";

export default async function Home() {
  const [products, categories] = await Promise.all([
    getProducts(),
    getCategories(),
  ]);

  return (
    <HomeClient
      products={products}
      categories={categories.map((c) => ({ slug: c.slug, name: c.name }))}
    />
  );
}
