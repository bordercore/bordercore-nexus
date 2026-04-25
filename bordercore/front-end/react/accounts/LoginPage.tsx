import React from "react";
import "./login-tokens.css";

interface LoginPageProps {
  message?: string;
  initialUsername: string;
  loginUrl: string;
  nextUrl: string;
  csrfToken: string;
}

function Mark({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect
        x="3"
        y="3"
        width="18"
        height="18"
        rx="4"
        stroke="url(#bc-mark-grad)"
        strokeWidth="1.5"
      />
      <rect x="7" y="7" width="10" height="10" rx="2" fill="url(#bc-mark-grad)" opacity="0.85" />
      <defs>
        <linearGradient id="bc-mark-grad" x1="0" y1="0" x2="1" y2="1">
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

export function LoginPage(_props: LoginPageProps) {
  return (
    <div className="bc-login-root">
      <BackdropGrid />
      <BrandBar />
    </div>
  );
}

export default LoginPage;
