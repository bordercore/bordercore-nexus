import type { ComponentType } from "react";
import GlobeViz from "./GlobeViz";
import IcosahedronViz from "./IcosahedronViz";
import MobiusViz from "./MobiusViz";
import TesseractViz from "./TesseractViz";
import TorusViz from "./TorusViz";
import type { RenderableKey } from "./types";

export interface VisualizerEntry {
  label: string;
  description: string;
  component: ComponentType;
}

export const VISUALIZER_REGISTRY: Record<RenderableKey, VisualizerEntry> = {
  torus: {
    label: "Torus",
    description: "Wireframe donut, slow rotation, depth fade",
    component: TorusViz,
  },
  icosahedron: {
    label: "Icosahedron",
    description: "20-faced polyhedron with bright vertex dots",
    component: IcosahedronViz,
  },
  tesseract: {
    label: "Tesseract",
    description: "4D hypercube — nested rotating cubes",
    component: TesseractViz,
  },
  mobius: {
    label: "Möbius strip",
    description: "Single-twist ribbon, hypnotic loop",
    component: MobiusViz,
  },
  globe: {
    label: "Globe",
    description: "Lat/long sphere with pulsing nodes",
    component: GlobeViz,
  },
};
