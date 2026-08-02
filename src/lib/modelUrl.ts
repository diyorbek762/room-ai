export type ModelQuality = "low" | "med" | "high";

/**
 * Build a public URL for a model at a given quality tier.
 * Layout: /models/{productId}/{quality}.glb
 */
export function getModelUrl(productId: string, quality: ModelQuality = "low"): string {
  return `/models/${productId}/${quality}.glb`;
}

/**
 * Get all three tier URLs for a product. Used by the cache pre-warm
 * and by the ObjectPlacer upgrade path.
 */
export function getAllModelUrls(productId: string): Record<ModelQuality, string> {
  return {
    low: getModelUrl(productId, "low"),
    med: getModelUrl(productId, "med"),
    high: getModelUrl(productId, "high"),
  };
}

/**
 * Enumerate every model URL we ship. Used by the service-worker / cache
 * pre-warm to know what to fetch on app load.
 */
export function getAllProductIds(): string[] {
  return [
    "demo-001", "demo-002", "demo-003", "demo-004", "demo-005",
    "demo-006", "demo-007", "demo-008", "demo-009", "demo-010",
    "demo-011", "demo-012", "demo-013", "demo-014", "demo-015",
    "demo-016", "demo-017", "demo-018",
  ];
}

export function getAllTierUrls(): Array<{ productId: string; quality: ModelQuality; url: string }> {
  const out: Array<{ productId: string; quality: ModelQuality; url: string }> = [];
  for (const id of getAllProductIds()) {
    for (const quality of ["low", "med", "high"] as const) {
      out.push({ productId: id, quality, url: getModelUrl(id, quality) });
    }
  }
  return out;
}
