# Login Page — F4 Mirrored Redesign

**Date:** 2026-04-25
**Status:** Approved (brainstorming complete)
**Source:** `design_handoff_login_f4_mirrored/README.md` (high-fidelity design handoff)

## Goal

Replace the existing Bootstrap-based login page with the F4 Mirrored design — two
counter-rotating wireframe cubes joined by a glowing sync line, framed against a
dark navy/black canvas with neon purple accent, and a glass card on the right
holding the form.

The visual treatment is fully specified in the handoff README; this spec
captures the integration choices for porting it into the Bordercore Django +
React codebase.

## Non-goals

- No changes to Django auth views, URL routes, or session handling.
- No global theme refactor — new design tokens are scoped to the login page.
- No new automated frontend test infrastructure.
- No mobile-app changes (this is the web login only).

## Architecture

### File layout

```
bordercore/
├── templates/
│   └── login.html                     ← unchanged
└── front-end/
    ├── entries/
    │   └── login.tsx                  ← unchanged (props contract preserved)
    └── react/accounts/
        ├── LoginPage.tsx              ← REWRITTEN
        ├── MirrorCube.tsx             ← NEW
        └── login-tokens.css           ← NEW
```

### Data flow

```
Django view  ──renders──▶  templates/login.html
                                  │
                                  ├── data-message
                                  ├── data-initial-username
                                  ├── data-login-url
                                  ├── data-next-url
                                  └── data-csrf-token
                                  │
                                  ▼
                        front-end/entries/login.tsx
                                  │  (createRoot + props)
                                  ▼
                        react/accounts/LoginPage
                                  │
                                  └── form action={loginUrl} method="post"
                                            │
                                            ▼
                                      Django auth ── success ──▶ redirect to nextUrl
                                            │
                                            └── failure ──▶ re-render with message
```

### Component composition

`LoginPage.tsx` renders the layered stack:

```
<div className="bc-login-root">
  <BackdropGrid />                                  z=0
  <div className="bc-login-cubes" left=22%><MirrorCube dir={+1}/></div>   z=1
  <div className="bc-login-cubes" left=42%><MirrorCube dir={-1}/></div>   z=1
  <SyncLine />                                      z=2
  <FloatingTags items={…} />                        z=2
  <BrandBar />                                      z=4
  <LoginCard … />                                   z=5
</div>
```

**Co-located in `LoginPage.tsx`:** `BackdropGrid`, `SyncLine`, `FloatingTags`,
`BrandBar`, `LoginCard`, plus internal `Field` and `PrimaryButton` sub-components.
**Extracted to `MirrorCube.tsx`:** the 3D-transform cube — used twice, parameterised
by `dir={+1|-1}` and `size`.

## Form behaviour

### Submit flow (plain HTML form-post)

The form uses standard HTML `<form action={loginUrl} method="post">` — no
`fetch` / AJAX. The browser submits the form natively.

1. `onSubmit` fires.
2. Client validation: if `username` or `password` is empty, set
   `clientError = "enter both username and password"`, call `e.preventDefault()`,
   stop. No POST.
3. Otherwise, set `loading = true`. Do **not** preventDefault. The submit button
   text swaps to `authenticating…`. The browser submits and navigates away on
   success.
4. On failure, Django re-renders `login.html` with `message` populated. The new
   `LoginPage` mounts fresh with `props.message` non-empty.

### State (in `LoginCard`)

```
username:     string   ← seeded from props.initialUsername
password:     string   ← always empty on mount
showPassword: boolean
loading:      boolean
clientError:  string | null
```

### Error display (single inline slot)

One error slot, rendered beneath the password field:

```
const errorText = clientError
  ?? (props.message ? "invalid credentials" : null);
```

Server-side `message` is overridden to the lowercase `"invalid credentials"`
string regardless of Django's exact wording — matches the design voice and
avoids leaking which field was wrong.

The error slot has `role="alert"` so screen readers announce it on appearance.

### Hidden inputs (preserved from existing template)

- `<input type="hidden" name="csrfmiddlewaretoken" value={csrfToken} />`
- `<input type="hidden" name="next" value={nextUrl} />`

## Visual treatment

All visual specifications come from the handoff README and reference files —
this spec does not duplicate those numbers. Key implementation notes:

### Tokens (`login-tokens.css`)

The full `--bc-*` token sheet (colors, type stacks, spacing, radii, shadows,
motion easings/durations) is wrapped in `:where(.bc-login-root)` so it only
applies to descendants of the login root. No global theme changes.

`login-tokens.css` is imported once at the top of `LoginPage.tsx`
(`import "./login-tokens.css";`). Vite handles CSS bundling automatically.

Webfonts (`Inter`, `Space Grotesk`, `JetBrains Mono`) are loaded via the same
Google Fonts `@import` URL the reference uses, declared at the top of
`login-tokens.css`.

### Keyframes

`mc-a`, `mc-b` (cube rotations), `fl0`, `fl1`, `fl2` (tag drift) live in
`login-tokens.css`. Keyframe rules are global by nature — they belong in CSS,
not inline.

### Logo mark

Inline gradient SVG (`Mark` from the reference) — purple-to-cyan gradient on a
rounded square. The existing `bordercore-logo-login.png` is not used.

## Motion & accessibility

### Reduced motion

```css
@media (prefers-reduced-motion: reduce) {
  .bc-login-root [data-anim] { animation-play-state: paused !important; }
}
```

`MirrorCube` and floating-tag elements get `data-anim`. Form-field micro-
transitions are short enough that they don't need explicit handling.

### Decorative elements

`BackdropGrid`, `MirrorCube`, `SyncLine`, `FloatingTags` all get
`aria-hidden="true"` — they're purely visual.

### Form accessibility

- Labels associated to inputs via `htmlFor`.
- Show/hide password button: `aria-label="show password" | "hide password"`
  and `aria-pressed={showPassword}`.
- Error slot: `role="alert"`.

## Responsive

At `< 900px` viewport:

```css
@media (max-width: 900px) {
  .bc-login-cubes,
  .bc-login-tags,
  .bc-login-syncline { display: none; }

  .bc-login-card {
    position: static;
    transform: none;
    width: auto;
    margin: 80px 24px 24px;
  }

  .bc-login-brandbar { padding: 16px 20px; }
}
```

Decorative layers hide; card detaches from right-dock and becomes centered
full-width with 24px gutters.

## Microcopy

All copy from the README "Microcopy (verbatim)" table is used verbatim:

| Slot | Copy |
|---|---|
| Brand | `bordercore` |
| Crumb | `primary + replica · v3.4.1` |
| Kicker | `// dual node` |
| Title | `Sign in to your brain` |
| Subtitle | `primary 0x4fa · replica 0x4fb · drift 4ms` |
| Username label | `username` |
| Password label | `password` |
| Submit | `connect →` |
| Footer link | `recover access` |
| Status | `both healthy` |
| Floating tags | `primary`, `replica`, `in-sync`, `lag 4ms`, `writes ←`, `reads →` |
| Loading state | `authenticating…` |
| Validation error (client) | `enter both username and password` |
| Server error (override) | `invalid credentials` |

The `recover access` link `href` is set to `#` — the `accounts` app has a
password-*change* route (`accounts:password`, requires login) but no public
password-*reset* flow, so there's no real target. The link is rendered for
visual completeness; clicking it is a no-op until a recovery flow is added.

## Testing

### Manual verification (primary)

- Start dev server, visit `/accounts/login/`.
- Empty submit → inline `enter both username and password` under password.
- Invalid creds submit → page reloads with inline `invalid credentials`.
- Valid creds → redirect to `nextUrl` / homepage.
- Show/hide password toggle works.
- Resize below 900px → cubes hide, card full-width.
- DevTools `prefers-reduced-motion: reduce` → cube + tag animations pause.

### Type-check + lint

- `tsc --noEmit` passes on changed files.
- `eslint` passes on changed files.

### Backend regression

- `pytest bordercore/accounts/` continues to pass (Django auth untouched).

### Browser check

- Chrome and Firefox latest — verify cube `transform-style: preserve-3d`
  renders correctly.

## Open items for implementation

None blocking. The two minor uncertainties resolved during spec review:
- `recover access` link → `#` (no public password-reset flow exists; documented above).
- Vite asset pickup → automatic (TSX and CSS files imported from `LoginPage.tsx` are
  bundled into the existing `dist/js/login` and `dist/css/bordercore` outputs).
