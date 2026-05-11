import React, { useEffect, useRef } from "react";
import { CONSTELLATIONS, Constellation } from "./constellations";

// ============================================================================
// Tunable parameters — single-line constants for easy adjustment.
// ============================================================================
const STAR_COUNT = 100;
const PAN_PX_PER_SEC = 8;
const LINE_ALPHA = 0.08;
const STAR_FIELD_COLOR = "oklch(94% 0.02 240)";
const CONST_STAR_ALPHA = 0.55;
const ACCENT_HALO_RADIUS_PX = 3;
const SHOOTING_STAR_MIN_S = 25;
const SHOOTING_STAR_MAX_S = 60;
const SHOOTING_STAR_DURATION_S = 0.7;
const SHOOTING_STAR_TAIL_PX = 80;
const CONSTELLATION_GAP_MIN_PX = 200;
const CONSTELLATION_GAP_MAX_PX = 400;
// Vertical scale for a constellation relative to the canvas height. The
// constellation's intrinsic box is normalized 0..1 in y — drawing it at
// the full bar height crowds the gutter, so we scale slightly inward and
// add jitter in the remaining margin.
const CONSTELLATION_VSCALE = 0.78;
// Per-constellation rotation. Each gets a randomized full-turn period in
// this range plus a randomized direction, so constellations rotate at
// slightly different rates and don't appear to move in lockstep.
const ROTATION_PERIOD_S_MIN = 120; // 2 min
const ROTATION_PERIOD_S_MAX = 180; // 3 min
// Per-constellation vertical bob. A slow sine wave on the y-axis, randomized
// in phase and frequency, so each constellation drifts up and down at its
// own pace. Amplitude is a fraction of the unused vertical margin (i.e. the
// space between the constellation and the top/bottom of the bar) so the
// motion stays inside the bar regardless of canvas height.
const Y_BOB_FREQ_MIN_HZ = 0.02; // ~50s period
const Y_BOB_FREQ_MAX_HZ = 0.06; // ~16s period
const Y_BOB_AMPLITUDE_FRAC = 0.25; // fraction of verticalMargin

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
  mag: number; // 0.15..0.55
  phase: number; // 0..2π
  freq: number; // Hz
}

interface ActiveConstellation {
  def: Constellation;
  xOffsetPx: number; // absolute left edge in canvas px
  yJitter: number; // -1..1 vertical jitter factor
  scale: number; // pixel height of the constellation box
  rotation: number; // current angle in radians, accumulated over time
  rotationSpeed: number; // rad/sec, signed (negative = counter-clockwise)
  vxSign: number; // +1 (moves right) or -1 (moves left)
  yPhase: number; // radians; per-constellation phase for vertical bob
  yBobFreq: number; // Hz; per-constellation vertical bob frequency
}

interface ShootingStar {
  startT: number;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

function buildAmbientStars(rng: () => number): AmbientStar[] {
  const out: AmbientStar[] = [];
  for (let i = 0; i < STAR_COUNT; i++) {
    out.push({
      x: rng(),
      y: rng(),
      mag: 0.15 + rng() * 0.4,
      phase: rng() * Math.PI * 2,
      freq: 0.15 + rng() * 0.25,
    });
  }
  return out;
}

function readAccentColor(): string {
  const styles = getComputedStyle(document.documentElement);
  return styles.getPropertyValue("--accent-3").trim() || "rgb(220, 180, 240)";
}

// Pick a constellation from CONSTELLATIONS, avoiding `prevDef` if one is
// given so consecutive entries don't repeat. Returns the def only — the
// caller is responsible for creating the ActiveConstellation around it.
function pickConstellationDef(prevDef: Constellation | null, rng: () => number): Constellation {
  const pool = prevDef ? CONSTELLATIONS.filter(c => c.name !== prevDef.name) : CONSTELLATIONS;
  return pool[Math.floor(rng() * pool.length)];
}

function spawnConstellation(
  def: Constellation,
  xOffsetPx: number,
  vxSign: number,
  canvasHeight: number,
  rng: () => number
): ActiveConstellation {
  const scale = canvasHeight * CONSTELLATION_VSCALE;
  const period = ROTATION_PERIOD_S_MIN + rng() * (ROTATION_PERIOD_S_MAX - ROTATION_PERIOD_S_MIN);
  const direction = rng() < 0.5 ? -1 : 1;
  return {
    def,
    xOffsetPx,
    yJitter: rng() * 2 - 1,
    scale,
    // Start upright so reduced-motion users see the canonical orientation;
    // animated users see the tilt accumulate from zero over time.
    rotation: 0,
    rotationSpeed: (direction * (Math.PI * 2)) / period,
    vxSign,
    yPhase: rng() * Math.PI * 2,
    yBobFreq: Y_BOB_FREQ_MIN_HZ + rng() * (Y_BOB_FREQ_MAX_HZ - Y_BOB_FREQ_MIN_HZ),
  };
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
    let actives: ActiveConstellation[] = [];
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

      // Seed two constellations across the bar with randomized horizontal
      // directions. In reduce-motion mode they sit at fixed offsets and
      // never move; in animated mode each picks its own direction and bob.
      const defA = pickConstellationDef(null, rng);
      const vxA = rng() < 0.5 ? -1 : 1;
      const a = spawnConstellation(defA, cw * 0.12, vxA, ch, rng);
      const defB = pickConstellationDef(defA, rng);
      const vxB = rng() < 0.5 ? -1 : 1;
      const b = spawnConstellation(defB, cw * 0.62, vxB, ch, rng);
      actives = [a, b];
    };

    const constellationWidthPx = (c: ActiveConstellation) => c.def.width * c.scale;

    const drawAmbient = (t: number) => {
      ctx.fillStyle = STAR_FIELD_COLOR;
      const prevAlpha = ctx.globalAlpha;
      for (const s of stars) {
        const breath = reduceMotion ? 0 : 0.08 * Math.sin(t * s.freq * Math.PI * 2 + s.phase);
        const alpha = Math.max(0, Math.min(1, s.mag + breath));
        const r = 0.6 + s.mag * 1.0;
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(s.x * cw, s.y * ch, r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = prevAlpha;
    };

    const drawConstellation = (c: ActiveConstellation, isFront: boolean, t: number) => {
      const widthPx = constellationWidthPx(c);
      // Vertical placement: center the constellation in the bar with a small
      // fixed jitter so successive entries don't sit on the exact same
      // baseline, plus a slow sinusoidal bob so the constellation drifts up
      // and down over time. Both terms scale with verticalMargin so the
      // motion always stays inside the bar. Bob is skipped in reduce-motion
      // so the canonical orientation stays put.
      const verticalMargin = ch - c.scale;
      const bob = reduceMotion
        ? 0
        : Math.sin(t * c.yBobFreq * Math.PI * 2 + c.yPhase) * verticalMargin * Y_BOB_AMPLITUDE_FRAC;
      const yTop = verticalMargin * 0.5 + c.yJitter * verticalMargin * 0.25 + bob;

      // Draw in a coordinate space whose origin is the constellation's center,
      // so rotation spins around that center rather than the canvas origin.
      // Star coordinates 0..1 in the dataset map to -widthPx/2..+widthPx/2
      // and -scale/2..+scale/2 here.
      const centerX = c.xOffsetPx + widthPx / 2;
      const centerY = yTop + c.scale / 2;
      const sx = (sx0: number) => (sx0 - 0.5) * widthPx;
      const sy = (sy0: number) => (sy0 - 0.5) * c.scale;

      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate(c.rotation);

      // Lines first, so stars sit on top.
      ctx.strokeStyle = STAR_FIELD_COLOR;
      ctx.lineWidth = 1;
      const prevAlpha = ctx.globalAlpha;
      ctx.globalAlpha = LINE_ALPHA;
      ctx.beginPath();
      for (const [i, j] of c.def.lines) {
        const a = c.def.stars[i];
        const b = c.def.stars[j];
        ctx.moveTo(sx(a.x), sy(a.y));
        ctx.lineTo(sx(b.x), sy(b.y));
      }
      ctx.stroke();

      // Stars.
      ctx.fillStyle = STAR_FIELD_COLOR;
      let brightestIdx = 0;
      let brightestMag = -1;
      for (let i = 0; i < c.def.stars.length; i++) {
        const s = c.def.stars[i];
        if (s.mag > brightestMag) {
          brightestMag = s.mag;
          brightestIdx = i;
        }
        ctx.globalAlpha = CONST_STAR_ALPHA * (0.6 + s.mag * 0.6);
        const r = 1.5 + s.mag * 1.0;
        ctx.beginPath();
        ctx.arc(sx(s.x), sy(s.y), r, 0, Math.PI * 2);
        ctx.fill();
      }

      // Accent halo on the brightest star of the front-most constellation
      // (the one closer to the left edge of the bar — i.e. exiting first).
      if (isFront) {
        const b = c.def.stars[brightestIdx];
        const hx = sx(b.x);
        const hy = sy(b.y);
        const grad = ctx.createRadialGradient(hx, hy, 0, hx, hy, ACCENT_HALO_RADIUS_PX * 2);
        grad.addColorStop(0, accent);
        grad.addColorStop(1, "rgba(0, 0, 0, 0)");
        ctx.fillStyle = grad;
        ctx.globalAlpha = 0.7;
        ctx.fillRect(
          hx - ACCENT_HALO_RADIUS_PX * 2,
          hy - ACCENT_HALO_RADIUS_PX * 2,
          ACCENT_HALO_RADIUS_PX * 4,
          ACCENT_HALO_RADIUS_PX * 4
        );
      }
      ctx.globalAlpha = prevAlpha;
      ctx.restore();
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
        const w = constellationWidthPx(c);
        const exitedLeft = c.xOffsetPx + w < 0 && c.vxSign <= 0;
        const exitedRight = c.xOffsetPx > cw && c.vxSign >= 0;
        if (!exitedLeft && !exitedRight) continue;

        const newDef = pickConstellationDef(c.def, rng);
        const newWidth = newDef.width * (ch * CONSTELLATION_VSCALE);
        const newVxSign = rng() < 0.5 ? -1 : 1;
        const gap =
          CONSTELLATION_GAP_MIN_PX + rng() * (CONSTELLATION_GAP_MAX_PX - CONSTELLATION_GAP_MIN_PX);

        let spawnX: number;
        if (newVxSign > 0) {
          // Heading right — spawn off-screen on the left, behind any
          // survivor that is currently on the left side too.
          let leftmost = 0;
          for (const other of actives) {
            if (other === c) continue;
            if (other.xOffsetPx < leftmost) leftmost = other.xOffsetPx;
          }
          spawnX = Math.min(leftmost, 0) - gap - newWidth;
        } else {
          // Heading left — spawn off-screen on the right, past any survivor
          // already off the right edge.
          let rightmost = cw;
          for (const other of actives) {
            if (other === c) continue;
            const re = other.xOffsetPx + constellationWidthPx(other);
            if (re > rightmost) rightmost = re;
          }
          spawnX = rightmost + gap;
        }

        actives[i] = spawnConstellation(newDef, spawnX, newVxSign, ch, rng);
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
        const x0 = cw * (0.7 + rng() * 0.3);
        const y0 = ch * (0.0 + rng() * 0.3);
        const x1 = x0 - cw * (0.25 + rng() * 0.25);
        const y1 = y0 + ch * (0.4 + rng() * 0.6);
        pending = { startT: t, x0, y0, x1, y1 };
      }
    };

    const draw = (t: number) => {
      ctx.clearRect(0, 0, cw, ch);
      drawAmbient(t);

      // Pick the leftmost (front-most, exiting first) active to receive the
      // accent halo. Done in-place to avoid a per-frame allocation.
      let frontIdx = 0;
      for (let i = 1; i < actives.length; i++) {
        if (actives[i].xOffsetPx < actives[frontIdx].xOffsetPx) frontIdx = i;
      }
      for (let i = 0; i < actives.length; i++) {
        drawConstellation(actives[i], i === frontIdx, t);
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
