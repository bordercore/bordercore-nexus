import React from "react";
import { useWireframeCanvas } from "./useWireframeCanvas";

const SEG_U = 60;
const SEG_V = 5;
const R = 1.0;
const W = 0.32;
const TILT = -0.7;
const DIST = 3.0;
const ROTATION_S = 75;

const BASE_VERTS: [number, number, number][][] = (() => {
  const out: [number, number, number][][] = [];
  for (let i = 0; i <= SEG_U; i++) {
    const u = (i / SEG_U) * Math.PI * 2;
    const cu = Math.cos(u);
    const su = Math.sin(u);
    const cuH = Math.cos(u / 2);
    const suH = Math.sin(u / 2);
    const ring: [number, number, number][] = [];
    for (let j = 0; j <= SEG_V; j++) {
      const v = -W + (2 * W * j) / SEG_V;
      const rad = R + v * cuH;
      ring.push([rad * cu, rad * su, v * suH]);
    }
    out.push(ring);
  }
  return out;
})();

export function MobiusViz() {
  const canvasRef = useWireframeCanvas(({ ctx, width: w, height: h, dpr, t, accent }) => {
    const angle = (t / ROTATION_S) * Math.PI * 2;
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);
    const cosT = Math.cos(TILT);
    const sinT = Math.sin(TILT);

    const scale = Math.min(w * 0.42, h * 1.0);
    const cx = w / 2;
    const cy = h * 0.6;

    const projected: { x: number; y: number; z: number }[][] = BASE_VERTS.map(ring =>
      ring.map(([x, y, z]) => {
        const rx = x * cosA + y * sinA;
        const ry0 = -x * sinA + y * cosA;
        const ry = ry0 * cosT - z * sinT;
        const rz2 = ry0 * sinT + z * cosT;
        const denom = DIST - rz2;
        return { x: cx + (rx * scale) / denom, y: cy + (ry * scale) / denom, z: rz2 };
      })
    );

    type Edge = { ax: number; ay: number; bx: number; by: number; z: number };
    const edges: Edge[] = [];
    for (let i = 0; i < SEG_U; i++) {
      for (let j = 0; j <= SEG_V; j++) {
        const a = projected[i][j];
        const b = projected[i + 1][j];
        edges.push({ ax: a.x, ay: a.y, bx: b.x, by: b.y, z: (a.z + b.z) / 2 });
      }
    }
    for (let i = 0; i <= SEG_U; i++) {
      for (let j = 0; j < SEG_V; j++) {
        const a = projected[i][j];
        const b = projected[i][j + 1];
        edges.push({ ax: a.x, ay: a.y, bx: b.x, by: b.y, z: (a.z + b.z) / 2 });
      }
    }
    edges.sort((e1, e2) => e1.z - e2.z);

    ctx.lineWidth = dpr;
    ctx.strokeStyle = accent;
    for (const e of edges) {
      const depth = (e.z + 1) / 2;
      ctx.globalAlpha = 0.15 + 0.8 * depth;
      ctx.beginPath();
      ctx.moveTo(e.ax, e.ay);
      ctx.lineTo(e.bx, e.by);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  });

  return <canvas ref={canvasRef} className="viz-canvas" aria-hidden="true" />;
}

export default MobiusViz;
