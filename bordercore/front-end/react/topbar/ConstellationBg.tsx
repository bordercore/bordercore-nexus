import React, { useEffect, useRef } from "react";

// ============================================================================
// Tunable parameters — single-line constants for easy adjustment.
// ============================================================================
const STAR_COUNT = 60;
const PAN_PX_PER_SEC = 14;
const LINE_ALPHA = 0.64;
const STAR_FIELD_COLOR = "oklch(94% 0.02 240)";
const CONST_STAR_ALPHA = 0.6;
const ACCENT_HALO_RADIUS_PX = 4;
// Subtle perspective grid (Aura-style backdrop).
const GRID_SPACING_PX = 28;
const GRID_ALPHA = 0.035;
// Dynamic linked particle mesh — drifting nodes connect when nearby,
// with z-depth driving size, opacity, and parallax for a 3D field.
const MESH_COUNT = 85;
const MESH_LINK_DIST_PX = 78;
const MESH_LINE_ALPHA = 0.16;
const MESH_SPEED_MIN = 3.5;
const MESH_SPEED_MAX = 7;
const MESH_WANDER_FORCE = 10;
const MESH_WANDER_FREQ_MIN = 0.12;
const MESH_WANDER_FREQ_MAX = 0.28;
const DEPTH_SCALE_MIN = 0.55;
const DEPTH_SCALE_MAX = 1.0;
const DEPTH_ALPHA_MIN = 0.22;
const DEPTH_ALPHA_MAX = 0.88;
const DEPTH_Y_SHIFT_FRAC = 0.12;
const STAR_GLOW_RADIUS_MUL = 2.4;
// Procedural cluster graphs — irregular node blobs with proximity links,
// replacing linear stick-figure constellations with Aura-style meshes.
const CLUSTER_NODE_COUNT_MIN = 9;
const CLUSTER_NODE_COUNT_MAX = 14;
const CLUSTER_LINK_DIST_NORM = 0.44;
const CLUSTER_NODE_DRIFT_AMP = 0.07;
const CLUSTER_WIDTH_MIN = 1.3;
const CLUSTER_WIDTH_MAX = 2.2;
const CLUSTER_MIN_NODE_SEP = 0.11;
// Slow foreshortening tilt on clusters so they read as 3D shapes.
const CONST_TILT_FREQ_HZ = 0.06;
const CONST_TILT_AMP = 0.32;
const PAN_WAVE_AMP_PX = 14;
const PAN_WAVE_FREQ_HZ = 0.09;
const SHOOTING_STAR_MIN_S = 25;
const SHOOTING_STAR_MAX_S = 60;
const SHOOTING_STAR_DURATION_S = 0.7;
const SHOOTING_STAR_TAIL_PX = 80;
const CONSTELLATION_GAP_MIN_PX = 160;
const CONSTELLATION_GAP_MAX_PX = 320;
const CONSTELLATION_VSCALE = 0.78;
const ROTATION_PERIOD_S_MIN = 28;
const ROTATION_PERIOD_S_MAX = 48;
const Y_BOB_FREQ_MIN_HZ = 0.03;
const Y_BOB_FREQ_MAX_HZ = 0.08;
const Y_BOB_AMPLITUDE_FRAC = 0.35;

// Deterministic seeded RNG so the ambient star field is stable across
// remounts and so React strict-mode double-effect doesn't reshuffle the
// layout. Standard mulberry32.
function makeRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface AmbientStar {
  x: number; // 0..1
  y: number; // 0..1
  z: number; // 0..1 depth
  mag: number; // 0.15..0.55
  phase: number; // 0..2π
  freq: number; // Hz
}

interface MeshParticle {
  x: number; // px
  y: number; // px
  z: number; // 0..1 depth
  vx: number; // px/s
  vy: number; // px/s
  vz: number; // depth units/s
  wanderPhase: number;
  wanderFreq: number;
}

interface ClusterNode {
  nx: number; // -0.5..0.5 normalized offset from cluster center
  ny: number;
  nz: number; // 0..1 depth within cluster
  mag: number;
  driftPhase: number;
  driftFreq: number;
}

interface ActiveCluster {
  nodes: ClusterNode[];
  width: number; // aspect ratio w/h
  xOffsetPx: number;
  yJitter: number;
  scale: number;
  rotation: number;
  rotationSpeed: number;
  vxSign: number;
  yPhase: number;
  yBobFreq: number;
  panWavePhase: number;
}

interface DepthPoint {
  x: number;
  y: number;
  scale: number;
  alpha: number;
}

interface ShootingStar {
  startT: number;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

function depthProject(x: number, y: number, z: number, ch: number): DepthPoint {
  const scale = DEPTH_SCALE_MIN + z * (DEPTH_SCALE_MAX - DEPTH_SCALE_MIN);
  const alpha = DEPTH_ALPHA_MIN + z * (DEPTH_ALPHA_MAX - DEPTH_ALPHA_MIN);
  const yShift = (0.5 - z) * ch * DEPTH_Y_SHIFT_FRAC;
  return { x, y: y + yShift, scale, alpha };
}

function buildAmbientStars(rng: () => number): AmbientStar[] {
  const out: AmbientStar[] = [];
  for (let i = 0; i < STAR_COUNT; i++) {
    out.push({
      x: rng(),
      y: rng(),
      z: rng(),
      mag: 0.15 + rng() * 0.4,
      phase: rng() * Math.PI * 2,
      freq: 0.15 + rng() * 0.25,
    });
  }
  return out;
}

function buildMeshParticles(rng: () => number, cw: number, ch: number): MeshParticle[] {
  const out: MeshParticle[] = [];
  for (let i = 0; i < MESH_COUNT; i++) {
    const speed = MESH_SPEED_MIN + rng() * (MESH_SPEED_MAX - MESH_SPEED_MIN);
    const angle = rng() * Math.PI * 2;
    out.push({
      x: rng() * cw,
      y: rng() * ch,
      z: 0.15 + rng() * 0.85,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      vz: (rng() - 0.5) * 0.025,
      wanderPhase: rng() * Math.PI * 2,
      wanderFreq: MESH_WANDER_FREQ_MIN + rng() * (MESH_WANDER_FREQ_MAX - MESH_WANDER_FREQ_MIN),
    });
  }
  return out;
}

function wrapMeshParticle(p: MeshParticle, cw: number, ch: number) {
  if (p.x < 0) p.x += cw;
  if (p.x > cw) p.x -= cw;
  if (p.y < 0) p.y += ch;
  if (p.y > ch) p.y -= ch;
  if (p.z <= 0.05 || p.z >= 0.95) {
    p.vz *= -1;
    p.z = Math.max(0.05, Math.min(0.95, p.z));
  }
}

function advanceMesh(mesh: MeshParticle[], dt: number, cw: number, ch: number) {
  for (const p of mesh) {
    p.wanderPhase += p.wanderFreq * Math.PI * 2 * dt;
    p.vx += Math.cos(p.wanderPhase) * MESH_WANDER_FORCE * dt;
    p.vy += Math.sin(p.wanderPhase * 1.37) * MESH_WANDER_FORCE * dt;
    const speed = Math.hypot(p.vx, p.vy);
    const maxSpeed = MESH_SPEED_MAX * 1.15;
    const minSpeed = MESH_SPEED_MIN * 0.65;
    if (speed > maxSpeed) {
      p.vx = (p.vx / speed) * maxSpeed;
      p.vy = (p.vy / speed) * maxSpeed;
    } else if (speed < minSpeed && speed > 0) {
      p.vx = (p.vx / speed) * minSpeed;
      p.vy = (p.vy / speed) * minSpeed;
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.z += p.vz * dt;
    wrapMeshParticle(p, cw, ch);
  }
}

function generateClusterNodes(rng: () => number): ClusterNode[] {
  const target =
    CLUSTER_NODE_COUNT_MIN +
    Math.floor(rng() * (CLUSTER_NODE_COUNT_MAX - CLUSTER_NODE_COUNT_MIN + 1));
  const nodes: ClusterNode[] = [];
  let guard = 0;
  while (nodes.length < target && guard++ < target * 30) {
    const nx = (rng() - 0.5) * 0.92;
    const ny = (rng() - 0.5) * 0.88;
    const tooClose = nodes.some(n => Math.hypot(n.nx - nx, n.ny - ny) < CLUSTER_MIN_NODE_SEP);
    if (tooClose) continue;
    nodes.push({
      nx,
      ny,
      nz: 0.2 + rng() * 0.8,
      mag: 0.45 + rng() * 0.55,
      driftPhase: rng() * Math.PI * 2,
      driftFreq: 0.1 + rng() * 0.22,
    });
  }
  while (nodes.length < CLUSTER_NODE_COUNT_MIN) {
    nodes.push({
      nx: (rng() - 0.5) * 0.85,
      ny: (rng() - 0.5) * 0.85,
      nz: rng(),
      mag: 0.55 + rng() * 0.35,
      driftPhase: rng() * Math.PI * 2,
      driftFreq: 0.12 + rng() * 0.18,
    });
  }
  return nodes;
}

function spawnCluster(
  xOffsetPx: number,
  vxSign: number,
  canvasHeight: number,
  rng: () => number
): ActiveCluster {
  const scale = canvasHeight * CONSTELLATION_VSCALE;
  const period = ROTATION_PERIOD_S_MIN + rng() * (ROTATION_PERIOD_S_MAX - ROTATION_PERIOD_S_MIN);
  const direction = rng() < 0.5 ? -1 : 1;
  return {
    nodes: generateClusterNodes(rng),
    width: CLUSTER_WIDTH_MIN + rng() * (CLUSTER_WIDTH_MAX - CLUSTER_WIDTH_MIN),
    xOffsetPx,
    yJitter: rng() * 2 - 1,
    scale,
    rotation: 0,
    rotationSpeed: (direction * (Math.PI * 2)) / period,
    vxSign,
    yPhase: rng() * Math.PI * 2,
    yBobFreq: Y_BOB_FREQ_MIN_HZ + rng() * (Y_BOB_FREQ_MAX_HZ - Y_BOB_FREQ_MIN_HZ),
    panWavePhase: rng() * Math.PI * 2,
  };
}

function drawStarGlow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  alpha: number,
  color: string
) {
  const glowR = radius * STAR_GLOW_RADIUS_MUL;
  const grad = ctx.createRadialGradient(x, y, 0, x, y, glowR);
  grad.addColorStop(0, color);
  grad.addColorStop(0.35, color);
  grad.addColorStop(1, "rgba(0, 0, 0, 0)");
  const prevAlpha = ctx.globalAlpha;
  ctx.globalAlpha = alpha;
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(x, y, glowR, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = prevAlpha;
}

function drawGrid(ctx: CanvasRenderingContext2D, cw: number, ch: number) {
  const cx = cw * 0.5;
  const cy = ch * 0.5;
  const maxR = Math.hypot(cx, cy) || 1;
  ctx.strokeStyle = STAR_FIELD_COLOR;
  ctx.lineWidth = 1;
  const prevAlpha = ctx.globalAlpha;
  for (let x = 0; x <= cw; x += GRID_SPACING_PX) {
    const xFade = Math.max(0, 1 - Math.abs(x - cx) / maxR);
    ctx.globalAlpha = GRID_ALPHA * xFade;
    ctx.beginPath();
    ctx.moveTo(x + 0.5, 0);
    ctx.lineTo(x + 0.5, ch);
    ctx.stroke();
  }
  for (let y = 0; y <= ch; y += GRID_SPACING_PX) {
    const yFade = Math.max(0, 1 - Math.abs(y - cy) / maxR);
    ctx.globalAlpha = GRID_ALPHA * yFade;
    ctx.beginPath();
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(cw, y + 0.5);
    ctx.stroke();
  }
  ctx.globalAlpha = prevAlpha;
}

function drawMeshNetwork(ctx: CanvasRenderingContext2D, mesh: MeshParticle[], ch: number) {
  const projected = mesh.map(p => ({ p, ...depthProject(p.x, p.y, p.z, ch) }));

  ctx.strokeStyle = STAR_FIELD_COLOR;
  ctx.lineWidth = 1;
  const prevAlpha = ctx.globalAlpha;
  for (let i = 0; i < projected.length; i++) {
    for (let j = i + 1; j < projected.length; j++) {
      const a = projected[i];
      const b = projected[j];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      if (dist > MESH_LINK_DIST_PX) continue;
      const distFade = 1 - dist / MESH_LINK_DIST_PX;
      const depthFade = (a.alpha + b.alpha) * 0.5;
      ctx.globalAlpha = MESH_LINE_ALPHA * distFade * distFade * depthFade;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
  }

  ctx.fillStyle = STAR_FIELD_COLOR;
  for (const pt of projected) {
    const r = (0.7 + pt.p.z * 0.9) * pt.scale;
    drawStarGlow(ctx, pt.x, pt.y, r, pt.alpha * 0.45, STAR_FIELD_COLOR);
    ctx.globalAlpha = pt.alpha * 0.9;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = prevAlpha;
}

function readAccentColor(): string {
  const styles = getComputedStyle(document.documentElement);
  return styles.getPropertyValue("--accent-3").trim() || "rgb(220, 180, 240)";
}

function clusterWidthPx(c: ActiveCluster) {
  return c.width * c.scale;
}

export function ConstellationBg() {
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
    let accent = readAccentColor();
    const rng = makeRng(0x5eed51e1);
    const stars = buildAmbientStars(rng);
    let mesh: MeshParticle[] = [];
    let actives: ActiveCluster[] = [];
    let pending: ShootingStar | null = null;
    let nextShootingT: number | null = null;
    let lastT = 0;

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

      mesh = buildMeshParticles(rng, cw, ch);

      const vxA = rng() < 0.5 ? -1 : 1;
      const a = spawnCluster(cw * 0.12, vxA, ch, rng);
      const vxB = rng() < 0.5 ? -1 : 1;
      const b = spawnCluster(cw * 0.62, vxB, ch, rng);
      actives = [a, b];
    };

    const drawCluster = (c: ActiveCluster, isFront: boolean, t: number) => {
      const widthPx = clusterWidthPx(c);
      const verticalMargin = ch - c.scale;
      const bob = reduceMotion
        ? 0
        : Math.sin(t * c.yBobFreq * Math.PI * 2 + c.yPhase) * verticalMargin * Y_BOB_AMPLITUDE_FRAC;
      const panWave = reduceMotion
        ? 0
        : Math.sin(t * PAN_WAVE_FREQ_HZ * Math.PI * 2 + c.panWavePhase) * PAN_WAVE_AMP_PX;
      const yTop = verticalMargin * 0.5 + c.yJitter * verticalMargin * 0.25 + bob + panWave;

      const centerX = c.xOffsetPx + widthPx / 2;
      const centerY = yTop + c.scale / 2;
      const tilt = reduceMotion
        ? 0
        : Math.sin(t * CONST_TILT_FREQ_HZ * Math.PI * 2 + c.yPhase) * CONST_TILT_AMP;
      const yForeshorten = 1 - Math.abs(tilt);
      const linkDistPx = CLUSTER_LINK_DIST_NORM * Math.max(widthPx, c.scale);
      const cosR = Math.cos(c.rotation);
      const sinR = Math.sin(c.rotation);

      const projected = c.nodes.map(node => {
        const drift = reduceMotion
          ? 0
          : Math.sin(t * node.driftFreq * Math.PI * 2 + node.driftPhase) * CLUSTER_NODE_DRIFT_AMP;
        const lx = (node.nx + drift * Math.cos(node.driftPhase)) * widthPx;
        const ly = (node.ny + drift * Math.sin(node.driftPhase * 1.3)) * c.scale * yForeshorten;
        const rx = lx * cosR - ly * sinR;
        const ry = lx * sinR + ly * cosR;
        const depth = depthProject(centerX + rx, centerY + ry, node.nz, ch);
        return { node, ...depth, mag: node.mag };
      });

      ctx.save();
      ctx.strokeStyle = STAR_FIELD_COLOR;
      ctx.lineWidth = 1;
      const prevAlpha = ctx.globalAlpha;
      const lineAlpha = LINE_ALPHA * (0.65 + yForeshorten * 0.35);

      for (let i = 0; i < projected.length; i++) {
        for (let j = i + 1; j < projected.length; j++) {
          const a = projected[i];
          const b = projected[j];
          const dist = Math.hypot(a.x - b.x, a.y - b.y);
          if (dist > linkDistPx) continue;
          const distFade = 1 - dist / linkDistPx;
          const depthFade = (a.alpha + b.alpha) * 0.5;
          ctx.globalAlpha = lineAlpha * distFade * distFade * depthFade;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }

      ctx.fillStyle = STAR_FIELD_COLOR;
      let brightestIdx = 0;
      let brightestMag = -1;
      for (let i = 0; i < projected.length; i++) {
        const pt = projected[i];
        if (pt.mag > brightestMag) {
          brightestMag = pt.mag;
          brightestIdx = i;
        }
        const starAlpha = CONST_STAR_ALPHA * (0.6 + pt.mag * 0.6) * (0.7 + yForeshorten * 0.3);
        const r = (1.4 + pt.mag * 1.1) * pt.scale * (0.85 + yForeshorten * 0.15);
        drawStarGlow(ctx, pt.x, pt.y, r, starAlpha * 0.5, STAR_FIELD_COLOR);
        ctx.globalAlpha = starAlpha;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, r, 0, Math.PI * 2);
        ctx.fill();
      }

      if (isFront) {
        const b = projected[brightestIdx];
        const grad = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, ACCENT_HALO_RADIUS_PX * 2);
        grad.addColorStop(0, accent);
        grad.addColorStop(1, "rgba(0, 0, 0, 0)");
        ctx.fillStyle = grad;
        ctx.globalAlpha = 0.7;
        ctx.fillRect(
          b.x - ACCENT_HALO_RADIUS_PX * 2,
          b.y - ACCENT_HALO_RADIUS_PX * 2,
          ACCENT_HALO_RADIUS_PX * 4,
          ACCENT_HALO_RADIUS_PX * 4
        );
      }
      ctx.globalAlpha = prevAlpha;
      ctx.restore();
    };

    const drawAmbient = (t: number) => {
      ctx.fillStyle = STAR_FIELD_COLOR;
      const prevAlpha = ctx.globalAlpha;
      for (const s of stars) {
        const breath = reduceMotion ? 0 : 0.08 * Math.sin(t * s.freq * Math.PI * 2 + s.phase);
        const baseAlpha = Math.max(0, Math.min(1, s.mag + breath));
        const pt = depthProject(s.x * cw, s.y * ch, s.z, ch);
        const alpha = baseAlpha * pt.alpha;
        const r = (0.5 + s.mag * 0.8) * pt.scale;
        drawStarGlow(ctx, pt.x, pt.y, r, alpha * 0.35, STAR_FIELD_COLOR);
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = prevAlpha;
    };

    const drawShootingStar = (t: number) => {
      if (!pending) return;
      const elapsed = t - pending.startT;
      if (elapsed < 0 || elapsed > SHOOTING_STAR_DURATION_S) return;
      const p = elapsed / SHOOTING_STAR_DURATION_S;
      const headX = pending.x0 + (pending.x1 - pending.x0) * p;
      const headY = pending.y0 + (pending.y1 - pending.y0) * p;
      // Tail extends backward from the head along the direction of travel.
      const dx = pending.x0 - pending.x1;
      const dy = pending.y0 - pending.y1;
      const len = Math.hypot(dx, dy) || 1;
      const ux = dx / len;
      const uy = dy / len;
      const tailX = headX + ux * SHOOTING_STAR_TAIL_PX;
      const tailY = headY + uy * SHOOTING_STAR_TAIL_PX;
      const grad = ctx.createLinearGradient(headX, headY, tailX, tailY);
      grad.addColorStop(0, "rgba(255,255,255,0.9)");
      grad.addColorStop(1, "rgba(255,255,255,0)");
      ctx.strokeStyle = grad;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(headX, headY);
      ctx.lineTo(tailX, tailY);
      ctx.stroke();
    };

    const advance = (t: number, dt: number) => {
      if (!reduceMotion) advanceMesh(mesh, dt, cw, ch);

      // Pan (signed by per-constellation direction) and rotate.
      for (const c of actives) {
        c.xOffsetPx += c.vxSign * PAN_PX_PER_SEC * dt;
        c.rotation += c.rotationSpeed * dt;
      }

      // Recycle any that have fully exited on either side. "Exited" requires
      // both being off-screen AND still travelling away from the canvas;
      // otherwise a constellation we just spawned off-screen (heading inward)
      // would be re-recycled on the very next frame and would never become
      // visible.
      for (let i = 0; i < actives.length; i++) {
        const c = actives[i];
        const w = clusterWidthPx(c);
        const exitedLeft = c.xOffsetPx + w < 0 && c.vxSign <= 0;
        const exitedRight = c.xOffsetPx > cw && c.vxSign >= 0;
        if (!exitedLeft && !exitedRight) continue;

        const newWidth =
          (CLUSTER_WIDTH_MIN + rng() * (CLUSTER_WIDTH_MAX - CLUSTER_WIDTH_MIN)) *
          (ch * CONSTELLATION_VSCALE);
        const newVxSign = rng() < 0.5 ? -1 : 1;
        const gap =
          CONSTELLATION_GAP_MIN_PX + rng() * (CONSTELLATION_GAP_MAX_PX - CONSTELLATION_GAP_MIN_PX);

        let spawnX: number;
        if (newVxSign > 0) {
          let leftmost = 0;
          for (const other of actives) {
            if (other === c) continue;
            if (other.xOffsetPx < leftmost) leftmost = other.xOffsetPx;
          }
          spawnX = Math.min(leftmost, 0) - gap - newWidth;
        } else {
          let rightmost = cw;
          for (const other of actives) {
            if (other === c) continue;
            const re = other.xOffsetPx + clusterWidthPx(other);
            if (re > rightmost) rightmost = re;
          }
          spawnX = rightmost + gap;
        }

        actives[i] = spawnCluster(spawnX, newVxSign, ch, rng);
      }

      // Shooting-star scheduling.
      // Schedule the first shooting star relative to the first observed t,
      // not to wall-clock time. Otherwise performance.now() being huge would
      // make it fire on the second frame of every page load.
      if (nextShootingT === null) {
        nextShootingT =
          t + SHOOTING_STAR_MIN_S + rng() * (SHOOTING_STAR_MAX_S - SHOOTING_STAR_MIN_S);
      }

      if (pending && t - pending.startT > SHOOTING_STAR_DURATION_S) {
        pending = null;
        nextShootingT =
          t + SHOOTING_STAR_MIN_S + rng() * (SHOOTING_STAR_MAX_S - SHOOTING_STAR_MIN_S);
      }
      if (!pending && t >= nextShootingT) {
        // Random origin and direction. Length is anchored to canvas width
        // so the streak always covers a meaningful distance regardless of
        // viewport size.
        const x0 = cw * rng();
        const y0 = ch * rng();
        const angle = rng() * Math.PI * 2;
        const length = cw * (0.25 + rng() * 0.35);
        const x1 = x0 + Math.cos(angle) * length;
        const y1 = y0 + Math.sin(angle) * length;
        pending = { startT: t, x0, y0, x1, y1 };
      }
    };

    const draw = (t: number) => {
      ctx.clearRect(0, 0, cw, ch);
      drawGrid(ctx, cw, ch);
      drawMeshNetwork(ctx, mesh, ch);
      drawAmbient(t);

      // Pick the leftmost (front-most, exiting first) active to receive the
      // accent halo. Done in-place to avoid a per-frame allocation.
      let frontIdx = 0;
      for (let i = 1; i < actives.length; i++) {
        if (actives[i].xOffsetPx < actives[frontIdx].xOffsetPx) frontIdx = i;
      }
      for (let i = 0; i < actives.length; i++) {
        drawCluster(actives[i], i === frontIdx, t);
      }

      if (!reduceMotion) drawShootingStar(t);
    };

    const tick = (now: number) => {
      const t = now / 1000;
      const dt = lastT === 0 ? 0 : Math.min(0.1, t - lastT);
      lastT = t;
      if (visible) {
        advance(t, dt);
        draw(t);
      }
      raf = requestAnimationFrame(tick);
    };

    resize();

    if (reduceMotion) {
      // Evenly space active constellations and draw once.
      if (actives.length >= 2) {
        actives[0].xOffsetPx = cw * 0.12;
        actives[1].xOffsetPx = cw * 0.58;
      }
      draw(0);
    } else {
      raf = requestAnimationFrame(tick);
    }

    const ro = new ResizeObserver(resize);
    ro.observe(container);

    const io = new IntersectionObserver(
      entries => {
        for (const e of entries) visible = e.isIntersecting;
      },
      { threshold: 0 }
    );
    io.observe(container);

    // Re-read the accent token when the theme attribute flips.
    const themeObserver = new MutationObserver(() => {
      accent = readAccentColor();
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

export default ConstellationBg;
