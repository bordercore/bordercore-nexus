"""Report Notes RAG retrieval quality against the curated eval dataset.

Loads the dataset, runs the real retrieval pipeline for each case, and prints
aggregate metrics plus a per-case breakdown. Retrieval only — each case costs
just the embedding call inside ``semantic_search``.
"""

import json
from pathlib import Path

from django.core.management.base import BaseCommand, CommandError

from blob.rag_eval import (
    DEFAULT_DATASET_PATH,
    evaluate_notes_retrieval,
    load_dataset,
)


class Command(BaseCommand):
    help = "Evaluate Notes RAG retrieval quality against the curated dataset."

    def add_arguments(self, parser):
        parser.add_argument("--user-id", type=int, default=1)
        parser.add_argument("--dataset", default=str(DEFAULT_DATASET_PATH))
        parser.add_argument(
            "--raw-k",
            type=int,
            default=8,
            help="Candidate pool size requested from semantic_search; raw recall "
            "is measured against this many hits.",
        )

    def handle(self, *args, **options):
        dataset_path = Path(options["dataset"])
        if not dataset_path.exists():
            raise CommandError(f"Dataset not found: {dataset_path}")

        try:
            dataset = load_dataset(dataset_path)
        except (json.JSONDecodeError, KeyError) as exc:
            raise CommandError(f"Dataset parse error in {dataset_path}: {exc}") from exc
        if not dataset:
            raise CommandError(f"Dataset is empty: {dataset_path}")

        report = evaluate_notes_retrieval(
            dataset,
            user_id=options["user_id"],
            raw_k=options["raw_k"],
        )

        raw_k = options["raw_k"]
        self.stdout.write(f"Cases: {report.case_count}")
        self.stdout.write(f"raw recall@{raw_k}:     {report.raw_recall_at_8:.3f}")
        self.stdout.write(f"effective recall@3: {report.effective_recall_at_3:.3f}")
        self.stdout.write(f"hit@1:              {report.hit_at_1:.3f}")
        self.stdout.write(f"MRR:                {report.mrr:.3f}")
        self.stdout.write(f"dropped-by-filter:  {report.dropped_count}")
        self.stdout.write(f"grounded@3:         {report.grounded_at_3:.3f}")
        self.stdout.write(f"grounded | hit@3:   {report.grounded_given_hit3:.3f}")
        self.stdout.write(f"measurable:         {report.measurable_count}/{report.case_count}")
        self.stdout.write("")

        grounded_label = {True: "yes", False: "no", None: "-"}
        for result in report.cases:
            status = "PASS" if result.effective_hit3 else "FAIL"
            marker = "  ⚠ dropped-by-filter" if result.dropped_by_filter else ""
            if result.effective_hit3 and result.passage_grounded is False:
                marker += "  ⚠ passage-not-grounded"
            label = result.case.note_name or ", ".join(result.case.expected_uuids)
            grounded = grounded_label[result.passage_grounded]
            self.stdout.write(
                f"[{status}] raw={result.raw_rank} eff={result.effective_rank} "
                f"grounded={grounded} {result.case.question!r} → {label}{marker}"
            )
