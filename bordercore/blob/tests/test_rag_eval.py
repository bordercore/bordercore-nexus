"""Unit and regression tests for the Notes RAG retrieval eval harness."""

import pytest

from blob.rag_eval import (
    CaseResult,
    EvalCase,
    EvalReport,
    _first_expected_rank,
    evaluate_notes_retrieval,
    score_case,
)


def _hit(uuid, score):
    return {"_score": score, "_source": {"uuid": uuid, "name": uuid}}


class TestFirstExpectedRank:
    def test_returns_one_based_rank_of_first_expected(self):
        hits = [_hit("a", 0.9), _hit("b", 0.8), _hit("c", 0.7)]
        assert _first_expected_rank(hits, ["b"]) == 2

    def test_returns_first_match_when_multiple_expected_present(self):
        hits = [_hit("a", 0.9), _hit("b", 0.8), _hit("c", 0.7)]
        assert _first_expected_rank(hits, ["c", "a"]) == 1

    def test_returns_none_when_no_expected_present(self):
        hits = [_hit("a", 0.9), _hit("b", 0.8)]
        assert _first_expected_rank(hits, ["z"]) is None

    def test_returns_none_on_empty_hits(self):
        assert _first_expected_rank([], ["a"]) is None


class TestScoreCase:
    def test_expected_passes_filter_and_cap(self):
        # "a" is rank 1 raw and survives the score filter + top-N cap.
        case = EvalCase(question="q", expected_uuids=["a"])
        raw = [_hit("a", 0.90), _hit("b", 0.80), _hit("c", 0.70)]
        result = score_case(case, raw)
        assert result.raw_rank == 1
        assert result.effective_rank == 1
        assert result.raw_hit8 is True
        assert result.effective_hit3 is True
        assert result.hit1 is True
        assert result.dropped_by_filter is False
        assert result.rr == 1.0

    def test_dropped_by_filter_when_below_min_score(self):
        # "a" is retrieved (raw rank 1) but its score is under 0.65, so the
        # filter removes it — the threshold-bug signature.
        case = EvalCase(question="q", expected_uuids=["a"])
        raw = [_hit("a", 0.50), _hit("b", 0.80)]
        result = score_case(case, raw)
        assert result.raw_rank == 1
        assert result.effective_rank is None
        assert result.raw_hit8 is True
        assert result.effective_hit3 is False
        assert result.dropped_by_filter is True
        assert result.rr == 1.0

    def test_dropped_by_cap_when_beyond_top_three(self):
        # "e" survives the score filter but sits at effective position 4 → capped out.
        case = EvalCase(question="q", expected_uuids=["e"])
        raw = [
            _hit("a", 0.95), _hit("b", 0.90), _hit("c", 0.85),
            _hit("d", 0.80), _hit("e", 0.75),
        ]
        result = score_case(case, raw)
        assert result.raw_rank == 5
        assert result.effective_rank is None
        assert result.dropped_by_filter is True
        assert result.rr == pytest.approx(0.2)

    def test_complete_miss(self):
        case = EvalCase(question="q", expected_uuids=["z"])
        raw = [_hit("a", 0.95), _hit("b", 0.90)]
        result = score_case(case, raw)
        assert result.raw_rank is None
        assert result.effective_rank is None
        assert result.raw_hit8 is False
        assert result.dropped_by_filter is False
        assert result.rr == 0.0
