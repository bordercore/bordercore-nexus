import React from "react";
import "./login-tokens.css";
import { MirrorCube } from "./MirrorCube";

interface LoginPageProps {
  message?: string;
  initialUsername: string;
  loginUrl: string;
  nextUrl: string;
  csrfToken: string;
}

const MARK_GRAD_ID = "bc-mark-grad-login";

function Mark({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect
        x="3"
        y="3"
        width="18"
        height="18"
        rx="4"
        stroke={`url(#${MARK_GRAD_ID})`}
        strokeWidth="1.5"
      />
      <rect
        x="7"
        y="7"
        width="10"
        height="10"
        rx="2"
        fill={`url(#${MARK_GRAD_ID})`}
        opacity="0.85"
      />
      <defs>
        <linearGradient id={MARK_GRAD_ID} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#b36bff" />
          <stop offset="100%" stopColor="#4cc2ff" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function BackdropGrid() {
  return (
    <>
      <div
        aria-hidden="true"
        // must remain inline — multi-layer gradient backdrop
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(800px 600px at 30% 50%, rgba(179,107,255,0.13), transparent 60%)," +
            "radial-gradient(700px 600px at 70% 50%, rgba(76,194,255,0.09), transparent 60%)," +
            "linear-gradient(180deg, #07070c 0%, #04030a 100%)",
        }}
      />
      <div
        aria-hidden="true"
        // must remain inline — masked grid overlay with vendor-prefixed mask
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "linear-gradient(rgba(179,107,255,0.05) 1px, transparent 1px)," +
            "linear-gradient(90deg, rgba(179,107,255,0.05) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
          maskImage: "radial-gradient(ellipse at center, black 30%, transparent 75%)",
          WebkitMaskImage: "radial-gradient(ellipse at center, black 30%, transparent 75%)",
        }}
      />
    </>
  );
}

function BrandBar() {
  return (
    <div
      className="bc-login-brandbar"
      // must remain inline — fixed top-left position with z-index stack
      style={{
        position: "absolute",
        top: 24,
        left: 32,
        zIndex: 4,
        display: "flex",
        alignItems: "center",
        gap: 10,
      }}
    >
      <Mark size={20} />
      <span
        // must remain inline — typography variables
        style={{
          fontFamily: "var(--bc-font-display)",
          fontWeight: 600,
          fontSize: 14,
        }}
      >
        bordercore
      </span>
      <span
        // must remain inline — divider + mono crumb styling
        style={{
          marginLeft: 14,
          paddingLeft: 14,
          borderLeft: "1px solid var(--bc-border-1)",
          fontFamily: "var(--bc-font-mono)",
          fontSize: 11,
          color: "var(--bc-fg-3)",
        }}
      >
        primary + replica · v3.4.1
      </span>
    </div>
  );
}

function CubeStage() {
  return (
    <>
      <div
        className="bc-login-cubes"
        aria-hidden="true"
        // must remain inline — absolute position with perspective and z-index
        style={{
          position: "absolute",
          left: "22%",
          top: "50%",
          transform: "translate(-50%, -50%)",
          perspective: 1200,
          zIndex: 1,
        }}
      >
        <MirrorCube size={200} dir={1} />
      </div>
      <div
        className="bc-login-cubes"
        aria-hidden="true"
        // must remain inline — absolute position with perspective and z-index
        style={{
          position: "absolute",
          left: "42%",
          top: "50%",
          transform: "translate(-50%, -50%)",
          perspective: 1200,
          zIndex: 1,
        }}
      >
        <MirrorCube size={200} dir={-1} />
      </div>
    </>
  );
}

function SyncLine() {
  return (
    <div
      className="bc-login-syncline"
      aria-hidden="true"
      // must remain inline — gradient hairline with glow
      style={{
        position: "absolute",
        left: "22%",
        right: "58%",
        top: "50%",
        height: 1,
        background: "linear-gradient(90deg, transparent, rgba(179,107,255,0.6), transparent)",
        boxShadow: "0 0 8px rgba(179,107,255,0.4)",
        zIndex: 2,
      }}
    />
  );
}

interface TagItem {
  label: string;
  x: number;
  y: number;
  hue: number;
}

const TAG_ITEMS: TagItem[] = [
  { label: "primary", x: 6, y: 36, hue: 270 },
  { label: "replica", x: 48, y: 36, hue: 200 },
  { label: "in-sync", x: 24, y: 18, hue: 270 },
  { label: "lag 4ms", x: 30, y: 78, hue: 200 },
  { label: "writes ←", x: 14, y: 60, hue: 320 },
  { label: "reads →", x: 38, y: 60, hue: 320 },
];

function FloatingTags() {
  return (
    <div
      className="bc-login-tags"
      aria-hidden="true"
      // must remain inline — fixed full-bleed positioning under cubes
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        overflow: "hidden",
        zIndex: 2,
      }}
    >
      {TAG_ITEMS.map((it, i) => (
        <span
          key={it.label}
          data-anim
          // must remain inline — per-tag position, hue, and animation index
          style={{
            position: "absolute",
            left: `${it.x}%`,
            top: `${it.y}%`,
            fontFamily: "var(--bc-font-mono)",
            fontSize: 11,
            letterSpacing: "0.05em",
            color: `hsla(${it.hue}, 70%, 75%, 0.6)`,
            padding: "3px 9px",
            border: `1px solid hsla(${it.hue}, 70%, 60%, 0.28)`,
            borderRadius: 999,
            background: "rgba(11, 13, 20, 0.45)",
            backdropFilter: "blur(4px)",
            WebkitBackdropFilter: "blur(4px)",
            animation: `fl${i % 3} ${14 + (i % 4) * 3}s ease-in-out infinite`,
          }}
        >
          {it.label}
        </span>
      ))}
    </div>
  );
}

export function LoginPage(_props: LoginPageProps) {
  return (
    <div className="bc-login-root">
      <BackdropGrid />
      <CubeStage />
      <SyncLine />
      <FloatingTags />
      <BrandBar />
    </div>
  );
}

export default LoginPage;
