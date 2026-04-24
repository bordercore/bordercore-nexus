# Chatbot Modal Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the bottom-right Bootstrap-utility chatbot strip with a polished centered/pinned modal matching the `refined-modal` pattern, plus 7 UX features (mode chips, multi-line input, streaming cursor + stop, per-message actions, syntax-highlighted code, follow-up chips, pin/resize).

**Architecture:** React 18 + TypeScript portal-rendered modal layered on top of the existing `_refined-modal.scss` shell. Two display modes (centered modal vs right-docked panel), toggled by a pin button and persisted to `localStorage`. Two new DRF endpoints (`chat_followups`, `chat_save_as_note`) added to `blob/`; existing `/blob/chat/` streaming endpoint untouched. Frontend reorganized from one ~280-line file into ~10 focused files under `front-end/react/chatbot/`.

**Tech Stack:** React 18, TypeScript, vitest + @testing-library/react, Django + DRF, OpenAI SDK (Python), `markdown-it`, `highlight.js`, `dompurify` (new), `pytest`.

**Spec:** `docs/superpowers/specs/2026-04-24-chatbot-modal-redesign-design.md`

---

## File Structure

### Created

| Path | Responsibility |
|---|---|
| `bordercore/front-end/react/chatbot/types.ts` | Shared types: `ChatMessage`, `ChatMode`, `ChatBotPersistedUI` |
| `bordercore/front-end/react/chatbot/storage.ts` | `localStorage` read/write for `{ pinned, pinnedWidth }` |
| `bordercore/front-end/react/chatbot/storage.test.ts` | Unit tests for storage helpers |
| `bordercore/front-end/react/chatbot/markdown.ts` | markdown-it instance + hljs highlighter + DOMPurify sanitization |
| `bordercore/front-end/react/chatbot/markdown.test.ts` | Tests for markdown rendering, code highlighting, sanitization |
| `bordercore/front-end/react/chatbot/SanitizedHtml.tsx` | Wrapper that mounts pre-sanitized HTML via DocumentFragment |
| `bordercore/front-end/react/chatbot/ModeChips.tsx` | Pill row replacing `<select>` |
| `bordercore/front-end/react/chatbot/ModeChips.test.tsx` | Click-to-select, active state, blob-context gating |
| `bordercore/front-end/react/chatbot/ChatInput.tsx` | Auto-grow textarea + send/stop button + keyboard hints |
| `bordercore/front-end/react/chatbot/ChatInput.test.tsx` | Enter sends, Shift-Enter newline, Esc behavior, stop button |
| `bordercore/front-end/react/chatbot/MessageActions.tsx` | Hover-revealed copy / regenerate / save-as-note button row |
| `bordercore/front-end/react/chatbot/MessageActions.test.tsx` | Click handlers, copy confirmation |
| `bordercore/front-end/react/chatbot/SaveAsNoteForm.tsx` | Inline strip with title/tags inputs |
| `bordercore/front-end/react/chatbot/SaveAsNoteForm.test.tsx` | Submit, cancel, autofill |
| `bordercore/front-end/react/chatbot/FollowUps.tsx` | Suggestion chip row |
| `bordercore/front-end/react/chatbot/FollowUps.test.tsx` | Renders chips, click → calls `onSelect` |
| `bordercore/front-end/react/chatbot/Message.tsx` | Single message: rendered markdown + actions + chips + save form |
| `bordercore/front-end/react/chatbot/MessageList.tsx` | Scroll container |
| `bordercore/front-end/react/chatbot/ChatBotHeader.tsx` | Eyebrow + title + lead + close + pin |
| `bordercore/front-end/react/chatbot/ChatBotShell.tsx` | Modal vs pinned shell, scrim, animation, resize handle |
| `bordercore/front-end/react/chatbot/ChatBot.tsx` | Top-level: state + EventBus + fetch + abort + followups |
| `bordercore/static/scss/components/_chatbot-modal.scss` | All chatbot-specific styles |

### Modified

| Path | Change |
|---|---|
| `bordercore/package.json` | Add `dompurify` + `@types/dompurify` |
| `bordercore/blob/services.py` | Add `chatbot_followups()` function |
| `bordercore/blob/views.py` | Add `chat_followups` and `chat_save_as_note` views |
| `bordercore/blob/urls.py` | Wire two new URL routes |
| `bordercore/blob/tests/test_services.py` | Tests for `chatbot_followups()` |
| `bordercore/blob/tests/test_views.py` | Tests for two new endpoints |
| `bordercore/templates/base.html` | Inject 2 new URLs into `chatBotConfig` |
| `bordercore/front-end/entries/base-react.tsx` | Update import path for ChatBot, pass new URL props |
| `bordercore/static/scss/bordercore.scss` | Replace `chatbot` import with `chatbot-modal` |

### Deleted

| Path | Reason |
|---|---|
| `bordercore/front-end/react/blob/ChatBot.tsx` | Moved to `front-end/react/chatbot/ChatBot.tsx` |
| `bordercore/static/scss/components/_chatbot.scss` | Replaced by `_chatbot-modal.scss` |

---

## Phase A — Backend endpoints (Tasks 1–3)

### Task 1: `chatbot_followups()` service

**Files:**
- Modify: `bordercore/blob/services.py` (add new function near existing `chatbot()` at line 926)
- Modify: `bordercore/blob/tests/test_services.py` (append new tests)

- [ ] **Step 1: Write the failing test**

Append to `bordercore/blob/tests/test_services.py`. If `json`, `MagicMock`, `patch` are not already imported at the top of the file, add them; only the new `from blob.services import chatbot_followups` is guaranteed new.

```python
import json
from unittest.mock import MagicMock, patch

from blob.services import chatbot_followups


@patch("blob.services.OpenAI")
def test_chatbot_followups_returns_suggestions(mock_openai_cls):
    """chatbot_followups returns the suggestions list parsed from the model response."""
    mock_client = MagicMock()
    mock_openai_cls.return_value = mock_client
    mock_client.chat.completions.create.return_value = MagicMock(
        choices=[
            MagicMock(message=MagicMock(content=json.dumps({
                "suggestions": ["explain more", "give an example", "related notes"]
            })))
        ]
    )

    result = chatbot_followups("Some assistant reply.", mode="chat")

    assert result == ["explain more", "give an example", "related notes"]


@patch("blob.services.OpenAI")
def test_chatbot_followups_returns_empty_on_parse_error(mock_openai_cls):
    """chatbot_followups returns [] when the model response is not valid JSON."""
    mock_client = MagicMock()
    mock_openai_cls.return_value = mock_client
    mock_client.chat.completions.create.return_value = MagicMock(
        choices=[
            MagicMock(message=MagicMock(content="not json at all"))
        ]
    )

    result = chatbot_followups("Some reply.", mode="chat")

    assert result == []


@patch("blob.services.OpenAI")
def test_chatbot_followups_returns_empty_on_missing_key(mock_openai_cls):
    """chatbot_followups returns [] when JSON has no 'suggestions' key."""
    mock_client = MagicMock()
    mock_openai_cls.return_value = mock_client
    mock_client.chat.completions.create.return_value = MagicMock(
        choices=[
            MagicMock(message=MagicMock(content=json.dumps({"other": []})))
        ]
    )

    result = chatbot_followups("Some reply.", mode="chat")

    assert result == []
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /home/jerrell/dev/django/bordercore
.venv/bin/python -m pytest bordercore/blob/tests/test_services.py -k chatbot_followups -v
```

Expected: 3 FAILED with `ImportError: cannot import name 'chatbot_followups' from 'blob.services'`.

- [ ] **Step 3: Implement `chatbot_followups()`**

In `bordercore/blob/services.py`, immediately after the existing `chatbot()` function (after line 1025), add:

```python
def chatbot_followups(assistant_reply: str, mode: str = "chat") -> list[str]:
    """Generate 2-3 follow-up question suggestions for an assistant reply.

    Uses gpt-3.5-turbo for cost / latency. Returns [] on any failure so the
    UI degrades gracefully (chips simply don't appear).
    """
    system = (
        "Given an assistant reply, suggest 2-3 short follow-up questions the "
        "user might ask next. Respond with JSON only, in the form "
        '{"suggestions": ["...", "..."]}. Each suggestion must be under 8 words.'
    )
    user_msg = f"Mode: {mode}\n\nAssistant reply:\n{assistant_reply}"

    try:
        client = OpenAI()
        response = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": user_msg},
            ],
            response_format={"type": "json_object"},
        )
        content = response.choices[0].message.content or ""
        parsed = json.loads(content)
        suggestions = parsed.get("suggestions", [])
        if not isinstance(suggestions, list):
            return []
        return [str(s) for s in suggestions[:3]]
    except (json.JSONDecodeError, KeyError, AttributeError, IndexError):
        return []
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
.venv/bin/python -m pytest bordercore/blob/tests/test_services.py -k chatbot_followups -v
```

Expected: 3 PASSED.

- [ ] **Step 5: Commit**

```bash
script -qc "git add bordercore/blob/services.py bordercore/blob/tests/test_services.py && git commit -m 'Add chatbot_followups service for follow-up suggestion chips'" /dev/null
```

---

### Task 2: `chat_followups` view + URL

**Files:**
- Modify: `bordercore/blob/views.py` (add view near existing `chat()` at line 1153)
- Modify: `bordercore/blob/urls.py` (add route)
- Modify: `bordercore/blob/tests/test_views.py` (append new tests)

- [ ] **Step 1: Write the failing test**

Append to `bordercore/blob/tests/test_views.py`. If `import json` isn't already at the top of the file, add it.

```python
@patch("blob.views.chatbot_followups")
def test_chat_followups_returns_suggestions(mock_followups, authenticated_client):
    """chat_followups view returns suggestions as JSON."""
    mock_followups.return_value = ["a", "b", "c"]

    _, client = authenticated_client()
    url = urls.reverse("blob:chat_followups")
    resp = client.post(
        url,
        data=json.dumps({"assistant_reply": "Hello", "mode": "chat"}),
        content_type="application/json",
    )

    assert resp.status_code == 200
    assert resp.json() == {"suggestions": ["a", "b", "c"]}
    mock_followups.assert_called_once_with("Hello", mode="chat")


def test_chat_followups_requires_login(client):
    """chat_followups view returns 403 for unauthenticated requests."""
    url = urls.reverse("blob:chat_followups")
    resp = client.post(
        url,
        data=json.dumps({"assistant_reply": "x", "mode": "chat"}),
        content_type="application/json",
    )
    assert resp.status_code == 403


@patch("blob.views.chatbot_followups")
def test_chat_followups_handles_missing_fields(mock_followups, authenticated_client):
    """chat_followups view tolerates missing fields by defaulting them."""
    mock_followups.return_value = []

    _, client = authenticated_client()
    url = urls.reverse("blob:chat_followups")
    resp = client.post(url, data=json.dumps({}), content_type="application/json")

    assert resp.status_code == 200
    assert resp.json() == {"suggestions": []}
    mock_followups.assert_called_once_with("", mode="chat")
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
.venv/bin/python -m pytest bordercore/blob/tests/test_views.py -k chat_followups -v
```

Expected: 3 FAILED with `NoReverseMatch: Reverse for 'chat_followups' not found`.

- [ ] **Step 3: Add the URL route**

In `bordercore/blob/urls.py`, immediately after the existing `chat` route block (after line 111), insert:

```python
    path(
        route="chat/followups",
        view=views.chat_followups,
        name="chat_followups"
    ),
```

- [ ] **Step 4: Add the view**

First check existing imports:

```bash
grep -n "from rest_framework\|api_view\|^from blob.services\|chatbot" bordercore/blob/views.py | head -15
```

Then in `bordercore/blob/views.py`, immediately after the existing `chat()` function (after line 1174), add:

```python
@api_view(["POST"])
def chat_followups(request: Request) -> Response:
    """Return 2-3 suggested follow-up prompts for a given assistant reply."""
    assistant_reply = request.data.get("assistant_reply", "")
    mode = request.data.get("mode", "chat")
    suggestions = chatbot_followups(assistant_reply, mode=mode)
    return Response({"suggestions": suggestions})
```

If `chatbot_followups` is not yet imported from `blob.services`, add it to the existing `from blob.services import (...)` block. DRF's `api_view`, `Response`, `Request` are almost certainly already imported (the file uses many `@api_view` decorators) — verify with the grep above.

- [ ] **Step 5: Run tests to verify they pass**

```bash
.venv/bin/python -m pytest bordercore/blob/tests/test_views.py -k chat_followups -v
```

Expected: 3 PASSED.

- [ ] **Step 6: Commit**

```bash
script -qc "git add bordercore/blob/views.py bordercore/blob/urls.py bordercore/blob/tests/test_views.py && git commit -m 'Add chat_followups view'" /dev/null
```

---

### Task 3: `chat_save_as_note` view + URL

**Files:**
- Modify: `bordercore/blob/views.py`
- Modify: `bordercore/blob/urls.py`
- Modify: `bordercore/blob/tests/test_views.py`

- [ ] **Step 1: Write the failing test**

Append to `bordercore/blob/tests/test_views.py`:

```python
def test_chat_save_as_note_creates_note(authenticated_client):
    """chat_save_as_note creates a note-typed Blob and returns its uuid + url."""
    user, client = authenticated_client()
    url = urls.reverse("blob:chat_save_as_note")
    resp = client.post(
        url,
        data=json.dumps({
            "title": "My answer",
            "tags": "ai, chatbot",
            "content": "The answer is 42.",
        }),
        content_type="application/json",
    )

    assert resp.status_code == 200
    body = resp.json()
    assert "uuid" in body
    assert "url" in body

    from blob.models import Blob
    blob = Blob.objects.get(uuid=body["uuid"])
    assert blob.user_id == user.id
    assert blob.is_note is True
    assert blob.name == "My answer"
    assert blob.content == "The answer is 42."
    tag_names = sorted(t.name for t in blob.tags.all())
    assert tag_names == ["ai", "chatbot"]


def test_chat_save_as_note_requires_title(authenticated_client):
    """chat_save_as_note returns 400 when title is missing or blank."""
    _, client = authenticated_client()
    url = urls.reverse("blob:chat_save_as_note")

    resp = client.post(
        url,
        data=json.dumps({"title": "  ", "content": "x"}),
        content_type="application/json",
    )
    assert resp.status_code == 400


def test_chat_save_as_note_requires_login(client):
    """chat_save_as_note returns 403 for unauthenticated requests."""
    url = urls.reverse("blob:chat_save_as_note")
    resp = client.post(
        url,
        data=json.dumps({"title": "x", "content": "y"}),
        content_type="application/json",
    )
    assert resp.status_code == 403
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
.venv/bin/python -m pytest bordercore/blob/tests/test_views.py -k chat_save_as_note -v
```

Expected: 3 FAILED with `NoReverseMatch`.

- [ ] **Step 3: Add the URL route**

In `bordercore/blob/urls.py`, immediately after the new `chat_followups` route, insert:

```python
    path(
        route="chat/save_as_note",
        view=views.chat_save_as_note,
        name="chat_save_as_note"
    ),
```

- [ ] **Step 4: Add the view**

First check imports:

```bash
grep -n "^from\|^import" bordercore/blob/views.py | head -30
```

In `bordercore/blob/views.py`, immediately after the new `chat_followups` view, add:

```python
@api_view(["POST"])
def chat_save_as_note(request: Request) -> Response:
    """Create a note-typed Blob from a chatbot assistant reply.

    Body: { title: str, tags: str (comma-separated, optional), content: str }
    Returns: { uuid: str, url: str }
    """
    user = cast(User, request.user)
    title = (request.data.get("title") or "").strip()
    content = request.data.get("content") or ""
    tags_raw = request.data.get("tags") or ""

    if not title:
        return Response(
            {"error": "title is required"},
            status=HTTPStatus.BAD_REQUEST,
        )

    blob = Blob.objects.create(
        user=user,
        name=title,
        content=content,
        is_note=True,
    )

    tag_names = [t.strip() for t in tags_raw.split(",") if t.strip()]
    for tag_name in tag_names:
        blob.tags.add(tag_name)

    return Response({
        "uuid": str(blob.uuid),
        "url": reverse("blob:detail", kwargs={"uuid": blob.uuid}),
    })
```

If any of `cast`, `User`, `Blob`, `reverse`, `HTTPStatus` are not yet imported in this file, add them (most likely already there — `cast`/`User` are used elsewhere; `Blob` and `reverse` almost certainly imported; `HTTPStatus` is used by other views per the existing code).

- [ ] **Step 5: Run tests to verify they pass**

```bash
.venv/bin/python -m pytest bordercore/blob/tests/test_views.py -k chat_save_as_note -v
```

Expected: 3 PASSED.

- [ ] **Step 6: Commit**

```bash
script -qc "git add bordercore/blob/views.py bordercore/blob/urls.py bordercore/blob/tests/test_views.py && git commit -m 'Add chat_save_as_note view for inline note creation'" /dev/null
```

---

## Phase B — Frontend foundations (Tasks 4–6)

### Task 4: Add `dompurify` dependency

**Files:**
- Modify: `bordercore/package.json` (via npm install)

- [ ] **Step 1: Install dompurify and types**

```bash
cd /home/jerrell/dev/django/bordercore/bordercore
npm install dompurify
npm install -D @types/dompurify
```

- [ ] **Step 2: Verify install**

```bash
node -e "console.log(require('dompurify/package.json').version)"
```

Expected: prints a version like `3.x.x`.

- [ ] **Step 3: Commit**

```bash
script -qc "git add bordercore/package.json bordercore/package-lock.json && git commit -m 'Add dompurify dependency for chatbot markdown sanitization'" /dev/null
```

---

### Task 5: Create chatbot directory + `types.ts` + `storage.ts`

**Files:**
- Create: `bordercore/front-end/react/chatbot/types.ts`
- Create: `bordercore/front-end/react/chatbot/storage.ts`
- Create: `bordercore/front-end/react/chatbot/storage.test.ts`

- [ ] **Step 1: Create the types file**

Create `bordercore/front-end/react/chatbot/types.ts`:

```ts
export type ChatRole = "system" | "user" | "assistant";

export interface ChatMessage {
  id: number;
  content: string;
  role: ChatRole;
}

export type ChatMode = "chat" | "notes" | "blob" | "question" | "exercise";

export interface ChatBotPersistedUI {
  pinned: boolean;
  pinnedWidth: number;
}
```

- [ ] **Step 2: Write the failing test for storage**

Create `bordercore/front-end/react/chatbot/storage.test.ts`:

```ts
import { describe, expect, it, beforeEach } from "vitest";
import { loadUiState, saveUiState, DEFAULT_UI_STATE } from "./storage";

describe("chatbot storage", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("returns defaults when nothing is stored", () => {
    expect(loadUiState()).toEqual(DEFAULT_UI_STATE);
  });

  it("returns defaults when stored value is unparseable JSON", () => {
    window.localStorage.setItem("bordercore.chatbot.ui", "{not json");
    expect(loadUiState()).toEqual(DEFAULT_UI_STATE);
  });

  it("merges stored partial state over defaults", () => {
    window.localStorage.setItem(
      "bordercore.chatbot.ui",
      JSON.stringify({ pinned: true })
    );
    expect(loadUiState()).toEqual({
      pinned: true,
      pinnedWidth: DEFAULT_UI_STATE.pinnedWidth,
    });
  });

  it("clamps pinnedWidth to [300, 600] on load", () => {
    window.localStorage.setItem(
      "bordercore.chatbot.ui",
      JSON.stringify({ pinned: true, pinnedWidth: 99 })
    );
    expect(loadUiState().pinnedWidth).toBe(300);

    window.localStorage.setItem(
      "bordercore.chatbot.ui",
      JSON.stringify({ pinned: true, pinnedWidth: 9999 })
    );
    expect(loadUiState().pinnedWidth).toBe(600);
  });

  it("saves state and reads it back round-trip", () => {
    saveUiState({ pinned: true, pinnedWidth: 420 });
    expect(loadUiState()).toEqual({ pinned: true, pinnedWidth: 420 });
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

```bash
cd /home/jerrell/dev/django/bordercore/bordercore
npx vitest run front-end/react/chatbot/storage.test.ts
```

Expected: FAIL with `Cannot find module './storage'`.

- [ ] **Step 4: Implement storage.ts**

Create `bordercore/front-end/react/chatbot/storage.ts`:

```ts
import type { ChatBotPersistedUI } from "./types";

const KEY = "bordercore.chatbot.ui";

export const DEFAULT_UI_STATE: ChatBotPersistedUI = {
  pinned: false,
  pinnedWidth: 360,
};

const MIN_WIDTH = 300;
const MAX_WIDTH = 600;

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

export function loadUiState(): ChatBotPersistedUI {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULT_UI_STATE;
    const parsed = JSON.parse(raw) as Partial<ChatBotPersistedUI>;
    return {
      pinned: typeof parsed.pinned === "boolean" ? parsed.pinned : DEFAULT_UI_STATE.pinned,
      pinnedWidth: clamp(
        typeof parsed.pinnedWidth === "number" ? parsed.pinnedWidth : DEFAULT_UI_STATE.pinnedWidth,
        MIN_WIDTH,
        MAX_WIDTH
      ),
    };
  } catch {
    return DEFAULT_UI_STATE;
  }
}

export function saveUiState(state: ChatBotPersistedUI): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // ignore quota / privacy-mode errors
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
npx vitest run front-end/react/chatbot/storage.test.ts
```

Expected: 5 PASS.

- [ ] **Step 6: Commit**

```bash
script -qc "git add bordercore/front-end/react/chatbot/types.ts bordercore/front-end/react/chatbot/storage.ts bordercore/front-end/react/chatbot/storage.test.ts && git commit -m 'Add chatbot types and localStorage helpers'" /dev/null
```

---

### Task 6: Create `markdown.ts` (markdown-it + hljs + DOMPurify) and `SanitizedHtml.tsx`

**Files:**
- Create: `bordercore/front-end/react/chatbot/markdown.ts`
- Create: `bordercore/front-end/react/chatbot/markdown.test.ts`
- Create: `bordercore/front-end/react/chatbot/SanitizedHtml.tsx`

The `SanitizedHtml` wrapper exists so the rest of the chatbot codebase never directly mounts raw HTML — all HTML injection in the chatbot goes through this single, audited spot. It receives pre-sanitized HTML from `markdown.ts` (which runs DOMPurify) and parses it into a `DocumentFragment` before mounting. No callers need to know about React's raw-HTML escape hatches.

- [ ] **Step 1: Write the failing tests for markdown**

Create `bordercore/front-end/react/chatbot/markdown.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { renderMarkdown } from "./markdown";

describe("chatbot markdown", () => {
  it("renders basic markdown", () => {
    const html = renderMarkdown("**bold** and *italic*");
    expect(html).toContain("<strong>bold</strong>");
    expect(html).toContain("<em>italic</em>");
  });

  it("highlights python code blocks", () => {
    const html = renderMarkdown("```python\ndef hi():\n    return 1\n```");
    expect(html).toContain("hljs");
    expect(html).toContain("language-python");
  });

  it("highlights javascript code blocks", () => {
    const html = renderMarkdown("```javascript\nconst x = 1;\n```");
    expect(html).toContain("hljs");
    expect(html).toContain("language-javascript");
  });

  it("falls back to plaintext for unknown languages", () => {
    const html = renderMarkdown("```rust\nfn main() {}\n```");
    expect(html).toContain("<pre");
    expect(html).toContain("<code");
  });

  it("strips raw script tags", () => {
    const html = renderMarkdown("<script>alert(1)</script>hello");
    expect(html).not.toContain("<script");
    expect(html).toContain("hello");
  });

  it("strips javascript: hrefs", () => {
    const html = renderMarkdown('<a href="javascript:alert(1)">x</a>');
    expect(html).not.toMatch(/href=["']javascript:/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run front-end/react/chatbot/markdown.test.ts
```

Expected: FAIL with `Cannot find module './markdown'`.

- [ ] **Step 3: Implement markdown.ts**

Create `bordercore/front-end/react/chatbot/markdown.ts`:

```ts
import MarkdownIt from "markdown-it";
import DOMPurify from "dompurify";
import hljs from "highlight.js/lib/core";

import python from "highlight.js/lib/languages/python";
import javascript from "highlight.js/lib/languages/javascript";
import typescript from "highlight.js/lib/languages/typescript";
import bash from "highlight.js/lib/languages/bash";
import sql from "highlight.js/lib/languages/sql";
import json from "highlight.js/lib/languages/json";
import yaml from "highlight.js/lib/languages/yaml";
import xml from "highlight.js/lib/languages/xml";
import css from "highlight.js/lib/languages/css";

hljs.registerLanguage("python", python);
hljs.registerLanguage("javascript", javascript);
hljs.registerLanguage("js", javascript);
hljs.registerLanguage("typescript", typescript);
hljs.registerLanguage("ts", typescript);
hljs.registerLanguage("bash", bash);
hljs.registerLanguage("sh", bash);
hljs.registerLanguage("sql", sql);
hljs.registerLanguage("json", json);
hljs.registerLanguage("yaml", yaml);
hljs.registerLanguage("yml", yaml);
hljs.registerLanguage("html", xml);
hljs.registerLanguage("xml", xml);
hljs.registerLanguage("css", css);

const SUPPORTED_LANGS = new Set([
  "python", "javascript", "js", "typescript", "ts",
  "bash", "sh", "sql", "json", "yaml", "yml",
  "html", "xml", "css",
]);

const md = MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
  highlight: (str, lang) => {
    const language = SUPPORTED_LANGS.has(lang) ? lang : null;
    if (language) {
      try {
        return `<pre class="hljs"><code class="language-${language}">${
          hljs.highlight(str, { language, ignoreIllegals: true }).value
        }</code></pre>`;
      } catch {
        // fall through to plain
      }
    }
    return `<pre class="hljs"><code>${md.utils.escapeHtml(str)}</code></pre>`;
  },
});

const PURIFY_CONFIG = {
  ADD_ATTR: ["target"],
  FORBID_TAGS: ["script", "style", "iframe", "object", "embed"],
  FORBID_ATTR: ["onerror", "onload", "onclick"],
};

export function renderMarkdown(source: string): string {
  const raw = md.render(source);
  return DOMPurify.sanitize(raw, PURIFY_CONFIG);
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run front-end/react/chatbot/markdown.test.ts
```

Expected: 6 PASS.

- [ ] **Step 5: Implement SanitizedHtml.tsx**

Create `bordercore/front-end/react/chatbot/SanitizedHtml.tsx`:

```tsx
import React, { useEffect, useRef } from "react";

// Mounts pre-sanitized HTML by parsing it into a DocumentFragment via
// Range.createContextualFragment, then appending. The caller is responsible
// for sanitizing — in the chatbot that happens in markdown.ts via DOMPurify
// before any string ever reaches this component.
//
// Why a wrapper at all? Routing every HTML mount through one named component
// makes the trust boundary obvious — there is exactly one place in the
// chatbot directory that writes raw HTML to the DOM, and it has a name you
// can grep for.
interface SanitizedHtmlProps {
  html: string;
  className?: string;
}

export function SanitizedHtml({ html, className }: SanitizedHtmlProps) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    while (node.firstChild) node.removeChild(node.firstChild);
    const range = document.createRange();
    const fragment = range.createContextualFragment(html);
    node.appendChild(fragment);
  }, [html]);
  return <span ref={ref} className={className} />;
}

export default SanitizedHtml;
```

- [ ] **Step 6: Verify SanitizedHtml compiles**

```bash
npx tsc --noEmit
```

Expected: no errors related to `SanitizedHtml.tsx`.

- [ ] **Step 7: Commit**

```bash
script -qc "git add bordercore/front-end/react/chatbot/markdown.ts bordercore/front-end/react/chatbot/markdown.test.ts bordercore/front-end/react/chatbot/SanitizedHtml.tsx && git commit -m 'Add markdown renderer and SanitizedHtml wrapper'" /dev/null
```

---

## Phase C — Leaf components (Tasks 7–11)

### Task 7: ModeChips component

**Files:**
- Create: `bordercore/front-end/react/chatbot/ModeChips.tsx`
- Create: `bordercore/front-end/react/chatbot/ModeChips.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `bordercore/front-end/react/chatbot/ModeChips.test.tsx`:

```tsx
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ModeChips } from "./ModeChips";

describe("ModeChips", () => {
  it("renders only chat and notes when no blob context", () => {
    render(<ModeChips mode="chat" hasBlobContext={false} onChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: "chat" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "notes" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "blob" })).not.toBeInTheDocument();
  });

  it("renders blob chip when hasBlobContext is true", () => {
    render(<ModeChips mode="chat" hasBlobContext={true} onChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: "blob" })).toBeInTheDocument();
  });

  it("marks the active mode chip as active", () => {
    render(<ModeChips mode="notes" hasBlobContext={false} onChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: "notes" })).toHaveClass(
      "chatbot-mode-chip--active"
    );
  });

  it("calls onChange with the clicked mode", async () => {
    const onChange = vi.fn();
    render(<ModeChips mode="chat" hasBlobContext={false} onChange={onChange} />);
    await userEvent.click(screen.getByRole("button", { name: "notes" }));
    expect(onChange).toHaveBeenCalledWith("notes");
  });

  it("renders a non-clickable indicator chip for question mode", () => {
    render(<ModeChips mode="question" hasBlobContext={false} onChange={vi.fn()} />);
    const chip = screen.getByText("question");
    expect(chip.tagName).toBe("SPAN");
  });

  it("renders a non-clickable indicator chip for exercise mode", () => {
    render(<ModeChips mode="exercise" hasBlobContext={false} onChange={vi.fn()} />);
    const chip = screen.getByText("exercise");
    expect(chip.tagName).toBe("SPAN");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run front-end/react/chatbot/ModeChips.test.tsx
```

Expected: FAIL with `Cannot find module './ModeChips'`.

- [ ] **Step 3: Implement ModeChips.tsx**

Create `bordercore/front-end/react/chatbot/ModeChips.tsx`:

```tsx
import React from "react";
import type { ChatMode } from "./types";

interface ModeChipsProps {
  mode: ChatMode;
  hasBlobContext: boolean;
  onChange: (mode: ChatMode) => void;
}

const SELECTABLE_MODES: ChatMode[] = ["chat", "notes", "blob"];

export function ModeChips({ mode, hasBlobContext, onChange }: ModeChipsProps) {
  // question / exercise are set by event payload, never user-selectable.
  // Render as a non-clickable indicator when active.
  if (mode === "question" || mode === "exercise") {
    return (
      <div className="chatbot-mode-chips">
        <span className="chatbot-mode-chip chatbot-mode-chip--active chatbot-mode-chip--readonly">
          {mode}
        </span>
      </div>
    );
  }

  const visible = SELECTABLE_MODES.filter(m => m !== "blob" || hasBlobContext);

  return (
    <div className="chatbot-mode-chips" role="group" aria-label="chat mode">
      {visible.map(m => (
        <button
          key={m}
          type="button"
          className={
            "chatbot-mode-chip" + (m === mode ? " chatbot-mode-chip--active" : "")
          }
          onClick={() => onChange(m)}
        >
          {m}
        </button>
      ))}
    </div>
  );
}

export default ModeChips;
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run front-end/react/chatbot/ModeChips.test.tsx
```

Expected: 6 PASS.

- [ ] **Step 5: Commit**

```bash
script -qc "git add bordercore/front-end/react/chatbot/ModeChips.tsx bordercore/front-end/react/chatbot/ModeChips.test.tsx && git commit -m 'Add ModeChips component'" /dev/null
```

---

### Task 8: ChatInput component

**Files:**
- Create: `bordercore/front-end/react/chatbot/ChatInput.tsx`
- Create: `bordercore/front-end/react/chatbot/ChatInput.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `bordercore/front-end/react/chatbot/ChatInput.test.tsx`:

```tsx
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChatInput } from "./ChatInput";

const baseProps = {
  value: "",
  onChange: vi.fn(),
  onSend: vi.fn(),
  onStop: vi.fn(),
  onEscape: vi.fn(),
  isStreaming: false,
};

describe("ChatInput", () => {
  it("renders the textarea with placeholder", () => {
    render(<ChatInput {...baseProps} />);
    const textarea = screen.getByPlaceholderText(/ask anything/i);
    expect(textarea).toBeInTheDocument();
    expect(textarea.tagName).toBe("TEXTAREA");
  });

  it("calls onChange when typing", async () => {
    const onChange = vi.fn();
    render(<ChatInput {...baseProps} onChange={onChange} />);
    await userEvent.type(screen.getByRole("textbox"), "hi");
    expect(onChange).toHaveBeenCalled();
  });

  it("calls onSend when Enter is pressed", async () => {
    const onSend = vi.fn();
    render(<ChatInput {...baseProps} value="hello" onSend={onSend} />);
    const textarea = screen.getByRole("textbox");
    textarea.focus();
    await userEvent.keyboard("{Enter}");
    expect(onSend).toHaveBeenCalledTimes(1);
  });

  it("does NOT call onSend when Shift+Enter is pressed", async () => {
    const onSend = vi.fn();
    render(<ChatInput {...baseProps} value="hello" onSend={onSend} />);
    const textarea = screen.getByRole("textbox");
    textarea.focus();
    await userEvent.keyboard("{Shift>}{Enter}{/Shift}");
    expect(onSend).not.toHaveBeenCalled();
  });

  it("calls onEscape when Escape is pressed", async () => {
    const onEscape = vi.fn();
    render(<ChatInput {...baseProps} onEscape={onEscape} />);
    const textarea = screen.getByRole("textbox");
    textarea.focus();
    await userEvent.keyboard("{Escape}");
    expect(onEscape).toHaveBeenCalledTimes(1);
  });

  it("shows the stop button when isStreaming is true", () => {
    render(<ChatInput {...baseProps} isStreaming={true} />);
    expect(screen.getByRole("button", { name: /stop/i })).toBeInTheDocument();
  });

  it("does not show the stop button when isStreaming is false", () => {
    render(<ChatInput {...baseProps} isStreaming={false} />);
    expect(screen.queryByRole("button", { name: /stop/i })).not.toBeInTheDocument();
  });

  it("calls onStop when stop button is clicked", async () => {
    const onStop = vi.fn();
    render(<ChatInput {...baseProps} isStreaming={true} onStop={onStop} />);
    await userEvent.click(screen.getByRole("button", { name: /stop/i }));
    expect(onStop).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run front-end/react/chatbot/ChatInput.test.tsx
```

Expected: FAIL with `Cannot find module './ChatInput'`.

- [ ] **Step 3: Implement ChatInput.tsx**

Create `bordercore/front-end/react/chatbot/ChatInput.tsx`:

```tsx
import React, { useEffect, useRef } from "react";

interface ChatInputProps {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  onStop: () => void;
  onEscape: () => void;
  isStreaming: boolean;
  autoFocus?: boolean;
}

const MIN_ROWS = 1;
const MAX_ROWS = 6;

export function ChatInput({
  value, onChange, onSend, onStop, onEscape, isStreaming, autoFocus,
}: ChatInputProps) {
  const ref = useRef<HTMLTextAreaElement>(null);

  // Auto-grow the textarea between MIN_ROWS and MAX_ROWS rows.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    const lineHeight = parseFloat(getComputedStyle(el).lineHeight) || 20;
    const max = lineHeight * MAX_ROWS;
    el.style.height = Math.min(el.scrollHeight, max) + "px";
  }, [value]);

  useEffect(() => {
    if (autoFocus) ref.current?.focus();
  }, [autoFocus]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSend();
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      onEscape();
    }
  };

  return (
    <div className="chatbot-input-area">
      <textarea
        ref={ref}
        className="chatbot-input"
        rows={MIN_ROWS}
        placeholder="ask anything…  (shift-↵ for newline)"
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
      />
      <div className="chatbot-keyboard-hints">
        <span>
          <kbd>↵</kbd> send <kbd>⇧↵</kbd> newline <kbd>esc</kbd> close
        </span>
        {isStreaming && (
          <button type="button" className="chatbot-stop-btn" onClick={onStop}>
            ■ stop
          </button>
        )}
      </div>
    </div>
  );
}

export default ChatInput;
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run front-end/react/chatbot/ChatInput.test.tsx
```

Expected: 8 PASS.

- [ ] **Step 5: Commit**

```bash
script -qc "git add bordercore/front-end/react/chatbot/ChatInput.tsx bordercore/front-end/react/chatbot/ChatInput.test.tsx && git commit -m 'Add ChatInput component with auto-grow and stop button'" /dev/null
```

---

### Task 9: MessageActions component

**Files:**
- Create: `bordercore/front-end/react/chatbot/MessageActions.tsx`
- Create: `bordercore/front-end/react/chatbot/MessageActions.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `bordercore/front-end/react/chatbot/MessageActions.test.tsx`:

```tsx
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MessageActions } from "./MessageActions";

beforeEach(() => {
  Object.assign(navigator, {
    clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
  });
});

describe("MessageActions", () => {
  it("renders only copy for user messages", () => {
    render(
      <MessageActions
        role="user"
        content="hi"
        canRegenerate={false}
        onRegenerate={vi.fn()}
        onSaveAsNote={vi.fn()}
      />
    );
    expect(screen.getByRole("button", { name: /copy/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /regenerate/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /save/i })).not.toBeInTheDocument();
  });

  it("renders all actions for assistant messages when canRegenerate is true", () => {
    render(
      <MessageActions
        role="assistant"
        content="hi"
        canRegenerate={true}
        onRegenerate={vi.fn()}
        onSaveAsNote={vi.fn()}
      />
    );
    expect(screen.getByRole("button", { name: /copy/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /regenerate/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /save as note/i })).toBeInTheDocument();
  });

  it("hides regenerate when canRegenerate is false", () => {
    render(
      <MessageActions
        role="assistant"
        content="hi"
        canRegenerate={false}
        onRegenerate={vi.fn()}
        onSaveAsNote={vi.fn()}
      />
    );
    expect(screen.queryByRole("button", { name: /regenerate/i })).not.toBeInTheDocument();
  });

  it("copies content to clipboard and shows confirmation", async () => {
    render(
      <MessageActions
        role="assistant"
        content="copied!"
        canRegenerate={true}
        onRegenerate={vi.fn()}
        onSaveAsNote={vi.fn()}
      />
    );
    await userEvent.click(screen.getByRole("button", { name: /copy/i }));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("copied!");
    expect(screen.getByText(/copied/i)).toBeInTheDocument();
  });

  it("calls onRegenerate when regenerate is clicked", async () => {
    const onRegenerate = vi.fn();
    render(
      <MessageActions
        role="assistant"
        content="x"
        canRegenerate={true}
        onRegenerate={onRegenerate}
        onSaveAsNote={vi.fn()}
      />
    );
    await userEvent.click(screen.getByRole("button", { name: /regenerate/i }));
    expect(onRegenerate).toHaveBeenCalled();
  });

  it("calls onSaveAsNote when save is clicked", async () => {
    const onSaveAsNote = vi.fn();
    render(
      <MessageActions
        role="assistant"
        content="x"
        canRegenerate={true}
        onRegenerate={vi.fn()}
        onSaveAsNote={onSaveAsNote}
      />
    );
    await userEvent.click(screen.getByRole("button", { name: /save as note/i }));
    expect(onSaveAsNote).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run front-end/react/chatbot/MessageActions.test.tsx
```

Expected: FAIL with `Cannot find module './MessageActions'`.

- [ ] **Step 3: Implement MessageActions.tsx**

Create `bordercore/front-end/react/chatbot/MessageActions.tsx`:

```tsx
import React, { useState } from "react";
import type { ChatRole } from "./types";

interface MessageActionsProps {
  role: ChatRole;
  content: string;
  canRegenerate: boolean;
  onRegenerate: () => void;
  onSaveAsNote: () => void;
}

export function MessageActions({
  role, content, canRegenerate, onRegenerate, onSaveAsNote,
}: MessageActionsProps) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1000);
    } catch {
      // ignore
    }
  };

  return (
    <div className="chatbot-message-actions">
      <button type="button" className="chatbot-action-btn" onClick={copy}>
        {copied ? "✓ copied" : "⧉ copy"}
      </button>
      {role === "assistant" && canRegenerate && (
        <button type="button" className="chatbot-action-btn" onClick={onRegenerate}>
          ↻ regenerate
        </button>
      )}
      {role === "assistant" && (
        <button type="button" className="chatbot-action-btn" onClick={onSaveAsNote}>
          📑 save as note
        </button>
      )}
    </div>
  );
}

export default MessageActions;
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run front-end/react/chatbot/MessageActions.test.tsx
```

Expected: 6 PASS.

- [ ] **Step 5: Commit**

```bash
script -qc "git add bordercore/front-end/react/chatbot/MessageActions.tsx bordercore/front-end/react/chatbot/MessageActions.test.tsx && git commit -m 'Add MessageActions component'" /dev/null
```

---

### Task 10: SaveAsNoteForm component

**Files:**
- Create: `bordercore/front-end/react/chatbot/SaveAsNoteForm.tsx`
- Create: `bordercore/front-end/react/chatbot/SaveAsNoteForm.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `bordercore/front-end/react/chatbot/SaveAsNoteForm.test.tsx`:

```tsx
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SaveAsNoteForm } from "./SaveAsNoteForm";

const baseProps = {
  defaultTitle: "default title",
  onSave: vi.fn(),
  onCancel: vi.fn(),
};

describe("SaveAsNoteForm", () => {
  it("autofills the title from defaultTitle", () => {
    render(<SaveAsNoteForm {...baseProps} />);
    const titleInput = screen.getByLabelText(/title/i) as HTMLInputElement;
    expect(titleInput.value).toBe("default title");
  });

  it("calls onSave with title and tags on submit", async () => {
    const onSave = vi.fn();
    render(<SaveAsNoteForm {...baseProps} onSave={onSave} />);

    const titleInput = screen.getByLabelText(/title/i);
    await userEvent.clear(titleInput);
    await userEvent.type(titleInput, "my note");

    const tagsInput = screen.getByLabelText(/tags/i);
    await userEvent.type(tagsInput, "ai, foo");

    await userEvent.click(screen.getByRole("button", { name: /save/i }));

    expect(onSave).toHaveBeenCalledWith({ title: "my note", tags: "ai, foo" });
  });

  it("does not call onSave when title is empty", async () => {
    const onSave = vi.fn();
    render(<SaveAsNoteForm {...baseProps} defaultTitle="" onSave={onSave} />);

    await userEvent.click(screen.getByRole("button", { name: /save/i }));

    expect(onSave).not.toHaveBeenCalled();
  });

  it("calls onCancel when cancel is clicked", async () => {
    const onCancel = vi.fn();
    render(<SaveAsNoteForm {...baseProps} onCancel={onCancel} />);
    await userEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalled();
  });

  it("calls onCancel on Escape", async () => {
    const onCancel = vi.fn();
    render(<SaveAsNoteForm {...baseProps} onCancel={onCancel} />);
    const titleInput = screen.getByLabelText(/title/i);
    titleInput.focus();
    await userEvent.keyboard("{Escape}");
    expect(onCancel).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run front-end/react/chatbot/SaveAsNoteForm.test.tsx
```

Expected: FAIL with `Cannot find module './SaveAsNoteForm'`.

- [ ] **Step 3: Implement SaveAsNoteForm.tsx**

Create `bordercore/front-end/react/chatbot/SaveAsNoteForm.tsx`:

```tsx
import React, { useEffect, useRef, useState } from "react";

interface SaveAsNoteFormProps {
  defaultTitle: string;
  onSave: (data: { title: string; tags: string }) => void;
  onCancel: () => void;
}

export function SaveAsNoteForm({ defaultTitle, onSave, onCancel }: SaveAsNoteFormProps) {
  const [title, setTitle] = useState(defaultTitle);
  const [tags, setTags] = useState("");
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    titleRef.current?.focus();
    titleRef.current?.select();
  }, []);

  const submit = () => {
    if (!title.trim()) return;
    onSave({ title: title.trim(), tags });
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      submit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      onCancel();
    }
  };

  return (
    <div className="chatbot-save-as-note" onKeyDown={handleKey}>
      <div className="chatbot-save-field">
        <label htmlFor="chatbot-save-title">title</label>
        <input
          ref={titleRef}
          id="chatbot-save-title"
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
        />
      </div>
      <div className="chatbot-save-field">
        <label htmlFor="chatbot-save-tags">tags <span className="optional">· optional</span></label>
        <input
          id="chatbot-save-tags"
          type="text"
          placeholder="comma-separated"
          value={tags}
          onChange={e => setTags(e.target.value)}
        />
      </div>
      <div className="chatbot-save-actions">
        <button type="button" className="chatbot-action-btn" onClick={onCancel}>cancel</button>
        <button type="button" className="chatbot-action-btn chatbot-action-btn--primary" onClick={submit}>
          save <span className="kbd">⏎</span>
        </button>
      </div>
    </div>
  );
}

export default SaveAsNoteForm;
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run front-end/react/chatbot/SaveAsNoteForm.test.tsx
```

Expected: 5 PASS.

- [ ] **Step 5: Commit**

```bash
script -qc "git add bordercore/front-end/react/chatbot/SaveAsNoteForm.tsx bordercore/front-end/react/chatbot/SaveAsNoteForm.test.tsx && git commit -m 'Add SaveAsNoteForm inline strip'" /dev/null
```

---

### Task 11: FollowUps component

**Files:**
- Create: `bordercore/front-end/react/chatbot/FollowUps.tsx`
- Create: `bordercore/front-end/react/chatbot/FollowUps.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `bordercore/front-end/react/chatbot/FollowUps.test.tsx`:

```tsx
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FollowUps } from "./FollowUps";

describe("FollowUps", () => {
  it("renders nothing when suggestions is empty", () => {
    const { container } = render(<FollowUps suggestions={[]} onSelect={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders one button per suggestion", () => {
    render(<FollowUps suggestions={["a", "b", "c"]} onSelect={vi.fn()} />);
    expect(screen.getAllByRole("button")).toHaveLength(3);
  });

  it("calls onSelect with the clicked suggestion", async () => {
    const onSelect = vi.fn();
    render(<FollowUps suggestions={["explain", "elaborate"]} onSelect={onSelect} />);
    await userEvent.click(screen.getByRole("button", { name: "explain" }));
    expect(onSelect).toHaveBeenCalledWith("explain");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run front-end/react/chatbot/FollowUps.test.tsx
```

Expected: FAIL with `Cannot find module './FollowUps'`.

- [ ] **Step 3: Implement FollowUps.tsx**

Create `bordercore/front-end/react/chatbot/FollowUps.tsx`:

```tsx
import React from "react";

interface FollowUpsProps {
  suggestions: string[];
  onSelect: (text: string) => void;
}

export function FollowUps({ suggestions, onSelect }: FollowUpsProps) {
  if (suggestions.length === 0) return null;
  return (
    <div className="chatbot-followups">
      {suggestions.map((s, i) => (
        <button
          key={i}
          type="button"
          className="chatbot-followup-chip"
          onClick={() => onSelect(s)}
        >
          {s}
        </button>
      ))}
    </div>
  );
}

export default FollowUps;
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run front-end/react/chatbot/FollowUps.test.tsx
```

Expected: 3 PASS.

- [ ] **Step 5: Commit**

```bash
script -qc "git add bordercore/front-end/react/chatbot/FollowUps.tsx bordercore/front-end/react/chatbot/FollowUps.test.tsx && git commit -m 'Add FollowUps suggestion chip component'" /dev/null
```

---

## Phase D — Composite components (Tasks 12–14)

### Task 12: Message component

**Files:**
- Create: `bordercore/front-end/react/chatbot/Message.tsx`

- [ ] **Step 1: Implement Message.tsx**

Create `bordercore/front-end/react/chatbot/Message.tsx`:

```tsx
import React, { useMemo } from "react";
import type { ChatMessage } from "./types";
import { renderMarkdown } from "./markdown";
import { SanitizedHtml } from "./SanitizedHtml";
import { MessageActions } from "./MessageActions";
import { SaveAsNoteForm } from "./SaveAsNoteForm";
import { FollowUps } from "./FollowUps";

interface MessageProps {
  message: ChatMessage;
  isLastAssistant: boolean;
  isStreaming: boolean;
  followups: string[];
  saveFormOpen: boolean;
  onRegenerate: () => void;
  onOpenSaveForm: () => void;
  onCancelSaveForm: () => void;
  onSaveAsNote: (data: { title: string; tags: string }) => void;
  onSelectFollowUp: (text: string) => void;
}

function summarize(text: string): string {
  // First sentence, truncated to 80 chars.
  const firstSentence = text.split(/[.!?]\s/)[0] || text;
  return firstSentence.slice(0, 80).trim();
}

export function Message({
  message, isLastAssistant, isStreaming,
  followups, saveFormOpen,
  onRegenerate, onOpenSaveForm, onCancelSaveForm, onSaveAsNote, onSelectFollowUp,
}: MessageProps) {
  const html = useMemo(() => renderMarkdown(message.content), [message.content]);

  const showCursor = isLastAssistant && isStreaming;
  const isAssistant = message.role === "assistant";

  return (
    <div className={`chatbot-message chatbot-message--${message.role}`}>
      <div className="chatbot-message-who">{message.role === "user" ? "you" : "ai"}</div>
      <div className="chatbot-message-text">
        <SanitizedHtml html={html} />
        {showCursor && <span className="chatbot-cursor" />}
      </div>
      {message.content && (
        <MessageActions
          role={message.role}
          content={message.content}
          canRegenerate={isAssistant && isLastAssistant && !isStreaming}
          onRegenerate={onRegenerate}
          onSaveAsNote={onOpenSaveForm}
        />
      )}
      {saveFormOpen && (
        <SaveAsNoteForm
          defaultTitle={summarize(message.content)}
          onSave={onSaveAsNote}
          onCancel={onCancelSaveForm}
        />
      )}
      {isAssistant && isLastAssistant && !isStreaming && (
        <FollowUps suggestions={followups} onSelect={onSelectFollowUp} />
      )}
    </div>
  );
}

export default Message;
```

- [ ] **Step 2: Verify file compiles**

```bash
cd /home/jerrell/dev/django/bordercore/bordercore
npx tsc --noEmit
```

Expected: no errors related to `Message.tsx`. (Pre-existing errors elsewhere are out of scope.)

- [ ] **Step 3: Commit**

```bash
script -qc "git add bordercore/front-end/react/chatbot/Message.tsx && git commit -m 'Add Message component composing actions, save form, follow-ups'" /dev/null
```

---

### Task 13: MessageList component

**Files:**
- Create: `bordercore/front-end/react/chatbot/MessageList.tsx`

- [ ] **Step 1: Implement MessageList.tsx**

Create `bordercore/front-end/react/chatbot/MessageList.tsx`:

```tsx
import React, { useEffect, useRef } from "react";
import type { ChatMessage } from "./types";
import { Message } from "./Message";

interface MessageListProps {
  messages: ChatMessage[];
  isStreaming: boolean;
  followups: string[];
  saveFormOpenForId: number | null;
  onRegenerate: () => void;
  onOpenSaveForm: (id: number) => void;
  onCancelSaveForm: () => void;
  onSaveAsNote: (data: { title: string; tags: string }) => void;
  onSelectFollowUp: (text: string) => void;
}

export function MessageList({
  messages, isStreaming, followups, saveFormOpenForId,
  onRegenerate, onOpenSaveForm, onCancelSaveForm, onSaveAsNote, onSelectFollowUp,
}: MessageListProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages]);

  const visible = messages.filter(m => m.role !== "system");
  const lastAssistantIdx = (() => {
    for (let i = visible.length - 1; i >= 0; i--) {
      if (visible[i].role === "assistant") return i;
    }
    return -1;
  })();

  return (
    <div className="chatbot-message-list" ref={ref}>
      {visible.map((m, i) => (
        <Message
          key={m.id}
          message={m}
          isLastAssistant={i === lastAssistantIdx}
          isStreaming={isStreaming}
          followups={i === lastAssistantIdx ? followups : []}
          saveFormOpen={saveFormOpenForId === m.id}
          onRegenerate={onRegenerate}
          onOpenSaveForm={() => onOpenSaveForm(m.id)}
          onCancelSaveForm={onCancelSaveForm}
          onSaveAsNote={onSaveAsNote}
          onSelectFollowUp={onSelectFollowUp}
        />
      ))}
    </div>
  );
}

export default MessageList;
```

- [ ] **Step 2: Verify file compiles**

```bash
npx tsc --noEmit
```

Expected: no errors related to `MessageList.tsx`.

- [ ] **Step 3: Commit**

```bash
script -qc "git add bordercore/front-end/react/chatbot/MessageList.tsx && git commit -m 'Add MessageList scroll container'" /dev/null
```

---

### Task 14: ChatBotHeader component

**Files:**
- Create: `bordercore/front-end/react/chatbot/ChatBotHeader.tsx`

- [ ] **Step 1: Implement ChatBotHeader.tsx**

Create `bordercore/front-end/react/chatbot/ChatBotHeader.tsx`:

```tsx
import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTimes, faThumbtack } from "@fortawesome/free-solid-svg-icons";

interface ChatBotHeaderProps {
  pinned: boolean;
  onClose: () => void;
  onTogglePin: () => void;
}

export function ChatBotHeader({ pinned, onClose, onTogglePin }: ChatBotHeaderProps) {
  return (
    <div className="chatbot-header">
      <div className="refined-modal-eyebrow">
        <span>chat</span>
        <span className="dot">·</span>
        <span className="mono">{pinned ? "docked" : "bordercore / assistant"}</span>
      </div>
      <button
        type="button"
        className={`chatbot-pin-btn${pinned ? " chatbot-pin-btn--active" : ""}`}
        aria-label={pinned ? "unpin" : "pin to side"}
        onClick={onTogglePin}
      >
        <FontAwesomeIcon icon={faThumbtack} />
      </button>
      <button
        type="button"
        className="refined-modal-close"
        aria-label="close"
        onClick={onClose}
      >
        <FontAwesomeIcon icon={faTimes} />
      </button>
      {!pinned && (
        <>
          <h2 className="refined-modal-title">Ask the assistant</h2>
          <p className="refined-modal-lead">
            streaming answers from your notes, blobs, or open chat.
          </p>
        </>
      )}
    </div>
  );
}

export default ChatBotHeader;
```

- [ ] **Step 2: Verify file compiles**

```bash
npx tsc --noEmit
```

Expected: no errors related to `ChatBotHeader.tsx`.

- [ ] **Step 3: Commit**

```bash
script -qc "git add bordercore/front-end/react/chatbot/ChatBotHeader.tsx && git commit -m 'Add ChatBotHeader with pin and close buttons'" /dev/null
```

---

## Phase E — Shell + main component (Tasks 15–16)

### Task 15: ChatBotShell component

**Files:**
- Create: `bordercore/front-end/react/chatbot/ChatBotShell.tsx`

- [ ] **Step 1: Implement ChatBotShell.tsx**

Create `bordercore/front-end/react/chatbot/ChatBotShell.tsx`:

```tsx
import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

interface ChatBotShellProps {
  pinned: boolean;
  pinnedWidth: number;
  onPinnedWidthChange: (w: number) => void;
  onClose: () => void;
  children: React.ReactNode;
}

const MIN_W = 300;
const MAX_W = 600;

export function ChatBotShell({
  pinned, pinnedWidth, onPinnedWidthChange, onClose, children,
}: ChatBotShellProps) {
  const draggingRef = useRef(false);

  useEffect(() => {
    if (!pinned) return;
    const onMove = (e: MouseEvent) => {
      if (!draggingRef.current) return;
      const w = window.innerWidth - e.clientX;
      onPinnedWidthChange(Math.min(MAX_W, Math.max(MIN_W, w)));
    };
    const onUp = () => {
      draggingRef.current = false;
      document.body.style.cursor = "";
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [pinned, onPinnedWidthChange]);

  const startResize = (e: React.MouseEvent) => {
    e.preventDefault();
    draggingRef.current = true;
    document.body.style.cursor = "ew-resize";
  };

  const shellStyle: React.CSSProperties = pinned
    ? { width: `${pinnedWidth}px` }
    : {};

  const className =
    "chatbot-modal" + (pinned ? " chatbot-modal--pinned" : " refined-modal");

  return createPortal(
    <>
      {!pinned && <div className="refined-modal-scrim" onClick={onClose} />}
      <div
        className={className}
        role="dialog"
        aria-modal={pinned ? "false" : "true"}
        aria-label="ask the assistant"
        style={shellStyle}
      >
        {pinned && (
          <div
            className="chatbot-resize-handle"
            onMouseDown={startResize}
            aria-hidden="true"
          />
        )}
        {children}
      </div>
    </>,
    document.body
  );
}

export default ChatBotShell;
```

- [ ] **Step 2: Verify file compiles**

```bash
npx tsc --noEmit
```

Expected: no errors related to `ChatBotShell.tsx`.

- [ ] **Step 3: Commit**

```bash
script -qc "git add bordercore/front-end/react/chatbot/ChatBotShell.tsx && git commit -m 'Add ChatBotShell with modal/pinned modes and resize handle'" /dev/null
```

---

### Task 16: ChatBot top-level component

**Files:**
- Create: `bordercore/front-end/react/chatbot/ChatBot.tsx`

- [ ] **Step 1: Implement ChatBot.tsx**

Create `bordercore/front-end/react/chatbot/ChatBot.tsx`:

```tsx
import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { ChatBotShell } from "./ChatBotShell";
import { ChatBotHeader } from "./ChatBotHeader";
import { ModeChips } from "./ModeChips";
import { MessageList } from "./MessageList";
import { ChatInput } from "./ChatInput";
import { loadUiState, saveUiState } from "./storage";
import type { ChatMessage, ChatMode } from "./types";

interface ChatBotProps {
  blobUuid?: string;
  chatUrl: string;
  followupsUrl: string;
  saveAsNoteUrl: string;
  csrfToken: string;
}

export interface ChatBotHandle {
  show: boolean;
}

const SYSTEM_MESSAGE: ChatMessage = {
  id: 1,
  content: "You are a helpful assistant.",
  role: "system",
};

export const ChatBot = forwardRef<ChatBotHandle, ChatBotProps>(function ChatBot(
  { blobUuid = "", chatUrl, followupsUrl, saveAsNoteUrl, csrfToken },
  ref
) {
  const initialUi = loadUiState();
  const [show, setShow] = useState(false);
  const [pinned, setPinned] = useState(initialUi.pinned);
  const [pinnedWidth, setPinnedWidth] = useState(initialUi.pinnedWidth);
  const [mode, setMode] = useState<ChatMode>("chat");
  const [history, setHistory] = useState<ChatMessage[]>([SYSTEM_MESSAGE]);
  const [draft, setDraft] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [followups, setFollowups] = useState<string[]>([]);
  const [saveFormOpenForId, setSaveFormOpenForId] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useImperativeHandle(ref, () => ({ show }));

  // Persist pin state on change.
  useEffect(() => {
    saveUiState({ pinned, pinnedWidth });
  }, [pinned, pinnedWidth]);

  const closeChat = useCallback(() => {
    setShow(false);
    abortRef.current?.abort();
  }, []);

  const togglePin = useCallback(() => {
    setPinned(p => !p);
  }, []);

  const sendMessage = useCallback(
    async (content: string, opts: { questionUuid?: string; exerciseUuid?: string } = {}) => {
      let payload: Record<string, string> = {};
      let nextHistory = history;
      let nextMode = mode;

      if (opts.questionUuid) {
        nextHistory = [SYSTEM_MESSAGE];
        nextMode = "question";
        payload = { question_uuid: opts.questionUuid };
      } else if (opts.exerciseUuid) {
        nextHistory = [SYSTEM_MESSAGE];
        nextMode = "exercise";
        payload = { exercise_uuid: opts.exerciseUuid };
      } else if (mode === "blob") {
        nextHistory = [SYSTEM_MESSAGE];
        payload = { content, blob_uuid: blobUuid };
      } else {
        const userMsg: ChatMessage = {
          id: history.length + 1,
          content,
          role: "user",
        };
        nextHistory = [...history, userMsg];
        payload = {
          chat_history: JSON.stringify(nextHistory),
          mode,
        };
      }

      setMode(nextMode);
      setHistory(nextHistory);
      setDraft("");
      setFollowups([]);
      setIsStreaming(true);

      const assistantMsg: ChatMessage = {
        id: nextHistory.length + 1,
        content: "",
        role: "assistant",
      };
      setHistory(prev => [...prev, assistantMsg]);

      const formData = new FormData();
      Object.entries(payload).forEach(([k, v]) => formData.append(k, v));

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const resp = await fetch(chatUrl, {
          method: "POST",
          headers: { "X-Csrftoken": csrfToken },
          body: formData,
          signal: controller.signal,
        });
        if (!resp.ok) throw new Error("network");
        const reader = resp.body?.getReader();
        if (!reader) throw new Error("no body");
        const decoder = new TextDecoder("utf-8");

        let assembledReply = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          assembledReply += chunk;
          setHistory(prev => {
            const updated = [...prev];
            const last = updated[updated.length - 1];
            if (last && last.role === "assistant") last.content += chunk;
            return updated;
          });
        }

        // Fetch follow-ups (non-blocking — fire-and-forget).
        if (assembledReply.trim().length > 0) {
          fetch(followupsUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Csrftoken": csrfToken,
            },
            body: JSON.stringify({ assistant_reply: assembledReply, mode: nextMode }),
          })
            .then(r => r.json())
            .then(data => setFollowups(data.suggestions || []))
            .catch(() => setFollowups([]));
        }
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          console.error("chat error:", err);
        }
      } finally {
        setIsStreaming(false);
        abortRef.current = null;
      }
    },
    [history, mode, blobUuid, chatUrl, followupsUrl, csrfToken]
  );

  // Listen to EventBus for Alt-C and external triggers.
  useEffect(() => {
    if (!window.EventBus) return;
    const handler = (payload: { content?: string; questionUuid?: string; exerciseUuid?: string }) => {
      // Pure toggle if no payload (Alt-C with no extras).
      if (!payload.content && !payload.questionUuid && !payload.exerciseUuid) {
        setShow(s => !s);
        return;
      }
      setShow(true);
      sendMessage(payload.content || "", payload);
    };
    window.EventBus.$on("chat", handler);
    return () => window.EventBus.$off("chat", handler);
  }, [sendMessage]);

  const handleSend = useCallback(() => {
    const text = draft.trim();
    if (!text || isStreaming) return;
    sendMessage(text);
  }, [draft, isStreaming, sendMessage]);

  const handleStop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const handleEscape = useCallback(() => {
    if (pinned) {
      // Esc unfocuses only — leave the dock open.
      (document.activeElement as HTMLElement | null)?.blur();
    } else {
      closeChat();
    }
  }, [pinned, closeChat]);

  const handleRegenerate = useCallback(() => {
    // Drop the last assistant message and re-send the previous user prompt.
    const visible = history.filter(m => m.role !== "system");
    const lastUser = [...visible].reverse().find(m => m.role === "user");
    if (!lastUser) return;
    setHistory(history.filter(
      (m, i, arr) => !(i === arr.length - 1 && m.role === "assistant")
    ));
    sendMessage(lastUser.content);
  }, [history, sendMessage]);

  const handleSaveAsNote = useCallback(
    async (data: { title: string; tags: string }) => {
      const message = history.find(m => m.id === saveFormOpenForId);
      if (!message) return;
      try {
        const resp = await fetch(saveAsNoteUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Csrftoken": csrfToken,
          },
          body: JSON.stringify({
            title: data.title,
            tags: data.tags,
            content: message.content,
          }),
        });
        if (resp.ok) {
          const body = await resp.json();
          setToast(`saved · ${body.url}`);
          window.setTimeout(() => setToast(null), 4000);
        }
      } catch {
        // ignore
      } finally {
        setSaveFormOpenForId(null);
      }
    },
    [history, saveFormOpenForId, saveAsNoteUrl, csrfToken]
  );

  if (!show) return null;

  return (
    <ChatBotShell
      pinned={pinned}
      pinnedWidth={pinnedWidth}
      onPinnedWidthChange={setPinnedWidth}
      onClose={closeChat}
    >
      <ChatBotHeader pinned={pinned} onClose={closeChat} onTogglePin={togglePin} />
      <ModeChips mode={mode} hasBlobContext={!!blobUuid} onChange={setMode} />
      <MessageList
        messages={history}
        isStreaming={isStreaming}
        followups={followups}
        saveFormOpenForId={saveFormOpenForId}
        onRegenerate={handleRegenerate}
        onOpenSaveForm={setSaveFormOpenForId}
        onCancelSaveForm={() => setSaveFormOpenForId(null)}
        onSaveAsNote={handleSaveAsNote}
        onSelectFollowUp={text => sendMessage(text)}
      />
      <ChatInput
        value={draft}
        onChange={setDraft}
        onSend={handleSend}
        onStop={handleStop}
        onEscape={handleEscape}
        isStreaming={isStreaming}
        autoFocus
      />
      {toast && <div className="chatbot-toast">{toast}</div>}
    </ChatBotShell>
  );
});

export default ChatBot;
```

- [ ] **Step 2: Verify file compiles**

```bash
npx tsc --noEmit
```

Expected: no errors related to `chatbot/ChatBot.tsx`.

- [ ] **Step 3: Commit**

```bash
script -qc "git add bordercore/front-end/react/chatbot/ChatBot.tsx && git commit -m 'Add new ChatBot top-level component with pin, abort, followups'" /dev/null
```

---

## Phase F — Wiring (Tasks 17–19)

### Task 17: Update base-react.tsx to use new ChatBot path + new props

**Files:**
- Modify: `bordercore/front-end/entries/base-react.tsx`

- [ ] **Step 1: Inspect the existing import and usage**

```bash
grep -n "ChatBot\|chatBotConfig\|chat-bot" bordercore/front-end/entries/base-react.tsx
```

Note the import line, the props passed to `<ChatBot ... />`, and the `chat-bot` mount-point reference.

- [ ] **Step 2: Update the import**

In `bordercore/front-end/entries/base-react.tsx`, find the existing import:

```tsx
import { ChatBot } from "../react/blob/ChatBot";
```

Replace it with:

```tsx
import { ChatBot } from "../react/chatbot/ChatBot";
```

- [ ] **Step 3: Add the two new props to the ChatBot render site**

Find the existing `<ChatBot ... />` render. The current props block likely looks like:

```tsx
<ChatBot
  blobUuid={chatBotConfig.blobUuid}
  chatUrl={chatBotConfig.chatUrl}
  csrfToken={chatBotConfig.csrfToken}
  ref={chatBotRef}
/>
```

Replace with:

```tsx
<ChatBot
  blobUuid={chatBotConfig.blobUuid}
  chatUrl={chatBotConfig.chatUrl}
  followupsUrl={chatBotConfig.followupsUrl}
  saveAsNoteUrl={chatBotConfig.saveAsNoteUrl}
  csrfToken={chatBotConfig.csrfToken}
  ref={chatBotRef}
/>
```

If TypeScript complains that `followupsUrl` / `saveAsNoteUrl` don't exist on `chatBotConfig`, find the type/interface for it (likely in this same file or a shared config file) and add:

```ts
followupsUrl: string;
saveAsNoteUrl: string;
```

- [ ] **Step 4: Verify it compiles**

```bash
npx tsc --noEmit
```

Expected: no errors related to `base-react.tsx`.

- [ ] **Step 5: Commit**

```bash
script -qc "git add bordercore/front-end/entries/base-react.tsx && git commit -m 'Wire base-react.tsx to new ChatBot with followups/save URLs'" /dev/null
```

---

### Task 18: Update base.html to inject the new URLs

**Files:**
- Modify: `bordercore/templates/base.html`

- [ ] **Step 1: Update the chatBotConfig block**

In `bordercore/templates/base.html`, find the existing block at line 175:

```html
chatBotConfig: {
    blobUuid: "{{ blob.uuid|default:'' }}",
    chatUrl: "{% url 'blob:chat' %}",
    csrfToken: "{{ csrf_token }}",
},
```

Replace with:

```html
chatBotConfig: {
    blobUuid: "{{ blob.uuid|default:'' }}",
    chatUrl: "{% url 'blob:chat' %}",
    followupsUrl: "{% url 'blob:chat_followups' %}",
    saveAsNoteUrl: "{% url 'blob:chat_save_as_note' %}",
    csrfToken: "{{ csrf_token }}",
},
```

- [ ] **Step 2: Commit**

```bash
script -qc "git add bordercore/templates/base.html && git commit -m 'Inject chat followups + save_as_note URLs into base template'" /dev/null
```

---

### Task 19: Add `_chatbot-modal.scss`, swap SCSS bundle import, delete old chatbot files

**Files:**
- Create: `bordercore/static/scss/components/_chatbot-modal.scss`
- Delete: `bordercore/static/scss/components/_chatbot.scss`
- Delete: `bordercore/front-end/react/blob/ChatBot.tsx`
- Modify: `bordercore/static/scss/bordercore.scss`

- [ ] **Step 1: Create _chatbot-modal.scss**

Create `bordercore/static/scss/components/_chatbot-modal.scss`:

```scss
// =============================================================================
// Chatbot modal — extends _refined-modal.scss with chat-specific styles.
// Two display modes: centered modal (default, uses .refined-modal) and
// right-docked panel (.chatbot-modal--pinned). The shell shares scrim,
// eyebrow, title, lead, and close button with refined-modal.
// =============================================================================

@keyframes chatbot-cursor-blink {
  50% { opacity: 0; }
}

@keyframes chatbot-pinned-in {
  from { transform: translateX(20px); opacity: 0; }
  to   { transform: translateX(0);    opacity: 1; }
}

@keyframes chatbot-followup-in {
  from { opacity: 0; transform: translateY(2px); }
  to   { opacity: 1; transform: translateY(0); }
}

// -----------------------------------------------------------------------------
// Modal mode — width override of refined-modal (default is 520px)
// -----------------------------------------------------------------------------
.refined-modal.chatbot-modal {
  display: flex;
  width: min(640px, calc(100vw - 40px));
  max-height: min(720px, calc(100vh - 80px));
  flex-direction: column;
  padding: 24px 24px 16px;
}

// -----------------------------------------------------------------------------
// Pinned mode — docked to right edge, no scrim, page interactive
// -----------------------------------------------------------------------------
.chatbot-modal--pinned {
  position: fixed;
  z-index: 70;
  top: 16px;
  right: 16px;
  bottom: 16px;
  display: flex;
  flex-direction: column;
  padding: 16px 18px 12px 22px;
  border: 1px solid color-mix(in oklch, var(--accent), transparent 82%);
  border-radius: 14px;
  animation: chatbot-pinned-in 160ms cubic-bezier(0.22, 1, 0.36, 1);
  backdrop-filter: blur(20px);
  background: color-mix(in oklch, var(--bg-1), transparent 4%);
  box-shadow:
    0 1px 0 0 rgb(255 255 255 / 4%) inset,
    0 20px 60px -12px rgb(0 0 0 / 70%);
  color: var(--fg-1);
  font-family: var(--font-ui);
}

// -----------------------------------------------------------------------------
// Header
// -----------------------------------------------------------------------------
.chatbot-header {
  position: relative;
  margin-bottom: 12px;
}

.chatbot-pin-btn {
  position: absolute;
  top: 0;
  right: 40px;
  display: grid;
  width: 30px;
  height: 30px;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: transparent;
  color: var(--fg-2);
  cursor: pointer;
  place-items: center;
  transition: all 120ms;
}

.chatbot-pin-btn:hover {
  background: var(--bg-2);
  color: var(--fg-1);
}

.chatbot-pin-btn--active {
  border-color: var(--accent);
  color: var(--accent);
}

// -----------------------------------------------------------------------------
// Mode chips
// -----------------------------------------------------------------------------
.chatbot-mode-chips {
  display: flex;
  flex-wrap: wrap;
  margin-bottom: 12px;
  gap: 6px;
}

.chatbot-mode-chip {
  padding: 4px 10px;
  border: 1px solid var(--line);
  border-radius: 99px;
  background: var(--bg-1);
  color: var(--fg-2);
  font-family: var(--font-ui);
  font-size: 11px;
  cursor: pointer;
  transition: all 120ms;
}

.chatbot-mode-chip:hover {
  border-color: color-mix(in oklch, var(--accent), transparent 60%);
  color: var(--fg-1);
}

.chatbot-mode-chip--active {
  border-color: var(--accent);
  background: color-mix(in oklch, var(--accent), transparent 88%);
  color: var(--accent);
}

.chatbot-mode-chip--readonly {
  cursor: default;
}

// -----------------------------------------------------------------------------
// Message list
// -----------------------------------------------------------------------------
.chatbot-message-list {
  display: flex;
  flex: 1;
  min-height: 240px;
  margin-bottom: 12px;
  padding-right: 6px;
  flex-direction: column;
  gap: 14px;
  overflow-y: auto;
}

.chatbot-modal--pinned .chatbot-message-list {
  min-height: 0;
}

.chatbot-message {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.chatbot-message-who {
  color: var(--fg-3);
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.06em;
}

.chatbot-message--user .chatbot-message-who {
  color: var(--accent);
}

.chatbot-message-text {
  color: var(--fg-1);
  font-size: 13.5px;
  line-height: 1.55;
}

.chatbot-modal--pinned .chatbot-message-text {
  font-size: 12.5px;
}

.chatbot-message-text p { margin: 0 0 8px; }
.chatbot-message-text p:last-child { margin-bottom: 0; }

.chatbot-message-text a {
  color: var(--accent);
  text-decoration: underline;
}

.chatbot-cursor {
  display: inline-block;
  width: 5px;
  height: 14px;
  margin-left: 2px;
  background: var(--accent);
  vertical-align: -1px;
  animation: chatbot-cursor-blink 1s steps(1) infinite;
}

// -----------------------------------------------------------------------------
// Code blocks (hljs)
// -----------------------------------------------------------------------------
.chatbot-message-text pre.hljs {
  position: relative;
  margin: 8px 0;
  padding: 12px 12px 10px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--bg-0);
  font-family: var(--font-mono);
  font-size: 12px;
  line-height: 1.5;
  overflow-x: auto;
}

.chatbot-message-text pre.hljs code {
  background: none;
  color: var(--fg-1);
  font-family: inherit;
  font-size: inherit;
}

.chatbot-message-text .hljs-keyword,
.chatbot-message-text .hljs-selector-tag,
.chatbot-message-text .hljs-built_in   { color: color-mix(in oklch, var(--accent), white 10%); }
.chatbot-message-text .hljs-string,
.chatbot-message-text .hljs-attr       { color: color-mix(in oklch, var(--accent), #88c070 50%); }
.chatbot-message-text .hljs-number,
.chatbot-message-text .hljs-literal    { color: color-mix(in oklch, var(--accent), #d8a853 60%); }
.chatbot-message-text .hljs-comment,
.chatbot-message-text .hljs-quote      { color: var(--fg-3); font-style: italic; }
.chatbot-message-text .hljs-function,
.chatbot-message-text .hljs-title      { color: color-mix(in oklch, var(--accent), white 30%); }

// -----------------------------------------------------------------------------
// Per-message actions
// -----------------------------------------------------------------------------
.chatbot-message-actions {
  display: flex;
  margin-top: 4px;
  gap: 6px;
  opacity: 0;
  transition: opacity 120ms;
}

.chatbot-message:hover .chatbot-message-actions { opacity: 1; }

@media (hover: none) {
  .chatbot-message-actions { opacity: 1; }
}

.chatbot-action-btn {
  padding: 3px 8px;
  border: 1px solid transparent;
  border-radius: 6px;
  background: transparent;
  color: var(--fg-2);
  font-family: var(--font-ui);
  font-size: 11px;
  cursor: pointer;
  transition: all 120ms;
}

.chatbot-action-btn:hover {
  border-color: var(--line);
  background: var(--bg-2);
  color: var(--fg-1);
}

.chatbot-action-btn--primary {
  border-color: var(--accent);
  color: var(--accent);
}

// -----------------------------------------------------------------------------
// Save-as-note inline strip
// -----------------------------------------------------------------------------
.chatbot-save-as-note {
  display: grid;
  margin-top: 8px;
  padding: 10px 12px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--bg-0);
  gap: 8px;
}

.chatbot-save-field {
  display: grid;
  gap: 4px;
}

.chatbot-save-field label {
  color: var(--fg-2);
  font-family: var(--font-ui);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.chatbot-save-field label .optional {
  color: var(--fg-3);
  font-weight: 400;
  letter-spacing: 0;
  text-transform: lowercase;
}

.chatbot-save-field input {
  width: 100%;
  padding: 6px 10px;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: var(--bg-1);
  color: var(--fg-1);
  font: 400 12.5px/1.4 var(--font-ui);
  outline: none;
  transition: border-color 120ms, box-shadow 120ms;
}

.chatbot-save-field input:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 2px color-mix(in oklch, var(--accent), transparent 80%);
}

.chatbot-save-actions {
  display: flex;
  justify-content: flex-end;
  gap: 6px;
}

// -----------------------------------------------------------------------------
// Follow-up chips
// -----------------------------------------------------------------------------
.chatbot-followups {
  display: flex;
  flex-wrap: wrap;
  margin-top: 8px;
  gap: 6px;
  animation: chatbot-followup-in 120ms cubic-bezier(0.22, 1, 0.36, 1);
}

.chatbot-followup-chip {
  padding: 3px 10px;
  border: 1px dashed color-mix(in oklch, var(--accent), transparent 60%);
  border-radius: 99px;
  background: transparent;
  color: var(--fg-2);
  font-family: var(--font-ui);
  font-size: 11px;
  cursor: pointer;
  transition: all 120ms;
}

.chatbot-followup-chip:hover {
  border-style: solid;
  border-color: var(--accent);
  color: var(--accent);
}

// -----------------------------------------------------------------------------
// Input area
// -----------------------------------------------------------------------------
.chatbot-input-area {
  margin-top: auto;
  padding-top: 10px;
  border-top: 1px solid color-mix(in oklch, var(--line), transparent 30%);
}

.chatbot-input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--bg-0);
  color: var(--fg-1);
  font: 400 13.5px/1.4 var(--font-ui);
  outline: none;
  resize: none;
  transition: border-color 120ms, box-shadow 120ms;
}

.chatbot-input:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 2px color-mix(in oklch, var(--accent), transparent 80%);
}

.chatbot-input::placeholder { color: var(--fg-3); }

.chatbot-keyboard-hints {
  display: flex;
  justify-content: space-between;
  margin-top: 6px;
  color: var(--fg-3);
  font-family: var(--font-ui);
  font-size: 10px;
}

.chatbot-keyboard-hints kbd {
  padding: 1px 5px;
  margin: 0 2px;
  border: 1px solid var(--line);
  border-radius: 3px;
  background: var(--bg-1);
  color: var(--fg-2);
  font-family: var(--font-mono);
  font-size: 9px;
}

.chatbot-stop-btn {
  padding: 0;
  border: none;
  background: transparent;
  color: #f87171;
  font-family: var(--font-ui);
  font-size: 10px;
  cursor: pointer;
}

// -----------------------------------------------------------------------------
// Resize handle (pinned mode only)
// -----------------------------------------------------------------------------
.chatbot-resize-handle {
  position: absolute;
  top: 0;
  bottom: 0;
  left: -4px;
  width: 8px;
  cursor: ew-resize;
}

.chatbot-resize-handle::before {
  content: "";
  position: absolute;
  top: 0;
  bottom: 0;
  left: 4px;
  width: 2px;
  background: transparent;
  transition: background 120ms;
}

.chatbot-resize-handle:hover::before {
  background: var(--accent);
}

// -----------------------------------------------------------------------------
// Toast (save confirmation)
// -----------------------------------------------------------------------------
.chatbot-toast {
  position: absolute;
  bottom: 12px;
  left: 50%;
  padding: 6px 12px;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: var(--bg-2);
  color: var(--fg-1);
  font-size: 11px;
  transform: translateX(-50%);
}
```

- [ ] **Step 2: Swap the import in the SCSS bundle**

In `bordercore/static/scss/bordercore.scss`, change line 51 from:

```scss
@import "components/chatbot";
```

to:

```scss
@import "components/chatbot-modal";
```

- [ ] **Step 3: Delete the old SCSS partial and old ChatBot file**

```bash
rm bordercore/static/scss/components/_chatbot.scss
rm bordercore/front-end/react/blob/ChatBot.tsx
```

- [ ] **Step 4: Verify build still succeeds**

```bash
cd /home/jerrell/dev/django/bordercore/bordercore
npm run vite:build
```

Expected: build completes without errors. (If `_chatbot.scss` is still imported anywhere else, the build will fail — `grep -rn "components/chatbot\b" bordercore/static/scss/` to find and update any stragglers.)

- [ ] **Step 5: Verify TypeScript still compiles**

```bash
npx tsc --noEmit
```

Expected: no errors. The old path should no longer be referenced — `grep -rn "blob/ChatBot" bordercore/front-end/` should return nothing.

- [ ] **Step 6: Commit**

```bash
script -qc "git add bordercore/static/scss/components/_chatbot-modal.scss bordercore/static/scss/bordercore.scss bordercore/static/scss/components/_chatbot.scss bordercore/front-end/react/blob/ChatBot.tsx && git commit -m 'Replace chatbot SCSS with chatbot-modal; remove legacy ChatBot.tsx'" /dev/null
```

---

## Phase G — Smoke test (Task 20)

### Task 20: End-to-end manual smoke test

**Files:** none changed; this is a verification pass.

The full vitest suite and the build already passed in earlier tasks. This task confirms the live, integrated UX before declaring the feature done.

- [ ] **Step 1: Run all tests one final time**

```bash
cd /home/jerrell/dev/django/bordercore/bordercore
npm run test
script -qc ".venv/bin/python -m pytest bordercore/blob/tests/test_views.py bordercore/blob/tests/test_services.py -v -k 'chat'" /dev/null
```

Expected: both runs are all green.

- [ ] **Step 2: Start the dev server**

```bash
cd /home/jerrell/dev/django/bordercore
make runserver  # or: .venv/bin/python bordercore/manage.py runserver
```

In a second terminal:

```bash
cd /home/jerrell/dev/django/bordercore/bordercore
npm run vite:dev
```

- [ ] **Step 3: Smoke test modal mode**

Open any page in the app. Press **Alt-C**.

Verify each:
- [ ] Modal appears centered with the existing refined-modal scrim/blur
- [ ] Eyebrow reads `chat · bordercore / assistant`
- [ ] Mode chips row shows `chat`, `notes` (and `blob` if a blob is loaded)
- [ ] Click `notes`, type "what was my latest note about?", press Enter
- [ ] Streaming cursor blinks at end of response
- [ ] Click `■ stop` mid-stream — generation halts, partial content is preserved
- [ ] Hover an assistant message → action buttons fade in
- [ ] Click `⧉ copy` → "✓ copied" appears for ~1s; pasting elsewhere yields the message text
- [ ] After streaming completes, follow-up chips appear; clicking one auto-sends it
- [ ] Click `📑 save as note` → inline strip slides open with title autofilled; Enter saves and shows toast; verify the note exists by visiting the toast URL
- [ ] Press Esc → modal closes

- [ ] **Step 4: Smoke test pinned mode**

Press **Alt-C** to reopen the modal.

- [ ] Click the 📌 pin button — modal animates to right-docked position; scrim disappears; page is now scrollable/clickable
- [ ] Drag the left edge of the dock → width changes live
- [ ] Refresh the page → press Alt-C → reopens already pinned at the same width (verifies localStorage round-trip)
- [ ] Press Alt-C while pinned and visible → dock closes
- [ ] Press Alt-C again → reopens pinned
- [ ] Click the pin again — animates back to centered modal; scrim returns; refresh → reopens centered (verifies pin state is unset)

- [ ] **Step 5: Smoke test code blocks**

In any mode, ask: "Show me a Python function that adds two numbers."

- [ ] Response renders in a styled code block with python language label and copy button
- [ ] Click `copy` on the code block → raw source ends up on the clipboard

- [ ] **Step 6: Smoke test regenerate**

After any assistant reply:

- [ ] Hover the latest assistant message → click `↻ regenerate` → that message is replaced by a fresh streaming reply for the same prompt

- [ ] **Step 7: If anything fails**

Note the failure inline in the task list with details, then debug. Re-run the smoke test from Step 3 once fixed.

- [ ] **Step 8: Final commit (if any fixes were needed during smoke test)**

If the smoke test surfaced bugs, the fixes were committed individually. Otherwise no commit needed for this task.

---

## Done

After Task 20 passes, the chatbot redesign is complete: a polished centered/pinned modal, live streaming with stop, per-message actions, inline note saving, syntax-highlighted code, follow-up chips, multi-line input, and a clean component split. Total commits: ~20 small, reviewable steps.
