import React from "react";
import { ToggleSwitch } from "../common/ToggleSwitch";
import type { Layer } from "./types";

interface ControlPanelProps {
  nodeCount: number;
  edgeCount: number;
  layers: Set<Layer>;
  onToggleLayer: (layer: Layer) => void;
}

/**
 * Top-right glass-morph card: shows counts and layer toggles.
 * Direct links are shown but not toggleable.
 */
export function ControlPanel({ nodeCount, edgeCount, layers, onToggleLayer }: ControlPanelProps) {
  return (
    <div className="constellation-control-panel">
      <h2 className="constellation-control-title">Constellation</h2>
      <p className="constellation-control-counts">
        {nodeCount} {nodeCount === 1 ? "item" : "items"} · {edgeCount}{" "}
        {edgeCount === 1 ? "connection" : "connections"}
      </p>
      <ul className="constellation-layer-list">
        <li className="constellation-layer-row constellation-layer-locked">
          <span className="constellation-layer-dot constellation-layer-dot-direct" />
          <span className="constellation-layer-label">Direct links</span>
          <span className="constellation-layer-state">on</span>
        </li>
        <LayerToggle
          layer="tags"
          label="Shared tags"
          dotClass="constellation-layer-dot-tag"
          layers={layers}
          onToggle={onToggleLayer}
        />
        <LayerToggle
          layer="collections"
          label="Shared collections"
          dotClass="constellation-layer-dot-collection"
          layers={layers}
          onToggle={onToggleLayer}
        />
      </ul>
    </div>
  );
}

interface LayerToggleProps {
  layer: Layer;
  label: string;
  dotClass: string;
  layers: Set<Layer>;
  onToggle: (layer: Layer) => void;
}

function LayerToggle({ layer, label, dotClass, layers, onToggle }: LayerToggleProps) {
  const active = layers.has(layer);
  return (
    <li className="constellation-layer-row">
      <label>
        <ToggleSwitch name={`layer-${layer}`} checked={active} onChange={() => onToggle(layer)} />
        <span className={`constellation-layer-dot ${dotClass}`} />
        <span className="constellation-layer-label">{label}</span>
      </label>
    </li>
  );
}

export default ControlPanel;
