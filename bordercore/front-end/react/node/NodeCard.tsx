import React from "react";
import type { NodeListItem } from "./types";
import { ageTone, fmtDate, relDate } from "./nodeListUtils";

interface SparklineProps {
  collections: number;
  todos: number;
}

function Sparkline({ collections, todos }: SparklineProps) {
  // Deterministic activity bars derived from the counts — purely decorative.
  const bars: number[] = [];
  const seed = collections * 13 + todos * 7 || 3;
  for (let i = 0; i < 12; i++) {
    const v = ((seed * (i + 3)) % 11) / 11;
    bars.push(0.2 + v * 0.8);
  }
  return (
    <svg className="nl-spark" viewBox="0 0 48 16" preserveAspectRatio="none" aria-hidden="true">
      {bars.map((h, i) => (
        <rect key={i} x={i * 4} y={16 - h * 14} width={2.4} height={h * 14} rx={0.6} />
      ))}
    </svg>
  );
}

interface NodeCardProps {
  node: NodeListItem;
  dense: boolean;
  detailUrl: string;
}

export function NodeCard({ node, dense, detailUrl }: NodeCardProps) {
  const tone = ageTone(node.modified);
  const isEmpty = node.collection_count === 0 && node.todo_count === 0;
  const classes = ["nl-card"];
  if (dense) classes.push("dense");
  if (node.pinned) classes.push("pinned");
  if (isEmpty) classes.push("empty");

  const style = {
    "--rail": tone.rail,
    "--rail-glow": tone.glow,
  } as React.CSSProperties;

  return (
    <a
      className={classes.join(" ")}
      // must remain inline (per-card --rail / --rail-glow age-tone variables)
      style={style}
      href={detailUrl}
    >
      <div className="nl-rail" aria-hidden="true" />

      <header className="nl-card-head">
        <h3 className="nl-card-title">{node.name}</h3>
        {node.pinned && (
          <span className="nl-pin" title="pinned">
            ◆
          </span>
        )}
      </header>

      {!dense && <Sparkline collections={node.collection_count} todos={node.todo_count} />}

      <dl className="nl-stats">
        <div className="nl-stat">
          <dt>collections</dt>
          <dd>
            <span className={`nl-num${node.collection_count === 0 ? " zero" : ""}`}>
              {node.collection_count}
            </span>
          </dd>
        </div>
        <div className="nl-stat">
          <dt>todos</dt>
          <dd>
            <span
              className={`nl-num${
                node.todo_count === 0 ? " zero" : node.todo_count > 2 ? " hot" : ""
              }`}
            >
              {node.todo_count}
            </span>
          </dd>
        </div>
        <div className="nl-stat nl-stat-date">
          <dt>modified</dt>
          <dd>
            <span className="nl-date">{fmtDate(node.modified)}</span>
            <span className="nl-rel">{relDate(node.modified)}</span>
          </dd>
        </div>
      </dl>

      <footer className="nl-card-foot">
        <span className="nl-age" data-tone={tone.label}>
          ● {tone.label}
        </span>
        <span className="nl-open">
          open <span className="arrow">→</span>
        </span>
      </footer>
    </a>
  );
}

export default NodeCard;
