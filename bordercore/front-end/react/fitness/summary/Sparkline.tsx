import React from "react";

interface SparklineProps {
  series: number[];
  /** Pixel height of the rendered SVG. The width stretches to fill. */
  height?: number;
  ariaLabel?: string;
}

/**
 * Tiny SVG sparkline — polyline + gradient fill underneath + glowing
 * last-point dot. Self-contained so cards don't need a chart library.
 *
 * The series renders oldest→newest. Stroke and dot pick up ``currentColor``,
 * so the parent card controls accent via CSS (per-state ``--card-accent``)
 * and the file stays free of inline ``style`` props.
 */
export function Sparkline({ series, height = 36, ariaLabel = "trend" }: SparklineProps) {
  const width = 220;

  if (!series || series.length < 2) {
    return (
      <svg
        className="fitness-card__sparkline fitness-card__sparkline--empty"
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={ariaLabel}
      />
    );
  }

  const padX = 2;
  const padY = 4;
  const innerW = width - padX * 2;
  const innerH = height - padY * 2;

  const min = Math.min(...series);
  const max = Math.max(...series);
  const span = max - min || 1;

  const points = series.map((value, i) => {
    const x = padX + (innerW * i) / (series.length - 1);
    const y = padY + innerH - ((value - min) / span) * innerH;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  });
  const polyline = points.join(" ");
  const lastX = padX + innerW;
  const lastY = padY + innerH - ((series[series.length - 1] - min) / span) * innerH;
  const areaPath = `M${padX},${height - padY} L${points.join(" L")} L${lastX},${height - padY} Z`;

  // Each rendered Sparkline needs a uniquely-keyed gradient so the gradients
  // don't collide across cards. The gradient itself uses currentColor so
  // it retints automatically per parent state.
  const gradId = `fitness-spark-${React.useId().replace(/:/g, "")}`;

  return (
    <svg
      className="fitness-card__sparkline"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={ariaLabel}
    >
      <defs>
        <linearGradient id={gradId} x1="0" x2="0" y1="0" y2="1">
          <stop className="fitness-card__sparkline-stop-top" offset="0%" />
          <stop className="fitness-card__sparkline-stop-bottom" offset="100%" />
        </linearGradient>
      </defs>
      <path className="fitness-card__sparkline-fill" d={areaPath} fill={`url(#${gradId})`} />
      <polyline className="fitness-card__sparkline-line" points={polyline} />
      <circle className="fitness-card__sparkline-dot" cx={lastX} cy={lastY} r="2" />
    </svg>
  );
}

export default Sparkline;
