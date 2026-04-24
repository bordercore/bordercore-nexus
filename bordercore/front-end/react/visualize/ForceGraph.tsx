import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  Simulation,
  SimulationLinkDatum,
  SimulationNodeDatum,
} from "d3-force";
import { zoom, zoomIdentity, ZoomBehavior, ZoomTransform } from "d3-zoom";
import { select } from "d3-selection";
import Starfield from "./Starfield";
import NodeTooltip from "./NodeTooltip";
import type { GraphEdge, GraphNode } from "./types";

interface ForceGraphProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  width: number;
  height: number;
  ambientDrift?: boolean;
}

interface SimNode extends SimulationNodeDatum {
  uuid: string;
  data: GraphNode;
}

interface SimEdge extends SimulationLinkDatum<SimNode> {
  kind: GraphEdge["kind"];
  weight: number;
  source: string | SimNode;
  target: string | SimNode;
}

const NODE_COLOR: Record<GraphNode["type"], string> = {
  blob: "#cfe0ff",
  bookmark: "#ffd58a",
  question: "#a6e8c9",
};

const DIRECT_EDGE_COLOR = "#7d95d0";
const TAG_EDGE_COLOR = "#6b7aa8";
const COLLECTION_EDGE_COLOR = "#8a6bc4";

const WARMUP_TICKS = 300;
const HOVER_DELAY_MS = 100;

function nodeRadius(degree: number): number {
  return 2.5 + Math.sqrt(Math.max(0, degree)) * 1.2;
}

function edgeColor(kind: GraphEdge["kind"]): string {
  if (kind === "direct") return DIRECT_EDGE_COLOR;
  if (kind === "collection") return COLLECTION_EDGE_COLOR;
  return TAG_EDGE_COLOR;
}

function edgeBaseOpacity(kind: GraphEdge["kind"]): number {
  if (kind === "direct") return 0.55;
  return 0.35;
}

export function ForceGraph({ nodes, edges, width, height, ambientDrift = false }: ForceGraphProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const zoomLayerRef = useRef<SVGGElement | null>(null);
  const zoomBehaviorRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null);

  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>({});
  const [transform, setTransform] = useState<ZoomTransform>(zoomIdentity);
  const [hoverUuid, setHoverUuid] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<{ node: GraphNode; x: number; y: number } | null>(null);
  const hoverTimerRef = useRef<number | null>(null);

  // Build neighbor adjacency once per edge set, used for hover highlighting.
  const neighborsByUuid = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const edge of edges) {
      const s = typeof edge.source === "string" ? edge.source : (edge.source as SimNode).uuid;
      const t = typeof edge.target === "string" ? edge.target : (edge.target as SimNode).uuid;
      if (!map.has(s)) map.set(s, new Set());
      if (!map.has(t)) map.set(t, new Set());
      map.get(s)!.add(t);
      map.get(t)!.add(s);
    }
    return map;
  }, [edges]);

  // Run the simulation when data or dimensions change.
  useEffect(() => {
    if (nodes.length === 0) {
      setPositions({});
      return;
    }

    const simNodes: SimNode[] = nodes.map(n => ({ uuid: n.uuid, data: n }));
    const uuidIndex = new Map(simNodes.map(n => [n.uuid, n]));
    const simEdges: SimEdge[] = [];
    for (const e of edges) {
      const s = uuidIndex.get(e.source);
      const t = uuidIndex.get(e.target);
      if (!s || !t) continue;
      simEdges.push({ source: s, target: t, kind: e.kind, weight: e.weight });
    }

    const simulation: Simulation<SimNode, SimEdge> = forceSimulation<SimNode>(simNodes)
      .force(
        "link",
        forceLink<SimNode, SimEdge>(simEdges)
          .id(n => n.uuid)
          .distance(35)
          .strength(link => (link.kind === "direct" ? 0.9 : 0.3))
      )
      .force("charge", forceManyBody<SimNode>().strength(-120))
      .force("center", forceCenter(width / 2, height / 2))
      .force(
        "collide",
        forceCollide<SimNode>().radius(n => nodeRadius(n.data.degree) + 2)
      )
      .alpha(1)
      .alphaDecay(0.04)
      .stop();

    for (let i = 0; i < WARMUP_TICKS; i += 1) {
      simulation.tick();
    }

    const frozen: Record<string, { x: number; y: number }> = {};
    simNodes.forEach(n => {
      frozen[n.uuid] = { x: n.x ?? width / 2, y: n.y ?? height / 2 };
    });
    setPositions(frozen);

    if (ambientDrift) {
      simulation.alphaTarget(0.003).restart();
      simulation.on("tick", () => {
        const next: Record<string, { x: number; y: number }> = {};
        simNodes.forEach(n => {
          next[n.uuid] = { x: n.x ?? 0, y: n.y ?? 0 };
        });
        setPositions(next);
      });
      return () => {
        simulation.on("tick", null);
        simulation.stop();
      };
    }

    return () => {
      simulation.stop();
    };
  }, [nodes, edges, width, height, ambientDrift]);

  // Attach d3-zoom once; read its transform into React state.
  useEffect(() => {
    if (!svgRef.current) return;
    const svg = select(svgRef.current);
    const zoomBehavior = zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.5, 4])
      .on("zoom", event => setTransform(event.transform));
    zoomBehaviorRef.current = zoomBehavior;
    svg.call(zoomBehavior);
    return () => {
      svg.on(".zoom", null);
    };
  }, []);

  // Keyboard: "0" resets zoom, "Escape" clears hover.
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === "0" && svgRef.current && zoomBehaviorRef.current) {
        const svg = select(svgRef.current);
        svg.call(zoomBehaviorRef.current.transform, zoomIdentity);
      } else if (event.key === "Escape") {
        clearHover();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  function scheduleHover(node: GraphNode, clientX: number, clientY: number) {
    if (hoverTimerRef.current) window.clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = window.setTimeout(() => {
      setHoverUuid(node.uuid);
      setTooltip({ node, x: clientX, y: clientY });
    }, HOVER_DELAY_MS);
  }

  function clearHover() {
    if (hoverTimerRef.current) window.clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = null;
    setHoverUuid(null);
    setTooltip(null);
  }

  const hoverNeighbors = hoverUuid ? (neighborsByUuid.get(hoverUuid) ?? new Set<string>()) : null;

  return (
    <>
      <svg
        ref={svgRef}
        className="constellation-svg"
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
      >
        <defs>
          <filter id="constellation-node-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="1.8" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <Starfield width={width} height={height} />

        <g
          ref={zoomLayerRef}
          transform={`translate(${transform.x},${transform.y}) scale(${transform.k})`}
        >
          <g className="constellation-edges">
            {edges.map((edge, idx) => {
              const sKey =
                typeof edge.source === "string" ? edge.source : (edge.source as SimNode).uuid;
              const tKey =
                typeof edge.target === "string" ? edge.target : (edge.target as SimNode).uuid;
              const s = positions[sKey];
              const t = positions[tKey];
              if (!s || !t) return null;
              const dimmed = hoverUuid !== null && sKey !== hoverUuid && tKey !== hoverUuid;
              const highlighted = hoverUuid !== null && (sKey === hoverUuid || tKey === hoverUuid);
              const opacity = dimmed ? 0.08 : highlighted ? 0.9 : edgeBaseOpacity(edge.kind);
              return (
                <line
                  key={`${sKey}-${tKey}-${idx}`}
                  x1={s.x}
                  y1={s.y}
                  x2={t.x}
                  y2={t.y}
                  stroke={edgeColor(edge.kind)}
                  strokeWidth={0.6}
                  strokeOpacity={opacity}
                  pointerEvents="none"
                />
              );
            })}
          </g>

          <g className="constellation-nodes">
            {nodes.map(node => {
              const pos = positions[node.uuid];
              if (!pos) return null;
              const isHover = hoverUuid === node.uuid;
              const isNeighbor = hoverNeighbors ? hoverNeighbors.has(node.uuid) : false;
              const dimmed = hoverUuid !== null && !isHover && !isNeighbor;
              const baseRadius = nodeRadius(node.degree);
              const radius = isHover ? baseRadius * 1.3 : baseRadius;
              const opacity = dimmed ? 0.2 : 1;
              return (
                <a
                  key={node.uuid}
                  href={node.detail_url}
                  onMouseEnter={event => scheduleHover(node, event.clientX, event.clientY)}
                  onMouseMove={event => {
                    if (hoverUuid === node.uuid) {
                      setTooltip({ node, x: event.clientX, y: event.clientY });
                    }
                  }}
                  onMouseLeave={clearHover}
                >
                  <circle
                    cx={pos.x}
                    cy={pos.y}
                    r={radius}
                    fill={NODE_COLOR[node.type]}
                    filter="url(#constellation-node-glow)"
                    opacity={opacity}
                  />
                </a>
              );
            })}
          </g>
        </g>
      </svg>
      {tooltip && <NodeTooltip node={tooltip.node} clientX={tooltip.x} clientY={tooltip.y} />}
    </>
  );
}

export default ForceGraph;
