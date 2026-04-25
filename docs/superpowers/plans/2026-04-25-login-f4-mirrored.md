# Login Page F4 Mirrored Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the existing Bootstrap-based login page with the F4 Mirrored design (two counter-rotating wireframe cubes, glass card form, dark cyber aesthetic) per `docs/superpowers/specs/2026-04-25-login-f4-mirrored-design.md`.

**Architecture:** Single React component (`LoginPage.tsx`) replacing existing implementation, with one extracted sub-component (`MirrorCube.tsx`) and one CSS file (`login-tokens.css`) holding scoped design tokens, keyframes, and responsive rules. Form submits via standard HTML POST to Django's existing `accounts:login` URL — no AJAX, no backend changes.

**Tech Stack:** React 18 + TypeScript, Vite, FontAwesome (already installed), CSS variables scoped via `:where(.bc-login-root)`, Google Fonts (Inter, Space Grotesk, JetBrains Mono).

---

## Context for engineer

### Where things live

- Django template: `bordercore/templates/login.html` — **don't touch**. Already mounts the React component and passes props as data attributes.
- Vite entry: `bordercore/front-end/entries/login.tsx` — **don't touch**. Reads data attributes, calls `createRoot`, renders `<LoginPage>`.
- React component: `bordercore/front-end/react/accounts/LoginPage.tsx` — **rewrite**.
- Reference design files: `design_handoff_login_f4_mirrored/reference/` — read-only references (HTML/JSX prototypes). Don't import from these.

### The props contract `LoginPage` must accept (unchanged)

```typescript
interface LoginPageProps {
  message?: string;          // Django auth error message (any wording)
  initialUsername: string;   // Seed for username field
  loginUrl: string;          // POST target
  nextUrl: string;           // Redirect destination after success
  csrfToken: string;         // CSRF token for the hidden input
}
```

### Dev environment commands

- `cd bordercore && npm run vite:dev` — starts Vite dev server
- `cd bordercore && npm run typecheck` — runs `tsc --noEmit`
- `cd bordercore && npm run lint:react` — runs ESLint
- Django runs separately; the login page is at `/accounts/login/`
- Wrap commits in `script -qc '<command>' /dev/null` because the pre-commit hook runs `uv run mypy` and `uv run` fails in non-tty environments

### Pre-existing files referenced

After Task 1, you'll have created `login-tokens.css`. After Task 2, `MirrorCube.tsx`. The full `LoginPage.tsx` is built up across Tasks 3–7.

---

## Task 1: Create login-tokens.css

**Files:**
- Create: `bordercore/front-end/react/accounts/login-tokens.css`

- [ ] **Step 1: Create the file with the full token sheet, keyframes, and media queries**

Create `bordercore/front-end/react/accounts/login-tokens.css` with this exact content:

```css
@import url("https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap");

:where(.bc-login-root) {
  --bc-accent:           #b36bff;
  --bc-accent-2:         #7c7fff;
  --bc-accent-3:         #ff3dbd;
  --bc-accent-4:         #4cc2ff;
  --bc-accent-soft:      #b36bff40;
  --bc-accent-hover:     #c98bff;
  --bc-accent-press:     #9a55e8;

  --bc-bg-0:             #07070c;
  --bc-bg-1:             #0b0d14;
  --bc-bg-2:             #12141c;
  --bc-bg-3:             #1a1d28;
  --bc-bg-4:             #242836;

  --bc-fg-1:             #e6e8f0;
  --bc-fg-2:             #b8bcc9;
  --bc-fg-3:             #8a8fa0;
  --bc-fg-4:             #5a5f72;
  --bc-fg-disabled:      #3a3e4b;

  --bc-ok:               #3fd29c;
  --bc-warn:             #f0b840;
  --bc-danger:           #ff5577;

  --bc-border-1:         #2a2e3d;
  --bc-border-2:         #3a3f52;
  --bc-hairline:         #1e212d;

  --bc-radius-md:        10px;
  --bc-radius-lg:        14px;
  --bc-radius-xl:        16px;
  --bc-radius-pill:      999px;

  --bc-font-sans:    "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  --bc-font-display: "Space Grotesk", "Inter", -apple-system, "Segoe UI", sans-serif;
  --bc-font-mono:    "JetBrains Mono", ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;

  --bc-ease-out:     cubic-bezier(0.22, 1, 0.36, 1);
  --bc-t-fast:       120ms;
  --bc-t-base:       180ms;
  --bc-t-slow:       280ms;
}

.bc-login-root {
  position: fixed;
  inset: 0;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background: var(--bc-bg-0);
  color: var(--bc-fg-1);
  font-family: var(--bc-font-sans);
  font-size: 14px;
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
}

.bc-login-root *,
.bc-login-root *::before,
.bc-login-root *::after {
  box-sizing: border-box;
}

.bc-login-root ::selection {
  background: rgba(179, 107, 255, 0.35);
  color: var(--bc-fg-1);
}

@keyframes mc-a {
  from { transform: rotateX(-22deg) rotateY(0); }
  to   { transform: rotateX(-22deg) rotateY(360deg); }
}

@keyframes mc-b {
  from { transform: rotateX(-22deg) rotateY(0); }
  to   { transform: rotateX(-22deg) rotateY(-360deg); }
}

@keyframes fl0 {
  0%, 100% { transform: translate(0, 0); }
  50%      { transform: translate(8px, -12px); }
}

@keyframes fl1 {
  0%, 100% { transform: translate(0, 0); }
  50%      { transform: translate(-10px, 8px); }
}

@keyframes fl2 {
  0%, 100% { transform: translate(0, 0); }
  50%      { transform: translate(6px, 10px); }
}

@media (prefers-reduced-motion: reduce) {
  .bc-login-root [data-anim] {
    animation-play-state: paused !important;
  }
}

@media (max-width: 900px) {
  .bc-login-cubes,
  .bc-login-tags,
  .bc-login-syncline {
    display: none;
  }

  .bc-login-card {
    position: static;
    transform: none;
    width: auto;
    margin: 80px 24px 24px;
  }

  .bc-login-brandbar {
    padding: 16px 20px;
  }
}
```

- [ ] **Step 2: Verify the file is well-formed CSS**

Run: `cd bordercore && npx stylelint front-end/react/accounts/login-tokens.css`
Expected: No errors. (Warnings about `@import` in the middle of a file are unlikely; if stylelint complains about anything, fix and re-run.)

- [ ] **Step 3: Commit**

```bash
cd /home/jerrell/dev/django/bordercore
git add bordercore/front-end/react/accounts/login-tokens.css
script -qc 'git commit -m "Add login-tokens.css with scoped design tokens

- Defines --bc-* CSS variables under :where(.bc-login-root) selector
- Includes mc-a/mc-b cube rotation keyframes and fl0-fl2 tag drift keyframes
- Adds prefers-reduced-motion and < 900px responsive rules
- Imports Inter, Space Grotesk, and JetBrains Mono webfonts"' /dev/null
```

Expected: pre-commit checks pass (mypy, eslint, stylelint), commit succeeds.

---

## Task 2: Create MirrorCube component

**Files:**
- Create: `bordercore/front-end/react/accounts/MirrorCube.tsx`

- [ ] **Step 1: Create the component file**

Create `bordercore/front-end/react/accounts/MirrorCube.tsx` with this exact content:

```typescript
import React from "react";

interface MirrorCubeProps {
  size?: number;
  dir?: 1 | -1;
}

const FACE_BASE_STYLE: React.CSSProperties = {
  position: "absolute",
  border: "1px solid rgba(179, 107, 255, 0.5)",
  background: "rgba(179, 107, 255, 0.05)",
  boxShadow: "inset 0 0 50px rgba(179, 107, 255, 0.18)",
};

const INNER_GRID_STYLE: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  backgroundImage:
    "linear-gradient(rgba(179,107,255,0.18) 1px, transparent 1px)," +
    "linear-gradient(90deg, rgba(179,107,255,0.18) 1px, transparent 1px)",
  backgroundSize: "32px 32px",
};

export function MirrorCube({ size = 200, dir = 1 }: MirrorCubeProps) {
  const half = size / 2;
  const faceTransforms = [
    `translateZ(${half}px)`,
    `rotateY(180deg) translateZ(${half}px)`,
    `rotateY(90deg) translateZ(${half}px)`,
    `rotateY(-90deg) translateZ(${half}px)`,
    `rotateX(90deg) translateZ(${half}px)`,
    `rotateX(-90deg) translateZ(${half}px)`,
  ];

  return (
    <div
      data-anim
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        transformStyle: "preserve-3d",
        animation: `${dir > 0 ? "mc-a" : "mc-b"} 22s linear infinite`,
      }}
    >
      {faceTransforms.map((tf, i) => (
        <div
          key={i}
          style={{
            ...FACE_BASE_STYLE,
            width: size,
            height: size,
            transform: tf,
          }}
        >
          <div style={INNER_GRID_STYLE} />
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Verify type-check passes**

Run: `cd bordercore && npm run typecheck`
Expected: No errors.

- [ ] **Step 3: Verify lint passes**

Run: `cd bordercore && npm run lint:react -- front-end/react/accounts/MirrorCube.tsx`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
cd /home/jerrell/dev/django/bordercore
git add bordercore/front-end/react/accounts/MirrorCube.tsx
script -qc 'git commit -m "Add MirrorCube 3D wireframe cube component

- Six faces with translateZ + rotateX/Y transforms
- Inner 32px gridline overlay on each face
- Parameterized by size and dir (rotation direction)
- Uses mc-a / mc-b keyframes from login-tokens.css
- Marked aria-hidden and data-anim for a11y and reduced motion"' /dev/null
```

Expected: pre-commit checks pass, commit succeeds.

---

## Task 3: Rewrite LoginPage.tsx — backdrop + brand bar skeleton

**Files:**
- Modify: `bordercore/front-end/react/accounts/LoginPage.tsx` (replace entire contents)

- [ ] **Step 1: Replace `LoginPage.tsx` with the skeleton version**

Replace the entire contents of `bordercore/front-end/react/accounts/LoginPage.tsx` with:

```typescript
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
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <rect x="3" y="3" width="18" height="18" rx="4" stroke="url(#bc-mark-grad)" strokeWidth="1.5" />
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
        style={{
          fontFamily: "var(--bc-font-display)",
          fontWeight: 600,
          fontSize: 14,
        }}
      >
        bordercore
      </span>
      <span
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
```

- [ ] **Step 2: Type-check + lint**

```bash
cd bordercore
npm run typecheck
npm run lint:react -- front-end/react/accounts/LoginPage.tsx
```

Expected: No errors. (The `_props` underscore prefix tells ESLint the unused parameter is intentional during this skeleton phase.)

- [ ] **Step 3: Manual verification**

Start Vite dev server: `cd bordercore && npm run vite:dev`
Start Django dev server in another terminal (per project convention).
Visit `/accounts/login/` in a browser.

Expected:
- Dark canvas (near-black) fills the viewport
- Subtle purple radial wash on the left, cyan on the right
- Faint 60×60 grid lines in the center, fading at edges
- Top-left: small gradient logo mark, the word `bordercore`, vertical divider, mono text `primary + replica · v3.4.1`
- No form yet (will be added in later tasks)

- [ ] **Step 4: Commit**

```bash
cd /home/jerrell/dev/django/bordercore
git add bordercore/front-end/react/accounts/LoginPage.tsx
script -qc 'git commit -m "Rewrite LoginPage skeleton with backdrop and brand bar

- Establishes .bc-login-root container with full-viewport dark canvas
- BackdropGrid renders gradient washes plus masked grid overlay
- BrandBar renders top-left mark, wordmark, and mono crumb
- Imports login-tokens.css for scoped design variables
- Form and decorative cubes will be added in subsequent commits"' /dev/null
```

---

## Task 4: Add cubes and sync line

**Files:**
- Modify: `bordercore/front-end/react/accounts/LoginPage.tsx`

- [ ] **Step 1: Add MirrorCube import and CubeStage + SyncLine sub-components**

Edit `bordercore/front-end/react/accounts/LoginPage.tsx`. After the `import "./login-tokens.css";` line, add:

```typescript
import { MirrorCube } from "./MirrorCube";
```

After the `BrandBar` function (and before the `LoginPage` function), add:

```typescript
function CubeStage() {
  return (
    <>
      <div
        className="bc-login-cubes"
        aria-hidden="true"
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
```

Update the `LoginPage` function to render them:

```typescript
export function LoginPage(_props: LoginPageProps) {
  return (
    <div className="bc-login-root">
      <BackdropGrid />
      <CubeStage />
      <SyncLine />
      <BrandBar />
    </div>
  );
}
```

- [ ] **Step 2: Type-check + lint**

```bash
cd bordercore
npm run typecheck
npm run lint:react -- front-end/react/accounts/LoginPage.tsx
```

Expected: No errors.

- [ ] **Step 3: Manual verification**

Reload the login page in the browser.

Expected:
- Two wireframe cubes appear, both centered vertically, one at ~22% from the left and one at ~42%
- The left cube rotates clockwise (from above), the right rotates counter-clockwise — they're mirror-rotating
- A faint glowing horizontal line connects them at the vertical midpoint
- Backdrop and brand bar still visible from Task 3

- [ ] **Step 4: Commit**

```bash
cd /home/jerrell/dev/django/bordercore
git add bordercore/front-end/react/accounts/LoginPage.tsx
script -qc 'git commit -m "Add counter-rotating cubes and sync line to LoginPage

- CubeStage renders two MirrorCube instances at left:22% and left:42%
- Each cube wrapper sets perspective:1200 for 3D effect
- SyncLine renders a glowing 1px hairline between the cubes
- Both wrappers carry the bc-login-cubes class for responsive hide"' /dev/null
```

---

## Task 5: Add floating data tags

**Files:**
- Modify: `bordercore/front-end/react/accounts/LoginPage.tsx`

- [ ] **Step 1: Add FloatingTags sub-component and TAG_ITEMS constant**

Edit `bordercore/front-end/react/accounts/LoginPage.tsx`. After the `SyncLine` function (and before `BrandBar` or `LoginPage`), add:

```typescript
interface TagItem {
  label: string;
  x: number;
  y: number;
  hue: number;
}

const TAG_ITEMS: TagItem[] = [
  { label: "primary",  x: 6,  y: 36, hue: 270 },
  { label: "replica",  x: 48, y: 36, hue: 200 },
  { label: "in-sync",  x: 24, y: 18, hue: 270 },
  { label: "lag 4ms",  x: 30, y: 78, hue: 200 },
  { label: "writes ←", x: 14, y: 60, hue: 320 },
  { label: "reads →",  x: 38, y: 60, hue: 320 },
];

function FloatingTags() {
  return (
    <div
      className="bc-login-tags"
      aria-hidden="true"
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
```

Update `LoginPage` to render `<FloatingTags />` (between `SyncLine` and `BrandBar`):

```typescript
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
```

- [ ] **Step 2: Type-check + lint**

```bash
cd bordercore
npm run typecheck
npm run lint:react -- front-end/react/accounts/LoginPage.tsx
```

Expected: No errors.

- [ ] **Step 3: Manual verification**

Reload the login page.

Expected:
- Six monospace pill labels appear scattered around the cubes: `primary`, `replica`, `in-sync`, `lag 4ms`, `writes ←`, `reads →`
- Each pill has a colored tinted border (purple, cyan, or pink) and slightly translucent dark background with a small blur
- Pills drift gently (≤12px translation) on slow loops; not all at the same phase

- [ ] **Step 4: Commit**

```bash
cd /home/jerrell/dev/django/bordercore
git add bordercore/front-end/react/accounts/LoginPage.tsx
script -qc 'git commit -m "Add floating data tags to LoginPage

- Six positioned pill labels using fl0/fl1/fl2 drift keyframes
- Tag set: primary, replica, in-sync, lag 4ms, writes ←, reads →
- Hue per spec table (270 purple, 200 cyan, 320 pink)
- Marked aria-hidden and data-anim for a11y / reduced motion"' /dev/null
```

---

## Task 6: Add login card chrome and form fields

**Files:**
- Modify: `bordercore/front-end/react/accounts/LoginPage.tsx`

- [ ] **Step 1: Add Field, PrimaryButton, and LoginCard sub-components**

Edit `bordercore/front-end/react/accounts/LoginPage.tsx`. At the top of the file, update the React import to include hooks:

```typescript
import React, { useState } from "react";
```

Also add the FontAwesome imports near the top (after the CSS import):

```typescript
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faUser, faLock } from "@fortawesome/free-solid-svg-icons";
```

After the `FloatingTags` function (and before `BrandBar`), add the `Field`, `PrimaryButton`, and `LoginCard` components plus the `LoginCardProps` interface:

```typescript
interface FieldProps {
  label: string;
  type?: "text" | "password";
  name: string;
  defaultValue?: string;
  placeholder?: string;
  autoFocus?: boolean;
  autoComplete?: string;
  adornment?: React.ReactNode;
}

function Field({
  label,
  type = "text",
  name,
  defaultValue,
  placeholder,
  autoFocus,
  autoComplete,
  adornment,
}: FieldProps) {
  const [focused, setFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === "password";
  const realType = isPassword && showPassword ? "text" : type;

  return (
    <label style={{ display: "block" }}>
      <div
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
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          background: "var(--bc-bg-1)",
          border: `1px solid ${focused ? "var(--bc-accent)" : "var(--bc-border-1)"}`,
          borderRadius: 8,
          boxShadow: focused ? "0 0 0 3px rgba(179,107,255,0.18)" : "none",
          transition: "all 160ms cubic-bezier(.22, 1, .36, 1)",
        }}
      >
        {adornment && (
          <div
            aria-hidden="true"
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
          defaultValue={defaultValue}
          placeholder={placeholder}
          autoFocus={autoFocus}
          autoComplete={autoComplete}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          spellCheck={false}
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
            onClick={() => setShowPassword((s) => !s)}
            aria-label={showPassword ? "hide password" : "show password"}
            aria-pressed={showPassword}
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
        <span style={{ fontFamily: "var(--bc-font-mono)" }}>authenticating…</span>
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
  csrfToken: string;
}

function LoginCard({
  initialUsername,
  loginUrl,
  nextUrl,
  csrfToken,
}: LoginCardProps) {
  return (
    <div
      className="bc-login-card"
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
        style={{
          width: 4,
          borderRadius: "16px 0 0 16px",
          background: "linear-gradient(180deg, #b36bff 0%, #4cc2ff 50%, #ff3dbd 100%)",
          boxShadow: "0 0 18px rgba(179, 107, 255, 0.5)",
        }}
      />
      <div style={{ padding: "30px 30px 26px", flex: 1 }}>
        <div
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
          style={{ display: "flex", flexDirection: "column", gap: 14 }}
        >
          <input type="hidden" name="csrfmiddlewaretoken" value={csrfToken} />
          <input type="hidden" name="next" value={nextUrl} />
          <Field
            label="username"
            name="username"
            defaultValue={initialUsername}
            placeholder="username"
            autoComplete="username"
            autoFocus
            adornment={<FontAwesomeIcon icon={faUser} style={{ fontSize: 13 }} />}
          />
          <Field
            label="password"
            type="password"
            name="password"
            placeholder="••••••••"
            autoComplete="current-password"
            adornment={<FontAwesomeIcon icon={faLock} style={{ fontSize: 13 }} />}
          />
          <PrimaryButton>connect →</PrimaryButton>
        </form>
        <div
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
            style={{
              color: "var(--bc-fg-3)",
              textDecoration: "none",
            }}
          >
            recover access
          </a>
          <span
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
```

Update `LoginPage` to render the card:

```typescript
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
```

- [ ] **Step 2: Type-check + lint**

```bash
cd bordercore
npm run typecheck
npm run lint:react -- front-end/react/accounts/LoginPage.tsx
```

Expected: No errors.

- [ ] **Step 3: Manual verification**

Reload the login page.

Expected:
- A glass-effect card appears docked to the right side, vertically centered
- Card has a 4px-wide vertical gradient bar on its left edge (purple → cyan → pink)
- Top of card content: small uppercase mono kicker `// dual node`, then large title `Sign in to your brain`, then mono subtitle `primary 0x4fa · replica 0x4fb · drift 4ms`
- Two input fields: `username` (with user icon) and `password` (with lock icon and `⊙ show` toggle on the right)
- Purple gradient `connect →` button below
- Bottom of card: thin hairline divider, `recover access` link on left, `● both healthy` mono text with green dot on right
- Focusing an input gives it a purple ring; the leading icon turns purple
- Clicking `⊙ show` toggles the password input between text and password type and the button label flips to `⊙ hide`
- Submitting the form posts to `/accounts/login/` and Django responds (will fail without valid creds — error display wired up next task)

- [ ] **Step 4: Commit**

```bash
cd /home/jerrell/dev/django/bordercore
git add bordercore/front-end/react/accounts/LoginPage.tsx
script -qc 'git commit -m "Add LoginCard with form fields to LoginPage

- Glass-effect right-docked card with 4px gradient accent bar
- Field component with focused/blurred states and password show/hide toggle
- PrimaryButton with purple gradient and loading-state authenticating… text
- Form posts to props.loginUrl with hidden csrf and next inputs
- Microcopy verbatim from design spec: kicker, title, subtitle, status"' /dev/null
```

---

## Task 7: Wire submit handler, client validation, and error display

**Files:**
- Modify: `bordercore/front-end/react/accounts/LoginPage.tsx`

- [ ] **Step 1: Replace LoginCard with the version that has form behavior**

Edit `bordercore/front-end/react/accounts/LoginPage.tsx`. Replace the entire `LoginCard` function with:

```typescript
function LoginCard({
  message,
  initialUsername,
  loginUrl,
  nextUrl,
  csrfToken,
}: LoginCardProps) {
  const [username, setUsername] = useState(initialUsername);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [clientError, setClientError] = useState<string | null>(null);

  const errorText =
    clientError ?? (message && message.length > 0 ? "invalid credentials" : null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    if (!username || !password) {
      e.preventDefault();
      setClientError("enter both username and password");
      return;
    }
    setClientError(null);
    setLoading(true);
    // Do NOT call e.preventDefault(); let the browser submit the form natively.
  }

  return (
    <div
      className="bc-login-card"
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
        style={{
          width: 4,
          borderRadius: "16px 0 0 16px",
          background: "linear-gradient(180deg, #b36bff 0%, #4cc2ff 50%, #ff3dbd 100%)",
          boxShadow: "0 0 18px rgba(179, 107, 255, 0.5)",
        }}
      />
      <div style={{ padding: "30px 30px 26px", flex: 1 }}>
        <div
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
          style={{ display: "flex", flexDirection: "column", gap: 14 }}
        >
          <input type="hidden" name="csrfmiddlewaretoken" value={csrfToken} />
          <input type="hidden" name="next" value={nextUrl} />
          <Field
            label="username"
            name="username"
            value={username}
            onChange={setUsername}
            placeholder="username"
            autoComplete="username"
            autoFocus
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
            adornment={<FontAwesomeIcon icon={faLock} style={{ fontSize: 13 }} />}
            error={errorText}
          />
          <PrimaryButton loading={loading}>connect →</PrimaryButton>
        </form>
        <div
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
            style={{
              color: "var(--bc-fg-3)",
              textDecoration: "none",
            }}
          >
            recover access
          </a>
          <span
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
```

- [ ] **Step 2: Update `Field` to support controlled value and an inline error**

Replace the existing `Field` function and `FieldProps` interface with:

```typescript
interface FieldProps {
  label: string;
  type?: "text" | "password";
  name: string;
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  autoComplete?: string;
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
    <label style={{ display: "block" }}>
      <div
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
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoFocus={autoFocus}
          autoComplete={autoComplete}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          spellCheck={false}
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
            onClick={() => setShowPassword((s) => !s)}
            aria-label={showPassword ? "hide password" : "show password"}
            aria-pressed={showPassword}
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
```

- [ ] **Step 3: Type-check + lint**

```bash
cd bordercore
npm run typecheck
npm run lint:react -- front-end/react/accounts/LoginPage.tsx
```

Expected: No errors.

- [ ] **Step 4: Manual verification**

Reload the login page and walk through these scenarios:

1. **Empty submit:** Click `connect →` without typing anything.
   Expected: page does not POST; below the password field appears the red error text `enter both username and password`. The password field border turns danger-red with a soft red ring.

2. **Type something then submit empty password:** Type a username, leave password empty, click submit.
   Expected: same `enter both username and password` error; no POST.

3. **Type both then submit:** Type a real username + a wrong password.
   Expected: button text briefly changes to `authenticating…`, browser submits, page reloads. After the reload, the inline error reads `invalid credentials` (not whatever Django's actual message text was).

4. **Successful login:** Type valid credentials.
   Expected: redirect to homepage / `nextUrl`.

5. **Show/hide password:** Type something in the password field, click `⊙ show`. Field reveals plaintext, button reads `⊙ hide`. Click again, field becomes dots.

- [ ] **Step 5: Commit**

```bash
cd /home/jerrell/dev/django/bordercore
git add bordercore/front-end/react/accounts/LoginPage.tsx
script -qc 'git commit -m "Wire login form submit, validation, and error display

- LoginCard owns username/password/loading/clientError state
- Empty fields trigger client error enter both username and password
- Server message overridden to lowercase invalid credentials
- Error text rendered in role=alert slot under password field with red border
- Field becomes controlled component with onChange callback
- Submit lets browser POST natively; loading state shown during navigation"' /dev/null
```

---

## Task 8: Final verification — responsive, reduced motion, regression

**Files:** none modified (verification only). Document outcomes; only commit if a fix is needed.

- [ ] **Step 1: Responsive collapse**

Open Chrome DevTools, toggle device emulation to a width below 900px (e.g., 375×667 iPhone SE).

Expected:
- Both cubes are hidden
- The sync line is hidden
- The floating tags are hidden
- The login card is no longer right-docked; it's full-width with 24px gutters and starts ~80px from the top of the viewport
- The brand bar tightens (16px 20px padding)

- [ ] **Step 2: Prefers-reduced-motion**

In Chrome DevTools: **More Tools → Rendering → Emulate CSS media feature `prefers-reduced-motion: reduce`**.

Expected:
- Cube rotations freeze
- Floating tag drift freezes
- Form-field focus transitions still work (intentionally — they're short)

- [ ] **Step 3: Cross-browser sanity check**

Open the login page in Firefox latest. Verify:
- Cubes rotate (3D `transform-style: preserve-3d` works)
- Glass-card backdrop blur shows
- Form is functional

(Safari testing optional unless the project explicitly supports Safari — webkit prefixes are already in place for blur.)

- [ ] **Step 4: Backend regression**

```bash
cd /home/jerrell/dev/django/bordercore
make test_unit 2>&1 | tail -30
```

Expected: existing accounts tests still pass. (Django auth was untouched, so nothing should break.)

If anything in `bordercore/accounts/tests/` regresses, investigate before declaring done.

- [ ] **Step 5: Production build sanity**

```bash
cd /home/jerrell/dev/django/bordercore/bordercore
npm run vite:build 2>&1 | tail -20
```

Expected: build completes, manifest emitted, no errors. The `dist/js/login` and `dist/css/bordercore` chunks should reflect the new code.

If the build fails, investigate (likely a typing or import issue surfacing under production transform).

- [ ] **Step 6: Type-check + lint final pass**

```bash
cd /home/jerrell/dev/django/bordercore/bordercore
npm run typecheck
npm run lint:react
```

Expected: clean across the board.

- [ ] **Step 7: Stage and review final diff**

```bash
cd /home/jerrell/dev/django/bordercore
git log --oneline main..HEAD -- 'bordercore/front-end/react/accounts/*' 'bordercore/front-end/react/accounts/login-tokens.css'
git diff main..HEAD -- bordercore/front-end/react/accounts/
```

Verify: the diff matches the spec — three files (LoginPage.tsx rewritten, MirrorCube.tsx new, login-tokens.css new), Django side untouched.

- [ ] **Step 8: No commit needed**

If everything passed, the work is complete. The previous task commits (1–7) carry the implementation; no extra commit is needed unless verification surfaced a fix. If a fix was made, commit it now with a descriptive message.

---

## Self-review checklist (run after writing/editing the plan)

- [x] All spec sections mapped to tasks: tokens (Task 1), MirrorCube (Task 2), backdrop+brand (Task 3), cubes+sync (Task 4), tags (Task 5), card+fields (Task 6), submit+errors (Task 7), responsive+reduced-motion+regression (Task 8).
- [x] No "TBD" / "TODO" / "implement later" placeholders.
- [x] All file paths are absolute or unambiguously rooted in `bordercore/`.
- [x] Each task ends with a `script -qc` commit (works around the `uv run` non-tty issue noted in project memory).
- [x] Type signatures stay consistent: `LoginCardProps`, `FieldProps`, `MirrorCubeProps` defined where introduced and reused unchanged.
- [x] Microcopy matches the spec verbatim: `// dual node`, `Sign in to your brain`, `primary 0x4fa · replica 0x4fb · drift 4ms`, `connect →`, `authenticating…`, `enter both username and password`, `invalid credentials`, `recover access`, `both healthy`, `primary + replica · v3.4.1`.
- [x] Hidden inputs preserved: `csrfmiddlewaretoken`, `next`.
- [x] Decorative layers carry `aria-hidden`; cube and tags carry `data-anim`; error slot has `role="alert"`.
