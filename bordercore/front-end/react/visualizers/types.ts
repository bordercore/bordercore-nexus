export type VisualizerKey =
  | "torus"
  | "icosahedron"
  | "tesseract"
  | "mobius"
  | "globe"
  | "random"
  | "none";

export const VISUALIZER_KEYS: VisualizerKey[] = [
  "torus",
  "icosahedron",
  "tesseract",
  "mobius",
  "globe",
  "random",
  "none",
];

export const RENDERABLE_KEYS = ["torus", "icosahedron", "tesseract", "mobius", "globe"] as const;
export type RenderableKey = (typeof RENDERABLE_KEYS)[number];

export function isRenderable(k: VisualizerKey): k is RenderableKey {
  return (RENDERABLE_KEYS as readonly string[]).includes(k);
}
