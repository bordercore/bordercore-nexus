import React, { useEffect, useRef } from "react";

// ============================================================================
// Tunable parameters — single-line constants for easy adjustment.
// ============================================================================
const MOTE_COUNT = 50;
// Per-mote linear drift speed range (px/s). Kept tiny so what reads is the
// breathing alpha, not the motion.
const DRIFT_PX_PER_S_MAX = 4;
// Slow per-mote wander on top of linear drift. Each mote samples sin/cos
// against its own seed so the field doesn't move as a coherent flock.
const WANDER_X_AMP = 0.4;
const WANDER_Y_AMP = 0.3;
// Breathing (alpha pulse) — slower than constellation twinkle so each mote
// reads as a clear "in and out" pulse rather than a shimmer.
const BREATH_FREQ_MIN_HZ = 0.1;
const BREATH_FREQ_MAX_HZ = 0.3;
const BREATH_AMPLITUDE = 0.18;
// Halo radii (px). Halo is drawn as a radial gradient additive-composited
// so overlapping motes glow brighter.
const HALO_RADIUS_PX = 8;
const HALO_FLARE_RADIUS_PX = 14;
// Periodic "flare" event per mote: alpha and size briefly spike, then ease
// back. Expected ~1–3 visible flares at any time across MOTE_COUNT motes.
const FLARE_DURATION_S = 0.6;
const FLARE_SCALE = 2.5;
const FLARE_INTERVAL_MIN_S = 20;
const FLARE_INTERVAL_MAX_S = 40;
// Fallback colors if CSS tokens aren't readable (e.g. during early mount).
const CORE_FALLBACK = "oklch(80% 0.12 280)";
const HALO_FALLBACK = "oklch(60% 0.08 240)";

interface Mote {
  x: number; // px in canvas space
  y: number; // px in canvas space
  vx: number; // linear drift, px/s
  vy: number; // linear drift, px/s
  noiseSeed: number; // unique offset driving wander
  baseAlpha: number; // 0.25..0.55
  breathFreq: number; // Hz
  breathPhase: number; // radians
  size: number; // core radius, px
  haloIdx: 0 | 1; // which halo color is in use (palette[0] vs palette[1])
  flareT: number; // next flare's start time (seconds since loop start)
}

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

interface Palette {
  core: string;
  halos: [string, string];
}

function readPalette(): Palette {
  const styles = getComputedStyle(document.documentElement);
  const core = styles.getPropertyValue("--accent-2").trim() || CORE_FALLBACK;
  const halo1 = styles.getPropertyValue("--accent").trim() || HALO_FALLBACK;
  const halo2 = styles.getPropertyValue("--accent-3").trim() || HALO_FALLBACK;
  return { core, halos: [halo1, halo2] };
}

function buildMotes(cw: number, ch: number, rng: () => number): Mote[] {
  const out: Mote[] = [];
  for (let i = 0; i < MOTE_COUNT; i++) {
    out.push({
      x: rng() * cw,
      y: rng() * ch,
      vx: (rng() * 2 - 1) * DRIFT_PX_PER_S_MAX,
      vy: (rng() * 2 - 1) * DRIFT_PX_PER_S_MAX,
      noiseSeed: rng() * 1000,
      baseAlpha: 0.25 + rng() * 0.3,
      breathFreq: BREATH_FREQ_MIN_HZ + rng() * (BREATH_FREQ_MAX_HZ - BREATH_FREQ_MIN_HZ),
      breathPhase: rng() * Math.PI * 2,
      size: 0.8 + rng() * 0.8,
      haloIdx: rng() < 0.5 ? 0 : 1,
      // First flare scheduled relative to t=0 of the loop; the integrator
      // adds (current t) on first observation to anchor it to a real
      // timeline, same trick ConstellationBg uses for shooting stars.
      flareT: 0,
    });
  }
  return out;
}

export function FirefliesBg() {
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
    // Single deterministic RNG drives both the initial mote field and the
    // post-flare reschedule. Same pattern as ConstellationBg.
    const rng = makeRng(0xf17ef1e5);
    let motes: Mote[] = [];
    let lastT = 0;
    let firstT: number | null = null;

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
      // Seed the field deterministically so a remount in dev / strict-mode
      // double-effect doesn't reshuffle the layout. Reseeded only when the
      // canvas size changes meaningfully (handled by the cw/ch guard above).
      motes = buildMotes(cw, ch, rng);
    };

    const advance = (t: number, dt: number) => {
      for (const m of motes) {
        const wx = Math.sin(t * 0.13 + m.noiseSeed) * WANDER_X_AMP;
        const wy = Math.cos(t * 0.11 + m.noiseSeed * 1.7) * WANDER_Y_AMP;
        m.x += (m.vx + wx) * dt;
        m.y += (m.vy + wy) * dt;
        // Soft wrap on all four edges. Mote alpha is already near zero at
        // its perimeter so the wrap never reads as a pop.
        if (m.x < -HALO_FLARE_RADIUS_PX) m.x = cw + HALO_FLARE_RADIUS_PX;
        else if (m.x > cw + HALO_FLARE_RADIUS_PX) m.x = -HALO_FLARE_RADIUS_PX;
        if (m.y < -HALO_FLARE_RADIUS_PX) m.y = ch + HALO_FLARE_RADIUS_PX;
        else if (m.y > ch + HALO_FLARE_RADIUS_PX) m.y = -HALO_FLARE_RADIUS_PX;
      }
    };

    // Returns flare intensity in [0..1] for a mote at time t, or 0 if no
    // flare is currently in progress. Side effect: when a flare completes,
    // schedules the next one on the mote.
    const flareIntensity = (m: Mote, t: number): number => {
      const elapsed = t - m.flareT;
      if (elapsed < 0) return 0;
      if (elapsed >= FLARE_DURATION_S) {
        m.flareT = t + FLARE_INTERVAL_MIN_S + rng() * (FLARE_INTERVAL_MAX_S - FLARE_INTERVAL_MIN_S);
        return 0;
      }
      // Cosine ease in/out — peaks at the midpoint, fades smoothly either side.
      const p = elapsed / FLARE_DURATION_S;
      return 0.5 - 0.5 * Math.cos(p * Math.PI * 2);
    };

    const drawMote = (m: Mote, t: number) => {
      const breath = reduceMotion
        ? 0
        : BREATH_AMPLITUDE * Math.sin(t * m.breathFreq * Math.PI * 2 + m.breathPhase);
      const flare = reduceMotion ? 0 : flareIntensity(m, t);
      const alpha = Math.max(0, Math.min(1, m.baseAlpha + breath + flare * 0.4));
      const haloR = HALO_RADIUS_PX + flare * (HALO_FLARE_RADIUS_PX - HALO_RADIUS_PX);
      const coreR = m.size * (1 + flare * (FLARE_SCALE - 1));

      // Halo: additive radial gradient. globalCompositeOperation is reset
      // before the core pass so the bright core isn't double-lightened.
      const haloColor = palette.halos[m.haloIdx];
      const grad = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, haloR);
      grad.addColorStop(0, haloColor);
      grad.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = alpha * 0.35;
      ctx.fillStyle = grad;
      ctx.fillRect(m.x - haloR, m.y - haloR, haloR * 2, haloR * 2);

      // Core: opaque accent-2 disc.
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = alpha;
      ctx.fillStyle = palette.core;
      ctx.beginPath();
      ctx.arc(m.x, m.y, coreR, 0, Math.PI * 2);
      ctx.fill();
    };

    const draw = (t: number) => {
      ctx.clearRect(0, 0, cw, ch);
      const prevAlpha = ctx.globalAlpha;
      const prevComp = ctx.globalCompositeOperation;
      for (const m of motes) drawMote(m, t);
      ctx.globalAlpha = prevAlpha;
      ctx.globalCompositeOperation = prevComp;
    };

    const tick = (now: number) => {
      const t = now / 1000;
      // First observed t becomes our origin so flare schedules don't fire
      // immediately on mount (performance.now() is a large wall-clock value).
      if (firstT === null) {
        firstT = t;
        for (const m of motes) {
          m.flareT =
            t + FLARE_INTERVAL_MIN_S + rng() * (FLARE_INTERVAL_MAX_S - FLARE_INTERVAL_MIN_S);
        }
      }
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
      // Single static frame at t=0: breath and flare paths short-circuit
      // to 0 above, so motes render at their base alphas and sizes.
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

    // Re-read accent tokens when the theme attribute flips.
    const themeObserver = new MutationObserver(() => {
      palette = readPalette();
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

export default FirefliesBg;
