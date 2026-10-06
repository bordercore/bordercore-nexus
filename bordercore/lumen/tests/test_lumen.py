import json
import sqlite3
from datetime import timedelta
from io import StringIO
from unittest.mock import Mock

import pytest
import requests
from lumen import generation, services
from lumen.models import GenerationJob, LessonVersion, LumenPreferences
from lumen.themes import STYLES, themed_html

from django.core.management import call_command
from django.core.management.base import CommandError
from django.db import IntegrityError, transaction
from django.test import Client
from django.urls import reverse
from django.utils import timezone

from accounts.tests.factories import UserFactory
from drill.models import Question
from drill.tests.factories import QuestionFactory

pytestmark = pytest.mark.django_db
HTML = """<!DOCTYPE html><html><head><title>Pressure</title></head><body>
<label>Area <input id="area" type="range" min="1" max="10" value="2"></label>
<output id="pressure">50 Pa</output><button id="example">Try five</button>
<script>const area=document.getElementById('area');
area.addEventListener('input',()=>{document.getElementById('pressure').textContent=100/Number(area.value)+' Pa'});
document.getElementById('example').addEventListener('click',()=>{area.value=5;area.dispatchEvent(new Event('input'))});</script>
</body></html>"""
PAYLOAD = {
    "accuracy": {
        "status": "accurate",
        "explanation": "The source is accurate.",
        "question": None,
        "answer": None,
    },
    "title": "Pressure playground",
    "summary": "How area changes pressure.",
    "html": HTML,
    "followups": [
        {"question": f"Question {i}?", "answer": f"Answer {i}."} for i in range(5)
    ],
}


@pytest.fixture
def owner(client, settings, monkeypatch):
    settings.LUMEN_GENERATION_ENABLED = True
    monkeypatch.setenv("ANTHROPIC_API_KEY", "synthetic-test-key")
    monkeypatch.setattr(generation, "generate", lambda *args: json.dumps(PAYLOAD))
    user = UserFactory()
    client.force_login(user)
    return user


@pytest.fixture
def question(owner):
    return QuestionFactory(
        user=owner,
        question="Why does area reduce pressure?",
        answer="Pressure is force divided by area.",
    )


def create_lesson(owner, question):
    services.enqueue(owner, str(question.uuid))
    job = services.claim_job()
    services.run_job(job)
    job.refresh_from_db()
    assert job.status == "complete"
    return job.lesson


def test_generation_snapshot_versions_and_failure(owner, question, monkeypatch):
    first = create_lesson(owner, question)
    original = first.html
    job = services.enqueue(owner, str(question.uuid))
    question.answer = "Edited after submission"
    question.save()
    services.run_job(services.claim_job())
    job.refresh_from_db()
    assert job.lesson.source == first.source
    assert job.lesson_id != first.id
    monkeypatch.setattr(generation, "generate", lambda *args: "broken JSON")
    services.enqueue(owner, str(question.uuid))
    failed = services.claim_job()
    services.run_job(failed)
    failed.refresh_from_db()
    assert failed.status == "error"
    assert LessonVersion.objects.count() == 2
    first.refresh_from_db()
    assert first.html == original


def test_queue_dedup_limit_and_claim(owner, question, settings):
    job = services.enqueue(owner, str(question.uuid))
    assert services.enqueue(owner, str(question.uuid)).pk == job.pk
    with pytest.raises(IntegrityError), transaction.atomic():
        GenerationJob.objects.create(
            user=owner, question_uuid=question.uuid, source={}, selected={}
        )
    settings.LUMEN_QUEUE_LIMIT = 1
    other = QuestionFactory(user=owner)
    with pytest.raises(generation.UserError, match="queue is full"):
        services.enqueue(owner, str(other.uuid))
    assert services.claim_job().id == job.id
    assert services.claim_job() is None


def test_expired_job_is_not_replayed(owner, question, monkeypatch):
    services.enqueue(owner, str(question.uuid))
    job = services.claim_job()
    GenerationJob.objects.filter(pk=job.pk).update(
        lease_expires_at=timezone.now() - timedelta(seconds=1)
    )
    assert services.claim_job() is None
    services.run_job(job)  # A late result must not overwrite the expired state.
    job.refresh_from_db()
    assert job.status == "error"
    assert not LessonVersion.objects.exists()


def test_disabled_worker_leaves_queue(owner, question, settings):
    job = services.enqueue(owner, str(question.uuid))
    settings.LUMEN_GENERATION_ENABLED = False
    assert services.claim_job() is None
    job.refresh_from_db()
    assert job.status == "queued"


def test_private_endpoints_and_csrf(owner, question, client):
    lesson = create_lesson(owner, question)
    job = GenerationJob.objects.get(lesson=lesson)
    other = UserFactory(username="someone-else")
    client.force_login(other)
    for name, args in [
        ("detail", [lesson.pk]),
        ("html", [lesson.pk]),
        ("job", [job.pk]),
    ]:
        assert client.get(reverse("lumen:" + name, args=args)).status_code == 404
    assert client.get(reverse("lumen:library")).json()["count"] == 0
    assert (
        client.get(reverse("lumen:versions", args=[question.uuid])).json()["versions"]
        == []
    )
    assert (
        client.post(
            reverse("lumen:generate"),
            {"uuid": str(question.uuid)},
            content_type="application/json",
        ).status_code
        == 404
    )
    csrf_client = Client(enforce_csrf_checks=True)
    csrf_client.force_login(owner)
    assert (
        csrf_client.post(
            reverse("lumen:generate"),
            {"uuid": str(question.uuid)},
            content_type="application/json",
        ).status_code
        == 403
    )
    client.logout()
    assert client.get(reverse("lumen:library")).status_code == 403
    assert client.get(reverse("lumen:html", args=[lesson.pk])).status_code == 302


@pytest.mark.parametrize("style", STYLES)
def test_theme_is_separate_and_never_rewrites_versions(owner, question, client, style):
    lesson = create_lesson(owner, question)
    profile = owner.userprofile
    profile.lumen_theme = style
    profile.save(update_fields=["lumen_theme"])
    url = reverse("lumen:html", args=[lesson.pk])
    view = client.get(url)
    download = client.get(url + "?download=1")
    assert view.content == download.content
    assert f'data-style="{style}"'.encode() in view.content
    assert "sandbox allow-scripts" in view["Content-Security-Policy"]
    assert "connect-src 'none'" in view["Content-Security-Policy"]
    assert view["X-Frame-Options"] == "SAMEORIGIN"
    assert view["Cache-Control"] == "private, no-store"
    assert download["Content-Disposition"].startswith("attachment;")
    lesson.refresh_from_db()
    assert "lumen-lesson-theme" not in lesson.html
    profile.refresh_from_db()
    assert profile.theme == "light"
    assert client.get(reverse("lumen:preferences")).json()["settings"]["style"] == style


def test_library_latest_search_and_source_changes(owner, question, client):
    first = create_lesson(owner, question)
    second = create_lesson(owner, question)
    url = reverse("lumen:library")
    assert client.get(url).json()["lessons"][0]["id"] == str(second.pk)
    assert client.get(url, {"q": "pressure"}).json()["count"] == 1
    assert client.get(url, {"q": str(question.uuid)}).json()["count"] == 1
    assert client.get(url, {"q": "missing"}).json()["count"] == 0
    assert (
        len(
            client.get(reverse("lumen:versions", args=[question.uuid])).json()[
                "versions"
            ]
        )
        == 2
    )
    question.answer = "Edited"
    question.save()
    assert client.get(reverse("lumen:detail", args=[first.pk])).json()["source_changed"]
    Question.objects.filter(pk=question.pk).delete()
    data = client.get(reverse("lumen:detail", args=[first.pk])).json()
    assert not data["can_regenerate"]
    assert data["source"]["answer"] != "Edited"


def test_preferences_validation(owner, client):
    url = reverse("lumen:preferences")
    for data in [
        {"provider": "bad", "model": "a"},
        {"provider": "openai", "model": ""},
    ]:
        assert client.put(url, data, content_type="application/json").status_code == 400
    assert (
        client.put(
            url,
            {"provider": "openrouter", "model": "example/model"},
            content_type="application/json",
        ).status_code
        == 200
    )
    assert LumenPreferences.objects.get(user=owner).model == "example/model"
    assert "synthetic-test-key" not in client.get(url).content.decode()


def test_invalid_uuid_and_disabled(owner, question, client, settings):
    url = reverse("lumen:generate")
    assert (
        client.post(url, {"uuid": "bad"}, content_type="application/json").status_code
        == 400
    )
    assert not GenerationJob.objects.exists()
    settings.LUMEN_GENERATION_ENABLED = False
    assert (
        client.post(
            url, {"uuid": str(question.uuid)}, content_type="application/json"
        ).status_code
        == 503
    )


def test_preferences_form_theme(owner):
    from django.test import RequestFactory

    from accounts.forms import UserProfileForm

    request = RequestFactory().get("/")
    request.user = owner
    form = UserProfileForm(instance=owner.userprofile, request=request)
    assert dict(form.fields["lumen_theme"].choices)["neon-circuit"] == "Neon Circuit"
    with pytest.raises(Exception):
        form.fields["lumen_theme"].clean("invalid-style")


def test_ported_assembly_and_theme():
    source = {"question": "<script>bad()</script>", "answer": "A & B"}
    html = generation.assemble_html(PAYLOAD, source)
    assert "&lt;script&gt;bad()&lt;/script&gt;" in html
    assert "Content-Security-Policy" in html
    assert html.count('id="lumen-review"') == 1
    script = HTML.split("<script>")[1].split("</script>")[0]
    for style in STYLES:
        assert script in themed_html(html, style)
    with pytest.raises(generation.UserError):
        generation.parse_lesson("{}")
    with pytest.raises(generation.UserError):
        generation.parse_lesson(json.dumps({**PAYLOAD, "followups": []}))


def test_math_assets_are_embedded_without_changing_csp_or_archive(owner, question, client):
    from lumen.math import with_math

    html = generation.assemble_html(PAYLOAD, {"question": "Q", "answer": r"\(x^2\)"})
    lesson = LessonVersion.objects.create(
        user=owner, question=question, question_uuid=question.uuid,
        title="Math", html=html, source={"question": "Q", "answer": "A"}, followups=[],
    )
    client.force_login(owner)
    url = reverse("lumen:html", args=[lesson.pk])
    for suffix in ("", "?download=1"):
        response = client.get(url + suffix)
        assert response.status_code == 200
        assert response.content.count(b'id="lumen-mathjax"') == 1
        assert response["Content-Security-Policy"] == generation.CSP + "; sandbox allow-scripts; frame-ancestors 'self'"
    lesson.refresh_from_db()
    assert lesson.html == html
    assert with_math(html).endswith("</body></html>")


@pytest.mark.parametrize("provider", ["anthropic", "openai", "openrouter"])
def test_provider_requests(provider, monkeypatch):
    monkeypatch.setenv(
        {
            "anthropic": "ANTHROPIC_API_KEY",
            "openai": "OPENAI_API_KEY",
            "openrouter": "OPENROUTER_API_KEY",
        }[provider],
        "test-key",
    )
    result = (
        {
            "stop_reason": "end_turn",
            "content": [{"type": "text", "text": json.dumps(PAYLOAD)}],
        }
        if provider == "anthropic"
        else {
            "choices": [
                {"finish_reason": "stop", "message": {"content": json.dumps(PAYLOAD)}}
            ]
        }
    )
    post = Mock(return_value=Mock(ok=True, json=lambda: result))
    monkeypatch.setattr(generation.requests, "post", post)
    assert (
        generation.parse_lesson(
            generation.generate(
                {"question": "q", "answer": "a"},
                {"provider": provider, "model": "test-model", "style": "neon-circuit"},
            )
        )["title"]
        == PAYLOAD["title"]
    )
    kwargs = post.call_args.kwargs
    assert kwargs["allow_redirects"] is False
    assert kwargs["timeout"] == (15, 600)
    assert "Neon Circuit" in str(kwargs["json"])
    prepared = requests.Request(
        "POST", "https://example.test", headers={"Authorization": "Basic wrong"}
    ).prepare()
    prepared = kwargs["auth"](prepared)
    assert (
        prepared.headers.get("x-api-key") == "test-key"
        if provider == "anthropic"
        else prepared.headers["Authorization"] == "Bearer test-key"
    )


def test_catalog_failure(monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test")
    monkeypatch.setattr(
        generation.requests, "get", Mock(side_effect=requests.Timeout())
    )
    assert generation.model_catalog("anthropic")["warning"]


def local_library(tmp_path, lesson):
    directory = tmp_path / "pages" / str(lesson.question_uuid) / str(lesson.pk)
    directory.mkdir(parents=True)
    metadata = {
        key: getattr(lesson, key)
        for key in [
            "title",
            "summary",
            "provider",
            "model",
            "source",
            "followups",
            "style",
        ]
    }
    metadata.update(
        id=str(lesson.pk),
        question_uuid=str(lesson.question_uuid),
        created_at=lesson.created_at.isoformat(),
    )
    (directory / "metadata.json").write_text(json.dumps(metadata))
    (directory / "index.html").write_text(lesson.html)
    conn = sqlite3.connect(tmp_path / "library.sqlite3")
    conn.executescript(
        "CREATE TABLE lessons (id TEXT, question_uuid TEXT, created_at TEXT, title TEXT, summary TEXT, provider TEXT, model TEXT, source TEXT, followups TEXT); CREATE TABLE settings (id INTEGER, value TEXT);"
    )
    conn.execute(
        "INSERT INTO lessons VALUES (?,?,?,?,?,?,?,?,?)",
        [
            metadata[k] if k not in ("source", "followups") else json.dumps(metadata[k])
            for k in [
                "id",
                "question_uuid",
                "created_at",
                "title",
                "summary",
                "provider",
                "model",
                "source",
                "followups",
            ]
        ],
    )
    conn.execute(
        "INSERT INTO settings VALUES (1,?)",
        [
            json.dumps(
                {
                    "provider": "anthropic",
                    "model": "test-model",
                    "style": "forest-study",
                }
            )
        ],
    )
    conn.commit()
    conn.close()
    return directory


def test_import_dry_run_idempotence_and_conflicts(owner, question, tmp_path):
    lesson = create_lesson(owner, question)
    directory = local_library(tmp_path, lesson)
    lesson.delete()
    output = StringIO()
    call_command(
        "import_lumen_library",
        str(tmp_path),
        user=owner.username,
        dry_run=True,
        stdout=output,
    )
    assert not LessonVersion.objects.exists()
    assert not LumenPreferences.objects.exists()
    call_command(
        "import_lumen_library", str(tmp_path), user=owner.username, stdout=output
    )
    call_command(
        "import_lumen_library", str(tmp_path), user=owner.username, stdout=output
    )
    assert LessonVersion.objects.count() == 1
    assert LessonVersion.objects.get().html.count('id="lumen-review"') == 1
    owner.userprofile.refresh_from_db()
    assert owner.userprofile.lumen_theme == "forest-study"
    (directory / "index.html").write_text("conflicting html")
    with pytest.raises(CommandError, match="Conflicting"):
        call_command(
            "import_lumen_library", str(tmp_path), user=owner.username, stdout=output
        )


@pytest.mark.django_db(transaction=True)
def test_concurrent_submissions_share_one_job(owner, question):
    from concurrent.futures import ThreadPoolExecutor

    from django.contrib.auth import get_user_model
    from django.db import connections

    def submit():
        try:
            user = get_user_model().objects.get(pk=owner.pk)
            return services.enqueue(user, str(question.uuid)).pk
        finally:
            connections.close_all()

    with ThreadPoolExecutor(max_workers=3) as pool:
        ids = list(pool.map(lambda _: submit(), range(3)))
    assert len(set(ids)) == 1
    assert GenerationJob.objects.count() == 1


def test_theme_saves_through_bordercore_preferences(owner, client):
    url = reverse("accounts:prefs")
    data = {
        "theme": "light",
        "lumen_theme": "neon-circuit",
        "topbar_animation": "aurora",
        "visualizer": "torus",
        "drill_intervals": "1,3,7",
        "bookmarks_per_page": "50",
    }
    response = client.post(url, data, HTTP_X_REQUESTED_WITH="XMLHttpRequest")
    assert response.status_code == 200, response.content
    owner.userprofile.refresh_from_db()
    assert owner.userprofile.lumen_theme == "neon-circuit"
    assert owner.userprofile.theme == "light"
    response = client.post(
        url, {**data, "lumen_theme": "invalid"}, HTTP_X_REQUESTED_WITH="XMLHttpRequest"
    )
    assert response.status_code == 400
    owner.userprofile.refresh_from_db()
    assert owner.userprofile.lumen_theme == "neon-circuit"


def test_lumen_page_and_drill_link(owner, question, client):
    response = client.get(reverse("lumen:index"))
    assert response.status_code == 200
    assert b"lumen-root" in response.content
    response = client.get(reverse("drill:detail", args=[question.uuid]))
    assert response.status_code == 200
    assert (
        'data-lumen-url="/lumen/?question=' + str(question.uuid)
    ).encode() in response.content


def correction_for(lesson):
    return {
        "status": "issues",
        "explanation": "The answer needs a fixed-force qualification.",
        "question": lesson.source["question"],
        "answer": "At fixed force, pressure is inversely proportional to area: P = F/A.",
    }


def test_apply_correction_uses_saved_proposal_and_preserves_history(
    owner, question, client, monkeypatch
):
    lesson = create_lesson(owner, question)
    lesson.accuracy = correction_for(lesson)
    lesson.save(update_fields=["accuracy"])
    original_source, original_html = lesson.source.copy(), lesson.html
    interval, reviewed = question.interval, question.last_reviewed
    index = Mock()
    monkeypatch.setattr(Question, "index_question", index)
    url = reverse("lumen:correct_source", args=[lesson.pk])
    # Client-supplied text must never replace the saved proposal.
    response = client.post(
        url, {"question": "forged", "answer": "forged"}, content_type="application/json"
    )
    assert response.status_code == 200
    question.refresh_from_db()
    assert question.question == lesson.accuracy["question"]
    assert question.answer == lesson.accuracy["answer"]
    assert (question.interval, question.last_reviewed) == (interval, reviewed)
    lesson.refresh_from_db()
    assert lesson.source == original_source and lesson.html == original_html
    assert client.get(reverse("lumen:detail", args=[lesson.pk])).json()[
        "correction_applied"
    ]
    assert client.post(url, {}, content_type="application/json").status_code == 200
    index.assert_called_once()


def test_correction_rejects_stale_source(owner, question, client):
    lesson = create_lesson(owner, question)
    lesson.accuracy = correction_for(lesson)
    lesson.save(update_fields=["accuracy"])
    question.question = "A newer edit"
    question.save()
    response = client.post(
        reverse("lumen:correct_source", args=[lesson.pk]),
        {},
        content_type="application/json",
    )
    assert response.status_code == 409
    question.refresh_from_db()
    assert question.question == "A newer edit"
    assert question.answer == lesson.source["answer"]


@pytest.mark.parametrize(
    "assessment",
    [
        None,
        {
            "status": "accurate",
            "explanation": "Correct",
            "question": None,
            "answer": None,
        },
        {
            "status": "uncertain",
            "explanation": "Unclear",
            "question": None,
            "answer": None,
        },
    ],
)
def test_no_correction_for_missing_accurate_or_uncertain_review(
    owner, question, client, assessment
):
    lesson = create_lesson(owner, question)
    lesson.accuracy = assessment
    lesson.save(update_fields=["accuracy"])
    assert (
        client.post(
            reverse("lumen:correct_source", args=[lesson.pk]),
            {},
            content_type="application/json",
        ).status_code
        == 400
    )


def test_accuracy_actions_require_owner_and_csrf(owner, question, client):
    lesson = create_lesson(owner, question)
    lesson.accuracy = correction_for(lesson)
    lesson.save(update_fields=["accuracy"])
    other = UserFactory(username="accuracy-other")
    csrf_client = Client(enforce_csrf_checks=True)
    csrf_client.force_login(owner)
    for name in ("correct_source", "check_accuracy"):
        url = reverse("lumen:" + name, args=[lesson.pk])
        assert (
            csrf_client.post(url, {}, content_type="application/json").status_code
            == 403
        )
        client.force_login(other)
        assert client.post(url, {}, content_type="application/json").status_code == 404
    client.force_login(owner)
    Question.objects.filter(pk=question.pk).delete()
    assert (
        client.post(
            reverse("lumen:correct_source", args=[lesson.pk]),
            {},
            content_type="application/json",
        ).status_code
        == 404
    )


def test_legacy_accuracy_job_only_saves_assessment(
    owner, question, client, monkeypatch
):
    lesson = create_lesson(owner, question)
    LessonVersion.objects.filter(pk=lesson.pk).update(accuracy=None)
    monkeypatch.setattr(
        generation, "generate_accuracy", lambda *_: correction_for(lesson)
    )
    url = reverse("lumen:check_accuracy", args=[lesson.pk])
    response = client.post(url, {}, content_type="application/json")
    assert response.status_code == 202
    assert (
        client.post(url, {}, content_type="application/json").json() == response.json()
    )
    services.run_job(services.claim_job())
    job = GenerationJob.objects.get(pk=response.json()["job_id"])
    assert job.status == "complete"
    assert client.get(reverse("lumen:job", args=[job.pk])).json()["lesson_id"] == str(
        lesson.pk
    )
    lesson.refresh_from_db()
    question.refresh_from_db()
    assert lesson.accuracy == correction_for(lesson)
    assert question.answer == lesson.source["answer"]
    assert LessonVersion.objects.count() == 1
    assert client.post(url, {}, content_type="application/json").status_code == 409


@pytest.mark.parametrize(
    "assessment",
    [
        None,
        {},
        {"status": "issues", "explanation": "wrong", "question": "q", "answer": ""},
        {
            "status": "uncertain",
            "explanation": "unclear",
            "question": "guess",
            "answer": "guess",
        },
    ],
)
def test_invalid_accuracy_is_rejected(assessment):
    with pytest.raises(generation.UserError):
        generation.parse_lesson(json.dumps({**PAYLOAD, "accuracy": assessment}))


def test_legacy_accuracy_failure_preserves_lesson(owner, question, client, monkeypatch):
    lesson = create_lesson(owner, question)
    original_html = lesson.html
    LessonVersion.objects.filter(pk=lesson.pk).update(accuracy=None)
    monkeypatch.setattr(
        generation,
        "generate_accuracy",
        Mock(side_effect=generation.UserError("Malformed response", 502)),
    )
    client.post(
        reverse("lumen:check_accuracy", args=[lesson.pk]),
        {},
        content_type="application/json",
    )
    job = services.claim_job()
    services.run_job(job)
    job.refresh_from_db()
    lesson.refresh_from_db()
    assert job.status == "error" and lesson.accuracy is None
    assert lesson.html == original_html
