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
def test_rephrase_returns_question_and_matching_answer(mock_openai_cls):
    """Happy path: the LLM returns both fields and the service forwards them."""
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

    q = QuestionFactory(question="What is 5 times 7?", answer="35")

    result = rephrase_question(q)

    assert result == {"question": "What is 6 times 8?", "answer": "48"}


@patch("drill.services.OpenAI")
def test_rephrase_sends_original_question_and_answer_in_prompt(mock_openai_cls):
    """The service must give the LLM both Q and A so it can produce a consistent variant."""
    mock_client = MagicMock()
    mock_openai_cls.return_value = mock_client
    mock_client.chat.completions.create.return_value = MagicMock(
        choices=[MagicMock(message=MagicMock(content='{"question": "x", "answer": "y"}'))]
    )

    q = QuestionFactory(question="What is the capital of France?", answer="Paris")
    rephrase_question(q)

    user_message = mock_client.chat.completions.create.call_args.kwargs["messages"][1]["content"]
    assert "What is the capital of France?" in user_message
    assert "Paris" in user_message


@patch("drill.services.OpenAI")
def test_rephrase_raises_on_invalid_json(mock_openai_cls):
    """A non-JSON LLM response is surfaced as RuntimeError for the view to handle."""
    mock_client = MagicMock()
    mock_openai_cls.return_value = mock_client
    mock_client.chat.completions.create.return_value = MagicMock(
        choices=[MagicMock(message=MagicMock(content="not json"))]
    )

    with pytest.raises(RuntimeError, match="not valid JSON"):
        rephrase_question(QuestionFactory())


@patch("drill.services.OpenAI")
def test_rephrase_raises_when_question_field_missing(mock_openai_cls):
    """Empty/missing 'question' in the JSON payload is treated as a failure."""
    mock_client = MagicMock()
    mock_openai_cls.return_value = mock_client
    mock_client.chat.completions.create.return_value = MagicMock(
        choices=[MagicMock(message=MagicMock(content='{"question": "", "answer": "y"}'))]
    )

    with pytest.raises(RuntimeError, match="missing 'question'"):
        rephrase_question(QuestionFactory())


@patch("drill.services.OpenAI")
def test_rephrase_raises_when_answer_field_missing(mock_openai_cls):
    """Empty/missing 'answer' in the JSON payload is treated as a failure."""
    mock_client = MagicMock()
    mock_openai_cls.return_value = mock_client
    mock_client.chat.completions.create.return_value = MagicMock(
        choices=[MagicMock(message=MagicMock(content='{"question": "x"}'))]
    )

    with pytest.raises(RuntimeError, match="missing 'answer'"):
        rephrase_question(QuestionFactory())


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

    mock_rephrase.return_value = {"question": "new q", "answer": "new a"}

    url = urls.reverse("drill:rephrase", kwargs={"uuid": target.uuid})
    resp = client.post(url)

    assert resp.status_code == 200
    assert resp.json() == {"question": "new q", "answer": "new a"}
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
