import { describe, expect, it } from "vitest";

import { VISUALIZER_REGISTRY } from "./registry";
import { RENDERABLE_KEYS } from "./types";

describe("VISUALIZER_REGISTRY", () => {
  it("has an entry for every renderable key", () => {
    expect(Object.keys(VISUALIZER_REGISTRY).sort()).toEqual([...RENDERABLE_KEYS].sort());
  });

  it("supplies a label, description, and component for each entry", () => {
    for (const key of RENDERABLE_KEYS) {
      const entry = VISUALIZER_REGISTRY[key];
      expect(entry.label, `${key}.label`).toBeTruthy();
      expect(entry.description, `${key}.description`).toBeTruthy();
      expect(entry.component, `${key}.component`).toBeTypeOf("function");
    }
  });

  it("uses unique labels across visualizers", () => {
    const labels = RENDERABLE_KEYS.map(k => VISUALIZER_REGISTRY[k].label);
    expect(new Set(labels).size).toBe(labels.length);
  });
});
