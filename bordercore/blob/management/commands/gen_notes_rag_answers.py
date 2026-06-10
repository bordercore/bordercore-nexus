"""Draft gold ``answer_phrases`` for Notes RAG eval cases (one-off, curate after).

For each curated case missing ``answer_phrases``, fetch the expected note and ask
gpt-4o-mini to extract the shortest verbatim span that answers the question.
Validates that the span is a real substring of the note (guards against
paraphrase/hallucination that would never match a passage); flags it for review
otherwise. Writes a DRAFT file; never overwrites the curated dataset.
"""

import json
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from openai import OpenAI

from blob.rag_eval import DEFAULT_DATASET_PATH, load_dataset
from lib.util import get_elasticsearch_connection

DRAFT_SYSTEM_PROMPT = (
    "You curate gold answers for a personal-notes search evaluation. Given a "
    "QUESTION and the full TEXT of the note that answers it, output the SHORTEST "
    "span copied VERBATIM from the note that contains the answer. Copy it exactly, "
    "preserving punctuation and capitalization. Output only that span, no quotes "
    "or preamble."
)

DRAFT_MODEL = "gpt-4o-mini"
EXCERPT_CHARS = 6000


def _phrase_in_note(phrase: str, contents: str) -> bool:
    """True iff ``phrase`` is a non-empty case-insensitive substring of ``contents``."""
    return bool(phrase) and phrase.lower() in (contents or "").lower()


class Command(BaseCommand):
    help = "Draft gold answer_phrases for Notes RAG eval cases (curate after)."

    def add_arguments(self, parser):
        parser.add_argument("--user-id", type=int, default=1)
        parser.add_argument("--dataset", default=str(DEFAULT_DATASET_PATH))
        parser.add_argument(
            "--out",
            default=str(
                Path(__file__).resolve().parents[2]
                / "rag_eval_data"
                / "notes_rag_eval.answers.draft.json"
            ),
        )

    def _note_contents(self, es, uuid):
        """Fetch a note's contents + name from Elasticsearch by uuid (= _id)."""
        try:
            doc = es.get(index=settings.ELASTICSEARCH_INDEX, id=uuid,
                         _source=["contents", "name"])
        except Exception:  # noqa: BLE001 — missing/deleted note: skip it
            return None, None
        source = doc.get("_source", {})
        return source.get("contents"), source.get("name")

    def handle(self, *args, **options):
        out_path = Path(options["out"])
        if out_path.name == "notes_rag_eval.json":
            raise CommandError(
                "Refusing to write the curated dataset path; choose a draft path."
            )

        dataset_path = Path(options["dataset"])
        if not dataset_path.exists():
            raise CommandError(f"Dataset not found: {dataset_path}")
        cases = load_dataset(dataset_path)

        es = get_elasticsearch_connection(host=settings.ELASTICSEARCH_ENDPOINT)
        client = OpenAI()

        drafted = 0
        flagged = 0
        out_cases = []
        for case in cases:
            record = {
                "question": case.question,
                "expected_uuids": case.expected_uuids,
                "note_name": case.note_name,
                "answer_phrases": list(case.answer_phrases),
            }
            if case.answer_phrases or not case.expected_uuids:
                out_cases.append(record)
                continue

            contents, name = self._note_contents(es, case.expected_uuids[0])
            if not contents:
                self.stderr.write(f"Skipped (no contents): {case.expected_uuids[0]}")
                out_cases.append(record)
                continue

            try:
                response = client.chat.completions.create(
                    model=DRAFT_MODEL,
                    messages=[
                        {"role": "system", "content": DRAFT_SYSTEM_PROMPT},
                        {"role": "user", "content":
                            f"QUESTION: {case.question}\n\nTEXT:\n{contents[:EXCERPT_CHARS]}"},
                    ],
                    temperature=0.0,
                    max_tokens=64,
                )
                phrase = (response.choices[0].message.content or "").strip()
            except Exception as exc:  # noqa: BLE001 — skip a case, keep going
                self.stderr.write(f"Skipped {case.expected_uuids[0]}: {exc}")
                out_cases.append(record)
                continue

            if _phrase_in_note(phrase, contents):
                record["answer_phrases"] = [phrase]
                drafted += 1
            else:
                # Keep the suggestion but flag it: not a verbatim match, so it
                # would never ground against a passage as-is.
                record["answer_phrases"] = [phrase]
                record["_needs_review"] = True
                flagged += 1
            out_cases.append(record)

        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(json.dumps(out_cases, indent=2, ensure_ascii=False))
        self.stdout.write(
            f"Drafted {drafted} phrases ({flagged} flagged _needs_review) → {out_path}"
        )
        self.stdout.write(
            "Curate this file (verify/trim phrases, drop _needs_review keys), "
            "then merge into notes_rag_eval.json."
        )
