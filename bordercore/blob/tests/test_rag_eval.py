"""Unit and regression tests for the Notes RAG retrieval eval harness."""

import pytest

from blob.rag_eval import (
    CaseResult,
    DEFAULT_DATASET_PATH,
    EvalCase,
    EvalReport,
    _first_expected_rank,
    _passage_contains,
    evaluate_notes_retrieval,
    load_dataset,
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
        # "a" is rank 1 raw and survives the top-N cap.
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

    def test_low_score_no_longer_dropped(self):
        # The cosine score filter is gone; only the top-N cap can drop a hit.
        # A rank-1 expected note is kept regardless of how low its score is.
        case = EvalCase(question="q", expected_uuids=["a"])
        raw = [_hit("a", 0.10), _hit("b", 0.80)]
        result = score_case(case, raw)
        assert result.raw_rank == 1
        assert result.effective_rank == 1
        assert result.effective_hit3 is True
        assert result.dropped_by_filter is False
        assert result.rr == 1.0

    def test_dropped_by_cap_when_beyond_top_three(self):
        # "e" is retrieved raw but sits at effective position 4 → capped out.
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


class TestEvalReport:
    def _result(self, *, raw_rank, effective_rank, rr):
        return CaseResult(
            case=EvalCase(question="q", expected_uuids=["a"]),
            raw_rank=raw_rank,
            effective_rank=effective_rank,
            rr=rr,
        )

    def test_aggregates_over_mixed_results(self):
        report = EvalReport(cases=[
            self._result(raw_rank=1, effective_rank=1, rr=1.0),    # raw+eff+hit1
            self._result(raw_rank=2, effective_rank=2, rr=0.5),    # raw+eff
            self._result(raw_rank=1, effective_rank=None, rr=1.0),  # dropped-by-filter
            self._result(raw_rank=None, effective_rank=None, rr=0.0),  # miss
        ])
        assert report.raw_recall_at_8 == pytest.approx(0.75)   # 3/4
        assert report.effective_recall_at_3 == pytest.approx(0.5)  # 2/4
        assert report.hit_at_1 == pytest.approx(0.25)          # 1/4
        assert report.mrr == pytest.approx((1.0 + 0.5 + 1.0 + 0.0) / 4)
        assert report.dropped_count == 1
        assert report.case_count == 4

    def test_empty_report_is_all_zero(self):
        report = EvalReport(cases=[])
        assert report.raw_recall_at_8 == 0.0
        assert report.effective_recall_at_3 == 0.0
        assert report.hit_at_1 == 0.0
        assert report.mrr == 0.0
        assert report.dropped_count == 0
        assert report.case_count == 0


class TestEvaluateNotesRetrieval:
    def test_drives_pipeline_with_injected_search_fn(self):
        dataset = [
            EvalCase(question="where are the taxes", expected_uuids=["tax"]),
            EvalCase(question="nothing matches", expected_uuids=["zzz"]),
        ]

        def fake_search(request, query, *, size):
            assert request.user.id == 7
            assert size == 8
            if "taxes" in query:
                return {"hits": {"hits": [{"_score": 0.9, "_source": {"uuid": "tax"}}]}}
            return {"hits": {"hits": [{"_score": 0.9, "_source": {"uuid": "other"}}]}}

        report = evaluate_notes_retrieval(dataset, user_id=7, search_fn=fake_search)
        assert report.case_count == 2
        assert report.raw_recall_at_8 == pytest.approx(0.5)
        assert report.cases[0].effective_rank == 1
        assert report.cases[1].raw_rank is None

    def test_passes_raw_k_through_as_size(self):
        seen = {}

        def fake_search(request, query, *, size):
            seen["size"] = size
            return {"hits": {"hits": []}}

        evaluate_notes_retrieval(
            [EvalCase(question="q", expected_uuids=["a"])],
            raw_k=20,
            search_fn=fake_search,
        )
        assert seen["size"] == 20


# Calibrated AFTER the first real run on the curated dataset: run
# `manage.py eval_notes_rag`, observe effective recall@3, and set this to a
# round value just below it. Calibrated 2026-06-06 (30 cases): pure-kNN, hybrid
# BM25+kNN, and chunk-level indexing all measured effective recall@3 = 0.867;
# gate stays 0.80 to absorb ~2 cases of embedding noise. (Chunking lifted raw
# recall@8/MRR and generation grounding, but the buried-fact cases rank in the
# candidate pool just outside the top-3 cap — reranking is the next lever.)
# Raise it when a deliberate retrieval improvement clears the top-3 cap; do not
# raise it reactively after a single high run.
NOTES_RAG_EVAL_BASELINE = 0.80

# Minimum cases before the guard asserts; below this, recall estimates are
# too noisy to be a reliable regression gate.
MIN_GUARD_CASES = 10


@pytest.mark.data_quality
def test_notes_rag_effective_recall_meets_baseline():
    """Real-ES regression guard: curated dataset must retrieve well enough.

    Skips until a curated dataset of at least MIN_GUARD_CASES exists, so a fresh
    clone or pre-curation state does not hard-fail. Once populated, it asserts
    effective recall@3 stays at or above the calibrated baseline.
    """
    if not DEFAULT_DATASET_PATH.exists():
        pytest.skip("No curated Notes RAG eval dataset present.")

    dataset = load_dataset(DEFAULT_DATASET_PATH)
    if len(dataset) < MIN_GUARD_CASES:
        pytest.skip(
            f"Curated dataset has {len(dataset)} cases (<{MIN_GUARD_CASES}); "
            "not enough to guard yet."
        )

    report = evaluate_notes_retrieval(dataset)
    assert report.effective_recall_at_3 >= NOTES_RAG_EVAL_BASELINE, (
        f"effective recall@3 {report.effective_recall_at_3:.3f} fell below "
        f"baseline {NOTES_RAG_EVAL_BASELINE}; {report.dropped_count} cases "
        "dropped by the top-N cap."
    )


class TestPassageContains:
    def test_true_when_any_phrase_present(self):
        assert _passage_contains("the vector is 1536 dims", ["1536"]) is True

    def test_case_insensitive(self):
        assert _passage_contains("Indexed with EMBEDDINGS_VECTOR", ["embeddings_vector"]) is True

    def test_any_of_matches_second_phrase(self):
        assert _passage_contains("size is 1,536", ["1536", "1,536"]) is True

    def test_false_when_no_phrase_present(self):
        assert _passage_contains("nothing relevant here", ["1536"]) is False

    def test_false_on_empty_phrases(self):
        assert _passage_contains("anything", []) is False

    def test_false_on_none_passage(self):
        assert _passage_contains(None, ["1536"]) is False
