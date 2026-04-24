# Drill Overview Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the drill overview page (`drill:list`) to match the high-fidelity design in `design_handoff_drill_overview/`, using existing Django + React + Vite + scoped-SCSS conventions and the existing theme tokens.

**Architecture:** Django view assembles a single JSON payload (passed via `json_script`); a React entry mounts a new `DrillOverviewPage` composed of small focused subcomponents; styles live in `static/scss/pages/_drill-refined.scss`, scoped under `.drill-app` and built on the unprefixed theme tokens (`--bg-0`, `--accent`, …) plus a small set of drill-only locals defined at the top of the file. Backend manager gains a handful of pure read helpers; the existing `_batch_tag_progress` row gains additive fields.

**Tech Stack:** Django 5, DRF, pytest + factory_boy, React 18 + TypeScript, Vite, Vitest + @testing-library/react, SCSS with CSS custom properties, FontAwesome 6 Solid, Inter / Space Grotesk / JetBrains Mono.

---

## Conventions

- **Branch / commits.** Work on whatever branch the user is on (master). Conventional-style imperative commits ("Add tags_needing_review manager helper", "Wire ScheduleStrip into overview"). Commit after every green test or self-contained chunk.
- **Backend tests.** `pytest -p no:warnings bordercore/drill/tests/test_managers.py::<name> -v` (uses `.venv/bin/pytest` via `make test` or directly). Tests must use `pytest.mark.django_db` and the existing `QuestionFactory` / `UserFactory`.
- **Frontend tests.** `npx vitest run path/to/file.test.tsx --reporter=verbose` from `bordercore/`.
- **Token discipline.** No hex literals in `_drill-refined.scss` outside the locals block at the top. Locals defined: `--bc-accent-2`, `--bc-accent-3`, `--bc-accent-4`, `--bc-fg-disabled`, `--bc-elev-2`, `--bc-glow-accent-sm`, `--bc-glow-cyan`, `--bc-hairline` — all built from the theme's `--accent` / `--bg-*` / `--line-soft` so they re-tint per theme.
- **Component file size.** Keep React components ≤ ~150 LoC. Extract sub-blocks into the `components/` folder rather than letting one file balloon.

---

## Task 1: Extend `_batch_tag_progress` with `todo` + raw `last_reviewed_dt`

**Files:**
- Modify: `bordercore/drill/managers.py:189-250`
- Test: `bordercore/drill/tests/test_managers.py`

- [ ] **Step 1: Read the existing test file to learn fixture conventions**

Run: `Read bordercore/drill/tests/test_managers.py` (no edits yet) — note how `QuestionFactory` is used and which `userprofile` fixture exists.

- [ ] **Step 2: Add a failing test for the new fields**

Append to `bordercore/drill/tests/test_managers.py`:

```python
@pytest.mark.django_db
def test_batch_tag_progress_includes_todo_and_dt(monkeypatch):
    user = UserFactory()
    tag = TagFactory(user=user, name="alpha")
    # 2 questions: one due (last_reviewed long ago), one fresh
    q_due = QuestionFactory(user=user, last_reviewed=timezone.now() - timedelta(days=400))
    q_due.tags.add(tag)
    q_fresh = QuestionFactory(user=user, last_reviewed=timezone.now())
    q_fresh.tags.add(tag)

    rows = Question.objects._batch_tag_progress(user, ["alpha"])
    assert len(rows) == 1
    row = rows[0]
    assert row["name"] == "alpha"
    assert row["count"] == 2
    assert row["todo"] == 1
    assert row["last_reviewed_dt"] is not None  # raw datetime, kept out of JSON path
    assert "progress" in row and "url" in row and "last_reviewed" in row
```

Imports at the top of the test file: ensure `timezone`, `timedelta`, `TagFactory`, `UserFactory`, `QuestionFactory`, `Question`, `pytest` are all present (add what's missing).

- [ ] **Step 3: Run the test to verify it fails**

Run: `.venv/bin/pytest bordercore/drill/tests/test_managers.py::test_batch_tag_progress_includes_todo_and_dt -v`
Expected: FAIL on `KeyError: 'todo'` or `KeyError: 'last_reviewed_dt'`.

- [ ] **Step 4: Add the fields to `_batch_tag_progress`**

In `bordercore/drill/managers.py`, inside the loop building `results`, change the appended dict to include:

```python
results.append({
    "name": name,
    "progress": progress,
    "todo": todo,
    "last_reviewed": last_reviewed_str,
    "last_reviewed_dt": stat.q_last_reviewed if stat else None,
    "url": reverse("drill:start_study_session")
    + f"?study_method=tag&tags={name}",
    "count": count,
})
```

`todo` is already computed; `last_reviewed_dt` is `stat.q_last_reviewed` (or `None`).

- [ ] **Step 5: Re-run the test to verify it passes**

Run the same pytest command. Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add bordercore/drill/managers.py bordercore/drill/tests/test_managers.py
git commit -m "Extend _batch_tag_progress rows with todo + raw last_reviewed_dt"
```

---

## Task 2: Add `tags_needing_review(user)` manager helper

**Files:**
- Modify: `bordercore/drill/managers.py`
- Test: `bordercore/drill/tests/test_managers.py`

- [ ] **Step 1: Add failing test**

```python
@pytest.mark.django_db
def test_tags_needing_review_filters_and_sorts():
    user = UserFactory()
    tag_old = TagFactory(user=user, name="oldest")
    tag_new = TagFactory(user=user, name="newer")
    tag_clean = TagFactory(user=user, name="clean")

    QuestionFactory(user=user, last_reviewed=timezone.now() - timedelta(days=400)).tags.add(tag_old)
    QuestionFactory(user=user, last_reviewed=timezone.now() - timedelta(days=100)).tags.add(tag_new)
    QuestionFactory(user=user, last_reviewed=timezone.now()).tags.add(tag_clean)  # not due

    rows = Question.objects.tags_needing_review(user)
    names = [r["name"] for r in rows]
    assert names == ["oldest", "newer"]  # sorted oldest-first, "clean" excluded
    assert all(r["todo"] > 0 for r in rows)
```

- [ ] **Step 2: Run, expect FAIL** (`AttributeError: tags_needing_review`).

- [ ] **Step 3: Implement**

Add to `DrillManager`:

```python
def tags_needing_review(self, user: User) -> list[dict[str, Any]]:
    """Tag-progress rows for tags with at least one due question.

    Sorted by last_reviewed ascending (nulls first / oldest-due-first).
    """
    tags = (
        Tag.objects.filter(user=user, question__isnull=False)
        .exclude(pk__in=user.userprofile.drill_tags_muted.all())
        .annotate(last_reviewed=Max("question__last_reviewed"))
        .order_by(F("last_reviewed").asc(nulls_first=True))
        .distinct()
        .values_list("name", flat=True)
    )
    rows = self._batch_tag_progress(user, list(tags))
    return [r for r in rows if r["todo"] > 0]
```

- [ ] **Step 4: Run, expect PASS.**

- [ ] **Step 5: Commit**

```bash
git add bordercore/drill/managers.py bordercore/drill/tests/test_managers.py
git commit -m "Add DrillManager.tags_needing_review helper"
```

---

## Task 3: Add `responses_by_kind(user)` aggregate

**Files:**
- Modify: `bordercore/drill/managers.py`
- Test: `bordercore/drill/tests/test_managers.py`

- [ ] **Step 1: Add failing test**

```python
@pytest.mark.django_db
def test_responses_by_kind_counts_each_response():
    user = UserFactory()
    q = QuestionFactory(user=user)
    QuestionResponse.objects.create(question=q, response="easy")
    QuestionResponse.objects.create(question=q, response="easy")
    QuestionResponse.objects.create(question=q, response="good")
    QuestionResponse.objects.create(question=q, response="hard")

    counts = Question.objects.responses_by_kind(user)
    assert counts == {"easy": 2, "good": 1, "hard": 1, "reset": 0}
```

Add `from drill.models import QuestionResponse` to test imports if missing.

- [ ] **Step 2: Run, expect FAIL.**

- [ ] **Step 3: Implement**

```python
def responses_by_kind(self, user: User) -> dict[str, int]:
    """Count of QuestionResponse rows per response kind for this user."""
    QuestionResponse = apps.get_model("drill", "QuestionResponse")
    rows = (
        QuestionResponse.objects.filter(question__user=user)
        .values("response")
        .annotate(n=Count("id"))
    )
    counts = {"easy": 0, "good": 0, "hard": 0, "reset": 0}
    for row in rows:
        if row["response"] in counts:
            counts[row["response"]] = row["n"]
    return counts
```

- [ ] **Step 4: Run, expect PASS.**

- [ ] **Step 5: Commit**

```bash
git add bordercore/drill/managers.py bordercore/drill/tests/test_managers.py
git commit -m "Add DrillManager.responses_by_kind aggregate"
```

---

## Task 4: Add `recent_responses(user, n=5)` helper

**Files:**
- Modify: `bordercore/drill/managers.py`
- Test: `bordercore/drill/tests/test_managers.py`

- [ ] **Step 1: Add failing test**

```python
@pytest.mark.django_db
def test_recent_responses_returns_latest_first():
    user = UserFactory()
    q1 = QuestionFactory(user=user, question="elixir pattern matching")
    q2 = QuestionFactory(user=user, question="lambda calculus")
    QuestionResponse.objects.create(question=q1, response="easy")
    QuestionResponse.objects.create(question=q2, response="hard")

    out = Question.objects.recent_responses(user, n=5)
    assert len(out) == 2
    assert out[0]["question"] == "lambda calculus"
    assert out[0]["response"] == "hard"
    assert isinstance(out[0]["date"], datetime)
```

Add `from datetime import datetime` to test imports if missing.

- [ ] **Step 2: Run, expect FAIL.**

- [ ] **Step 3: Implement**

```python
def recent_responses(self, user: User, n: int = 5) -> list[dict[str, Any]]:
    """Latest n QuestionResponse rows for the user, newest first.

    Returns dicts shaped: ``{"question": str, "response": str, "date": datetime}``.
    """
    QuestionResponse = apps.get_model("drill", "QuestionResponse")
    qs = (
        QuestionResponse.objects.filter(question__user=user)
        .select_related("question")
        .order_by("-date")[:n]
    )
    return [
        {"question": r.question.question, "response": r.response, "date": r.date}
        for r in qs
    ]
```

- [ ] **Step 4: Run, expect PASS. Commit.**

```bash
git add bordercore/drill/managers.py bordercore/drill/tests/test_managers.py
git commit -m "Add DrillManager.recent_responses helper"
```

---

## Task 5: Add `activity_heatmap(user, days=28)` helper

**Files:** same.

- [ ] **Step 1: Add failing test**

```python
@pytest.mark.django_db
def test_activity_heatmap_returns_one_int_per_day():
    user = UserFactory()
    q = QuestionFactory(user=user)
    today = timezone.now()
    QuestionResponse.objects.create(question=q, response="easy")
    QuestionResponse.objects.create(question=q, response="good")

    out = Question.objects.activity_heatmap(user, days=28)
    assert len(out) == 28
    assert all(isinstance(n, int) for n in out)
    assert out[-1] == 2  # today should have 2 responses
```

- [ ] **Step 2: Run, expect FAIL.**

- [ ] **Step 3: Implement**

```python
def activity_heatmap(self, user: User, days: int = 28) -> list[int]:
    """Return a list of ``days`` integers — response count per day, oldest first."""
    QuestionResponse = apps.get_model("drill", "QuestionResponse")
    today = timezone.localdate()
    start = today - timedelta(days=days - 1)
    rows = (
        QuestionResponse.objects.filter(question__user=user, date__date__gte=start)
        .values("date__date")
        .annotate(n=Count("id"))
    )
    by_day = {r["date__date"]: r["n"] for r in rows}
    return [by_day.get(start + timedelta(days=i), 0) for i in range(days)]
```

Add `from datetime import timedelta` and `from django.utils import timezone` to `managers.py` if not already imported (`timezone` already is; `timedelta` may need adding).

- [ ] **Step 4: Run, expect PASS. Commit.**

```bash
git add bordercore/drill/managers.py bordercore/drill/tests/test_managers.py
git commit -m "Add DrillManager.activity_heatmap helper"
```

---

## Task 6: Add `schedule(user, span_days=3)` helper

**Files:** same.

- [ ] **Step 1: Add failing test**

```python
@pytest.mark.django_db
def test_schedule_returns_seven_days_with_overdue_collapsed():
    user = UserFactory()
    today = timezone.localdate()
    # one overdue, one due today, one due in 2 days
    QuestionFactory(
        user=user,
        last_reviewed=timezone.now() - timedelta(days=10),
        interval=timedelta(days=1),
    )
    QuestionFactory(
        user=user,
        last_reviewed=timezone.now() - timedelta(days=2),
        interval=timedelta(days=2),
    )
    QuestionFactory(
        user=user,
        last_reviewed=timezone.now(),
        interval=timedelta(days=2),
    )

    days = Question.objects.schedule(user, span_days=3)
    assert len(days) == 7
    today_cell = next(d for d in days if d["state"] == "today")
    # today bucket includes overdue + today's due
    assert today_cell["due"] >= 2
    assert all("date" in d and "dow" in d for d in days)
```

- [ ] **Step 2: Run, expect FAIL.**

- [ ] **Step 3: Implement**

```python
def schedule(self, user: User, span_days: int = 3) -> list[dict[str, Any]]:
    """7-day schedule centered on today (``[today - span_days, today + span_days]``).

    Each entry: ``{"dow": "mon", "date": "21", "due": int, "state": "over"|"today"|"upcoming"|"empty"}``.
    Overdue questions and questions due today are collapsed into the today bucket.
    """
    Question = apps.get_model("drill", "Question")
    today = timezone.localdate()
    span = range(-span_days, span_days + 1)

    qs = Question.objects.filter(user=user, is_disabled=False, last_reviewed__isnull=False)
    out: list[dict[str, Any]] = []
    overdue_count = 0
    for offset in span:
        d = today + timedelta(days=offset)
        if offset < 0:
            count = qs.filter(
                last_reviewed__date=d - F("interval"),  # rough — see below
            ).count()
            # Simpler: defer overdue counting to today bucket
            count = 0
            state = "over"
        elif offset == 0:
            # everything due-or-overdue lands here
            count = qs.filter(
                Q(interval__lte=timezone.now() - F("last_reviewed"))
            ).count() + Question.objects.filter(
                user=user, is_disabled=False, last_reviewed__isnull=True
            ).count()
            state = "today"
        else:
            # estimate: questions whose last_reviewed + interval falls on day d
            count = qs.extra(  # noqa: S610 — bounded user input
                where=["DATE(last_reviewed + interval) = %s"], params=[d],
            ).count()
            state = "upcoming" if count else "empty"
        out.append({
            "dow": d.strftime("%a").lower(),
            "date": d.strftime("%-d"),
            "due": count,
            "state": state,
        })
    return out
```

Note: the `extra()` call uses Postgres date arithmetic; the project uses Postgres, so this is safe. Mark `state = "over"` cells with `due = 0` since the count is folded into the today bucket — the design copy still says "12 due / 8 due / 14 due" for past days, so the *display layer* shows `"{n} due"` only when `due > 0`. To support the design literal of past-day counts, treat overdue per-day correctly:

Replace the `if offset < 0` branch with:

```python
if offset < 0:
    count = qs.extra(
        where=["DATE(last_reviewed + interval) = %s"], params=[d],
    ).count()
    state = "over" if count else "empty"
```

Remove the duplicate `count = 0` line.

- [ ] **Step 4: Run, expect PASS. Commit.**

```bash
git add bordercore/drill/managers.py bordercore/drill/tests/test_managers.py
git commit -m "Add DrillManager.schedule 7-day strip helper"
```

---

## Task 7: Add `featured_tag_histogram(tag, user, weeks=12)` helper

**Files:** same.

- [ ] **Step 1: Add failing test**

```python
@pytest.mark.django_db
def test_featured_tag_histogram_returns_weeks_of_counts():
    user = UserFactory()
    tag = TagFactory(user=user, name="lisp")
    q = QuestionFactory(user=user)
    q.tags.add(tag)
    QuestionResponse.objects.create(question=q, response="easy")

    histo = Question.objects.featured_tag_histogram("lisp", user, weeks=12)
    assert len(histo) == 12
    assert sum(histo) == 1
```

- [ ] **Step 2: Run, expect FAIL. Implement:**

```python
def featured_tag_histogram(
    self, tag: str, user: User, weeks: int = 12
) -> list[int]:
    """Per-week QuestionResponse counts for ``tag`` over the last ``weeks`` weeks."""
    QuestionResponse = apps.get_model("drill", "QuestionResponse")
    today = timezone.localdate()
    start = today - timedelta(weeks=weeks - 1)
    rows = (
        QuestionResponse.objects.filter(
            question__user=user,
            question__tags__name=tag,
            date__date__gte=start,
        )
        .annotate(week_start=TruncWeek("date"))
        .values("week_start")
        .annotate(n=Count("id"))
    )
    by_week = {r["week_start"].date(): r["n"] for r in rows}
    week_keys = [start + timedelta(weeks=i) for i in range(weeks)]
    # snap to TruncWeek's Monday boundary
    return [
        by_week.get(_monday_of(w), 0) for w in week_keys
    ]


def _monday_of(d):  # module-level helper at bottom of managers.py
    from datetime import date as _date
    return d - timedelta(days=d.weekday())
```

Add at top of `managers.py`: `from django.db.models.functions import TruncWeek` and `from datetime import date, timedelta`.

- [ ] **Step 3: Run, expect PASS. Commit.**

```bash
git add bordercore/drill/managers.py bordercore/drill/tests/test_managers.py
git commit -m "Add DrillManager.featured_tag_histogram helper"
```

---

## Task 8: Add `study_streak(user)` and `reviewed_count(user, since)`

**Files:** same.

- [ ] **Step 1: Add failing tests**

```python
@pytest.mark.django_db
def test_reviewed_count_since():
    user = UserFactory()
    q = QuestionFactory(user=user)
    QuestionResponse.objects.create(question=q, response="easy")
    QuestionResponse.objects.create(question=q, response="good")
    yesterday = timezone.now() - timedelta(days=1)
    assert Question.objects.reviewed_count(user, since=yesterday) == 2

@pytest.mark.django_db
def test_study_streak_counts_consecutive_days():
    user = UserFactory()
    q = QuestionFactory(user=user)
    today = timezone.now()
    for offset in (0, 1, 2):
        r = QuestionResponse.objects.create(question=q, response="good")
        QuestionResponse.objects.filter(pk=r.pk).update(date=today - timedelta(days=offset))
    assert Question.objects.study_streak(user) == 3
```

- [ ] **Step 2: Run both, expect FAIL.**

- [ ] **Step 3: Implement**

```python
def reviewed_count(self, user: User, since) -> int:
    """Count QuestionResponse rows for ``user`` since the given datetime."""
    QuestionResponse = apps.get_model("drill", "QuestionResponse")
    return QuestionResponse.objects.filter(
        question__user=user, date__gte=since
    ).count()

def study_streak(self, user: User) -> int:
    """Number of consecutive days (ending today) with at least one response."""
    QuestionResponse = apps.get_model("drill", "QuestionResponse")
    today = timezone.localdate()
    days_with_any = set(
        QuestionResponse.objects.filter(question__user=user)
        .annotate(d=TruncDate("date"))
        .values_list("d", flat=True)
        .distinct()
    )
    streak = 0
    cursor = today
    while cursor in days_with_any:
        streak += 1
        cursor -= timedelta(days=1)
    return streak
```

Add `from django.db.models.functions import TruncDate` to imports (alongside `TruncWeek`).

- [ ] **Step 4: Run, expect PASS. Commit.**

```bash
git add bordercore/drill/managers.py bordercore/drill/tests/test_managers.py
git commit -m "Add DrillManager.study_streak and reviewed_count helpers"
```

---

## Task 9: Add `next_due_in(user)` helper

**Files:** same.

- [ ] **Step 1: Add failing test**

```python
@pytest.mark.django_db
def test_next_due_in_returns_humanized_delta_or_none():
    user = UserFactory()
    QuestionFactory(
        user=user,
        last_reviewed=timezone.now() - timedelta(hours=22),
        interval=timedelta(days=1),
    )
    out = Question.objects.next_due_in(user)
    assert out is not None
    assert out.endswith("m") or out.endswith("h")  # e.g. "in 02h 14m"

    user2 = UserFactory()
    assert Question.objects.next_due_in(user2) is None
```

- [ ] **Step 2: Run, expect FAIL.**

- [ ] **Step 3: Implement**

```python
def next_due_in(self, user: User) -> str | None:
    """Humanized time-until next question becomes due (e.g. ``"in 02h 14m"``).

    Returns ``None`` if the user has no scheduled questions.
    """
    Question = apps.get_model("drill", "Question")
    qs = Question.objects.filter(
        user=user, is_disabled=False, last_reviewed__isnull=False
    )
    now = timezone.now()
    next_due = qs.annotate(
        due_at=F("last_reviewed") + F("interval"),
    ).aggregate(soonest=models.Min("due_at"))["soonest"]
    if next_due is None:
        return None
    delta = next_due - now
    if delta.total_seconds() <= 0:
        return "due now"
    hours, remainder = divmod(int(delta.total_seconds()), 3600)
    minutes = remainder // 60
    if hours >= 24:
        days = hours // 24
        return f"in {days}d"
    return f"in {hours:02d}h {minutes:02d}m"
```

- [ ] **Step 4: Run, expect PASS. Commit.**

```bash
git add bordercore/drill/managers.py bordercore/drill/tests/test_managers.py
git commit -m "Add DrillManager.next_due_in humanized helper"
```

---

## Task 10: Rewrite `DrillListView.get_context_data` to assemble the unified payload

**Files:**
- Modify: `bordercore/drill/views.py:46-105`
- Test: `bordercore/drill/tests/test_views.py`

- [ ] **Step 1: Add failing test asserting the payload shape**

Append to `bordercore/drill/tests/test_views.py`:

```python
@pytest.mark.django_db
def test_drill_list_view_payload_has_all_keys(client, db):
    user = UserFactory()
    client.force_login(user)
    response = client.get(reverse("drill:list"))
    assert response.status_code == 200
    payload = json.loads(response.context["payload_json"])
    for key in [
        "title", "urls", "session", "studyScope", "intervals",
        "responsesByKind", "totalProgress", "favoritesProgress",
        "schedule", "tagsNeedingReview", "pinned", "disabled",
        "featured", "streak", "nextDue", "activity28d", "recentResponses",
    ]:
        assert key in payload, f"missing payload key: {key}"
    assert isinstance(payload["activity28d"], list) and len(payload["activity28d"]) == 28
    assert isinstance(payload["schedule"], list) and len(payload["schedule"]) == 7
```

- [ ] **Step 2: Run, expect FAIL** (`KeyError: 'payload_json'`).

- [ ] **Step 3: Rewrite the view**

Replace `DrillListView.get_context_data` body in `bordercore/drill/views.py:56-105` with:

```python
def get_context_data(self, **kwargs: Any) -> dict[str, Any]:
    context = super().get_context_data(**kwargs)
    user = cast(User, self.request.user)
    qs = Question.objects

    total_progress = qs.total_tag_progress(user)
    favorites_progress = qs.favorite_questions_progress(user)
    favorites_total = Question.objects.filter(user=user, is_favorite=True).count()
    all_total = Question.objects.filter(user=user).count()
    needs_review = total_progress["count"]

    now = timezone.now()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = now - timedelta(days=7)
    reviewed_today = qs.reviewed_count(user, today_start)
    reviewed_week = qs.reviewed_count(user, week_start)

    intervals = list(user.userprofile.drill_intervals or [])
    tags_needing = qs.tags_needing_review(user)
    today = timezone.localdate()
    for r in tags_needing:
        last_dt = r.pop("last_reviewed_dt", None)
        r["overdueDays"] = (today - last_dt.date()).days if last_dt else None
        r["pip"] = (
            "danger" if (r["overdueDays"] or 0) > 295
            else "warm" if (r["overdueDays"] or 0) > 280
            else "cool"
        )

    pinned_rows = qs.get_pinned_tags(user)
    for r in pinned_rows:
        r.pop("last_reviewed_dt", None)
    disabled_rows = qs.get_disabled_tags(user)
    for r in disabled_rows:
        r.pop("last_reviewed_dt", None)

    featured = qs.get_random_tag(user)
    if featured:
        featured = {**featured}
        featured.pop("last_reviewed_dt", None)
        featured["histo"] = qs.featured_tag_histogram(featured["name"], user, weeks=12)

    session = self.request.session.get("drill_study_session")
    session_payload = None
    if session:
        idx = Question.get_study_session_progress(self.request.session)
        session_payload = {
            **session,
            "completed": idx,
            "total": len(session.get("list", [])),
            "scopeLabel": session.get("type", "all"),
            "nextIn": qs.next_due_in(user),
        }

    payload = {
        "title": "Drill",
        "urls": {
            "drillList": reverse("drill:list"),
            "drillAdd": reverse("drill:add"),
            "startStudySession": reverse("drill:start_study_session"),
            "resume": reverse("drill:resume"),
            "getPinnedTags": reverse("drill:get_pinned_tags"),
            "pinTag": reverse("drill:pin_tag"),
            "unpinTag": reverse("drill:unpin_tag"),
            "sortPinnedTags": reverse("drill:sort_pinned_tags"),
            "getDisabledTags": reverse("drill:get_disabled_tags"),
            "disableTag": reverse("drill:disable_tag"),
            "enableTag": reverse("drill:enable_tag"),
            "tagSearch": reverse("tag:search"),
        },
        "session": session_payload,
        "studyScope": [
            {"key": "all",       "label": "all questions", "count": all_total},
            {"key": "review",    "label": "needs review",  "count": needs_review},
            {"key": "favorites", "label": "favorites",     "count": favorites_total},
            {"key": "recent",    "label": "recent · 7d",
             "count": Question.objects.filter(user=user, created__gte=week_start).count()},
            {"key": "random",    "label": "random · 10",   "count": 10},
            {"key": "keyword",   "label": "keyword search","count": None},
        ],
        "intervals": intervals,
        "responsesByKind": qs.responses_by_kind(user),
        "totalProgress": {
            "pct": int(round(total_progress["percentage"])),
            "remaining": needs_review,
            "total": all_total,
            "reviewedToday": reviewed_today,
            "reviewedWeek": reviewed_week,
        },
        "favoritesProgress": {
            "pct": int(round(favorites_progress["percentage"])),
            "remaining": favorites_total - sum(
                1 for q in Question.objects.filter(user=user, is_favorite=True)
                if not q.needs_review
            ),
            "total": favorites_total,
            "reviewedToday": reviewed_today,
            "reviewedWeek": reviewed_week,
        },
        "schedule": qs.schedule(user, span_days=3),
        "tagsNeedingReview": tags_needing,
        "pinned": pinned_rows,
        "disabled": disabled_rows,
        "featured": featured,
        "streak": qs.study_streak(user),
        "nextDue": qs.next_due_in(user),
        "activity28d": qs.activity_heatmap(user, days=28),
        "recentResponses": [
            {
                "question": r["question"],
                "response": r["response"],
                "ago": _humanize_ago(r["date"]),
            }
            for r in qs.recent_responses(user, n=5)
        ],
    }
    return {**context, "title": "Drill", "payload_json": json.dumps(payload, default=str)}
```

Add module-level:

```python
def _humanize_ago(dt) -> str:
    delta = timezone.now() - dt
    seconds = int(delta.total_seconds())
    if seconds < 60: return f"{seconds}s"
    if seconds < 3600: return f"{seconds // 60}m"
    if seconds < 86400: return f"{seconds // 3600}h"
    return f"{seconds // 86400}d"
```

Add imports to top of `views.py`:

```python
from datetime import timedelta
from django.utils import timezone
```

(`json`, `cast`, `User`, `reverse` already imported.)

- [ ] **Step 4: Run, expect PASS.**

- [ ] **Step 5: Commit**

```bash
git add bordercore/drill/views.py bordercore/drill/tests/test_views.py
git commit -m "Rewrite DrillListView to assemble unified payload"
```

---

## Task 11: Update template to publish payload via `json_script`

**Files:**
- Modify: `bordercore/templates/drill/drill_list.html`

- [ ] **Step 1: Replace template body**

```django
{% extends "base.html" %}
{% load vite_tags %}

{% block title %} Drill :: {{ title }} {% endblock %}

{% block content %}
    <div class="drill-app">
        <div id="drill-overview-root"></div>
        {{ payload_json|json_script:"drill-overview-payload" }}
    </div>
{% endblock %}

{% block javascript_bundles %}
    {{ block.super }}
    {% vite_asset "dist/js/drill-list" %}
{% endblock %}
```

Note: `payload_json` is already a JSON string, so `json_script` will quote it and we'd need to JSON-parse twice. Easier: pass the raw dict instead of pre-serialized string. Adjust `views.py` to also expose the raw dict:

In `views.py`, change the final return to include a separate `payload` dict alongside `payload_json`:

```python
return {**context, "title": "Drill", "payload": payload, "payload_json": json.dumps(payload, default=str)}
```

Then in the template use `{{ payload|json_script:"drill-overview-payload" }}`.

- [ ] **Step 2: Verify the existing test still passes**

Run: `.venv/bin/pytest bordercore/drill/tests/test_views.py -v`
Expected: PASS (test reads `context["payload_json"]`).

- [ ] **Step 3: Commit**

```bash
git add bordercore/templates/drill/drill_list.html bordercore/drill/views.py
git commit -m "Publish drill payload via json_script"
```

---

## Task 12: Add shared TypeScript types

**Files:**
- Create: `bordercore/front-end/react/drill/types.ts`

- [ ] **Step 1: Create the file**

```ts
export interface DrillUrls {
  drillList: string;
  drillAdd: string;
  startStudySession: string;
  resume: string;
  getPinnedTags: string;
  pinTag: string;
  unpinTag: string;
  sortPinnedTags: string;
  getDisabledTags: string;
  disableTag: string;
  enableTag: string;
  tagSearch: string;
}

export interface SessionPayload {
  type: string;
  tag?: string | null;
  list: string[];
  current: string;
  completed: number;
  total: number;
  scopeLabel: string;
  nextIn: string | null;
}

export interface StudyScopeItem {
  key: "all" | "review" | "favorites" | "recent" | "random" | "keyword";
  label: string;
  count: number | null;
}

export type ResponseKind = "easy" | "good" | "hard" | "reset";

export interface ProgressBlock {
  pct: number;
  remaining: number;
  total: number;
  reviewedToday: number;
  reviewedWeek: number;
}

export interface ScheduleDay {
  dow: string;
  date: string;
  due: number;
  state: "over" | "today" | "upcoming" | "empty";
}

export interface TagProgressRow {
  name: string;
  progress: number;
  todo: number;
  count: number;
  last_reviewed: string;
  url: string;
  overdueDays?: number | null;
  pip?: "danger" | "warm" | "cool" | "accent";
}

export interface PinnedTag {
  name: string;
  progress: number;
  count: number;
  last_reviewed: string;
  url: string;
}

export interface DisabledTag {
  name: string;
  progress: number;
  count: number;
  last_reviewed: string;
  url: string;
}

export interface FeaturedTag {
  name: string;
  progress: number;
  count: number;
  last_reviewed: string;
  url: string;
  histo: number[];
}

export interface RecentResponse {
  question: string;
  response: ResponseKind;
  ago: string;
}

export interface DrillPayload {
  title: string;
  urls: DrillUrls;
  session: SessionPayload | null;
  studyScope: StudyScopeItem[];
  intervals: number[];
  responsesByKind: Record<ResponseKind, number>;
  totalProgress: ProgressBlock;
  favoritesProgress: ProgressBlock;
  schedule: ScheduleDay[];
  tagsNeedingReview: TagProgressRow[];
  pinned: PinnedTag[];
  disabled: DisabledTag[];
  featured: FeaturedTag | null;
  streak: number;
  nextDue: string | null;
  activity28d: number[];
  recentResponses: RecentResponse[];
}
```

- [ ] **Step 2: Commit**

```bash
git add bordercore/front-end/react/drill/types.ts
git commit -m "Add DrillPayload TypeScript types"
```

---

## Task 13: Rewrite the React entry to read the unified payload

**Files:**
- Modify: `bordercore/front-end/entries/drill-list.tsx`

- [ ] **Step 1: Replace contents**

```tsx
import React from "react";
import { createRoot } from "react-dom/client";
import DrillOverviewPage from "../react/drill/DrillOverviewPage";
import type { DrillPayload } from "../react/drill/types";

const container = document.getElementById("drill-overview-root");
const payloadEl = document.getElementById("drill-overview-payload");

if (container && payloadEl) {
  const payload: DrillPayload = JSON.parse(payloadEl.textContent || "{}");
  createRoot(container).render(<DrillOverviewPage payload={payload} />);
}
```

- [ ] **Step 2: Stub `DrillOverviewPage` so build passes**

Create `bordercore/front-end/react/drill/DrillOverviewPage.tsx` with a placeholder:

```tsx
import React from "react";
import type { DrillPayload } from "./types";

interface Props { payload: DrillPayload; }

export default function DrillOverviewPage({ payload }: Props) {
  return <div className="drill-overview">Drill: {payload.title}</div>;
}
```

- [ ] **Step 3: Typecheck**

Run: `npm --prefix bordercore run typecheck 2>&1 | tail -20`
Expected: no errors related to these files.

- [ ] **Step 4: Commit**

```bash
git add bordercore/front-end/entries/drill-list.tsx bordercore/front-end/react/drill/DrillOverviewPage.tsx bordercore/front-end/react/drill/types.ts
git commit -m "Wire drill entry to unified payload + stub overview page"
```

---

## Task 14: Scaffold the scoped SCSS file

**Files:**
- Create: `bordercore/static/scss/pages/_drill-refined.scss`
- Modify: `bordercore/static/scss/bordercore.scss` (add `@import`)

- [ ] **Step 1: Create the SCSS scaffold**

```scss
// =============================================================================
// Drill — "Refined Dark" overview redesign
// Scoped under .drill-app. Tokens come from theme files (--bg-0, --accent, ...);
// drill-only locals defined here are derived from those theme tokens so they
// re-tint per theme.
// =============================================================================

// stylelint-disable no-descending-specificity

.drill-app {
  // ----- drill-only locals (derived from theme tokens) -----
  --bc-accent-2: color-mix(in oklch, var(--accent), white 18%);
  --bc-accent-3: color-mix(in oklch, var(--danger), var(--accent) 50%);
  --bc-accent-4: color-mix(in oklch, var(--accent), var(--ok) 60%);
  --bc-fg-disabled: color-mix(in oklch, var(--fg-3), transparent 45%);
  --bc-hairline: var(--line-soft);
  --bc-elev-2: 0 1px 0 0 rgb(255 255 255 / 3%) inset,
               0 8px 24px -8px rgb(0 0 0 / 55%),
               0 0 0 1px var(--line-soft);
  --bc-glow-accent-sm: 0 0 0 1px color-mix(in oklch, var(--accent), transparent 72%),
                       0 0 10px -2px color-mix(in oklch, var(--accent), transparent 65%);
  --bc-glow-cyan: 0 0 18px -2px color-mix(in oklch, var(--bc-accent-4), transparent 60%);
  --bc-radius-lg: var(--radius-lg);
  --bc-t-fast: 120ms;
  --bc-t-slow: 280ms;
  --bc-ease-out: cubic-bezier(0.22, 1, 0.36, 1);

  position: relative;
  min-height: 100vh;
  margin: -1rem -1.5rem 0;
  padding: 0;
  background: var(--bg-0);
  color: var(--fg-1);
  font-family: var(--font-ui);
  font-size: 14px;
  line-height: 1.55;

  &::before {
    position: absolute;
    z-index: 0;
    background:
      radial-gradient(1100px 700px at 90% -5%, color-mix(in oklch, var(--accent), transparent 85%), transparent 55%),
      radial-gradient(900px 600px at 10% 110%, color-mix(in oklch, var(--bc-accent-4), transparent 92%), transparent 60%);
    content: "";
    inset: 0;
    pointer-events: none;
  }

  // ==== Layout shell ====
  .drill-shell { position: relative; z-index: 1; display: grid; grid-template-columns: 240px 1fr; min-height: 100vh; }
  .drill-sidebar { padding: 20px 14px; border-right: 1px solid var(--line-soft); display: flex; flex-direction: column; gap: 18px; }
  .drill-main { padding: 28px 36px 120px; }

  // The rest (hero, schedule, tags table, sidebar widgets) is filled in over
  // tasks 15–23.
}
```

- [ ] **Step 2: Add the import**

Edit `bordercore/static/scss/bordercore.scss` line 80 area, add:

```scss
@import "pages/drill-refined";
```

(Adjacent to the other refined imports.)

- [ ] **Step 3: Build CSS to verify it compiles**

Run: `npm --prefix bordercore run vite:build 2>&1 | tail -30`
Expected: build succeeds with no SCSS errors.

- [ ] **Step 4: Commit**

```bash
git add bordercore/static/scss/pages/_drill-refined.scss bordercore/static/scss/bordercore.scss
git commit -m "Scaffold .drill-app scoped SCSS"
```

---

## Task 15: Build `ProgressRing` + `RingDefs`

**Files:**
- Create: `bordercore/front-end/react/drill/components/ProgressRing.tsx`
- Create: `bordercore/front-end/react/drill/components/RingDefs.tsx`
- Modify: `bordercore/static/scss/pages/_drill-refined.scss` (append `.drill-ring` block)

- [ ] **Step 1: Create `RingDefs.tsx`**

```tsx
import React from "react";

export default function RingDefs() {
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden>
      <defs>
        <linearGradient id="ringPurple" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--accent)" />
          <stop offset="100%" stopColor="var(--bc-accent-2)" />
        </linearGradient>
        <linearGradient id="ringCyan" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--bc-accent-4)" />
          <stop offset="100%" stopColor="var(--bc-accent-2)" />
        </linearGradient>
      </defs>
    </svg>
  );
}
```

- [ ] **Step 2: Create `ProgressRing.tsx`**

```tsx
import React from "react";

interface Props {
  pct: number;
  variant?: "purple" | "cyan";
  suffix?: string;
}

export default function ProgressRing({ pct, variant = "purple", suffix = "reviewed" }: Props) {
  const R = 44;
  const C = 2 * Math.PI * R;
  const offset = C - (pct / 100) * C;
  return (
    <div className="drill-ring">
      <svg viewBox="0 0 100 100">
        <circle className="track" cx="50" cy="50" r={R} fill="none" strokeWidth="8" />
        <circle
          className={`fill ${variant === "cyan" ? "cyan" : ""}`}
          cx="50" cy="50" r={R} fill="none" strokeWidth="8"
          strokeDasharray={C} strokeDashoffset={offset}
        />
      </svg>
      <div className="label">
        <span className="pct">{pct}<span className="sign">%</span></span>
        <span className="suffix">{suffix}</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Append SCSS**

Append inside `.drill-app { … }` in `_drill-refined.scss`:

```scss
.drill-ring {
  position: relative;
  flex: 0 0 auto;
  width: 108px;
  height: 108px;

  svg { width: 100%; height: 100%; transform: rotate(-90deg); }
  .track { stroke: var(--bg-3); }
  .fill {
    stroke: url(#ringPurple);
    stroke-linecap: round;
    transition: stroke-dashoffset var(--bc-t-slow) var(--bc-ease-out);
    &.cyan { stroke: url(#ringCyan); }
  }
  .label {
    position: absolute; inset: 0;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
  }
  .pct { font: 700 24px/1 "Space Grotesk", var(--font-ui); color: var(--fg-1); letter-spacing: -0.02em; }
  .pct .sign { font-size: 14px; color: var(--fg-3); margin-left: 1px; }
  .suffix {
    font: 500 9.5px/1 var(--font-mono);
    text-transform: uppercase; letter-spacing: 0.1em;
    color: var(--fg-3); margin-top: 3px;
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add bordercore/front-end/react/drill/components/ bordercore/static/scss/pages/_drill-refined.scss
git commit -m "Add ProgressRing + RingDefs components"
```

---

## Task 16: Build `ActionCard`

**Files:**
- Create: `bordercore/front-end/react/drill/components/ActionCard.tsx`
- Modify: `_drill-refined.scss` (append `.drill-card`, `.drill-hero-action`, button blocks)

- [ ] **Step 1: Create the component**

```tsx
import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBolt, faPlay, faPlus } from "@fortawesome/free-solid-svg-icons";
import type { SessionPayload, DrillUrls } from "../types";

interface Props {
  streak: number;
  session: SessionPayload | null;
  scope: string;
  urls: DrillUrls;
  onStudy: () => void;
  onNewQuestion: () => void;
}

export default function ActionCard({ streak, session, scope, urls, onStudy, onNewQuestion }: Props) {
  return (
    <section className="drill-card drill-hero-action">
      <div className="card-eyebrow">
        <h3>next session</h3>
        <span className="meta">streak · {streak} days</span>
      </div>
      <p className="prompt">
        Click <span className="hl">Study</span> to start a session, or pick a tag from the
        list below to drill on a specific category.
      </p>
      <div className="cta-row">
        <button className="drill-btn-huge" onClick={onStudy}>
          <FontAwesomeIcon icon={faBolt} />
          <span>Study</span>
          <span className="kbd">⇧S</span>
        </button>
        {session && (
          <a className="drill-btn-secondary" href={urls.resume}>
            <FontAwesomeIcon icon={faPlay} className="i" />
            <span>Resume</span>
          </a>
        )}
      </div>
      {session && (
        <div className="drill-session-status">
          <span className="pulse" />
          <span>
            studying <span className="link">{session.scopeLabel}</span> · {session.completed} of {session.total} done
            {session.nextIn && <> · next <span className="accent">{session.nextIn}</span></>}
          </span>
        </div>
      )}
      <div className="drill-newq">
        <button onClick={onNewQuestion}>
          <FontAwesomeIcon icon={faPlus} />
          <span>New question</span>
        </button>
        <span className="hint">⌘N</span>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Append SCSS**

Append (inside `.drill-app`):

```scss
.drill-card {
  position: relative;
  padding: 20px 22px;
  background: var(--bg-2);
  border: 1px solid var(--line-soft);
  border-radius: var(--bc-radius-lg);
  box-shadow: var(--bc-elev-2);
  overflow: hidden;

  .card-eyebrow { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
  h3 { font: 600 11px/1 var(--font-ui); text-transform: uppercase; letter-spacing: 0.12em; color: var(--fg-3); margin: 0; }
  .card-eyebrow .meta { font-family: var(--font-mono); font-size: 11px; color: var(--fg-3); }
}

.drill-hero {
  display: grid;
  grid-template-columns: 1.35fr 1fr 1fr;
  gap: 16px;
  margin-bottom: 20px;
}

.drill-hero-action {
  background:
    radial-gradient(600px 300px at 0% 0%, color-mix(in oklch, var(--accent), transparent 78%), transparent 60%),
    radial-gradient(500px 260px at 100% 100%, color-mix(in oklch, var(--bc-accent-4), transparent 90%), transparent 55%),
    var(--bg-2);
  border-color: color-mix(in oklch, var(--accent), transparent 75%);

  .prompt { font: 500 15px/1.5 var(--font-ui); color: var(--fg-1); margin: 0 0 18px; max-width: 340px; }
  .prompt .hl { color: var(--accent); font-weight: 600; }
  .cta-row { display: flex; gap: 10px; margin-bottom: 16px; flex-wrap: wrap; }
}

.drill-btn-huge {
  display: inline-flex; align-items: center; gap: 10px;
  padding: 12px 18px;
  font: 600 14px/1 var(--font-ui);
  border-radius: 10px;
  background: linear-gradient(180deg, var(--accent), color-mix(in oklch, var(--accent), black 12%));
  color: var(--accent-fg);
  border: 1px solid rgb(255 255 255 / 14%);
  box-shadow:
    0 0 0 1px color-mix(in oklch, var(--accent), transparent 65%),
    0 12px 30px -10px color-mix(in oklch, var(--accent), transparent 45%),
    inset 0 1px 0 rgb(255 255 255 / 20%);
  cursor: pointer;
  transition: all var(--bc-t-fast) var(--bc-ease-out);

  &:hover { filter: brightness(1.08); transform: translateY(-1px); }
  &:active { transform: translateY(0); }
  .kbd { font-family: var(--font-mono); font-size: 11px; opacity: 0.72; padding-left: 6px; border-left: 1px solid rgb(255 255 255 / 20%); }
}

.drill-btn-secondary {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 12px 16px;
  font: 500 13px/1 var(--font-ui);
  border-radius: 10px;
  background: var(--bg-3);
  color: var(--fg-1);
  border: 1px solid var(--line-soft);
  cursor: pointer;
  text-decoration: none;
  transition: all var(--bc-t-fast) var(--bc-ease-out);

  &:hover { background: color-mix(in oklch, var(--bg-3), white 5%); border-color: var(--line); }
  .i { color: var(--bc-accent-4); }
}

.drill-session-status {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 12px;
  background: color-mix(in oklch, var(--bg-1), transparent 50%);
  border: 1px dashed var(--line-soft);
  border-radius: 10px;
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--fg-2);

  .pulse {
    width: 7px; height: 7px; border-radius: 50%;
    background: var(--ok);
    box-shadow: 0 0 10px var(--ok);
    animation: drill-pulse 1.8s ease-in-out infinite;
  }
  .link { color: var(--accent); }
  .accent { color: var(--accent); }
}

@keyframes drill-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }

.drill-newq {
  margin-top: 14px;
  padding-top: 14px;
  border-top: 1px solid var(--bc-hairline);
  display: flex; align-items: center; gap: 10px;

  button {
    display: inline-flex; align-items: center; gap: 8px;
    padding: 9px 14px;
    background: transparent;
    border: 1px solid var(--line-soft);
    border-radius: 8px;
    color: var(--fg-1);
    font: 500 12.5px/1 var(--font-ui);
    cursor: pointer;
    transition: all var(--bc-t-fast) var(--bc-ease-out);

    &:hover { background: var(--bg-3); border-color: var(--line); }
  }
  .hint { font-family: var(--font-mono); font-size: 11px; color: var(--fg-3); }
}
```

- [ ] **Step 3: Commit**

```bash
git add bordercore/front-end/react/drill/components/ActionCard.tsx bordercore/static/scss/pages/_drill-refined.scss
git commit -m "Add ActionCard component + hero-action styles"
```

---

## Task 17: Build `ProgressCard` (used 2x: total + favorites)

**Files:**
- Create: `bordercore/front-end/react/drill/components/ProgressCard.tsx`
- Modify: `_drill-refined.scss` (append `.drill-progress-card`, `.drill-mini-bar`)

- [ ] **Step 1: Create component**

```tsx
import React from "react";
import ProgressRing from "./ProgressRing";
import type { ProgressBlock } from "../types";

interface Props {
  label: string;
  meta: string;
  data: ProgressBlock;
  variant: "purple" | "cyan";
  desc: string;
  split?: { k: string; v: string }[];
}

export default function ProgressCard({ label, meta, data, variant, desc, split }: Props) {
  return (
    <section className="drill-card drill-progress-card">
      <div className="card-eyebrow">
        <h3>{label}</h3>
        <span className="meta">{meta}</span>
      </div>
      <div className="body">
        <ProgressRing pct={data.pct} variant={variant} />
        <div className="desc">
          <span className="lead">{desc}</span>
          <span className="count">
            <span className="num">{data.remaining}</span> of {data.total} questions need review
          </span>
          {split && (
            <div className="split">
              {split.map(s => <span key={s.k}><b>{s.v}</b> {s.k}</span>)}
            </div>
          )}
        </div>
      </div>
      <div className={`drill-mini-bar ${variant === "cyan" ? "cyan" : ""}`}>
        <div className="seg" style={{ width: `${data.pct}%` }} />
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Append SCSS**

```scss
.drill-progress-card {
  .body { display: flex; gap: 18px; align-items: center; }
  .desc { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
  .desc .lead { font: 400 13px/1.5 var(--font-ui); color: var(--fg-1); }
  .desc .count {
    display: inline-flex; align-items: baseline; gap: 6px;
    font-family: var(--font-mono); font-size: 12px; color: var(--fg-3);
  }
  .desc .count .num { font: 600 16px/1 var(--font-mono); color: var(--bc-accent-4); }
  .desc .split { display: flex; gap: 12px; margin-top: 6px; font-family: var(--font-mono); font-size: 11px; color: var(--fg-3); }
  .desc .split b { color: var(--fg-1); font-weight: 600; }
}

.drill-mini-bar {
  position: relative;
  margin-top: 14px;
  height: 4px; border-radius: 2px;
  background: var(--bg-3);
  overflow: hidden;

  .seg {
    position: absolute; top: 0; bottom: 0; left: 0;
    background: linear-gradient(90deg, var(--accent), var(--bc-accent-2));
    border-radius: 2px;
  }
  &.cyan .seg { background: linear-gradient(90deg, var(--bc-accent-4), var(--bc-accent-2)); }
}
```

- [ ] **Step 3: Commit**

```bash
git add bordercore/front-end/react/drill/components/ProgressCard.tsx bordercore/static/scss/pages/_drill-refined.scss
git commit -m "Add ProgressCard component"
```

---

## Task 18: Build `ScheduleStrip`

**Files:**
- Create: `bordercore/front-end/react/drill/components/ScheduleStrip.tsx`
- Modify: `_drill-refined.scss` (append `.drill-schedule`)

- [ ] **Step 1: Create component**

```tsx
import React from "react";
import type { ScheduleDay } from "../types";

interface Props { days: ScheduleDay[]; overdueDays: number; weekLabel: string; }

const stateLabel = (d: ScheduleDay) =>
  d.state === "empty" ? "—"
  : d.state === "today" || d.state === "over" ? `${d.due} due`
  : `${d.due} est`;

export default function ScheduleStrip({ days, overdueDays, weekLabel }: Props) {
  return (
    <section className="drill-card">
      <div className="head">
        <div className="title">
          <h2>Review Schedule</h2>
          {overdueDays > 0 && <span className="count-chip hot">{overdueDays} days overdue</span>}
        </div>
        <span className="week-meta">{weekLabel}</span>
      </div>
      <div className="drill-schedule">
        {days.map(d => (
          <div key={d.dow + d.date} className={`day ${d.state}`}>
            <div className="dow">{d.dow}</div>
            <div className="date">{d.date}</div>
            <div className="n">{stateLabel(d)}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Append SCSS**

```scss
.drill-card .head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; padding-bottom: 12px; border-bottom: 1px solid var(--bc-hairline); }
.drill-card .head .title { display: flex; align-items: baseline; gap: 10px; }
.drill-card .head .title h2 { margin: 0; font: 600 17px/1.2 "Space Grotesk", var(--font-ui); }
.drill-card .head .title .count-chip {
  font-family: var(--font-mono); font-size: 11px;
  padding: 2px 8px; border-radius: 999px;
  background: var(--bg-3); border: 1px solid var(--line-soft); color: var(--fg-3);

  &.hot {
    color: var(--danger);
    border-color: color-mix(in oklch, var(--danger), transparent 65%);
    background: color-mix(in oklch, var(--danger), transparent 88%);
  }
}
.drill-card .head .week-meta { font-family: var(--font-mono); font-size: 11px; color: var(--fg-3); }

.drill-schedule {
  display: flex; gap: 6px;
  margin-top: 12px;
  padding-top: 14px;
  border-top: 1px solid var(--bc-hairline);

  .day {
    flex: 1;
    background: var(--bg-1);
    border: 1px solid var(--line-soft);
    border-radius: 8px;
    padding: 8px 6px;
    text-align: center;
    position: relative;

    .dow { font: 500 9.5px/1 var(--font-mono); text-transform: uppercase; letter-spacing: 0.08em; color: var(--fg-3); margin-bottom: 5px; }
    .date { font: 600 13px/1 "Space Grotesk", var(--font-ui); color: var(--fg-1); margin-bottom: 6px; }
    .n { font: 500 11px/1 var(--font-mono); color: var(--fg-2); }

    &.today { border-color: var(--accent); background: color-mix(in oklch, var(--accent), transparent 90%); box-shadow: var(--bc-glow-accent-sm); }
    &.today .date, &.today .n { color: var(--accent); }
    &.over { border-color: color-mix(in oklch, var(--danger), transparent 70%); }
    &.over .n { color: var(--danger); }
    &.empty .n { color: var(--bc-fg-disabled); }
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add bordercore/front-end/react/drill/components/ScheduleStrip.tsx bordercore/static/scss/pages/_drill-refined.scss
git commit -m "Add ScheduleStrip component"
```

---

## Task 19: Build `TagsNeedingReview` (left of body grid)

**Files:**
- Create: `bordercore/front-end/react/drill/components/TagsNeedingReview.tsx`
- Modify: `_drill-refined.scss`

- [ ] **Step 1: Create component**

```tsx
import React, { useMemo, useState } from "react";
import type { TagProgressRow } from "../types";

type Mode = "all" | "critical" | "recent";

interface Props { tags: TagProgressRow[]; }

export default function TagsNeedingReview({ tags }: Props) {
  const [mode, setMode] = useState<Mode>("all");
  const filtered = useMemo(() => {
    if (mode === "critical") return tags.filter(t => (t.overdueDays ?? 0) > 295);
    if (mode === "recent")   return tags.filter(t => (t.overdueDays ?? 0) <= 290);
    return tags;
  }, [mode, tags]);

  return (
    <section className="drill-card">
      <div className="head">
        <div className="title">
          <h2>Tags needing review</h2>
          <span className="count-chip hot">{tags.length} overdue</span>
        </div>
        <div className="drill-tags-filter">
          {(["all", "critical", "recent"] as Mode[]).map(m => (
            <button key={m} className={mode === m ? "active" : ""} onClick={() => setMode(m)}>
              {m}
            </button>
          ))}
        </div>
      </div>
      <div className="drill-card-thead">
        <span>tag</span><span>overdue</span><span>last reviewed · questions</span>
      </div>
      <div className="drill-tag-scroll">
        {filtered.map(t => (
          <a key={t.name} className="drill-tag-row" href={t.url}>
            <span className="name">
              <span className={`pip ${t.pip || "accent"}`} />
              <span className="text">{t.name}</span>
            </span>
            <span className={`overdue-days ${(t.overdueDays ?? 0) <= 295 ? "warn" : ""}`}>
              +{t.overdueDays ?? 0}d
            </span>
            <span className="meta-right">
              <span className="last">{t.last_reviewed}</span>
              <span className="count">{t.count}q</span>
            </span>
          </a>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Append SCSS** (full block — see kit.css `.drill-card-thead`/`.drill-tag-row`/`.drill-tags-filter` lines 209-297; translate hex to tokens identically to prior tasks). Key swaps:

- `var(--bc-bg-3)` → `var(--bg-3)`
- `var(--bc-fg-1/2/3/4)` → `var(--fg-1/1/2/3)` (note: codebase has only `--fg-0..3`)
- `rgba(179,107,255,0.x)` → `color-mix(in oklch, var(--accent), transparent <100-x>%)`
- `rgba(255,85,119,0.x)` → `color-mix(in oklch, var(--danger), transparent <100-x>%)`
- `rgba(240,184,64,0.x)` → `color-mix(in oklch, var(--warn), transparent <100-x>%)`

Also add:

```scss
.drill-tag-scroll { max-height: 520px; overflow-y: auto; margin-top: 2px; padding-right: 4px; }
.drill-tag-row .meta-right { display: flex; gap: 12px; align-items: center; justify-content: flex-end; }
```

- [ ] **Step 3: Commit**

```bash
git add bordercore/front-end/react/drill/components/TagsNeedingReview.tsx bordercore/static/scss/pages/_drill-refined.scss
git commit -m "Add TagsNeedingReview component"
```

---

## Task 20: `PinnedTagsCard` — wrap existing `DrillPinnedTags` in new chrome

**Files:**
- Create: `bordercore/front-end/react/drill/components/PinnedTagsCard.tsx`

The existing `DrillPinnedTags` already handles fetch + drag-reorder + pin/unpin. Reuse it. Wrap in a `.drill-card` shell to inherit the new look. (No new SCSS needed beyond what `.drill-card .head` already gives us.)

- [ ] **Step 1: Create the wrapper**

```tsx
import React from "react";
import DrillPinnedTags from "../DrillPinnedTags";
import type { DrillUrls } from "../types";

interface Props { urls: DrillUrls; }

export default function PinnedTagsCard({ urls }: Props) {
  return (
    <section className="drill-card drill-pinned-card">
      <DrillPinnedTags
        getPinnedTagsUrl={urls.getPinnedTags}
        pinTagUrl={urls.pinTag}
        unpinTagUrl={urls.unpinTag}
        sortPinnedTagsUrl={urls.sortPinnedTags}
        tagSearchUrl={urls.tagSearch}
      />
    </section>
  );
}
```

- [ ] **Step 2: Add minimal SCSS to neutralize `Card` chrome bleed**

Append:

```scss
.drill-pinned-card .card { background: transparent; border: none; box-shadow: none; padding: 0; }
.drill-pinned-card .card-body { padding: 0; }
```

- [ ] **Step 3: Commit**

```bash
git add bordercore/front-end/react/drill/components/PinnedTagsCard.tsx bordercore/static/scss/pages/_drill-refined.scss
git commit -m "Add PinnedTagsCard wrapping existing DrillPinnedTags"
```

---

## Task 21: `FeaturedTagCard`

**Files:**
- Create: `bordercore/front-end/react/drill/components/FeaturedTagCard.tsx`
- Modify: `_drill-refined.scss`

- [ ] **Step 1: Create component**

```tsx
import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faMagnifyingGlass } from "@fortawesome/free-solid-svg-icons";
import type { FeaturedTag } from "../types";

interface Props { featured: FeaturedTag; onSearch: () => void; }

export default function FeaturedTagCard({ featured, onSearch }: Props) {
  const max = Math.max(1, ...featured.histo);
  return (
    <section className="drill-card drill-featured">
      <div className="head" style={{ border: "none", padding: 0, margin: 0 }}>
        <div className="title">
          Featured Tag: <a className="name" href={featured.url}>{featured.name}</a>
        </div>
        <button className="search-btn" onClick={onSearch} aria-label="Search tag">
          <FontAwesomeIcon icon={faMagnifyingGlass} />
        </button>
      </div>
      <div className="stats">
        <span className="bigpct">{featured.progress}<span className="sign">%</span></span>
        <div className="last-row">
          <span className="k">last reviewed</span>
          <span className="v">{featured.last_reviewed}</span>
        </div>
        <span className="questions">{featured.count} questions</span>
      </div>
      <div className="histo">
        {featured.histo.map((v, i) => (
          <div key={i} className={`bar ${v < max * 0.3 ? "dim" : ""}`}
               style={{ height: `${(v / max) * 100}%` }} />
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Append SCSS** (port kit.css lines 347-408, swap tokens). Key block:

```scss
.drill-featured {
  background:
    radial-gradient(500px 240px at 100% 0%, color-mix(in oklch, var(--bc-accent-4), transparent 80%), transparent 55%),
    linear-gradient(180deg, color-mix(in oklch, var(--accent), transparent 92%), transparent 70%),
    var(--bg-2);
  border-color: color-mix(in oklch, var(--bc-accent-4), transparent 75%);
  box-shadow: 0 8px 24px -8px rgb(0 0 0 / 55%), 0 0 0 1px color-mix(in oklch, var(--bc-accent-4), transparent 80%);

  .head .title { font: 600 16px/1.2 "Space Grotesk", var(--font-ui); color: var(--fg-1); }
  .head .title .name { color: var(--bc-accent-4); font-family: var(--font-mono); text-decoration: none; }
  .search-btn { background: transparent; border: 1px solid var(--line-soft); color: var(--fg-3); width: 30px; height: 30px; border-radius: 8px; cursor: pointer; display: grid; place-items: center; }
  .search-btn:hover { color: var(--fg-1); border-color: var(--line); }

  .stats { display: grid; grid-template-columns: auto 1fr auto; gap: 14px; align-items: center; padding: 12px 0; }
  .bigpct { font: 700 38px/1 "Space Grotesk", var(--font-ui); color: var(--bc-accent-4); letter-spacing: -0.02em; }
  .bigpct .sign { font-size: 18px; color: var(--fg-3); }
  .last-row { display: flex; flex-direction: column; gap: 3px; font-family: var(--font-mono); font-size: 11px; }
  .last-row .k { color: var(--fg-3); text-transform: uppercase; letter-spacing: 0.08em; font-size: 10px; }
  .last-row .v { color: var(--fg-1); font-size: 12.5px; }
  .questions { font-family: var(--font-mono); font-size: 11px; color: var(--bc-accent-4); text-align: right; }

  .histo { display: flex; gap: 3px; align-items: flex-end; height: 36px; margin-top: 10px; padding-top: 12px; border-top: 1px dashed var(--bc-hairline); }
  .histo .bar { flex: 1; border-radius: 2px; background: linear-gradient(180deg, color-mix(in oklch, var(--bc-accent-4), transparent 40%), color-mix(in oklch, var(--bc-accent-4), transparent 88%)); min-height: 4px; }
  .histo .bar.dim { background: var(--bg-3); }
}
```

- [ ] **Step 3: Commit**

```bash
git add bordercore/front-end/react/drill/components/FeaturedTagCard.tsx bordercore/static/scss/pages/_drill-refined.scss
git commit -m "Add FeaturedTagCard component"
```

---

## Task 22: `DisabledTagsCard` — wrap existing `DrillDisabledTags`

**Files:**
- Create: `bordercore/front-end/react/drill/components/DisabledTagsCard.tsx`

- [ ] **Step 1: Create wrapper**

```tsx
import React from "react";
import DrillDisabledTags from "../DrillDisabledTags";
import type { DrillUrls } from "../types";

interface Props { urls: DrillUrls; }

export default function DisabledTagsCard({ urls }: Props) {
  return (
    <section className="drill-card drill-disabled-card">
      <DrillDisabledTags
        getDisabledTagsUrl={urls.getDisabledTags}
        disableTagUrl={urls.disableTag}
        enableTagUrl={urls.enableTag}
        tagSearchUrl={urls.tagSearch}
      />
    </section>
  );
}
```

Reuse the same neutralize-Card-chrome SCSS pattern from Task 20:

```scss
.drill-disabled-card .card { background: transparent; border: none; box-shadow: none; padding: 0; }
.drill-disabled-card .card-body { padding: 0; }
```

- [ ] **Step 2: Commit**

```bash
git add bordercore/front-end/react/drill/components/DisabledTagsCard.tsx bordercore/static/scss/pages/_drill-refined.scss
git commit -m "Add DisabledTagsCard wrapper"
```

---

## Task 23: Build the `Sidebar` and its sub-blocks

**Files:**
- Create: `bordercore/front-end/react/drill/components/Sidebar.tsx`
- Create: `bordercore/front-end/react/drill/components/StudyScopeNav.tsx`
- Create: `bordercore/front-end/react/drill/components/IntervalsBlock.tsx`
- Create: `bordercore/front-end/react/drill/components/ByResponseNav.tsx`
- Create: `bordercore/front-end/react/drill/components/SessionMeta.tsx`
- Create: `bordercore/front-end/react/drill/components/ActivityHeatmap.tsx`
- Create: `bordercore/front-end/react/drill/components/RecentResponses.tsx`
- Modify: `_drill-refined.scss`

- [ ] **Step 1: `StudyScopeNav.tsx`**

```tsx
import React from "react";
import type { StudyScopeItem, DrillUrls } from "../types";

interface Props { items: StudyScopeItem[]; urls: DrillUrls; activeKey: string; onSelect: (key: string) => void; }

export default function StudyScopeNav({ items, urls, activeKey, onSelect }: Props) {
  return (
    <div>
      <h3>study scope</h3>
      <div className="drill-nav">
        {items.map(item => (
          <a
            key={item.key}
            className={`drill-nav-item ${activeKey === item.key ? "active" : ""}`}
            href={`${urls.startStudySession}?study_method=${item.key}`}
            onClick={() => onSelect(item.key)}
          >
            <span className="label">{item.label}</span>
            {item.count !== null && <span className="count">{item.count}</span>}
          </a>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: `IntervalsBlock.tsx`**

```tsx
import React from "react";

interface Props { intervals: number[]; }

export default function IntervalsBlock({ intervals }: Props) {
  if (!intervals.length) return null;
  const last = intervals[intervals.length - 1];
  return (
    <div>
      <h3>intervals</h3>
      <div className="drill-intervals">
        <span className="comment">// spaced-repetition</span>
        <div className="ladder">
          {intervals.map((d, i) => (
            <React.Fragment key={i}>
              <span className={d === last && i === intervals.length - 1 ? "accent" : ""}>{d}d</span>
              {i < intervals.length - 1 && <span className="arrow">→</span>}
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: `ByResponseNav.tsx`**

```tsx
import React from "react";
import type { ResponseKind } from "../types";

const SWATCHES: Record<ResponseKind, string> = {
  easy: "var(--ok)", good: "var(--bc-accent-2)",
  hard: "var(--warn)", reset: "var(--danger)",
};

interface Props { counts: Record<ResponseKind, number>; }

export default function ByResponseNav({ counts }: Props) {
  return (
    <div>
      <h3>by response</h3>
      <div className="drill-nav">
        {(Object.keys(SWATCHES) as ResponseKind[]).map(k => (
          <div key={k} className="drill-nav-item">
            <span className="swatch" style={{ background: SWATCHES[k] }} />
            <span className="label">{k}</span>
            <span className="count">{counts[k]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: `SessionMeta.tsx`**

```tsx
import React from "react";

interface Props {
  nextDue: string | null;
  streak: number;
  reviewedToday: number;
  reviewedWeek: number;
}

export default function SessionMeta({ nextDue, streak, reviewedToday, reviewedWeek }: Props) {
  return (
    <div>
      <h3>session</h3>
      <div className="drill-sidebar-meta">
        {nextDue && <div className="meta-row"><span className="k">next due</span><span className="accent">{nextDue}</span></div>}
        <div className="meta-row"><span className="k">streak</span><span className="ok">{streak} days ✓</span></div>
        <div className="meta-row"><span className="k">today</span><span className="v">{reviewedToday}q reviewed</span></div>
        <div className="meta-row"><span className="k">7d</span><span className="v">{reviewedWeek}q reviewed</span></div>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: `ActivityHeatmap.tsx`**

```tsx
import React from "react";

interface Props { counts: number[]; }

const level = (n: number, max: number): 0 | 1 | 2 | 3 | 4 => {
  if (n === 0) return 0;
  const ratio = n / max;
  if (ratio <= 0.25) return 1;
  if (ratio <= 0.5) return 2;
  if (ratio <= 0.75) return 3;
  return 4;
};

export default function ActivityHeatmap({ counts }: Props) {
  const max = Math.max(1, ...counts);
  return (
    <div>
      <h3>activity · 28d</h3>
      <div className="drill-heatmap">
        {counts.map((n, i) => (
          <span key={i} className={`cell lv-${level(n, max)}`} title={`day ${i + 1} · ${n}q`} />
        ))}
      </div>
      <div className="drill-heatmap-legend">
        <span>less</span>
        {[0, 1, 2, 3, 4].map(l => <span key={l} className={`cell lv-${l}`} />)}
        <span>more</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 6: `RecentResponses.tsx`**

```tsx
import React from "react";
import type { RecentResponse } from "../types";

const dotClass = (r: RecentResponse["response"]) => {
  switch (r) {
    case "easy": return "ok";
    case "good": return "info";
    case "hard": return "warn";
    case "reset": return "danger";
  }
};

interface Props { items: RecentResponse[]; }

export default function RecentResponses({ items }: Props) {
  return (
    <div>
      <h3>recent responses</h3>
      <ul className="drill-recent">
        {items.map((r, i) => (
          <li key={i}>
            <span className={`dot ${dotClass(r.response)}`} />
            <span className="txt">{r.question}</span>
            <span className="t">{r.ago}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 7: `Sidebar.tsx` composing them all**

```tsx
import React from "react";
import StudyScopeNav from "./StudyScopeNav";
import IntervalsBlock from "./IntervalsBlock";
import ByResponseNav from "./ByResponseNav";
import SessionMeta from "./SessionMeta";
import ActivityHeatmap from "./ActivityHeatmap";
import RecentResponses from "./RecentResponses";
import type { DrillPayload } from "../types";

interface Props { payload: DrillPayload; activeScope: string; onSelectScope: (key: string) => void; }

export default function Sidebar({ payload, activeScope, onSelectScope }: Props) {
  return (
    <aside className="drill-sidebar">
      <StudyScopeNav
        items={payload.studyScope}
        urls={payload.urls}
        activeKey={activeScope}
        onSelect={onSelectScope}
      />
      <IntervalsBlock intervals={payload.intervals} />
      <ByResponseNav counts={payload.responsesByKind} />
      <SessionMeta
        nextDue={payload.nextDue}
        streak={payload.streak}
        reviewedToday={payload.totalProgress.reviewedToday}
        reviewedWeek={payload.totalProgress.reviewedWeek}
      />
      <ActivityHeatmap counts={payload.activity28d} />
      <RecentResponses items={payload.recentResponses} />
    </aside>
  );
}
```

- [ ] **Step 8: Append SCSS for sidebar widgets**

Port from kit.css lines 493-568 + the bc-sidebar block from `_shared.css:64-99`. Map tokens identically. Skeleton:

```scss
.drill-sidebar h3 { font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em; color: var(--fg-3); margin: 0 8px 6px; font-weight: 600; }
.drill-nav { display: flex; flex-direction: column; gap: 2px; }
.drill-nav-item {
  display: flex; align-items: center; gap: 10px;
  padding: 7px 10px; border-radius: 8px;
  color: var(--fg-1); font: 500 13px/1.2 var(--font-ui);
  background: transparent; border: 1px solid transparent;
  text-decoration: none; cursor: pointer;
  transition: all var(--bc-t-fast) var(--bc-ease-out);

  &:hover { background: var(--bg-2); border-color: var(--line-soft); }
  &.active {
    background: color-mix(in oklch, var(--accent), transparent 90%);
    border-color: color-mix(in oklch, var(--accent), transparent 70%);
    box-shadow: 0 0 14px -4px color-mix(in oklch, var(--accent), transparent 55%);
  }
  .count { margin-left: auto; font-family: var(--font-mono); font-size: 11px; color: var(--fg-3); }
  &.active .count { color: var(--accent); }
  .swatch { width: 8px; height: 8px; border-radius: 2px; }
}

.drill-intervals {
  padding: 0 8px;
  font-family: var(--font-mono); font-size: 11.5px;
  color: var(--fg-2); line-height: 1.9;
  .comment { color: var(--fg-3); display: block; }
  .ladder { display: inline; }
  .arrow { color: var(--fg-3); margin: 0 4px; }
  .accent { color: var(--accent); }
}

.drill-sidebar-meta {
  padding: 10px 12px;
  background: color-mix(in oklch, var(--bg-2), transparent 40%);
  border: 1px dashed var(--line-soft);
  border-radius: 10px;
  font-family: var(--font-mono); font-size: 11px; color: var(--fg-2);
  display: flex; flex-direction: column; gap: 6px;

  .meta-row { display: flex; justify-content: space-between; align-items: baseline; gap: 10px; }
  .k { color: var(--fg-3); text-transform: uppercase; letter-spacing: 0.06em; font-size: 10px; }
  .v { color: var(--fg-1); }
  .accent { color: var(--accent); }
  .ok { color: var(--ok); }
}

.drill-heatmap {
  display: grid; grid-template-columns: repeat(7, 1fr); gap: 3px; padding: 0 8px;

  .cell { aspect-ratio: 1; border-radius: 3px; background: var(--bg-3); border: 1px solid var(--line-soft); }
  .cell.lv-0 { background: var(--bg-3); }
  .cell.lv-1 { background: color-mix(in oklch, var(--accent), transparent 78%); border-color: color-mix(in oklch, var(--accent), transparent 82%); }
  .cell.lv-2 { background: color-mix(in oklch, var(--accent), transparent 58%); border-color: color-mix(in oklch, var(--accent), transparent 70%); }
  .cell.lv-3 { background: color-mix(in oklch, var(--accent), transparent 35%); border-color: color-mix(in oklch, var(--accent), transparent 60%); }
  .cell.lv-4 { background: var(--accent); border-color: var(--bc-accent-2); box-shadow: 0 0 6px color-mix(in oklch, var(--accent), transparent 40%); }
}
.drill-heatmap-legend {
  display: flex; align-items: center; gap: 4px; padding: 8px 8px 0;
  font-family: var(--font-mono); font-size: 10px; color: var(--fg-3);
  .cell { width: 10px; height: 10px; border-radius: 2px; border: 1px solid var(--line-soft); }
}

.drill-recent {
  list-style: none; padding: 0 8px; margin: 0;
  display: flex; flex-direction: column; gap: 6px;

  li { display: flex; align-items: center; gap: 8px; padding: 5px 8px; border-radius: 6px; font-size: 12px; color: var(--fg-1); transition: background var(--bc-t-fast); }
  li:hover { background: var(--bg-2); }
  .dot { width: 6px; height: 6px; border-radius: 50%; flex: 0 0 auto; }
  .dot.ok     { background: var(--ok);          box-shadow: 0 0 6px var(--ok); }
  .dot.info   { background: var(--bc-accent-4); box-shadow: 0 0 6px var(--bc-accent-4); }
  .dot.warn   { background: var(--warn);        box-shadow: 0 0 6px var(--warn); }
  .dot.danger { background: var(--danger);      box-shadow: 0 0 6px var(--danger); }
  .txt { flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .t { font-family: var(--font-mono); font-size: 10.5px; color: var(--fg-3); }
}
```

- [ ] **Step 9: Commit**

```bash
git add bordercore/front-end/react/drill/components/ bordercore/static/scss/pages/_drill-refined.scss
git commit -m "Add Sidebar and sub-block components"
```

---

## Task 24: Compose `DrillOverviewPage` (replaces stub)

**Files:**
- Modify: `bordercore/front-end/react/drill/DrillOverviewPage.tsx`

- [ ] **Step 1: Replace stub**

```tsx
import React, { useState, useCallback } from "react";
import RingDefs from "./components/RingDefs";
import Sidebar from "./components/Sidebar";
import ActionCard from "./components/ActionCard";
import ProgressCard from "./components/ProgressCard";
import ScheduleStrip from "./components/ScheduleStrip";
import TagsNeedingReview from "./components/TagsNeedingReview";
import PinnedTagsCard from "./components/PinnedTagsCard";
import FeaturedTagCard from "./components/FeaturedTagCard";
import DisabledTagsCard from "./components/DisabledTagsCard";
import type { DrillPayload } from "./types";

interface Props { payload: DrillPayload; }

export default function DrillOverviewPage({ payload }: Props) {
  const [activeScope, setActiveScope] = useState<string>(payload.session?.type ?? "all");

  const startStudy = useCallback(() => {
    window.location.href = `${payload.urls.startStudySession}?study_method=${activeScope}`;
  }, [activeScope, payload.urls.startStudySession]);

  const newQuestion = useCallback(() => {
    window.location.href = payload.urls.drillAdd;
  }, [payload.urls.drillAdd]);

  const overdueDays = payload.tagsNeedingReview.filter(t => (t.overdueDays ?? 0) > 0).length;
  const today = new Date();
  const weekLabel = `week of ${today.toLocaleString("en", { month: "short" }).toLowerCase()} ${
    today.getDate() - today.getDay() + 1
  }`;

  return (
    <div className="drill-shell">
      <RingDefs />
      <Sidebar payload={payload} activeScope={activeScope} onSelectScope={setActiveScope} />
      <main className="drill-main">
        <div className="drill-page-head">
          <h1>Drill <span className="dim">— spaced-repetition overview</span></h1>
          <p>Review your overdue tags, drill on a category, or start a global session.
             Intervals advance on <code>easy</code>/<code>good</code> and step back on <code>hard</code>.</p>
        </div>

        <div className="drill-hero">
          <ActionCard
            streak={payload.streak}
            session={payload.session}
            scope={activeScope}
            urls={payload.urls}
            onStudy={startStudy}
            onNewQuestion={newQuestion}
          />
          <ProgressCard
            label="total progress"
            meta={`${payload.totalProgress.total} questions`}
            data={payload.totalProgress}
            variant="purple"
            desc="Portion of your library not currently needing review."
            split={[
              { k: "today", v: `${payload.totalProgress.reviewedToday}q` },
              { k: "7d",    v: `${payload.totalProgress.reviewedWeek}q` },
            ]}
          />
          <ProgressCard
            label="favorites progress"
            meta={`${payload.favoritesProgress.total} starred`}
            data={payload.favoritesProgress}
            variant="cyan"
            desc="Portion of your starred questions currently on schedule."
            split={[
              { k: "due",  v: `${payload.favoritesProgress.remaining}q` },
              { k: "done", v: `${payload.favoritesProgress.total - payload.favoritesProgress.remaining}q` },
            ]}
          />
        </div>

        <ScheduleStrip days={payload.schedule} overdueDays={overdueDays} weekLabel={weekLabel} />

        <div className="drill-body-grid">
          <TagsNeedingReview tags={payload.tagsNeedingReview} />
          <div className="drill-side-stack">
            <PinnedTagsCard urls={payload.urls} />
            {payload.featured && <FeaturedTagCard featured={payload.featured} onSearch={() => {}} />}
            <DisabledTagsCard urls={payload.urls} />
          </div>
        </div>
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Append layout SCSS**

```scss
.drill-page-head { margin-bottom: 28px; }
.drill-page-head h1 { font: 600 24px/1.2 "Space Grotesk", var(--font-ui); letter-spacing: -0.01em; margin: 0; }
.drill-page-head h1 .dim { color: var(--fg-3); font-weight: 500; }
.drill-page-head p { color: var(--fg-2); margin-top: 6px; max-width: 620px; }

.drill-body-grid {
  display: grid;
  grid-template-columns: 1.6fr 1fr;
  gap: 16px;
  align-items: start;
  margin-top: 16px;
}
.drill-side-stack { display: flex; flex-direction: column; gap: 16px; }

@media (max-width: 1280px) {
  .drill-hero { grid-template-columns: 1fr 1fr; }
  .drill-hero-action { grid-column: 1 / -1; }
}
@media (max-width: 960px) {
  .drill-shell { grid-template-columns: 1fr; }
  .drill-sidebar { border-right: none; border-bottom: 1px solid var(--line-soft); }
  .drill-body-grid { grid-template-columns: 1fr; }
  .drill-hero { grid-template-columns: 1fr; }
  .drill-hero-action { grid-column: auto; }
}
```

- [ ] **Step 3: Typecheck + build**

```bash
npm --prefix bordercore run typecheck
npm --prefix bordercore run vite:build 2>&1 | tail -10
```

Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add bordercore/front-end/react/drill/DrillOverviewPage.tsx bordercore/static/scss/pages/_drill-refined.scss
git commit -m "Compose DrillOverviewPage with all sub-components"
```

---

## Task 25: Smoke test for `DrillOverviewPage`

**Files:**
- Create: `bordercore/front-end/react/drill/DrillOverviewPage.test.tsx`

- [ ] **Step 1: Add test**

```tsx
import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import DrillOverviewPage from "./DrillOverviewPage";
import type { DrillPayload } from "./types";

const payload: DrillPayload = {
  title: "Drill",
  urls: {
    drillList: "/drill/", drillAdd: "/drill/question/add/",
    startStudySession: "/drill/start_study_session", resume: "/drill/resume",
    getPinnedTags: "/drill/get_pinned_tags", pinTag: "/drill/pin_tag",
    unpinTag: "/drill/unpin_tag", sortPinnedTags: "/drill/sort_pinned_tags",
    getDisabledTags: "/drill/get_disabled_tags", disableTag: "/drill/disable_tag",
    enableTag: "/drill/enable_tag", tagSearch: "/tag/search",
  },
  session: null,
  studyScope: [
    { key: "all", label: "all questions", count: 642 },
    { key: "review", label: "needs review", count: 395 },
    { key: "favorites", label: "favorites", count: 51 },
    { key: "recent", label: "recent · 7d", count: 18 },
    { key: "random", label: "random · 10", count: 10 },
    { key: "keyword", label: "keyword search", count: null },
  ],
  intervals: [1, 2, 3, 5, 8, 13, 21, 30],
  responsesByKind: { easy: 412, good: 198, hard: 64, reset: 14 },
  totalProgress: { pct: 38, remaining: 395, total: 642, reviewedToday: 21, reviewedWeek: 148 },
  favoritesProgress: { pct: 27, remaining: 37, total: 51, reviewedToday: 4, reviewedWeek: 12 },
  schedule: [{ dow: "thu", date: "24", due: 395, state: "today" }],
  tagsNeedingReview: [{ name: "numpy", progress: 30, todo: 5, count: 22, last_reviewed: "Jun 27, 2025", url: "#", overdueDays: 301, pip: "danger" }],
  pinned: [], disabled: [], featured: null,
  streak: 17, nextDue: "in 02h 14m",
  activity28d: Array.from({ length: 28 }, (_, i) => i % 5),
  recentResponses: [{ question: "lambda calculus", response: "easy", ago: "2m" }],
};

describe("DrillOverviewPage", () => {
  it("renders the page head, hero, schedule, and tags table", () => {
    // Mock fetch for the wrapped DrillPinnedTags / DrillDisabledTags
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ tag_list: [] }) });

    render(<DrillOverviewPage payload={payload} />);
    expect(screen.getByText(/spaced-repetition overview/i)).toBeInTheDocument();
    expect(screen.getByText("all questions")).toBeInTheDocument();
    expect(screen.getByText(/Tags needing review/i)).toBeInTheDocument();
    expect(screen.getByText("numpy")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Study/i })).toBeInTheDocument();
    expect(screen.getByText(/17 days/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run, expect PASS**

```bash
npx vitest run --reporter=verbose front-end/react/drill/DrillOverviewPage.test.tsx
```

(Run from `bordercore/`.)

- [ ] **Step 3: Commit**

```bash
git add bordercore/front-end/react/drill/DrillOverviewPage.test.tsx
git commit -m "Add DrillOverviewPage smoke test"
```

---

## Task 26: Delete the old `DrillListPage`

**Files:**
- Delete: `bordercore/front-end/react/drill/DrillListPage.tsx`

- [ ] **Step 1: Verify nothing else imports it**

```bash
grep -rn "DrillListPage" bordercore/front-end/ bordercore/templates/
```

Expected: no matches besides the file itself.

- [ ] **Step 2: Delete**

```bash
git rm bordercore/front-end/react/drill/DrillListPage.tsx
```

- [ ] **Step 3: Typecheck + build**

```bash
npm --prefix bordercore run typecheck
npm --prefix bordercore run vite:build 2>&1 | tail -10
```

Expected: clean.

- [ ] **Step 4: Commit**

```bash
git commit -m "Delete legacy DrillListPage component"
```

---

## Task 27: Run all backend + frontend tests, fix any regressions

- [ ] **Step 1: Run drill backend tests**

```bash
.venv/bin/pytest bordercore/drill/tests/ -v 2>&1 | tail -40
```

Expected: all PASS. If any pre-existing failure surfaces (per memory: `test_data.py` lacks `django_db`; `aws/tests/test_lambdas.py` import broken), note it as pre-existing and ignore.

- [ ] **Step 2: Run frontend tests**

```bash
npm --prefix bordercore test 2>&1 | tail -30
```

Expected: all PASS.

- [ ] **Step 3: If anything fails, fix it before continuing.** Do not skip — root-cause + fix, then re-run.

---

## Task 28: Manual visual verification

- [ ] **Step 1: Start the dev server**

```bash
make runserver  # or whatever the project's standard runserver command is
```

In a parallel terminal, run vite dev:

```bash
npm --prefix bordercore run vite:dev
```

- [ ] **Step 2: Open `/drill/` in a browser, side-by-side with `design_handoff_drill_overview/screenshots/01-full-page.png`**

Verify:
- Sidebar order matches design (study scope → intervals → by response → session → activity → recent responses).
- Hero row: action card + 2 ring cards.
- Schedule strip below hero, with today highlighted in accent.
- Tags-needing-review table left of right stack (pinned → featured → disabled).
- Cards use the `.drill-card` chrome (rounded, subtle border, soft shadow).
- Topography matches: Inter body, Space Grotesk h1/h2, JetBrains Mono for counts/meta.

- [ ] **Step 3: Test the wired interactions**

- Sidebar nav items navigate to `?study_method=<key>`.
- Tag rows in the main table navigate to `?study_method=tag&tags=<name>`.
- Study button starts a session for the active scope.
- Resume button navigates to `drill:resume` (only visible when a session exists).
- Pin/unpin still works (DrillPinnedTags wrapped).

- [ ] **Step 4: Theme switch sanity**

Toggle the user's theme between dark / cobalt-abyss / cyberpunk via the user menu. Confirm tokens re-tint without breaking layout.

- [ ] **Step 5: If any visual or interaction issue is found, file a follow-up task in the conversation rather than silently editing — keep the plan honest about what shipped.**

---

## Self-review checklist (run after Task 28)

- Spec coverage: every section of `design_handoff_drill_overview/README.md` mapped to a task above? Walk through "Layout (top-level)", "Sidebar sections", "Components", "Review schedule strip", "Tags needing review", "Right stack", "Interactions & State", "Data Model Mapping" — each maps to Tasks 14-25.
- Placeholders: no "TBD"/"add validation"/etc. in this plan.
- Type consistency: `DrillPayload` definition (Task 12) keys match what view emits (Task 10) and what page consumes (Task 24).
- No hex literals in `_drill-refined.scss` after Task 14 (locals block is the one allowed exception).
