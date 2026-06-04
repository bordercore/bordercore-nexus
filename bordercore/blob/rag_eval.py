"""Retrieval-quality evaluation for the Notes RAG pipeline.

Pure, dependency-light scoring layered on the *real* retrieval functions so the
eval tracks production behavior. Retrieval only: no generation, no LLM judge.
Each case costs just the embedding calls inside ``semantic_search``.

Metric definitions (per case, "expected" = at least one ``expected_uuids``
member present at that stage):

- raw recall@k      expected present in ``semantic_search`` top-k hits.
- effective recall@3 expected present after the ``NOTES_RAG_MIN_SCORE`` filter
                     and the ``NOTES_RAG_MAX_SOURCES`` cap.
- hit@1             the #1 effective result is an expected note.
- MRR               mean reciprocal rank of the first expected uuid in the raw
                     ranking.
- dropped-by-filter raw-hit but not effective-hit (removed by the score filter or the top-N cap).
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable

from blob.services import NOTES_RAG_MAX_SOURCES, _filter_notes_hits
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
        """Whether an expected note survived the score filter and top-3 cap."""
        return self.effective_rank is not None

    @property
    def hit1(self) -> bool:
        """Whether the #1 effective result is an expected note."""
        return self.effective_rank == 1

    @property
    def dropped_by_filter(self) -> bool:
        """Raw-hit that didn't reach the effective set.

        True when an expected note was retrieved in the raw ranking but was
        removed by the score filter or the top-N cap (the threshold-bug
        signature). "Filter" here means the whole effective-set construction,
        not only the score threshold.
        """
        return self.raw_hit8 and not self.effective_hit3


@dataclass
class EvalReport:
    """Aggregate metrics over scored cases. Implemented in Task 2."""

    cases: list[CaseResult]


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


def score_case(case: EvalCase, raw_hits: list[dict[str, Any]]) -> CaseResult:
    """Score a single case from its raw ``semantic_search`` hits.

    Pure: takes the raw hit list and applies the same filter + cap the
    production RAG flow uses, then computes ranks and reciprocal rank.
    """
    effective_hits = _filter_notes_hits(raw_hits)[:NOTES_RAG_MAX_SOURCES]
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
    """Run each case through the retrieval pipeline. Implemented in Task 2."""
    raise NotImplementedError
