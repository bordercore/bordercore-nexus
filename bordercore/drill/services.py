"""Service functions for the drill app.

Currently provides AI-assisted rephrasing of drill questions to defeat
rote memorization during spaced-repetition review.
"""
from __future__ import annotations

import json
import logging
from typing import TypedDict

from openai import OpenAI

from drill.models import Question

log = logging.getLogger(f"bordercore.{__name__}")

REPHRASE_MODEL = "gpt-4o-mini"
REPHRASE_MAX_TOKENS = 600

REWORD_SYSTEM_PROMPT = (
    "You rephrase study-question prompts so the learner can't memorize the "
    "exact wording. Preserve the meaning and every concrete fact (numbers, "
    "names, code, identifiers) EXACTLY. Vary sentence structure, word "
    "choice, and voice. Do not add or remove information. Do not change "
    "what the question is asking for.\n\n"
    "Respond with JSON: {\"question\": \"<new question text>\"}. "
    "No prose outside the JSON."
)

VARY_SYSTEM_PROMPT = (
    "You rewrite study questions to defeat rote memorization. You may vary "
    "concrete data such as numbers, names, and entities, AND you must "
    "compute the new correct answer that matches the varied question.\n\n"
    "Rules:\n"
    "1. Keep the same underlying skill/concept the question tests.\n"
    "2. If you change numbers or names, make sure the new answer is "
    "consistent with the new question.\n"
    "3. If the original answer's format implies units, structure, or step "
    "count, the new answer must match that format.\n"
    "4. Do not introduce ambiguity. The new question must have one clear "
    "answer.\n\n"
    "Respond with JSON: {\"question\": \"<new question>\", "
    "\"answer\": \"<new matching answer>\"}. No prose outside the JSON."
)


class RephraseResult(TypedDict):
    """Result of a rephrase call.

    Attributes:
        question: The rephrased question text.
        answer: The new matching answer, or None if data was not varied
            (caller should keep the original stored answer).
    """

    question: str
    answer: str | None


def rephrase_question(question: Question) -> RephraseResult:
    """Generate a rephrased version of ``question`` via the LLM.

    When ``question.allow_data_variation`` is False, only the phrasing is
    changed; the stored answer remains valid. When True, the LLM may vary
    concrete data and produces a matching new answer.

    Args:
        question: The Question to rephrase.

    Returns:
        RephraseResult with the new question text and, for data-varying
        rephrases, a new matching answer.

    Raises:
        RuntimeError: If the LLM response cannot be parsed or is missing
            required fields. Callers should surface this as a 502/503 so the
            frontend can fall back to the original text.
    """
    user_prompt = _build_user_prompt(question)
    system_prompt = (
        VARY_SYSTEM_PROMPT if question.allow_data_variation else REWORD_SYSTEM_PROMPT
    )

    client = OpenAI()
    response = client.chat.completions.create(
        model=REPHRASE_MODEL,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        response_format={"type": "json_object"},
        temperature=0.9,
        max_tokens=REPHRASE_MAX_TOKENS,
    )

    raw = (response.choices[0].message.content or "").strip()
    try:
        payload = json.loads(raw)
    except json.JSONDecodeError as exc:
        log.warning("Rephrase JSON parse failed for question %s: %s", question.uuid, exc)
        raise RuntimeError("Rephrase response was not valid JSON") from exc

    new_question = (payload.get("question") or "").strip()
    if not new_question:
        raise RuntimeError("Rephrase response missing 'question' field")

    new_answer: str | None = None
    if question.allow_data_variation:
        new_answer_raw = (payload.get("answer") or "").strip()
        if not new_answer_raw:
            raise RuntimeError("Data-varying rephrase missing 'answer' field")
        new_answer = new_answer_raw

    return {"question": new_question, "answer": new_answer}


def _build_user_prompt(question: Question) -> str:
    """Format the question's text and (when relevant) its stored answer.

    For data-varying rephrases, the answer is included so the model has the
    full Q/A context it needs to construct a consistent variant.
    """
    if question.allow_data_variation:
        return (
            f"Original question:\n{question.question}\n\n"
            f"Original answer:\n{question.answer}"
        )
    return f"Original question:\n{question.question}"
