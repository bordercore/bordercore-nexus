import React from "react";
import { useWireframeCanvas } from "./useWireframeCanvas";

const W_DIST = 2.2;
const Z_DIST = 3.6;
const TILT = -0.4;
const ROTATION_S = 80;
const W_ROTATION_S = 110;

const VERTS_4D: [number, number, number, number][] = (() => {
  const out: [number, number, number, number][] = [];
  for (let i = 0; i < 16; i++) {
    out.push([i & 1 ? 1 : -1, i & 2 ? 1 : -1, i & 4 ? 1 : -1, i & 8 ? 1 : -1]);
  }
  return out;
})();

const EDGES: [number, number][] = (() => {
  const out: [number, number][] = [];
  for (let i = 0; i < 16; i++) {
    for (let j = i + 1; j < 16; j++) {
      let diff = 0;
      for (let k = 0; k < 4; k++) if (VERTS_4D[i][k] !== VERTS_4D[j][k]) diff++;
      if (diff === 1) out.push([i, j]);
    }
  }
  return out;
})();

export function TesseractViz() {
  const canvasRef = useWireframeCanvas(({ ctx, width: w, height: h, dpr, t, accent }) => {
    const angle3 = (t / ROTATION_S) * Math.PI * 2;
    const angleW = (t / W_ROTATION_S) * Math.PI * 2;
    const cA = Math.cos(angle3);
    const sA = Math.sin(angle3);
    const cT = Math.cos(TILT);
    const sT = Math.sin(TILT);
    const cW = Math.cos(angleW);
    const sW = Math.sin(angleW);

    const scale = Math.min(w, h * 1.7) * 0.42;
    const cx = w / 2;
    const cy = h * 0.6;

    const projected = VERTS_4D.map(([x, y, z, w4]) => {
      const xw = x * cW + w4 * sW;
      const ww = -x * sW + w4 * cW;
      const k4 = 1 / (W_DIST - ww);
      const x3 = xw * k4;
      const y3 = y * k4;
      const z3 = z * k4;

      const rx = x3 * cA + z3 * sA;
      const rz = -x3 * sA + z3 * cA;
      const ry = y3 * cT - rz * sT;
      const rz2 = y3 * sT + rz * cT;

      const denom = Z_DIST - rz2;
      return {
        x: cx + (rx * scale) / denom,
        y: cy + (ry * scale) / denom,
        z: rz2,
        w: ww,
      };
    });

    type Draw = { ax: number; ay: number; bx: number; by: number; z: number };
    const draws: Draw[] = EDGES.map(([i, j]) => {
      const a = projected[i];
      const b = projected[j];
      return { ax: a.x, ay: a.y, bx: b.x, by: b.y, z: (a.z + b.z) / 2 };
    });
    draws.sort((e1, e2) => e1.z - e2.z);

    ctx.lineWidth = dpr;
    ctx.strokeStyle = accent;
    for (const e of draws) {
      const depth = (e.z + 1) / 2;
      ctx.globalAlpha = 0.15 + 0.75 * depth;
      ctx.beginPath();
      ctx.moveTo(e.ax, e.ay);
      ctx.lineTo(e.bx, e.by);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  });

  return <canvas ref={canvasRef} className="viz-canvas" aria-hidden="true" />;
}

export default TesseractViz;
