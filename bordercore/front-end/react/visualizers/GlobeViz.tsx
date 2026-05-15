import React from "react";
import { useWireframeCanvas } from "./useWireframeCanvas";

const LAT_LINES = 7;
const LON_LINES = 14;
const SEG = 48;
const TILT = -0.35;
const DIST = 3.2;
const ROTATION_S = 90;
const NODE_PULSE_S = 4;

const NODES: [number, number][] = [
  [0.6, 0.3],
  [1.2, 1.4],
  [0.9, 2.6],
  [1.7, 3.5],
  [0.5, 4.6],
  [1.4, 5.5],
];

function sphereXYZ(theta: number, phi: number): [number, number, number] {
  const s = Math.sin(theta);
  return [s * Math.cos(phi), Math.cos(theta), s * Math.sin(phi)];
}

const LAT_RINGS: [number, number, number][][] = (() => {
  const out: [number, number, number][][] = [];
  for (let i = 1; i < LAT_LINES; i++) {
    const theta = (i / LAT_LINES) * Math.PI;
    const ring: [number, number, number][] = [];
    for (let j = 0; j <= SEG; j++) {
      ring.push(sphereXYZ(theta, (j / SEG) * Math.PI * 2));
    }
    out.push(ring);
  }
  return out;
})();

const LON_RINGS: [number, number, number][][] = (() => {
  const out: [number, number, number][][] = [];
  for (let i = 0; i < LON_LINES; i++) {
    const phi = (i / LON_LINES) * Math.PI * 2;
    const ring: [number, number, number][] = [];
    for (let j = 0; j <= SEG; j++) {
      ring.push(sphereXYZ((j / SEG) * Math.PI, phi));
    }
    out.push(ring);
  }
  return out;
})();

export function GlobeViz() {
  const canvasRef = useWireframeCanvas(({ ctx, width: w, height: h, dpr, t, accent }) => {
    const angle = (t / ROTATION_S) * Math.PI * 2;
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);
    const cosT = Math.cos(TILT);
    const sinT = Math.sin(TILT);

    const scale = Math.min(w, h * 1.7) * 0.45;
    const cx = w / 2;
    const cy = h * 0.6;

    const project = ([x, y, z]: [number, number, number]) => {
      const rx = x * cosA + z * sinA;
      const rz = -x * sinA + z * cosA;
      const ry = y * cosT - rz * sinT;
      const rz2 = y * sinT + rz * cosT;
      const denom = DIST - rz2;
      return { x: cx + (rx * scale) / denom, y: cy + (ry * scale) / denom, z: rz2 };
    };

    const drawRing = (ring: [number, number, number][]) => {
      ctx.beginPath();
      let prev: { x: number; y: number; z: number } | null = null;
      for (const p of ring) {
        const q = project(p);
        const depth = (q.z + 1) / 2;
        ctx.globalAlpha = 0.08 + 0.55 * depth;
        if (prev) {
          ctx.beginPath();
          ctx.moveTo(prev.x, prev.y);
          ctx.lineTo(q.x, q.y);
          ctx.stroke();
        }
        prev = q;
      }
    };

    ctx.lineWidth = dpr * 0.9;
    ctx.strokeStyle = accent;
    for (const ring of LAT_RINGS) drawRing(ring);
    for (const ring of LON_RINGS) drawRing(ring);

    ctx.fillStyle = accent;
    const pulse = (Math.sin((t / NODE_PULSE_S) * Math.PI * 2) + 1) / 2;
    for (const [theta, phi] of NODES) {
      const q = project(sphereXYZ(theta, phi));
      if (q.z < -0.05) continue;
      const depth = (q.z + 1) / 2;
      ctx.globalAlpha = (0.4 + 0.6 * depth) * (0.6 + 0.4 * pulse);
      ctx.beginPath();
      ctx.arc(q.x, q.y, dpr * (1.6 + 0.6 * pulse), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  });

  return <canvas ref={canvasRef} className="viz-canvas" aria-hidden="true" />;
}

export default GlobeViz;
