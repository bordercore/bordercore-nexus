import React, { useEffect, useRef } from "react";

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
        {
          x: 0.15 + 0.05 * Math.sin(t * 0.4),
          y: 0.5 + 0.2 * Math.cos(t * 0.3),
          c: "rgba(179,107,255,0.45)",
          r: 0.7,
        },
        {
          x: 0.45 + 0.12 * Math.sin(t * 0.27),
          y: 0.45 + 0.25 * Math.cos(t * 0.5),
          c: "rgba(76,194,255,0.30)",
          r: 0.55,
        },
        {
          x: 0.78 + 0.08 * Math.sin(t * 0.35),
          y: 0.55 + 0.2 * Math.cos(t * 0.42),
          c: "rgba(255,61,189,0.28)",
          r: 0.6,
        },
        {
          x: 0.95 + 0.06 * Math.sin(t * 0.6),
          y: 0.4 + 0.18 * Math.cos(t * 0.24),
          c: "rgba(124,127,255,0.30)",
          r: 0.5,
        },
      ];
      for (const b of blobs) {
        const cx = b.x * cw;
        const cy = b.y * ch;
        const rad = b.r * ch * 2.2;
        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad);
        grad.addColorStop(0, b.c);
        grad.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, cw, ch);
      }
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

    return () => {
      if (raf !== null) cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
    };
  }, []);

  return (
    <div ref={containerRef} className="refined-tb-bg">
      <canvas ref={canvasRef} className="refined-tb-bg-canvas" />
    </div>
  );
}

export default AuroraBg;
