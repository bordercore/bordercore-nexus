# Chatbot modal redesign — design spec

**Date:** 2026-04-24
**Component:** `bordercore/front-end/react/blob/ChatBot.tsx` and supporting SCSS / backend endpoints

## Summary

Replace the current bottom-right Bootstrap-utility chat strip with a polished, two-mode chat surface: a centered `refined-modal` (the same shell used by `NewNodeModal` and `StudyModal`) and a right-hand docked panel toggled by a "pin" button. Add seven UX features that move the chatbot from "bare-bones" to a daily-use surface: mode chips, multi-line input, live streaming cursor + stop, per-message actions, syntax-highlighted code blocks, follow-up suggestion chips, and pin-mode resize. Alt-C continues to be the open shortcut.

## Goals

- Visually consistent with the existing `refined-modal` system (same scrim, animation, eyebrow/title/lead/actions structure, design tokens).
- Two display modes — centered modal (default) and right-docked panel (pinned). Pin state persists per user via `localStorage`.
- Make streaming feel alive and interruptible (cursor + stop button).
- Make assistant replies actionable (copy, regenerate, save as note) and parseable (syntax-highlighted code with copy).
- Reduce input friction (multi-line textarea, Shift-Enter for newline, mode chips with Tab cycling, ↵ send, Esc close).
- After each reply, surface 2–3 follow-up suggestion chips.

## Non-goals (deferred)

- Conversation history persisted server-side (deferred to a future PR).
- Slash commands, prompt templates / personas, model picker, voice input, image attachment, designed empty state, auto context detection, visible context pill, citation panel, full export. (All considered, intentionally out of scope.)
- Migrating the chat backend off `FormData` to JSON — current contract is preserved.

## Current state (one paragraph)

`ChatBot.tsx` renders a fixed-position div at the bottom of the page using Bootstrap utility classes only. It listens on `EventBus.$on("chat", ...)`, opens on Alt-C (handled in `bordercore/front-end/entries/base-react.tsx`), and POSTs to `/blob/chat/` (URL: `blob:chat`). The endpoint streams text chunks back via `StreamingHttpResponse`; the client appends them to the last assistant message. Mode is a `<select>` (Chat / Query Notes / Query Blob, plus implicit `question` / `exercise` modes triggered by event payload). Markdown is rendered with `markdown-it` and injected as inner HTML. There is no abort, no per-message UI, no syntax highlighting, no follow-ups.

## Architecture overview

### Display modes

| | Modal mode (default) | Pinned mode |
|---|---|---|
| Position | Centered, `top: 50%; left: 50%` | Fixed to right edge, full viewport height minus margins |
| Scrim | Yes (`refined-modal-scrim`, blurred) | None — page stays scrollable / clickable |
| Width | Fixed responsive: `min(640px, calc(100vw - 40px))` | User-resizable via left-edge drag handle, persisted to `localStorage` (default 360px, min 300, max 600) |
| Alt-C | Opens (modal closes on click outside / Esc) | Toggles open/closed |
| Animation | Existing `refined-modal-in` (200ms slide-up + fade) | Slide-in from right (160ms) |

State persists in `localStorage` under a single key `bordercore.chatbot.ui`:

```json
{ "pinned": true, "pinnedWidth": 380 }
```

On mount: read this; pin defaults to `false` if unset. Alt-C opens whichever mode the user last left it in.

### Component tree

```
ChatBot.tsx (top-level, renders into document.body via createPortal)
├── ChatBotShell.tsx        — modal vs pinned shell wrapper, scrim, animation, resize handle
│   ├── ChatBotHeader.tsx   — eyebrow + title + close + pin toggle
│   ├── ModeChips.tsx       — pill row, Tab-cycles, replaces <select>
│   ├── MessageList.tsx     — scroll container, renders Message
│   │   └── Message.tsx     — single message; wraps MessageActions, CodeBlock, FollowUps, SaveAsNoteForm
│   └── ChatInput.tsx       — auto-grow textarea, Send/Stop button, keyboard hints
```

Files live under `bordercore/front-end/react/chatbot/` (new directory) — current `blob/ChatBot.tsx` moves there. The keep-it-with-blob accident-of-history goes away; chat is its own surface.

## Visual design

The shell reuses the existing refined-modal CSS contract (eyebrow, title, lead, scrim, actions). New SCSS lives in `bordercore/static/scss/components/_chatbot-modal.scss` and extends what `_refined-modal.scss` provides — it does not duplicate the scrim or base shell.

**Header layout:**

```
┌─────────────────────────────────────────────────────────┐
│ chat · bordercore / assistant                  📌  ×    │
│ Ask the assistant                                        │
│ streaming answers from your notes, blobs, or open chat   │
├─────────────────────────────────────────────────────────┤
│ [chat]  notes  blob  question  exercise                  │  ← mode chips
├─────────────────────────────────────────────────────────┤
│ you · what's the gist of yesterday's note?               │
│                                                          │
│ ai · The note covers …▍                                  │  ← streaming cursor
│   ⧉ copy  ↻ regenerate  📑 save as note                  │  ← per-message actions
│   [explain more] [give an example] [related notes]       │  ← follow-up chips
├─────────────────────────────────────────────────────────┤
│ ┌────────────────────────────────────────────────┐      │
│ │ ask anything… (shift-↵ for newline)            │      │
│ └────────────────────────────────────────────────┘      │
│ ↵ send  ⇧↵ newline  esc close          ■ stop           │
└─────────────────────────────────────────────────────────┘
```

In pinned mode, the same components render in a narrower frame: lead text is hidden, eyebrow shortens to "chat · docked", message text shrinks one notch (12px → 11.5px), follow-up chips wrap.

## Feature specs

### Mode chips

Replace `<select>` with a horizontal pill row above the message list. Five modes: `chat`, `notes`, `blob` (only if `blobUuid` prop is set), `question`, `exercise` (the latter two are read-only — they're set by event payload, never user-selectable, so they show as a non-clickable indicator chip when active). Tab cycles forward, Shift-Tab cycles back. Active chip uses `--accent` border and color, matching the existing `.refined-field` focus treatment. Replaces the current `hotkeys`-based up/down cycling.

### Multi-line input

`<textarea>` with auto-grow (1 row min, 6 rows max, then scrolls). Enter sends, Shift-Enter inserts newline, Esc closes the modal (or unfocuses + collapses pinned mode — see open question Q1). Same `--bg-0` background and accent focus ring as `.refined-field` inputs.

### Streaming cursor + stop button

While `isStreaming` is true:

- The last assistant message renders a 5×11px blinking caret at the end of its content (a span with `animation: chatbot-cursor-blink 1s steps(1) infinite`).
- The footer's right side shows a `■ stop` link (red `--danger` token, otherwise text-styled).
- Clicking stop calls `abortController.abort()` on the in-flight `fetch()`. Whatever has streamed so far is preserved as a complete message.

Implementation: replace the existing `fetch()` call with one that takes an `AbortController.signal`. No backend change.

### Per-message actions

Visible on hover (and always visible on mobile / touch — no hover state). Actions row appears below each *assistant* message (user messages get only ⧉ copy):

- **⧉ copy** — copies the message's plain text (markdown source) to the clipboard via `navigator.clipboard.writeText`. Shows a 1-second "✓ copied" confirmation.
- **↻ regenerate** — re-issues the same request that produced this assistant message. Truncates `chatHistory` to just before this assistant turn, then re-runs `handleChat()` with the prior user prompt. Available only on the most-recent assistant message.
- **📑 save as note** — toggles open an inline `SaveAsNoteForm` strip directly under the actions row (see below). Not modal-on-modal.

### Save-as-note inline form

When 📑 is clicked, a thin strip slides down (~80px tall):

```
┌─────────────────────────────────────────────────────┐
│ TITLE        [Auto-summary of the answer (editable)]│
│ TAGS         [optional, comma-separated]            │
│                                  [cancel]   save ↵  │
└─────────────────────────────────────────────────────┘
```

- Title autofills with the first sentence of the assistant message (truncated to 80 chars), editable.
- Tags is optional; comma-separated.
- ↵ submits, Esc cancels and closes the strip.

**Backend:** add `POST /blob/chat/save_as_note/` (URL name `blob:chat_save_as_note`). Body: `{ title, tags, content }`. Creates a Blob with `is_note=True`, owned by `request.user`. Returns `{ uuid, url }`. On success, the strip collapses and an unobtrusive toast at the modal footer reads "saved · [open note](…)" for 4 seconds.

The reason we add a small dedicated endpoint rather than reusing `BlobCreateView`: that view is a Django form view that redirects on success. The chat needs a JSON contract.

### Code blocks with syntax highlighting

For fenced code blocks rendered through markdown-it, run output through `highlight.js`. Each code block gets:

- A small uppercase language label in the top-left corner
- A `copy` button in the top-right corner that copies the raw source

Uses the existing markdown-it instance — add a `highlight` callback per its docs:

```ts
const markdown = MarkdownIt({
  html: true, linkify: true, typographer: true,
  highlight: (str, lang) => hljs.highlight(str, { language: lang || "plaintext" }).value,
});
```

Tokens: code block background `var(--bg-0)`, border `var(--line)`, monospace font from `--font-mono`. We pull a hljs theme that uses our existing accent palette (custom CSS, not a default hljs theme — about 25 lines of color-mix overrides in `_chatbot-modal.scss`).

**Sanitization note:** the existing implementation injects markdown output as raw HTML. Since the chatbot now also renders highlighted code (which is HTML from hljs), we should pipe the final markdown output through DOMPurify before injection. This is a small hardening win on top of the redesign and protects against any future model output that contains tags. Add `dompurify` as a dependency; sanitize once before injection in `Message.tsx`.

### Follow-up suggestion chips

When streaming completes (and the assistant message is non-empty), fire a separate POST to `/blob/chat/followups/` (URL name `blob:chat_followups`).

**Request:** `{ assistant_reply: string, mode: string }`
**Response:** `{ suggestions: string[] }` — exactly 2–3 short prompts.

**Backend implementation:** new view in `blob/views.py`, calls a new function `chatbot_followups()` in `blob/services.py`. Uses GPT-3.5 (cheaper, faster than the main model). System prompt: "Given this assistant reply, suggest 2-3 short follow-up questions the user might ask next. Return JSON: `{\"suggestions\": [\"…\",\"…\"]}`. Each under 8 words." Parses with `json.loads`; on parse failure, returns `{ suggestions: [] }` (chips just don't appear — graceful degradation). Non-streaming response.

**Frontend:** chips render below the actions row with a small fade-in (120ms). Clicking a chip puts its text in the input, focuses, and (per Open question Q3) optionally auto-sends.

Chips are cleared the moment the user starts typing or sends a new message.

### Pin toggle + persistence

Pin button (`📌`) sits in the top-right alongside the close `×`. Clicking it:

- Animates the modal to its pinned position (300ms transition on `transform`, `width`, `top`, `left`, `right`, `bottom`).
- Removes the scrim.
- Writes `{ pinned: true, ... }` to `localStorage`.
- Adds `aria-modal="false"` to the dialog (so screen readers know the page is interactive).

Clicking it again unpins — animates back to centered, restores the scrim, sets `aria-modal="true"`. State persists.

Alt-C behavior:

- If pinned and visible → close
- If pinned and hidden → open in pinned mode
- If unpinned and hidden → open in modal mode
- If unpinned and visible → close (unchanged)

Esc only closes when in modal mode (in pinned mode, Esc just unfocuses the input — see Open question Q1).

### Resize (pinned mode only)

A 4px-wide drag handle on the left edge of the pinned panel. On `mousedown`, attach `mousemove` / `mouseup` listeners; update width live; clamp to `[300, 600]`; persist on `mouseup`. Cursor changes to `ew-resize` over the handle. Shows a 2px accent-colored stripe on hover.

Modal mode is a fixed responsive width (no resize). This keeps it visually consistent with `NewNodeModal` and `StudyModal`.

## Backend changes summary

| Change | Location | Notes |
|---|---|---|
| Add `chatbot_followups()` service | `blob/services.py` | GPT-3.5, JSON-parsed response, swallow parse errors |
| Add `chat_followups` view | `blob/views.py` | DRF `@api_view(["POST"])`, returns `Response({"suggestions": [...]})` |
| Add `chat_save_as_note` view | `blob/views.py` | DRF `@api_view(["POST"])`, creates note-blob, returns `{uuid, url}` |
| Wire two new URL routes | `blob/urls.py` | Names `blob:chat_followups`, `blob:chat_save_as_note` |
| Inject new URLs into base template | `templates/base.html` | Add to existing chatbot props block at line 177 |

The existing `/blob/chat/` streaming endpoint is unchanged.

## SCSS changes

- New file: `bordercore/static/scss/components/_chatbot-modal.scss` (~250 lines) — chatbot-specific styles, depends on tokens and `_refined-modal.scss`.
- Delete: `bordercore/static/scss/components/_chatbot.scss` (replaced).
- Update import in main scss bundle.

`_chatbot-modal.scss` reuses (does not redefine):

- `.refined-modal-scrim`, `.refined-modal`, `.refined-modal-eyebrow`, `.refined-modal-title`, `.refined-modal-lead`, `.refined-modal-close`
- The `--accent`, `--bg-*`, `--fg-*`, `--line` tokens

It adds chatbot-specific classes:

- `.chatbot-modal` — extends the `.refined-modal` width override (640px), adjusts padding for chat density
- `.chatbot-modal--pinned` — modifier that overrides position/width/animation for docked mode
- `.chatbot-mode-chips`, `.chatbot-mode-chip`, `.chatbot-mode-chip--active`
- `.chatbot-message`, `.chatbot-message--user`, `.chatbot-message--assistant`
- `.chatbot-message-actions` (hover-revealed)
- `.chatbot-cursor` (animated caret)
- `.chatbot-followup-chip`
- `.chatbot-code-block`, `.chatbot-code-copy`, `.chatbot-code-lang`
- `.chatbot-resize-handle`
- `.chatbot-input-area`, `.chatbot-keyboard-hints`
- `.chatbot-save-as-note` (inline strip)

## Frontend state shape

```ts
type ChatBotState = {
  show: boolean;              // open / closed
  pinned: boolean;            // persisted
  pinnedWidth: number;        // persisted
  mode: ChatMode;             // 'chat' | 'notes' | 'blob' | 'question' | 'exercise'
  history: ChatMessage[];
  draft: string;              // input contents
  isStreaming: boolean;
  abortController: AbortController | null;
  followups: string[];        // suggestions for the latest assistant message
  saveFormOpenForId: number | null;  // which message has the save strip open
};
```

Stored in component state (no global store needed). Persistence is just `localStorage` reads/writes for `pinned` and `pinnedWidth`.

## Testing

- Unit-test `ChatInput` keyboard handling (Enter sends, Shift-Enter inserts, Esc closes).
- Unit-test `ModeChips` Tab cycling.
- Test the pin persistence round-trip (set pinned → reload → still pinned).
- Test stop-mid-stream: assistant message is preserved with whatever streamed before abort.
- Backend: standard view tests for `chat_followups` (happy path, parse-error fallback) and `chat_save_as_note` (happy path, missing-title 400, owner check).

## Open questions

1. **Esc behavior in pinned mode** — should it close the dock, or just unfocus the input? Recommendation: unfocus only (pinning implies you want it persistent), with Alt-C as the close toggle.
2. **highlight.js language scope** — load all common languages (~80kb gzipped) or just a curated set (python, javascript/ts, bash, sql, json, yaml, html, css, ~25kb)? Recommendation: curated set; auto-detect within that scope.
3. **Follow-up chip click — auto-send or just fill input?** Recommendation: auto-send. The chips exist to reduce friction; making them require a second click defeats the point.

These can be resolved in the planning step or punted to implementation.
