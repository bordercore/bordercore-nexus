import { useEffect, useRef } from "react";

export type DrawFn = (params: {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  dpr: number;
  /** Seconds since the visualizer mounted. Pinned to 0 if prefers-reduced-motion. */
  t: number;
  /** Accent color resolved from the active theme (rgb string). */
  accent: string;
}) => void;

export function useWireframeCanvas(draw: DrawFn) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawRef = useRef<DrawFn>(draw);
  drawRef.current = draw;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    canvas.style.color = "var(--accent)";
    const accent = getComputedStyle(canvas).color;
    canvas.style.color = "";

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const start = performance.now();
    let raf = 0;

    const tick = (now: number) => {
      const t = reduceMotion ? 0 : (now - start) / 1000;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      drawRef.current({
        ctx,
        width: canvas.width,
        height: canvas.height,
        dpr,
        t,
        accent,
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  return canvasRef;
}
