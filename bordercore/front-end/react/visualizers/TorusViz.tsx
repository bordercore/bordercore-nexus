import React from "react";
import { useWireframeCanvas } from "./useWireframeCanvas";

const SEG_U = 40;
const SEG_V = 16;
const R = 1.0;
const r = 0.38;
const TILT = -0.55;
const DIST = 3.0;
const ROTATION_S = 60;

const baseVerts: [number, number, number][][] = (() => {
  const out: [number, number, number][][] = [];
  for (let i = 0; i < SEG_U; i++) {
    const u = (i / SEG_U) * Math.PI * 2;
    const cosU = Math.cos(u);
    const sinU = Math.sin(u);
    const ring: [number, number, number][] = [];
    for (let j = 0; j < SEG_V; j++) {
      const v = (j / SEG_V) * Math.PI * 2;
      const tubeR = R + r * Math.cos(v);
      ring.push([tubeR * cosU, r * Math.sin(v), tubeR * sinU]);
    }
    out.push(ring);
  }
  return out;
})();

export function TorusViz() {
  const canvasRef = useWireframeCanvas(({ ctx, width: w, height: h, dpr, t, accent }) => {
    const angle = (t / ROTATION_S) * Math.PI * 2;
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);
    const cosT = Math.cos(TILT);
    const sinT = Math.sin(TILT);

    const scale = Math.min(w * 0.42, h * 0.95);
    const cx = w / 2;
    const cy = h * 0.6;

    const projected: { x: number; y: number; z: number }[][] = baseVerts.map(ring =>
      ring.map(([x, y, z]) => {
        const rx = x * cosA + z * sinA;
        const rz = -x * sinA + z * cosA;
        const ry = y * cosT - rz * sinT;
        const rz2 = y * sinT + rz * cosT;
        const denom = DIST - rz2;
        return { x: cx + (rx * scale) / denom, y: cy + (ry * scale) / denom, z: rz2 };
      })
    );

    type Edge = { ax: number; ay: number; bx: number; by: number; z: number };
    const edges: Edge[] = [];
    for (let i = 0; i < SEG_U; i++) {
      for (let j = 0; j < SEG_V; j++) {
        const ni = (i + 1) % SEG_U;
        const nj = (j + 1) % SEG_V;
        const a = projected[i][j];
        const ring = projected[ni][j];
        const tube = projected[i][nj];
        edges.push({ ax: a.x, ay: a.y, bx: ring.x, by: ring.y, z: (a.z + ring.z) / 2 });
        edges.push({ ax: a.x, ay: a.y, bx: tube.x, by: tube.y, z: (a.z + tube.z) / 2 });
      }
    }
    edges.sort((e1, e2) => e1.z - e2.z);

    ctx.lineWidth = dpr;
    ctx.strokeStyle = accent;
    const zMin = -(R + r);
    const zRange = (R + r) * 2;
    for (const e of edges) {
      const depth = (e.z - zMin) / zRange;
      ctx.globalAlpha = 0.1 + 0.8 * depth;
      ctx.beginPath();
      ctx.moveTo(e.ax, e.ay);
      ctx.lineTo(e.bx, e.by);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  });

  return <canvas ref={canvasRef} className="viz-canvas" aria-hidden="true" />;
}

export default TorusViz;
