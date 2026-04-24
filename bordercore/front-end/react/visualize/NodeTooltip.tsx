import React from "react";
import type { GraphNode } from "./types";

interface NodeTooltipProps {
  node: GraphNode;
  clientX: number;
  clientY: number;
}

const TYPE_LABEL: Record<GraphNode["type"], string> = {
  blob: "blob",
  bookmark: "bookmark",
  question: "question",
};

/**
 * Glass-morph card rendered at a fixed position near the cursor.
 * Small offset so the cursor doesn't obscure the content.
 */
export function NodeTooltip({ node, clientX, clientY }: NodeTooltipProps) {
  const style: React.CSSProperties = {
    left: clientX + 16,
    top: clientY + 16,
  };

  return (
    // Cursor-follow coordinates must remain inline — can't be expressed as a static class.
    <div className="constellation-tooltip" style={style}>
      <div className="constellation-tooltip-type">{TYPE_LABEL[node.type]}</div>
      <div className="constellation-tooltip-name" title={node.name}>
        {node.name || "(untitled)"}
      </div>
      {node.thumbnail_url && node.type === "blob" && (
        <img
          className="constellation-tooltip-thumb"
          src={node.thumbnail_url}
          alt=""
          loading="lazy"
        />
      )}
      <div className="constellation-tooltip-meta">
        {node.degree} {node.degree === 1 ? "connection" : "connections"}
      </div>
    </div>
  );
}

export default NodeTooltip;
