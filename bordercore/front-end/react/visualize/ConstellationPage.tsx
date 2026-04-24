import React, { useCallback, useEffect, useMemo, useState } from "react";
import ForceGraph from "./ForceGraph";
import ControlPanel from "./ControlPanel";
import Starfield from "./Starfield";
import { useConstellationData } from "./useConstellationData";
import type { Layer } from "./types";

const MAX_RENDERED_NODES = 1500;

interface ConstellationPageProps {
  graphUrl: string;
}

export function ConstellationPage({ graphUrl }: ConstellationPageProps) {
  const [layers, setLayers] = useState<Set<Layer>>(() => new Set<Layer>(["direct", "tags"]));
  const [dims, setDims] = useState(() => ({
    width: typeof window !== "undefined" ? window.innerWidth : 1200,
    height: typeof window !== "undefined" ? window.innerHeight : 800,
  }));

  useEffect(() => {
    const handle = () => setDims({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener("resize", handle);
    return () => window.removeEventListener("resize", handle);
  }, []);

  const { status, data, error, reload } = useConstellationData(graphUrl, layers);

  const toggleLayer = useCallback((layer: Layer) => {
    setLayers(prev => {
      const next = new Set(prev);
      if (next.has(layer)) {
        next.delete(layer);
      } else {
        next.add(layer);
      }
      // "direct" is always implicit — keep it in the set.
      next.add("direct");
      return next;
    });
  }, []);

  const clippedNodes = useMemo(() => {
    if (!data) return [];
    if (data.nodes.length <= MAX_RENDERED_NODES) return data.nodes;
    return [...data.nodes].sort((a, b) => b.degree - a.degree).slice(0, MAX_RENDERED_NODES);
  }, [data]);

  const clippedEdges = useMemo(() => {
    if (!data) return [];
    if (data.nodes.length <= MAX_RENDERED_NODES) return data.edges;
    const keep = new Set(clippedNodes.map(n => n.uuid));
    return data.edges.filter(e => keep.has(e.source) && keep.has(e.target));
  }, [data, clippedNodes]);

  const overCap = data && data.nodes.length > MAX_RENDERED_NODES;

  return (
    <div className="constellation-page">
      {status === "loading" && <LoadingOverlay />}

      {status === "error" && (
        <div className="constellation-message-overlay">
          <div className="constellation-message-card">
            <h2>Couldn&rsquo;t load constellation</h2>
            <p>{error}</p>
            <button className="btn btn-primary" onClick={reload}>
              Try again
            </button>
          </div>
        </div>
      )}

      {status === "ready" && data && data.nodes.length === 0 && (
        <div className="constellation-message-overlay">
          <div className="constellation-message-card">
            <h2>Your constellation is empty</h2>
            <p>
              Create some blobs and link them, and this page will fill in with the shape of your
              knowledge.
            </p>
            <a className="btn btn-primary" href="/blob/new/">
              Create a blob
            </a>
          </div>
        </div>
      )}

      {status === "ready" && data && data.nodes.length > 0 && (
        <>
          {overCap && (
            <div className="constellation-banner">
              Rendering {MAX_RENDERED_NODES} of {data.nodes.length} items by connection count. Older
              or isolated items aren&rsquo;t shown.
            </div>
          )}
          <ForceGraph
            nodes={clippedNodes}
            edges={clippedEdges}
            width={dims.width}
            height={dims.height}
          />
          <ControlPanel
            nodeCount={clippedNodes.length}
            edgeCount={clippedEdges.length}
            layers={layers}
            onToggleLayer={toggleLayer}
          />
        </>
      )}
    </div>
  );
}

function LoadingOverlay() {
  return (
    <div className="constellation-page constellation-loading">
      <svg
        className="constellation-svg"
        width="100%"
        height="100%"
        preserveAspectRatio="xMidYMid slice"
      >
        <Starfield
          width={typeof window !== "undefined" ? window.innerWidth : 1200}
          height={typeof window !== "undefined" ? window.innerHeight : 800}
        />
      </svg>
      <div className="constellation-loading-text">Assembling constellation&hellip;</div>
    </div>
  );
}

export default ConstellationPage;
