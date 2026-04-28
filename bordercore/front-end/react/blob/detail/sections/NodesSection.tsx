import React from "react";

import type { NodeInfo } from "../../types";

interface NodesSectionProps {
  nodes: NodeInfo[];
}

export function NodesSection({ nodes }: NodesSectionProps) {
  if (nodes.length === 0) return null;

  return (
    <div className="bd-rail-section">
      <h3>
        Nodes
        <span className="bd-count">{nodes.length}</span>
      </h3>
      <div className="bd-nodes">
        {nodes.map(node => (
          <a key={node.uuid} className="bd-node" href={node.url}>
            {node.name}
          </a>
        ))}
      </div>
    </div>
  );
}

export default NodesSection;
