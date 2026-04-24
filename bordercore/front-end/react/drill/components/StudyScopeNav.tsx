import React from "react";
import type { StudyScopeItem, DrillUrls } from "../types";

interface Props {
  items: StudyScopeItem[];
  urls: DrillUrls;
  activeKey: string;
  onSelect: (key: string) => void;
}

export default function StudyScopeNav({ items, urls, activeKey, onSelect }: Props) {
  return (
    <div>
      <h3>study scope</h3>
      <div className="drill-nav">
        {items.map(item => (
          <a
            key={item.key}
            className={`drill-nav-item ${activeKey === item.key ? "active" : ""}`}
            href={`${urls.startStudySession}?study_method=${item.key}`}
            onClick={() => onSelect(item.key)}
          >
            <span className="label">{item.label}</span>
            {item.count !== null && <span className="count">{item.count}</span>}
          </a>
        ))}
      </div>
    </div>
  );
}
