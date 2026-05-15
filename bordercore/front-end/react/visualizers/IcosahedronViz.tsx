import React from "react";
import { useWireframeCanvas } from "./useWireframeCanvas";

const PHI = (1 + Math.sqrt(5)) / 2;
const TILT = -0.45;
const DIST = 3.2;
const ROTATION_S = 70;

const RAW_VERTS: [number, number, number][] = [
  [0, 1, PHI],
  [0, 1, -PHI],
  [0, -1, PHI],
  [0, -1, -PHI],
  [1, PHI, 0],
  [1, -PHI, 0],
  [-1, PHI, 0],
  [-1, -PHI, 0],
  [PHI, 0, 1],
  [PHI, 0, -1],
  [-PHI, 0, 1],
  [-PHI, 0, -1],
];

const BASE_VERTS: [number, number, number][] = (() => {
  const len = Math.hypot(0, 1, PHI);
  return RAW_VERTS.map(([x, y, z]) => [x / len, y / len, z / len]);
})();

const EDGES: [number, number][] = (() => {
  const out: [number, number][] = [];
  const target = Math.hypot(0, 2, 0) / Math.hypot(0, 1, PHI);
  const eps = 1e-3;
  for (let i = 0; i < BASE_VERTS.length; i++) {
    for (let j = i + 1; j < BASE_VERTS.length; j++) {
      const dx = BASE_VERTS[i][0] - BASE_VERTS[j][0];
      const dy = BASE_VERTS[i][1] - BASE_VERTS[j][1];
      const dz = BASE_VERTS[i][2] - BASE_VERTS[j][2];
      const d = Math.hypot(dx, dy, dz);
      if (Math.abs(d - target) < eps) out.push([i, j]);
    }
  }
  return out;
})();

export function IcosahedronViz() {
  const canvasRef = useWireframeCanvas(({ ctx, width: w, height: h, dpr, t, accent }) => {
    const angle = (t / ROTATION_S) * Math.PI * 2;
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);
    const cosT = Math.cos(TILT);
    const sinT = Math.sin(TILT);

    const scale = Math.min(w, h * 1.6) * 0.5;
    const cx = w / 2;
    const cy = h * 0.6;

    const projected = BASE_VERTS.map(([x, y, z]) => {
      const rx = x * cosA + z * sinA;
      const rz = -x * sinA + z * cosA;
      const ry = y * cosT - rz * sinT;
      const rz2 = y * sinT + rz * cosT;
      const denom = DIST - rz2;
      return { x: cx + (rx * scale) / denom, y: cy + (ry * scale) / denom, z: rz2 };
    });

    type DrawEdge = { ax: number; ay: number; bx: number; by: number; z: number };
    const draws: DrawEdge[] = EDGES.map(([i, j]) => {
      const a = projected[i];
      const b = projected[j];
      return { ax: a.x, ay: a.y, bx: b.x, by: b.y, z: (a.z + b.z) / 2 };
    });
    draws.sort((e1, e2) => e1.z - e2.z);

    ctx.lineWidth = dpr * 1.1;
    ctx.strokeStyle = accent;
    for (const e of draws) {
      const depth = (e.z + 1) / 2;
      ctx.globalAlpha = 0.15 + 0.8 * depth;
      ctx.beginPath();
      ctx.moveTo(e.ax, e.ay);
      ctx.lineTo(e.bx, e.by);
      ctx.stroke();
    }

    ctx.globalAlpha = 1;
    ctx.fillStyle = accent;
    for (const p of projected) {
      const depth = (p.z + 1) / 2;
      ctx.globalAlpha = 0.3 + 0.7 * depth;
      ctx.beginPath();
      ctx.arc(p.x, p.y, dpr * 1.4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  });

  return <canvas ref={canvasRef} className="viz-canvas" aria-hidden="true" />;
}

export default IcosahedronViz;
