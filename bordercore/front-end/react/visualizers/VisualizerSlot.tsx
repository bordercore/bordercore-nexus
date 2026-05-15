import React, { useEffect, useState } from "react";
import { VISUALIZER_REGISTRY } from "./registry";
import { isRenderable, RENDERABLE_KEYS, type RenderableKey, type VisualizerKey } from "./types";

function readChoice(): VisualizerKey {
  const v = document.documentElement.getAttribute("visualizer");
  if (
    v === "icosahedron" ||
    v === "tesseract" ||
    v === "mobius" ||
    v === "globe" ||
    v === "random" ||
    v === "none"
  ) {
    return v;
  }
  return "torus";
}

function pickRandom(): RenderableKey {
  const i = Math.floor(Math.random() * RENDERABLE_KEYS.length);
  return RENDERABLE_KEYS[i];
}

export function VisualizerSlot() {
  const [choice, setChoice] = useState<VisualizerKey>(readChoice);
  // Random is resolved once per mount so the visualizer doesn't change
  // mid-session every time someone toggles the picker.
  const [randomPick, setRandomPick] = useState<RenderableKey>(pickRandom);

  useEffect(() => {
    const obs = new MutationObserver(() => {
      const next = readChoice();
      setChoice(prev => {
        if (next === "random" && prev !== "random") setRandomPick(pickRandom());
        return next;
      });
    });
    obs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["visualizer"],
    });
    return () => obs.disconnect();
  }, []);

  if (choice === "none") return null;
  const resolved: RenderableKey =
    choice === "random" ? randomPick : isRenderable(choice) ? choice : "torus";
  const Entry = VISUALIZER_REGISTRY[resolved].component;
  return <Entry />;
}

export default VisualizerSlot;
