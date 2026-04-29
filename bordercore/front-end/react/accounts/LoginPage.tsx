import React, { useState } from "react";
import "./login-tokens.css";
import { MirrorCube } from "./MirrorCube";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faUser, faLock } from "@fortawesome/free-solid-svg-icons";
import { getCsrfToken } from "../utils/reactUtils";

interface LoginPageProps {
  message?: string;
  initialUsername: string;
  loginUrl: string;
  nextUrl: string;
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

interface FieldProps {
  label: string;
  type?: "text" | "password";
  name: string;
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  autoComplete?: string;
  autoCorrect?: string;
  autoCapitalize?: string;
  adornment?: React.ReactNode;
  error?: string | null;
}

function Field({
  label,
  type = "text",
  name,
  value,
  onChange,
  placeholder,
  autoFocus,
  autoComplete,
  autoCorrect,
  autoCapitalize,
  adornment,
  error,
}: FieldProps) {
  const [focused, setFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === "password";
  const realType = isPassword && showPassword ? "text" : type;

  const borderColor = error
    ? "var(--bc-danger)"
    : focused
      ? "var(--bc-accent)"
      : "var(--bc-border-1)";
  const ringShadow = error
    ? "0 0 0 3px rgba(255,85,119,0.15)"
    : focused
      ? "0 0 0 3px rgba(179,107,255,0.18)"
      : "none";

  return (
    <label
      // must remain inline — display block wrapper
      style={{ display: "block" }}
    >
      <div
        // must remain inline — uppercase label styling
        style={{
          fontSize: 11,
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.1em",
          color: "var(--bc-fg-3)",
          marginBottom: 8,
        }}
      >
        {label}
      </div>
      <div
        // must remain inline — focus ring depends on runtime focused / error state
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          background: "var(--bc-bg-1)",
          border: `1px solid ${borderColor}`,
          borderRadius: 8,
          boxShadow: ringShadow,
          transition: "all 160ms cubic-bezier(.22, 1, .36, 1)",
        }}
      >
        {adornment && (
          <div
            aria-hidden="true"
            // must remain inline — color depends on runtime focused state
            style={{
              paddingLeft: 12,
              color: focused ? "var(--bc-accent)" : "var(--bc-fg-4)",
              transition: "color 160ms",
              display: "flex",
              alignItems: "center",
            }}
          >
            {adornment}
          </div>
        )}
        <input
          type={realType}
          name={name}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          autoFocus={autoFocus}
          autoComplete={autoComplete}
          autoCorrect={autoCorrect}
          autoCapitalize={autoCapitalize}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          spellCheck={false}
          // must remain inline — input styling with adornment-aware padding
          style={{
            flex: 1,
            padding: "11px 14px",
            paddingLeft: adornment ? 10 : 14,
            background: "transparent",
            border: "none",
            outline: "none",
            color: "var(--bc-fg-1)",
            fontFamily: "var(--bc-font-sans)",
            fontSize: 14,
          }}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPassword(s => !s)}
            aria-label={showPassword ? "hide password" : "show password"}
            aria-pressed={showPassword}
            // must remain inline — toggle button reset styles
            style={{
              all: "unset",
              cursor: "pointer",
              padding: "0 14px",
              fontSize: 11,
              color: "var(--bc-fg-3)",
              fontFamily: "var(--bc-font-mono)",
              userSelect: "none",
            }}
          >
            {showPassword ? "⊙ hide" : "⊙ show"}
          </button>
        )}
      </div>
      {error && (
        <div
          role="alert"
          // must remain inline — inline error text styling
          style={{
            fontSize: 11,
            color: "var(--bc-danger)",
            marginTop: 6,
          }}
        >
          {error}
        </div>
      )}
    </label>
  );
}

interface PrimaryButtonProps {
  children: React.ReactNode;
  loading?: boolean;
  type?: "button" | "submit";
}

function PrimaryButton({ children, loading, type = "submit" }: PrimaryButtonProps) {
  return (
    <button
      type={type}
      disabled={loading}
      // must remain inline — primary CTA visual treatment
      style={{
        all: "unset",
        cursor: loading ? "wait" : "pointer",
        boxSizing: "border-box",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        width: "100%",
        padding: "12px 22px",
        background: "linear-gradient(180deg, #b36bff 0%, #9355ef 100%)",
        color: "#fff",
        borderRadius: 10,
        fontSize: 14,
        fontWeight: 600,
        boxShadow:
          "0 0 0 1px rgba(179,107,255,0.35)," +
          "0 8px 24px -6px rgba(179,107,255,0.55)," +
          "inset 0 1px 0 rgba(255,255,255,0.15)",
        transition: "all 160ms cubic-bezier(.22, 1, .36, 1)",
        opacity: loading ? 0.7 : 1,
        textAlign: "center",
      }}
    >
      {loading ? (
        <span
          // must remain inline — mono font swap for loading state
          style={{ fontFamily: "var(--bc-font-mono)" }}
        >
          authenticating…
        </span>
      ) : (
        children
      )}
    </button>
  );
}

interface LoginCardProps {
  message?: string;
  initialUsername: string;
  loginUrl: string;
  nextUrl: string;
}

function LoginCard({ message, initialUsername, loginUrl, nextUrl }: LoginCardProps) {
  const [username, setUsername] = useState(initialUsername);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [clientError, setClientError] = useState<string | null>(null);

  const errorText = clientError ?? (message && message.length > 0 ? "invalid credentials" : null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    if (!username || !password) {
      e.preventDefault();
      setClientError("enter both username and password");
      return;
    }
    // Refresh CSRF token from cookie at submit time so it matches the live cookie
    const tokenInput = e.currentTarget.querySelector<HTMLInputElement>(
      'input[name="csrfmiddlewaretoken"]'
    );
    if (tokenInput) tokenInput.value = getCsrfToken();
    setClientError(null);
    setLoading(true);
    // Do NOT call e.preventDefault(); let the browser submit the form natively.
  }

  return (
    <div
      className="bc-login-card"
      // must remain inline — glass card visual treatment
      style={{
        position: "absolute",
        right: 56,
        top: "50%",
        transform: "translateY(-50%)",
        width: 380,
        background: "rgba(18, 20, 28, 0.78)",
        backdropFilter: "blur(18px)",
        WebkitBackdropFilter: "blur(18px)",
        border: "1px solid rgba(179, 107, 255, 0.22)",
        borderRadius: 16,
        boxShadow: "0 30px 80px -20px #000, 0 0 0 1px rgba(179,107,255,0.15)",
        zIndex: 5,
        display: "flex",
      }}
    >
      <div
        aria-hidden="true"
        // must remain inline — vertical accent gradient bar
        style={{
          width: 4,
          borderRadius: "16px 0 0 16px",
          background: "linear-gradient(180deg, #b36bff 0%, #4cc2ff 50%, #ff3dbd 100%)",
          boxShadow: "0 0 18px rgba(179, 107, 255, 0.5)",
        }}
      />
      <div
        // must remain inline — card content padding
        style={{ padding: "30px 30px 26px", flex: 1 }}
      >
        <div
          // must remain inline — kicker mono uppercase
          style={{
            fontSize: 11,
            fontFamily: "var(--bc-font-mono)",
            color: "var(--bc-fg-4)",
            textTransform: "uppercase",
            letterSpacing: "0.15em",
            marginBottom: 8,
          }}
        >
          // dual node
        </div>
        <h1
          // must remain inline — display title
          style={{
            fontFamily: "var(--bc-font-display)",
            fontSize: 24,
            fontWeight: 600,
            letterSpacing: "-0.01em",
            margin: 0,
            color: "var(--bc-fg-1)",
          }}
        >
          Sign in to your brain
        </h1>
        <p
          // must remain inline — subtitle line
          style={{
            fontSize: 13,
            color: "var(--bc-fg-3)",
            margin: "6px 0 24px",
          }}
        >
          primary 0x4fa · replica 0x4fb · drift 4ms
        </p>
        <form
          action={loginUrl}
          method="post"
          onSubmit={onSubmit}
          // must remain inline — form layout
          style={{ display: "flex", flexDirection: "column", gap: 14 }}
        >
          <input type="hidden" name="csrfmiddlewaretoken" defaultValue={getCsrfToken()} />
          <input type="hidden" name="next" value={nextUrl} />
          <Field
            label="username"
            name="username"
            value={username}
            onChange={setUsername}
            placeholder="username"
            autoComplete="username"
            autoCorrect="off"
            autoCapitalize="none"
            autoFocus
            // must remain inline — icon size passed as prop to FontAwesomeIcon
            adornment={<FontAwesomeIcon icon={faUser} style={{ fontSize: 13 }} />}
          />
          <Field
            label="password"
            type="password"
            name="password"
            value={password}
            onChange={setPassword}
            placeholder="••••••••"
            autoComplete="current-password"
            // must remain inline — icon size passed as prop to FontAwesomeIcon
            adornment={<FontAwesomeIcon icon={faLock} style={{ fontSize: 13 }} />}
            error={errorText}
          />
          <PrimaryButton loading={loading}>connect →</PrimaryButton>
        </form>
        <div
          // must remain inline — footer row layout
          style={{
            marginTop: 22,
            paddingTop: 16,
            borderTop: "1px solid var(--bc-hairline)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: 12,
          }}
        >
          <a
            href="#"
            // must remain inline — link color
            style={{
              color: "var(--bc-fg-3)",
              textDecoration: "none",
            }}
          >
            recover access
          </a>
          <span
            // must remain inline — status row mono styling
            style={{
              fontFamily: "var(--bc-font-mono)",
              fontSize: 10,
              color: "var(--bc-fg-4)",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <span
              aria-hidden="true"
              // must remain inline — status dot
              style={{
                width: 6,
                height: 6,
                borderRadius: 3,
                background: "var(--bc-ok)",
                boxShadow: "0 0 8px var(--bc-ok)",
              }}
            />
            both healthy
          </span>
        </div>
      </div>
    </div>
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

export function LoginPage(props: LoginPageProps) {
  return (
    <div className="bc-login-root">
      <BackdropGrid />
      <CubeStage />
      <SyncLine />
      <FloatingTags />
      <BrandBar />
      <LoginCard {...props} />
    </div>
  );
}

export default LoginPage;
