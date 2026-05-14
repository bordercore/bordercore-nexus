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
// Side-effect import: registers .transition() on d3 selections so the
// focus pan/zoom below can animate via zoomBehavior.transform.
import "d3-transition";
import Starfield from "./Starfield";
import NodeTooltip from "./NodeTooltip";
import type { GraphEdge, GraphNode } from "./types";

interface ForceGraphProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  width: number;
  height: number;
  ambientDrift?: boolean;
  // When set, pan + zoom to this node after layout settles and surface its
  // tooltip / neighbor highlight. Silently no-ops if the node isn't in the
  // current rendered set (e.g. cut by the MAX_RENDERED_NODES cap upstream).
  focusUuid?: string | null;
}

// Zoom level used when a specific node is focused via ?focus=<uuid>.
// 2.0 is enough to clearly distinguish the node + immediate neighbors
// without losing surrounding context.
const FOCUS_ZOOM_K = 2.0;
// Camera glide duration when focusing a node. Long enough to read as a
// deliberate flight, short enough not to make the user wait.
const FOCUS_TRANSITION_MS = 750;

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

// The constellation viewer is intentionally fixed-palette and does NOT
// consume theme tokens — see the header doc in static/scss/pages/_visualize.scss
// for the rationale (a constellation reads as a constellation only against
// a dark cosmic background, and the colors here are calibrated for legibility
// on that fixed gradient). The DIRECT / TAG / COLLECTION edge colors and the
// COMMUNITY_PALETTE entries are mirrored by .constellation-layer-dot-* /
// .constellation-cluster-dot-* swatches in _visualize.scss so the SVG
// rendering and the CSS legend agree; if you change one, change the other.

// Categorical palette for Louvain communities. Tuned for high luminance on
// the dark cosmic gradient — Tableau-10 shifted brighter / desaturated so
// nodes still read as "stars" rather than UI chrome. 10 slots matches
// MAX_COMMUNITIES in bordercore/visualize/services.py.
export const COMMUNITY_PALETTE = [
  "#7ab8ff", // soft blue
  "#ffb685", // warm peach
  "#8ddc9e", // mint
  "#e58fb4", // rose
  "#c9a7ff", // lavender
  "#ffd166", // gold
  "#5fd0e1", // cyan
  "#ff9090", // coral
  "#b3e07a", // chartreuse
  "#d8b094", // tan
] as const;

const UNCLUSTERED_COLOR = "#7d8aa8";

function nodeColor(community: number | null): string {
  if (community === null || community === undefined) return UNCLUSTERED_COLOR;
  return COMMUNITY_PALETTE[community % COMMUNITY_PALETTE.length];
}

/** Gradient id for a community's star fill. `null` → the unclustered gradient. */
function nodeGradientId(community: number | null): string {
  if (community === null || community === undefined) return "constellation-star-unclustered";
  return `constellation-star-${community % COMMUNITY_PALETTE.length}`;
}

const DIRECT_EDGE_COLOR = "#7d95d0";
const TAG_EDGE_COLOR = "#6b7aa8";
const COLLECTION_EDGE_COLOR = "#8a6bc4";

const WARMUP_TICKS = 300;
const HOVER_DELAY_MS = 100;

// A node's nominal radius — the size of its bright "body." The SVG circle is
// actually drawn at this * RENDER_RADIUS_MULT so the radial gradient can fade
// to transparent past the body, producing a soft glow without a blur filter.
const RENDER_RADIUS_MULT = 2.4;

// Importance >= 10 means the blob is starred by the user (see
// bordercore/blob/services.py — `is_starred = blob.importance >= 10`). Those
// nodes render as bright magnitude-1 stars with diffraction spikes; everything
// else is a regular point of light.
const STARRED_IMPORTANCE_THRESHOLD = 10;
const STARRED_RADIUS_BOOST = 1.6;
const SPIKE_LENGTH_MULT = 4.5;

function nodeRadius(degree: number): number {
  return 2.5 + Math.sqrt(Math.max(0, degree)) * 1.2;
}

function isStarred(node: GraphNode): boolean {
  return (node.importance ?? 0) >= STARRED_IMPORTANCE_THRESHOLD;
}

// Cheap, deterministic phase bucket from a uuid so each node twinkles on its
// own offset without us emitting per-node inline styles (which the project's
// test_html lints against). 8 buckets × CSS animation-delay classes give the
// visual impression of a randomized phase across thousands of nodes.
const TWINKLE_PHASE_BUCKETS = 8;

function twinklePhaseBucket(uuid: string): number {
  let sum = 0;
  for (let i = 0; i < uuid.length; i += 1) {
    sum = (sum + uuid.charCodeAt(i)) % 1024;
  }
  return sum % TWINKLE_PHASE_BUCKETS;
}

function nodeClassName(node: GraphNode): string {
  const phase = twinklePhaseBucket(node.uuid);
  const amp = isStarred(node) ? "constellation-node-amp-high" : "constellation-node-amp-low";
  return `constellation-node ${amp} constellation-node-phase-${phase}`;
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

export function ForceGraph({
  nodes,
  edges,
  width,
  height,
  ambientDrift = false,
  focusUuid = null,
}: ForceGraphProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const zoomLayerRef = useRef<SVGGElement | null>(null);
  const zoomBehaviorRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null);

  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>({});
  const [transform, setTransform] = useState<ZoomTransform>(zoomIdentity);
  const [hoverUuid, setHoverUuid] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<{ node: GraphNode; x: number; y: number } | null>(null);
  const hoverTimerRef = useRef<number | null>(null);
  // Uuid we've most recently flown to; lets the focus effect fire once per
  // distinct target (the initial ?focus= and every subsequent search pick)
  // without re-firing on unrelated rerenders that share the same focusUuid.
  const lastFocusedRef = useRef<string | null>(null);

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

  // Pan + zoom to the focused node once layout has produced positions. Fires
  // once per distinct focus uuid — covers both the initial ?focus= param and
  // later picks from the search box. lastFocusedRef prevents re-firing when
  // unrelated state (layer toggle, window resize, hover) re-runs the effect
  // with the same target.
  useEffect(() => {
    if (!focusUuid) return;
    if (lastFocusedRef.current === focusUuid) return;
    const pos = positions[focusUuid];
    if (!pos) return;
    if (!svgRef.current || !zoomBehaviorRef.current) return;
    if (!nodes.some(n => n.uuid === focusUuid)) return;

    lastFocusedRef.current = focusUuid;

    // d3-zoom's transform composes as (translate, then scale * coords), so to
    // place a graph-space point (pos.x, pos.y) at viewport center we need:
    //   tx = width/2  - pos.x * k
    //   ty = height/2 - pos.y * k
    const k = FOCUS_ZOOM_K;
    const target = zoomIdentity.translate(width / 2 - pos.x * k, height / 2 - pos.y * k).scale(k);
    const svg = select(svgRef.current);
    // Animate via d3 transition; the zoom behavior pipes intermediate
    // transforms through its "zoom" handler so our React `transform` state
    // updates each frame and the SVG group re-renders accordingly.
    svg.transition().duration(FOCUS_TRANSITION_MS).call(zoomBehaviorRef.current.transform, target);

    // Surface the focused node the same way a hover would: tooltip + neighbor
    // highlight. We anchor the tooltip at the post-pan viewport position so
    // it lands next to where the node will settle, not where it started.
    const focused = nodes.find(n => n.uuid === focusUuid);
    if (focused) {
      setHoverUuid(focusUuid);
      setTooltip({ node: focused, x: width / 2, y: height / 2 });
    }
  }, [focusUuid, positions, nodes, width, height]);

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
          {/*
            One radial gradient per community palette slot + one for the
            unclustered bucket. Each gradient bakes its own glow: hot white
            core (0–10%) → solid community color (28%) → faded color (55%) →
            transparent (100%). Rendering at RENDER_RADIUS_MULT × the body
            radius gives the outer fade room to breathe, replacing the old
            uniform gaussian blur filter with a per-color star.
          */}
          {COMMUNITY_PALETTE.map((color, idx) => (
            <radialGradient key={idx} id={`constellation-star-${idx}`}>
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
              <stop offset="14%" stopColor="#ffffff" stopOpacity="0.7" />
              <stop offset="28%" stopColor={color} stopOpacity="1" />
              <stop offset="55%" stopColor={color} stopOpacity="0.55" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </radialGradient>
          ))}
          <radialGradient id="constellation-star-unclustered">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.85" />
            <stop offset="14%" stopColor="#ffffff" stopOpacity="0.55" />
            <stop offset="28%" stopColor={UNCLUSTERED_COLOR} stopOpacity="0.9" />
            <stop offset="55%" stopColor={UNCLUSTERED_COLOR} stopOpacity="0.4" />
            <stop offset="100%" stopColor={UNCLUSTERED_COLOR} stopOpacity="0" />
          </radialGradient>
          {/*
            Diffraction-spike symbol used by starred (importance >= 10) blobs.
            Two thin crossed lines centered on (0, 0) in a -10..10 viewBox; the
            consumer scales it to SPIKE_LENGTH_MULT × the body radius via the
            width/height attributes on <use>.
          */}
          <symbol
            id="constellation-spike"
            viewBox="-10 -10 20 20"
            overflow="visible"
            preserveAspectRatio="xMidYMid meet"
          >
            <line x1="-10" y1="0" x2="10" y2="0" stroke="#ffffff" strokeWidth="0.25" />
            <line x1="0" y1="-10" x2="0" y2="10" stroke="#ffffff" strokeWidth="0.25" />
          </symbol>
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
              const starred = isStarred(node);
              // Body radius: starred blobs bump up a notch (magnitude metaphor).
              // Render radius is larger so the gradient's fade has room.
              const bodyRadius = nodeRadius(node.degree) * (starred ? STARRED_RADIUS_BOOST : 1);
              const hoverScale = isHover ? 1.3 : 1;
              const renderRadius = bodyRadius * RENDER_RADIUS_MULT * hoverScale;
              const opacity = dimmed ? 0.2 : 1;
              const spikeSize = bodyRadius * SPIKE_LENGTH_MULT * hoverScale;
              return (
                <a
                  key={node.uuid}
                  href={node.detail_url}
                  className={nodeClassName(node)}
                  onMouseEnter={event => scheduleHover(node, event.clientX, event.clientY)}
                  onMouseMove={event => {
                    if (hoverUuid === node.uuid) {
                      setTooltip({ node, x: event.clientX, y: event.clientY });
                    }
                  }}
                  onMouseLeave={clearHover}
                >
                  {starred && (
                    <use
                      href="#constellation-spike"
                      x={pos.x - spikeSize / 2}
                      y={pos.y - spikeSize / 2}
                      width={spikeSize}
                      height={spikeSize}
                      opacity={dimmed ? 0.08 : 0.55}
                      pointerEvents="none"
                    />
                  )}
                  <circle
                    cx={pos.x}
                    cy={pos.y}
                    r={renderRadius}
                    fill={`url(#${nodeGradientId(node.community)})`}
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
