import React from "react";

interface NeonChipProps {
  name: string;
  size?: "small" | "medium" | "large";
  showHash?: boolean;
}

export function NeonChip({ name, size = "large", showHash = true }: NeonChipProps) {
  const sizeClass =
    size === "medium" ? "tg-hero-chip--medium"
    : size === "small" ? "tg-hero-chip--small"
    : "";

  return (
    <span className={`tg-hero-chip ${sizeClass}`.trim()}>
      {showHash && <span className="tg-hero-chip__hash">#</span>}
      <span className="tg-hero-chip__name">{name}</span>
    </span>
  );
}
