"""Retrieval-quality evaluation for the Notes RAG pipeline.

Pure, dependency-light scoring layered on the *real* retrieval functions so the
eval tracks production behavior. Retrieval only: no generation, no LLM judge.
Each case costs just the embedding calls inside ``semantic_search``.

Metric definitions (per case, "expected" = at least one ``expected_uuids``
member present at that stage):

- raw recall@k      expected present in ``semantic_search`` top-k hits.
- effective recall@3 expected present after the ``NOTES_RAG_MAX_SOURCES`` cap.
- hit@1             the #1 effective result is an expected note.
- MRR               mean reciprocal rank of the first expected uuid in the raw
                     ranking.
- dropped-by-filter raw-hit but not effective-hit (removed by the top-N cap).

Scope and interpretation:

- This covers standalone-question retrieval only. It calls ``semantic_search``
  directly and does NOT exercise the multi-turn query rewrite
  (``_rewrite_notes_search_query``), which only fires on chat follow-ups, so a
  rewrite regression won't show up here.
- When reading a report, ``effective recall@3`` and ``dropped-by-filter`` are
  the primary retrieval-regression signals. A uniform raw miss across every case
  usually means an Elasticsearch infra problem, not a retrieval regression —
  ``semantic_search`` swallows ``RequestError`` and returns no hits.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from types import SimpleNamespace
from typing import Any, Callable

from blob.services import NOTES_RAG_MAX_SOURCES
from search.services import semantic_search

DEFAULT_DATASET_PATH = Path(__file__).resolve().parent / "rag_eval_data" / "notes_rag_eval.json"


@dataclass
class EvalCase:
    """One evaluation case: a question and the note(s) that should answer it."""

    question: str
    expected_uuids: list[str]
    note_name: str = ""


@dataclass
class CaseResult:
    """Scored outcome for a single :class:`EvalCase`."""

    case: EvalCase
    raw_rank: int | None
    effective_rank: int | None
    rr: float

    @property
    def raw_hit8(self) -> bool:
        """Whether an expected note appeared anywhere in the raw top-k hits."""
        return self.raw_rank is not None

    @property
    def effective_hit3(self) -> bool:
        """Whether an expected note survived the top-3 cap."""
        return self.effective_rank is not None

    @property
    def hit1(self) -> bool:
        """Whether the #1 effective result is an expected note."""
        return self.effective_rank == 1

    @property
    def dropped_by_filter(self) -> bool:
        """Raw-hit that didn't reach the effective set.

        True when an expected note was retrieved in the raw ranking but fell
        outside the top-``NOTES_RAG_MAX_SOURCES`` cap. (The name is retained for
        the report/tests; under hybrid RRF the only drop cause is the cap.)
        """
        return self.raw_hit8 and not self.effective_hit3


def _mean(values: list[float]) -> float:
    """Arithmetic mean, returning 0.0 for an empty sequence."""
    return sum(values) / len(values) if values else 0.0


@dataclass
class EvalReport:
    """Aggregate metrics over a list of scored cases."""

    cases: list[CaseResult]

    @property
    def case_count(self) -> int:
        """Total number of scored cases in this report."""
        return len(self.cases)

    @property
    def raw_recall_at_8(self) -> float:
        """Fraction of cases whose expected note appeared in the raw top-k."""
        return _mean([1.0 if c.raw_hit8 else 0.0 for c in self.cases])

    @property
    def effective_recall_at_3(self) -> float:
        """Fraction of cases whose expected note survived the top-3 cap."""
        return _mean([1.0 if c.effective_hit3 else 0.0 for c in self.cases])

    @property
    def hit_at_1(self) -> float:
        """Fraction of cases whose #1 effective result is an expected note."""
        return _mean([1.0 if c.hit1 else 0.0 for c in self.cases])

    @property
    def mrr(self) -> float:
        """Mean reciprocal rank of the first expected uuid in the raw ranking."""
        return _mean([c.rr for c in self.cases])

    @property
    def dropped_count(self) -> int:
        """Number of cases that were retrieved raw but lost to the top-N cap."""
        return sum(1 for c in self.cases if c.dropped_by_filter)


def _first_expected_rank(
    hits: list[dict[str, Any]],
    expected_uuids: list[str],
) -> int | None:
    """Return the 1-based rank of the first expected uuid in ``hits``, else None."""
    expected = set(expected_uuids)
    for index, hit in enumerate(hits, start=1):
        if hit.get("_source", {}).get("uuid") in expected:
            return index
    return None


def _passage_contains(passage: str | None, phrases: list[str]) -> bool:
    """Case-insensitive any-of substring test.

    True iff ``passage`` contains at least one of ``phrases``. Empty phrases or a
    missing passage return False.
    """
    if not passage or not phrases:
        return False
    haystack = passage.lower()
    return any(phrase.lower() in haystack for phrase in phrases)


def score_case(case: EvalCase, raw_hits: list[dict[str, Any]]) -> CaseResult:
    """Score a single case from its raw ``semantic_search`` hits.

    Pure: applies the same top-``NOTES_RAG_MAX_SOURCES`` cap the production RAG
    flow uses (there is no score filter under hybrid RRF), then computes ranks
    and reciprocal rank.
    """
    effective_hits = raw_hits[:NOTES_RAG_MAX_SOURCES]
    raw_rank = _first_expected_rank(raw_hits, case.expected_uuids)
    effective_rank = _first_expected_rank(effective_hits, case.expected_uuids)
    rr = (1.0 / raw_rank) if raw_rank is not None else 0.0
    return CaseResult(
        case=case,
        raw_rank=raw_rank,
        effective_rank=effective_rank,
        rr=rr,
    )


def evaluate_notes_retrieval(
    dataset: list[EvalCase],
    user_id: int = 1,
    *,
    raw_k: int = 8,
    search_fn: Callable[..., dict[str, Any]] = semantic_search,
) -> EvalReport:
    """Run each case through the real retrieval pipeline and score it.

    Args:
        dataset: Cases to evaluate.
        user_id: Owner whose notes are searched (notes' owner defaults to 1).
        raw_k: Number of raw hits to request from ``semantic_search`` (the
            ``size`` argument); raw recall is measured against this top-k.
        search_fn: The retrieval function, injectable for testing. Defaults to
            the production :func:`search.services.semantic_search`.

    Returns:
        An :class:`EvalReport` aggregating every case result.
    """
    request = SimpleNamespace(user=SimpleNamespace(id=user_id))
    results: list[CaseResult] = []
    for case in dataset:
        response = search_fn(request, case.question, size=raw_k)
        raw_hits = (response.get("hits") or {}).get("hits") or []
        results.append(score_case(case, raw_hits))
    return EvalReport(cases=results)


def load_dataset(path: Path = DEFAULT_DATASET_PATH) -> list[EvalCase]:
    """Load eval cases from a JSON file.

    The file is a JSON list of objects with ``question`` (str),
    ``expected_uuids`` (list of str), and an optional ``note_name`` (str).

    Raises:
        FileNotFoundError: If ``path`` does not exist.
        json.JSONDecodeError: If the file is not valid JSON.
        KeyError: If a record is missing a required field (``question`` or
            ``expected_uuids``).
    """
    data = json.loads(Path(path).read_text())
    return [
        EvalCase(
            question=item["question"],
            expected_uuids=item["expected_uuids"],
            note_name=item.get("note_name", ""),
        )
        for item in data
    ]
