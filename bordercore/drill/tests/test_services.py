"""Tests for drill/services.py — the AI question rephrasing service."""
from __future__ import annotations

import json
from unittest.mock import MagicMock, patch

import pytest
from django import urls

from drill.services import rephrase_question
from drill.tests.factories import QuestionFactory

pytestmark = [pytest.mark.django_db]


# ----- service: rephrase_question -----------------------------------------

@patch("drill.services.OpenAI")
def test_rephrase_reword_only_returns_question_and_null_answer(mock_openai_cls):
    """For allow_data_variation=False, the service returns just the new question."""
    mock_client = MagicMock()
    mock_openai_cls.return_value = mock_client
    mock_client.chat.completions.create.return_value = MagicMock(
        choices=[
            MagicMock(message=MagicMock(content=json.dumps({
                "question": "What do you call the capital city of France?",
            })))
        ]
    )

    q = QuestionFactory(
        question="What is the capital of France?",
        answer="Paris",
        allow_data_variation=False,
    )

    result = rephrase_question(q)

    assert result["question"] == "What do you call the capital city of France?"
    assert result["answer"] is None


@patch("drill.services.OpenAI")
def test_rephrase_data_varying_returns_question_and_new_answer(mock_openai_cls):
    """For allow_data_variation=True, the service returns a matching new answer."""
    mock_client = MagicMock()
    mock_openai_cls.return_value = mock_client
    mock_client.chat.completions.create.return_value = MagicMock(
        choices=[
            MagicMock(message=MagicMock(content=json.dumps({
                "question": "What is 6 times 8?",
                "answer": "48",
            })))
        ]
    )

    q = QuestionFactory(
        question="What is 5 times 7?",
        answer="35",
        allow_data_variation=True,
    )

    result = rephrase_question(q)

    assert result["question"] == "What is 6 times 8?"
    assert result["answer"] == "48"


@patch("drill.services.OpenAI")
def test_rephrase_uses_different_system_prompts_for_each_mode(mock_openai_cls):
    """Reword-only mode must NOT instruct the model to vary data."""
    mock_client = MagicMock()
    mock_openai_cls.return_value = mock_client
    mock_client.chat.completions.create.return_value = MagicMock(
        choices=[MagicMock(message=MagicMock(content='{"question": "x"}'))]
    )

    q_reword = QuestionFactory(allow_data_variation=False)
    rephrase_question(q_reword)
    reword_system = mock_client.chat.completions.create.call_args.kwargs["messages"][0]["content"]
    assert "EXACTLY" in reword_system  # preserve facts exactly

    mock_client.chat.completions.create.return_value = MagicMock(
        choices=[MagicMock(message=MagicMock(content='{"question": "x", "answer": "y"}'))]
    )
    q_vary = QuestionFactory(allow_data_variation=True)
    rephrase_question(q_vary)
    vary_system = mock_client.chat.completions.create.call_args.kwargs["messages"][0]["content"]
    assert "vary concrete data" in vary_system


@patch("drill.services.OpenAI")
def test_rephrase_raises_on_invalid_json(mock_openai_cls):
    """A non-JSON LLM response is surfaced as RuntimeError for the view to handle."""
    mock_client = MagicMock()
    mock_openai_cls.return_value = mock_client
    mock_client.chat.completions.create.return_value = MagicMock(
        choices=[MagicMock(message=MagicMock(content="not json"))]
    )

    q = QuestionFactory(allow_data_variation=False)

    with pytest.raises(RuntimeError, match="not valid JSON"):
        rephrase_question(q)


@patch("drill.services.OpenAI")
def test_rephrase_raises_when_question_field_missing(mock_openai_cls):
    """Empty/missing 'question' in the JSON payload is treated as a failure."""
    mock_client = MagicMock()
    mock_openai_cls.return_value = mock_client
    mock_client.chat.completions.create.return_value = MagicMock(
        choices=[MagicMock(message=MagicMock(content='{"question": ""}'))]
    )

    q = QuestionFactory(allow_data_variation=False)

    with pytest.raises(RuntimeError, match="missing 'question'"):
        rephrase_question(q)


@patch("drill.services.OpenAI")
def test_rephrase_data_varying_raises_when_answer_missing(mock_openai_cls):
    """Data-varying mode requires a matching answer; missing one is a failure."""
    mock_client = MagicMock()
    mock_openai_cls.return_value = mock_client
    mock_client.chat.completions.create.return_value = MagicMock(
        choices=[MagicMock(message=MagicMock(content='{"question": "What is 6 * 8?"}'))]
    )

    q = QuestionFactory(allow_data_variation=True)

    with pytest.raises(RuntimeError, match="missing 'answer'"):
        rephrase_question(q)


# ----- view: drill:rephrase -----------------------------------------------

@patch("drill.views.rephrase_question")
def test_rephrase_view_returns_rephrased_payload(
    mock_rephrase, authenticated_client, question
):
    """Happy path: 200 with the service's payload as JSON."""
    user, client = authenticated_client()
    target = question[0]
    target.user = user
    target.save()

    mock_rephrase.return_value = {"question": "new q", "answer": None}

    url = urls.reverse("drill:rephrase", kwargs={"uuid": target.uuid})
    resp = client.post(url)

    assert resp.status_code == 200
    assert resp.json() == {"question": "new q", "answer": None}
    mock_rephrase.assert_called_once()


@patch("drill.views.rephrase_question")
def test_rephrase_view_returns_502_on_service_failure(
    mock_rephrase, authenticated_client, question
):
    """LLM/parse failures bubble up to the user as a 502 with an error message."""
    user, client = authenticated_client()
    target = question[0]
    target.user = user
    target.save()

    mock_rephrase.side_effect = RuntimeError("boom")

    url = urls.reverse("drill:rephrase", kwargs={"uuid": target.uuid})
    resp = client.post(url)

    assert resp.status_code == 502
    assert "Rephrase service unavailable" in resp.json()["detail"]


@patch("drill.views.rephrase_question")
def test_rephrase_view_rejects_questions_owned_by_other_users(
    mock_rephrase, authenticated_client, question
):
    """A user cannot rephrase someone else's question (owner-scoped lookup)."""
    _, client = authenticated_client()  # logs in a fresh user, not question[0].user

    url = urls.reverse("drill:rephrase", kwargs={"uuid": question[0].uuid})
    resp = client.post(url)

    assert resp.status_code == 404
    mock_rephrase.assert_not_called()
