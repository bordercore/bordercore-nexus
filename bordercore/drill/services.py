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

REPHRASE_SYSTEM_PROMPT = (
    "You rewrite study-question prompts to defeat rote memorization while "
    "preserving what's being tested. Vary sentence structure, word choice, "
    "voice, and framing. Where it serves the same goal, you may also vary "
    "concrete data — numbers, names, entities, or example values — provided "
    "the underlying skill or concept the question tests stays the same.\n\n"
    "Always compute and return the matching correct answer:\n"
    "1. If you changed data, the new answer must be consistent with the new "
    "question.\n"
    "2. If you did not change data, return the original answer verbatim.\n"
    "3. Match the original answer's format (units, structure, step count, "
    "code style).\n"
    "4. Do not introduce ambiguity. The rewritten question must have one "
    "clear answer.\n"
    "5. Do not change what the question is asking the learner to produce.\n\n"
    "Respond with JSON: {\"question\": \"<rewritten question>\", "
    "\"answer\": \"<matching answer>\"}. No prose outside the JSON."
)


class RephraseResult(TypedDict):
    """Result of a rephrase call.

    Attributes:
        question: The rephrased question text.
        answer: The matching correct answer. Equals the original answer
            verbatim when data was not varied.
    """

    question: str
    answer: str


def rephrase_question(question: Question) -> RephraseResult:
    """Generate a rephrased version of ``question`` via the LLM.

    The LLM may also vary concrete data (numbers, names, example values)
    when doing so preserves what the question tests, and always returns a
    matching correct answer.

    Args:
        question: The Question to rephrase.

    Returns:
        RephraseResult with the rewritten question text and matching answer.

    Raises:
        RuntimeError: If the LLM response cannot be parsed or is missing
            required fields. Callers should surface this as a 502/503 so the
            frontend can fall back to the original text.
    """
    user_prompt = (
        f"Original question:\n{question.question}\n\n"
        f"Original answer:\n{question.answer}"
    )

    client = OpenAI()
    response = client.chat.completions.create(
        model=REPHRASE_MODEL,
        messages=[
            {"role": "system", "content": REPHRASE_SYSTEM_PROMPT},
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
    new_answer = (payload.get("answer") or "").strip()
    if not new_question:
        raise RuntimeError("Rephrase response missing 'question' field")
    if not new_answer:
        raise RuntimeError("Rephrase response missing 'answer' field")

    return {"question": new_question, "answer": new_answer}
