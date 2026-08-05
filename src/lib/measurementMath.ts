import type { RoomMetrics } from "@/types";

export interface Point2D {
  x: number;
  z: number;
}

export interface WallHeightSample {
  /** Plane-local polygon. In WebXR vertical planes, the local z-axis is height. */
  polygon: ReadonlyArray<{ x: number; z: number }>;
}

export const DEFAULT_CEILING_HEIGHT_M = 2.7;
const MIN_CEILING_HEIGHT_M = 1.5;
const MAX_CEILING_HEIGHT_M = 5.0;

/**
 * Compute signed polygon area via the shoelace formula.
 * Returns a positive value regardless of winding order.
 */
export function polygonArea(corners: Point2D[]): number {
  let sum = 0;
  const n = corners.length;
  for (let i = 0; i < n; i++) {
    const a = corners[i];
    const b = corners[(i + 1) % n];
    sum += a.x * b.z - b.x * a.z;
  }
  return Math.abs(sum) / 2;
}

/**
 * Sum of edge lengths (perimeter) for a closed polygon.
 */
export function polygonPerimeter(corners: Point2D[]): number {
  let sum = 0;
  const n = corners.length;
  for (let i = 0; i < n; i++) {
    const a = corners[i];
    const b = corners[(i + 1) % n];
    sum += Math.hypot(a.x - b.x, a.z - b.z);
  }
  return sum;
}

/**
 * Total wall area = perimeter × ceiling height.
 * Openings/doors are not subtracted in v1.
 */
export function wallArea(perimeterM: number, ceilingHeightM: number): number {
  return perimeterM * ceilingHeightM;
}

/**
 * Estimate ceiling height from vertical plane polygons.
 * Returns the largest local-z extent found, or null if no samples.
 */
export function estimateWallHeight(walls: WallHeightSample[]): number | null {
  let maxZ = 0;
  for (const wall of walls) {
    for (const p of wall.polygon) {
      if (p.z > maxZ) maxZ = p.z;
    }
  }
  return maxZ > 0.05 ? maxZ : null;
}

/**
 * Check whether a polygon is simple (no self-intersections).
 * Only checks non-adjacent edge pairs.
 */
/**
 * Check if a point is inside a polygon using ray casting algorithm.
 */
export function isPointInPolygon(point: Point2D, polygon: Point2D[]): boolean {
  if (polygon.length < 3) return false;
  let isInside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x;
    const zi = polygon[i].z;
    const xj = polygon[j].x;
    const zj = polygon[j].z;

    const intersect =
      zi > point.z !== zj > point.z &&
      point.x < ((xj - xi) * (point.z - zi)) / (zj - zi) + xi;
    if (intersect) isInside = !isInside;
  }
  return isInside;
}

export function isSimplePolygon(corners: Point2D[]): boolean {
  const n = corners.length;
  if (n < 4) return true;

  for (let i = 0; i < n; i++) {
    const a1 = corners[i];
    const a2 = corners[(i + 1) % n];
    for (let j = i + 1; j < n; j++) {
      const b1 = corners[j];
      const b2 = corners[(j + 1) % n];
      if (i === j || (i + 1) % n === j || (j + 1) % n === i) continue;
      if (segmentsIntersect(a1, a2, b1, b2)) return false;
    }
  }
  return true;
}

function segmentsIntersect(
  a1: Point2D,
  a2: Point2D,
  b1: Point2D,
  b2: Point2D
): boolean {
  const d1 = direction(b1, b2, a1);
  const d2 = direction(b1, b2, a2);
  const d3 = direction(a1, a2, b1);
  const d4 = direction(a1, a2, b2);

  if (
    ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
    ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))
  ) {
    return true;
  }

  if (d1 === 0 && onSegment(b1, b2, a1)) return true;
  if (d2 === 0 && onSegment(b1, b2, a2)) return true;
  if (d3 === 0 && onSegment(a1, a2, b1)) return true;
  if (d4 === 0 && onSegment(a1, a2, b2)) return true;

  return false;
}

function direction(a: Point2D, b: Point2D, c: Point2D): number {
  return (c.x - a.x) * (b.z - a.z) - (b.x - a.x) * (c.z - a.z);
}

function onSegment(a: Point2D, b: Point2D, c: Point2D): boolean {
  return (
    Math.min(a.x, b.x) <= c.x &&
    c.x <= Math.max(a.x, b.x) &&
    Math.min(a.z, b.z) <= c.z &&
    c.z <= Math.max(a.z, b.z)
  );
}

/**
 * Order points by polar angle around their centroid.
 * Useful as a recovery helper if the user taps corners out of order.
 */
export function orderCornersByAngle(corners: Point2D[]): Point2D[] {
  if (corners.length === 0) return [];
  let cx = 0;
  let cz = 0;
  for (const p of corners) {
    cx += p.x;
    cz += p.z;
  }
  cx /= corners.length;
  cz /= corners.length;

  return [...corners].sort((a, b) => {
    const angA = Math.atan2(a.z - cz, a.x - cx);
    const angB = Math.atan2(b.z - cz, b.x - cx);
    return angA - angB;
  });
}

/**
 * Compute all edge lengths in order.
 */
export function edgeLengths(corners: Point2D[]): number[] {
  const n = corners.length;
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const a = corners[i];
    const b = corners[(i + 1) % n];
    out.push(Math.hypot(a.x - b.x, a.z - b.z));
  }
  return out;
}

export function computeRoomMetrics(
  corners: Point2D[],
  ceilingHeightM: number = DEFAULT_CEILING_HEIGHT_M
): { metrics: RoomMetrics | null; error: string | null } {
  if (corners.length < 4) {
    return { metrics: null, error: null };
  }
  if (!isSimplePolygon(corners)) {
    return {
      metrics: null,
      error:
        "Room outline crosses itself. Tap the 4 corners in order around the perimeter.",
    };
  }

  const floorAreaM2 = polygonArea(corners);
  const perimeterM = polygonPerimeter(corners);

  return {
    metrics: {
      floorAreaM2,
      wallAreaM2: wallArea(perimeterM, ceilingHeightM),
      perimeterM,
      ceilingHeightM,
    },
    error: null,
  };
}

export function clampCeilingHeight(value: number): number {
  return Math.max(MIN_CEILING_HEIGHT_M, Math.min(MAX_CEILING_HEIGHT_M, value));
}

export function formatM2(value: number, digits = 2): string {
  return `${value.toFixed(digits)} m²`;
}

export function formatLinearM(value: number, digits = 2): string {
  return `${value.toFixed(digits)} m`;
}

export function formatCm(value: number): string {
  return `${Math.round(value * 100)} cm`;
}
