import React from "react";
import { ToggleSwitch } from "../common/ToggleSwitch";
import type { GraphNode, Layer } from "./types";

interface ControlPanelProps {
  nodeCount: number;
  edgeCount: number;
  layers: Set<Layer>;
  onToggleLayer: (layer: Layer) => void;
  nodes: GraphNode[];
  communityLabels: Record<string, string[]>;
}

interface ClusterRow {
  // null is the unclustered bucket; numbers are community ids 0..N-1.
  community: number | null;
  count: number;
}

/**
 * Tally cluster sizes from the rendered (post-cap) node set so the legend
 * matches what's on screen rather than the server-side totals.
 *
 * Returns numeric communities sorted by id ascending (the server already
 * size-ordered them, so id 0 is largest). The unclustered bucket, if
 * present, is appended at the end.
 */
export function summarizeClusters(nodes: GraphNode[]): ClusterRow[] {
  const counts = new Map<number, number>();
  let unclustered = 0;
  for (const node of nodes) {
    if (node.community === null || node.community === undefined) {
      unclustered += 1;
    } else {
      counts.set(node.community, (counts.get(node.community) ?? 0) + 1);
    }
  }
  const rows: ClusterRow[] = [...counts.entries()]
    .sort(([a], [b]) => a - b)
    .map(([community, count]) => ({ community, count }));
  if (unclustered > 0) {
    rows.push({ community: null, count: unclustered });
  }
  return rows;
}

/**
 * Top-right glass-morph card: shows counts, a cluster legend, and layer
 * toggles. Direct links are shown but not toggleable.
 */
/**
 * Build the human-readable name for a cluster legend row. Prefers the
 * server-supplied TF-IDF tag labels (e.g. "linux · kernel"); falls back
 * to a generic "Cluster N" for numbered clusters without labels and the
 * literal "Unclustered" for the null bucket.
 */
export function clusterDisplayName(
  community: number | null,
  communityLabels: Record<string, string[]>,
): string {
  if (community === null) return "Unclustered";
  const labels = communityLabels[String(community)];
  if (labels && labels.length > 0) return labels.join(" · ");
  return `Cluster ${community + 1}`;
}

export function ControlPanel({
  nodeCount,
  edgeCount,
  layers,
  onToggleLayer,
  nodes,
  communityLabels,
}: ControlPanelProps) {
  const clusters = summarizeClusters(nodes);
  const hasClusters = clusters.some(row => row.community !== null);

  return (
    <div className="constellation-control-panel">
      <h2 className="constellation-control-title">Constellation</h2>
      <p className="constellation-control-counts">
        {nodeCount} {nodeCount === 1 ? "item" : "items"} · {edgeCount}{" "}
        {edgeCount === 1 ? "connection" : "connections"}
      </p>

      {hasClusters && (
        <>
          <h3 className="constellation-control-subtitle">Clusters</h3>
          <ul className="constellation-cluster-list">
            {clusters.map(row => (
              <li key={row.community ?? "unclustered"} className="constellation-cluster-row">
                <span
                  className={
                    row.community === null
                      ? "constellation-cluster-dot constellation-cluster-dot-unclustered"
                      : `constellation-cluster-dot constellation-cluster-dot-${row.community}`
                  }
                />
                <span className="constellation-cluster-label">
                  {clusterDisplayName(row.community, communityLabels)}
                </span>
                <span className="constellation-cluster-count">{row.count}</span>
              </li>
            ))}
          </ul>
        </>
      )}

      <h3 className="constellation-control-subtitle">Layers</h3>
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
