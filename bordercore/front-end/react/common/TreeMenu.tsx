import React, { useState } from "react";

interface TreeNode {
  id: number;
  label: string;
  nodes: TreeNode[];
}

interface TreeMenuProps {
  item: TreeNode;
  depth?: number;
  initialOpen?: boolean;
}

export function TreeMenu({ item, depth = 1, initialOpen = false }: TreeMenuProps) {
  const [isOpen, setIsOpen] = useState(initialOpen);

  const isFolder = item.nodes && item.nodes.length > 0;

  const toggle = () => {
    if (isFolder) {
      setIsOpen(!isOpen);
    }
  };

  return (
    <li className={depth === 0 ? "hide-list-element" : ""}>
      {depth > 0 && (
        <div className={`text-break tree-node ${isFolder ? "tree-folder" : "tree-leaf"}`}>
          {isFolder && (
            <span className={`tree-arrow ${isOpen ? "open" : ""}`} onClick={toggle}>
              &#9656;
            </span>
          )}
          <a href={`#section_${item.id}`}>{item.label}</a>
        </div>
      )}
      {isFolder && isOpen && (
        <ul className="mb-0 ms-2">
          {item.nodes.map((child, index) => (
            <TreeMenu key={index} item={child} depth={depth + 1} />
          ))}
        </ul>
      )}
    </li>
  );
}

interface TreeMenuRootProps {
  tree: {
    label: string;
    nodes: TreeNode[];
  };
}

export function TreeMenuRoot({ tree }: TreeMenuRootProps) {
  if (!tree.nodes || tree.nodes.length === 0) {
    return null;
  }

  return (
    <ul className="tree-menu mb-0 ps-4">
      {tree.nodes.map((node, index) => (
        <TreeMenu key={index} item={node} depth={1} />
      ))}
    </ul>
  );
}

export default TreeMenu;
