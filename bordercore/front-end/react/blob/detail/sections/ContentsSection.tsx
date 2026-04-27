import React, { useEffect, useRef, useState } from "react";

import type { TreeNode } from "../../types";

interface ContentsSectionProps {
  // Tree of headings parsed from blob content (top-level nodes, with nested children).
  nodes: TreeNode[];
  // Container with the rendered markdown — needed to attach IntersectionObserver.
  contentRoot: HTMLElement | null;
}

interface FlatToCItem {
  id: number;
  label: string;
  level: number;
}

function flatten(nodes: TreeNode[], level: number, out: FlatToCItem[]): void {
  for (const n of nodes) {
    out.push({ id: n.id, label: n.label, level });
    if (n.nodes && n.nodes.length > 0) flatten(n.nodes, level + 1, out);
  }
}

// Server-side markdown insertion (Blob.get_tree) wraps each heading with a
// `%#@!N!@#%` marker that BlobDetailPage replaces with `<a name="section_N">`.
// The scroll-spy locks onto these anchors.
function anchorIdFor(headingId: number): string {
  return `section_${headingId}`;
}

export function ContentsSection({ nodes, contentRoot }: ContentsSectionProps) {
  const [activeId, setActiveId] = useState<number | null>(null);
  const items = useRef<FlatToCItem[]>([]);

  if (items.current.length === 0 && nodes.length > 0) {
    flatten(nodes, 1, items.current);
  }

  useEffect(() => {
    if (!contentRoot) return;
    if (items.current.length === 0) return;

    const observed: HTMLElement[] = [];
    for (const item of items.current) {
      const anchor = contentRoot.querySelector<HTMLElement>(`a[name="${anchorIdFor(item.id)}"]`);
      if (anchor) observed.push(anchor);
    }
    if (observed.length === 0) return;

    const visible = new Map<HTMLElement, number>();
    const observer = new IntersectionObserver(
      entries => {
        for (const e of entries) {
          if (e.isIntersecting) {
            visible.set(e.target as HTMLElement, e.intersectionRatio);
          } else {
            visible.delete(e.target as HTMLElement);
          }
        }
        // Pick the topmost visible anchor.
        let best: HTMLElement | null = null;
        let bestTop = Infinity;
        for (const el of visible.keys()) {
          const top = el.getBoundingClientRect().top;
          if (top < bestTop) {
            best = el;
            bestTop = top;
          }
        }
        if (best) {
          const idAttr = best.getAttribute("name") || "";
          const match = idAttr.match(/^section_(\d+)$/);
          if (match) setActiveId(Number(match[1]));
        }
      },
      { rootMargin: "-80px 0px -60% 0px", threshold: [0, 0.5, 1] }
    );

    for (const el of observed) observer.observe(el);
    return () => observer.disconnect();
  }, [contentRoot, nodes]);

  if (items.current.length === 0) return null;

  return (
    <div className="bd-rail-section bd-toc-section">
      <h3>
        Contents <span className="bd-count">{items.current.length}</span>
      </h3>
      <nav className="bd-toc">
        {items.current.map(item => (
          <a
            key={item.id}
            href={`#${anchorIdFor(item.id)}`}
            className={`bd-toc-item lvl-${item.level}${activeId === item.id ? " active" : ""}`}
            onClick={e => {
              e.preventDefault();
              if (!contentRoot) return;
              const anchor = contentRoot.querySelector<HTMLElement>(
                `a[name="${anchorIdFor(item.id)}"]`
              );
              if (anchor) {
                anchor.scrollIntoView({ behavior: "smooth", block: "start" });
                setActiveId(item.id);
              }
            }}
          >
            <span className="label">{item.label}</span>
          </a>
        ))}
      </nav>
    </div>
  );
}

export default ContentsSection;
