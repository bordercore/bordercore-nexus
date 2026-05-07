import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCube,
  faBookmark,
  faCompactDisc,
  faLayerGroup,
  faSquareCheck,
  faBrain,
  faMusic,
} from "@fortawesome/free-solid-svg-icons";
import type { TagSnapshot, CountKey } from "./types";

const ICONS = {
  "fa-cube": faCube,
  "fa-bookmark": faBookmark,
  "fa-compact-disc": faCompactDisc,
  "fa-layer-group": faLayerGroup,
  "fa-square-check": faSquareCheck,
  "fa-brain": faBrain,
  "fa-music": faMusic,
} as const;

interface Props {
  tag: TagSnapshot;
  onPinnedToggle: () => void;
  onMetaToggle: () => void;
}

export function TagControlsCard({ tag, onPinnedToggle, onMetaToggle }: Props) {
  return (
    <div className="tg-card">
      <div className="tg-card__head">
        <h2 className="tg-card__title">
          tag controls — <span className="tg-accent">{tag.name}</span>
        </h2>
        <span className="tg-card__meta">{tag.user}</span>
      </div>

      <div className="tg-toggle-row">
        <div>
          <div className="tg-toggle-row__label">pinned</div>
          <div className="tg-toggle-row__hint">shows in your sidebar shortcuts</div>
        </div>
        <div className="bc-toggle" data-on={String(tag.pinned)} onClick={onPinnedToggle}>
          <div className="track">
            <div className="knob" />
          </div>
        </div>
      </div>

      <div className="tg-toggle-row">
        <div>
          <div className="tg-toggle-row__label">meta tag</div>
          <div className="tg-toggle-row__hint">
            treat as a top-level category, surface on homepage
          </div>
        </div>
        <div className="bc-toggle" data-on={String(tag.meta)} onClick={onMetaToggle}>
          <div className="track">
            <div className="knob" />
          </div>
        </div>
      </div>

      <div className="tg-refs">
        <div className="bc-label tg-refs__heading">references</div>
        <div className="tg-refs__grid">
          {(Object.keys(tag.counts) as CountKey[]).map(k => {
            const c = tag.counts[k];
            const icon = ICONS[c.icon as keyof typeof ICONS];
            const empty = c.count === 0;
            return (
              <div key={k} className={`tg-refs__cell ${empty ? "tg-refs__cell--empty" : ""}`}>
                {icon && <FontAwesomeIcon icon={icon} className="tg-refs__cell-icon" />}
                <span className="tg-refs__cell-label">{c.label}</span>
                <span className="tg-refs__cell-count">{c.count}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
