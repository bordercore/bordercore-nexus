# Refined design patterns

A short reference for the "refined" UI system — the dark, accent-tinted look used by
the node modals, the redesigned todo modals, the date pickers, and the chat shell.

This document captures **decisions and when-to-use**. The code is authoritative for
implementation details; if a class name listed here disappears or changes, fix the
doc, don't reverse-engineer it.

## When to use refined patterns

Use them for **new pages and modals**. Don't retrofit Bootstrap-styled pages
unless you're already touching them — mixed pages are fine during transition.

The refined system assumes a dark, single-app feel. It's not designed to coexist
with Bootstrap form-controls inside the same component.

## Canonical references

When building a new component of one of these kinds, copy from the named file
rather than starting from scratch. The named files are the gold-standard.

| Pattern | Canonical reference |
|---|---|
| Minimal create modal (~2 fields, native form POST) | `front-end/react/node/NewNodeModal.tsx` |
| Multi-field create modal (JSON API + tags + date) | `front-end/react/todo/NewTodoModal.tsx` |
| Edit modal with Delete | `front-end/react/todo/EditTodoModal.tsx` |
| Popover pattern (click-outside, Esc, portal-anchored) | `front-end/react/common/RefinedDatePicker.tsx` |
| Date input | `RefinedDatePicker` |
| Date + time input | `RefinedDateTimePicker` |
| Tag input | `front-end/react/common/TagsInput.tsx` (auto-themed inside `.refined-field`) |

If you find yourself wanting something not on this list (range picker, multi-step
wizard, inline editor), build it once, then add a row here.

## Building blocks

### Modal shell

Defined in `static/scss/components/_refined-modal.scss`. Render via
`createPortal(..., document.body)` so selectors live at root scope.

| Class | Purpose |
|---|---|
| `.refined-modal` | The modal box itself (520px wide, fixed center, accent-glow border). |
| `.refined-modal-scrim` | Full-viewport backdrop with blur. Click → close. |
| `.refined-modal-close` | Top-right close X button. |
| `.refined-modal-eyebrow` | Mono-font breadcrumb above the title (e.g. `"new todo · bordercore / todos / create"`). |
| `.refined-modal-title` | The `<h2>`. Sentence case, no period. |
| `.refined-modal-lead` | *(optional)* Explanatory paragraph below the title. Skip when the modal's purpose is obvious from its fields. |
| `.refined-modal-actions` | Footer button row. `flex` with `flex-wrap`. |

### Form fields

| Class | Purpose |
|---|---|
| `.refined-field` | Wraps a label + input/select/textarea. Stacked `display: grid`. |
| `.refined-field label` | Small uppercase, letter-spaced label. Add `<span class="optional">· optional</span>` for non-required. |
| `.refined-row-2` | Two-column grid for pairing two compact fields on one line (e.g. priority + due date). Wraps `.refined-field` children. |

Native `<input>`, `<select>`, `<textarea>` are auto-themed when nested inside
`.refined-field`. Don't add `form-control` classes — that's Bootstrap.

### Buttons

Defined in `static/scss/components/_refined-components.scss`.

| Class | Use |
|---|---|
| `.refined-btn` | Base button. |
| `.refined-btn.primary` | The submit/confirm action. Inside `.refined-modal-actions` it auto-takes `flex: 1`. Usually one per modal. |
| `.refined-btn.ghost` | Cancel, secondary actions. |
| `.refined-btn.danger` | Destructive actions (delete). Auto-aligned left in `.refined-modal-actions`. |
| `.refined-btn-icon` | Apply to a leading FontAwesome icon (sets size). |
| `.kbd` | Trailing keyboard hint chip (e.g. `<span class="kbd">⏎</span>`). |

## Design tokens

Defined in `static/scss/themes/`. Re-tint everything; don't hard-code colors.

| Token | Use |
|---|---|
| `--accent`, `--accent-fg`, `--accent-glow` | Theme accent. |
| `--bg-0` … `--bg-3` | Background surfaces, dark → light. `--bg-0` for input fields, `--bg-1` for the modal body. |
| `--fg-0` … `--fg-3` | Text, brightest → dimmest. `--fg-1` for primary text, `--fg-3` for placeholders / dimmed labels. |
| `--line` | Borders. |
| `--font-ui`, `--font-mono` | Typeface stacks. Use mono for breadcrumbs and code-y bits. |

## Behavior conventions

These apply to all refined modals and popovers. Diverging from them needs a
specific reason.

- **Open state is declarative.** Pass `open: boolean` and `onClose: () => void` as
  props. Never expose imperative refs (`openModal()` methods) — the parent owns
  the open state.
- **Escape key closes** the modal/popover.
- **Click on the scrim closes** the modal. Click outside the popover closes it.
- **Cancel button closes**, doesn't confirm-discard.
- **Auto-focus** the first text input on open (with a ~40ms `setTimeout` so the
  open animation doesn't fight the focus).
- **Enter in the name/title input submits** when not held with Shift. Multi-line
  textareas don't get this — they accept newlines.
- **State resets on each open.** Either reset everything (Create) or re-seed
  from `todoInfo`/equivalent props (Edit). Don't carry state across closes.
- **Primary action shows a `<span class="kbd">⏎</span>` hint** when Enter
  submits.
- **Disabled primary action** when required fields are empty. Don't pop a
  validation toast for "name is required" — the disabled button is the cue.

## Where things live

- Modal SCSS: `static/scss/components/_refined-modal.scss`
- Buttons / general components: `static/scss/components/_refined-components.scss`
- Date picker SCSS: `static/scss/components/_refined-datepicker.scss`
- React components: `front-end/react/common/` for shared (date pickers, tag
  input), per-domain folders (`todo/`, `node/`, `habit/`) for one-offs.

## When *not* to use refined

- Admin / Django-form pages that lean on `django-crispy-forms` or rendered
  `{% form %}`. Don't fight the framework just to match the look.
- One-off internal tools where consistency isn't worth the porting cost.
- Anywhere the surrounding page is fully Bootstrap and the new component would
  be the only refined thing — visual mixing is jarring.

## Updating this doc

Keep it short. If you add a new building block (e.g. a new `.refined-something`
class), add a row to the relevant table. If you build a new canonical
reference, list it. Don't paste CSS or component code in here — link to the
source file instead.
