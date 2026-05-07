import React, { useEffect, useRef } from "react";

// Tokens read from :root via getComputedStyle, so the canvas tints with
// whatever theme is active. Each blob carries its own alpha (applied via
// globalAlpha at draw time) because canvas fillStyle accepts a color string,
// not an expression — and our resolved oklch(...) tokens don't carry alpha
// of their own.
type BlobToken = "--accent" | "--accent-2" | "--accent-3" | "--accent-4";
const BLOB_PALETTE: Array<{ token: BlobToken; alpha: number }> = [
  { token: "--accent", alpha: 0.45 },
  { token: "--accent-4", alpha: 0.3 },
  { token: "--accent-3", alpha: 0.28 },
  { token: "--accent-2", alpha: 0.3 },
];

function readPalette(): string[] {
  const styles = getComputedStyle(document.documentElement);
  return BLOB_PALETTE.map(({ token }) => styles.getPropertyValue(token).trim());
}

export function AuroraBg() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let raf: number | null = null;
    let visible = true;
    let cw = 0;
    let ch = 0;
    let palette = readPalette();

    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const r = container.getBoundingClientRect();
      const w = Math.max(1, Math.min(4096, Math.floor(r.width)));
      const h = Math.max(1, Math.min(512, Math.floor(r.height)));
      if (w === cw && h === ch) return;
      cw = w;
      ch = h;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const draw = (t: number) => {
      ctx.clearRect(0, 0, cw, ch);
      const blobs = [
        { x: 0.15 + 0.05 * Math.sin(t * 0.4), y: 0.5 + 0.2 * Math.cos(t * 0.3), r: 0.7 },
        { x: 0.45 + 0.12 * Math.sin(t * 0.27), y: 0.45 + 0.25 * Math.cos(t * 0.5), r: 0.55 },
        { x: 0.78 + 0.08 * Math.sin(t * 0.35), y: 0.55 + 0.2 * Math.cos(t * 0.42), r: 0.6 },
        { x: 0.95 + 0.06 * Math.sin(t * 0.6), y: 0.4 + 0.18 * Math.cos(t * 0.24), r: 0.5 },
      ];
      // Each blob fills the full rect with a radial gradient that fades
      // from its accent color (resolved from the active theme) to fully
      // transparent. globalAlpha applies the per-blob opacity that used
      // to be baked into the original rgba() literal.
      const prevAlpha = ctx.globalAlpha;
      for (let i = 0; i < blobs.length; i++) {
        const b = blobs[i];
        const color = palette[i];
        if (!color) continue;
        const cx = b.x * cw;
        const cy = b.y * ch;
        const rad = b.r * ch * 2.2;
        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad);
        grad.addColorStop(0, color);
        grad.addColorStop(1, "rgba(0, 0, 0, 0)");
        ctx.fillStyle = grad;
        ctx.globalAlpha = BLOB_PALETTE[i].alpha;
        ctx.fillRect(0, 0, cw, ch);
      }
      ctx.globalAlpha = prevAlpha;
    };

    const tick = (now: number) => {
      if (visible) draw(now / 1000);
      raf = requestAnimationFrame(tick);
    };

    resize();

    if (reduceMotion) {
      // Single static frame, no animation loop
      draw(0);
    } else {
      raf = requestAnimationFrame(tick);
    }

    // Observe parent (not canvas) to avoid resize feedback loop
    const ro = new ResizeObserver(resize);
    ro.observe(container);

    // Pause animation when bar isn't visible
    const io = new IntersectionObserver(
      entries => {
        for (const e of entries) visible = e.isIntersecting;
      },
      { threshold: 0 }
    );
    io.observe(container);

    // Re-read the palette when the user switches themes at runtime. The
    // theme switcher flips `color-mode` on <html>; watching that attribute
    // is enough to catch every theme change.
    const themeObserver = new MutationObserver(() => {
      palette = readPalette();
      // Force a static repaint so reduce-motion users see the new tint
      // immediately without waiting for the next animation frame.
      if (reduceMotion) draw(0);
    });
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["color-mode"],
    });

    return () => {
      if (raf !== null) cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      themeObserver.disconnect();
    };
  }, []);

  return (
    <div ref={containerRef} className="refined-tb-bg">
      <canvas ref={canvasRef} className="refined-tb-bg-canvas" />
    </div>
  );
}

export default AuroraBg;
