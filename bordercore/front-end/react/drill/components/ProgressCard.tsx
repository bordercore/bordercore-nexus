import React from "react";
import ProgressRing from "./ProgressRing";
import type { ProgressBlock } from "../types";
import { pluralize } from "../utils";

interface Props {
  label: string;
  meta: string;
  data: ProgressBlock;
  variant: "purple" | "cyan";
  desc: string;
  split?: { k: string; v: string }[];
}

export default function ProgressCard({ label, meta, data, variant, desc, split }: Props) {
  return (
    <section className="drill-card drill-progress-card">
      <div className="card-eyebrow">
        <h3>{label}</h3>
        <span className="meta">{meta}</span>
      </div>
      <div className="body">
        <ProgressRing pct={data.pct} variant={variant} />
        <div className="desc">
          <span className="lead">{desc}</span>
          <span className="count">
            <span className="num">{data.remaining}</span> of {data.total}{" "}
            {pluralize("question", data.total)} {data.remaining === 1 ? "needs" : "need"} review
          </span>
          {split && (
            <div className="split">
              {split.map(s => (
                <span key={s.k}>
                  <b>{s.v}</b> {s.k}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className={`drill-mini-bar ${variant === "cyan" ? "cyan" : ""}`}>
        {/* width must remain inline — driven by dynamic pct value */}
        <div className="seg" style={{ width: `${Math.max(0, Math.min(100, data.pct))}%` }} />
      </div>
    </section>
  );
}
