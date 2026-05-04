export const DENSITY_STOPS = ["compact", "grid", "mosaic", "cinema"] as const;

export type Density = (typeof DENSITY_STOPS)[number];

export const STORAGE_KEY = "bordercore.collections.density";

const DEFAULT: Density = "grid";

export function densityFromIndex(i: number): Density {
  if (i < 0 || i >= DENSITY_STOPS.length || !Number.isInteger(i)) return DEFAULT;
  return DENSITY_STOPS[i];
}

export function indexFromDensity(d: Density): number {
  return DENSITY_STOPS.indexOf(d);
}

function isDensity(value: unknown): value is Density {
  return typeof value === "string" && (DENSITY_STOPS as readonly string[]).includes(value);
}

export function loadDensity(): Density {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return isDensity(raw) ? raw : DEFAULT;
  } catch {
    return DEFAULT;
  }
}

export function saveDensity(density: Density): void {
  try {
    localStorage.setItem(STORAGE_KEY, density);
  } catch {
    // ignore storage failures (private mode, quota, etc.)
  }
}
