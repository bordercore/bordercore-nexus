import React from "react";

interface SideItemProps {
  label: React.ReactNode;
  count?: number | string;
  active?: boolean;
  onClick?: () => void;
  swatchColor?: string;
  className?: string;
  leadingIcon?: React.ReactNode;
}

export function SideItem({
  label,
  count,
  active,
  onClick,
  swatchColor,
  className,
  leadingIcon,
}: SideItemProps) {
  const classes = ["refined-side-item"];
  if (active) classes.push("active");
  if (className) classes.push(className);

  return (
    <button
      type="button"
      className={classes.join(" ")}
      onClick={onClick}
      aria-current={active ? "true" : undefined}
    >
      <span className="label">
        {swatchColor !== undefined && (
          <span
            className="swatch"
            aria-hidden="true"
            // must remain inline (per-tag color variable)
            style={{ "--swatch-color": swatchColor } as React.CSSProperties}
          />
        )}
        {leadingIcon}
        <span className="text">{label}</span>
      </span>
      {count !== undefined && <span className="refined-count-badge">{count}</span>}
    </button>
  );
}

export default SideItem;
