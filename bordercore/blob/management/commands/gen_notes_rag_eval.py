"""Draft a starter Notes RAG eval dataset with an LLM (one-off, curate after).

Samples notes that have an embeddings_vector, asks gpt-4o-mini to draft one
standalone question answerable from each note, and writes a DRAFT JSON file for
manual curation (trim weak cases, fix expected UUIDs, add hard proper-noun /
multi-note cases). Never overwrites the curated dataset.
"""

import json
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from openai import OpenAI

from lib.util import get_elasticsearch_connection

DRAFT_SYSTEM_PROMPT = (
    "You write evaluation questions for a personal-notes search system. Given "
    "the text of ONE note, output a single natural, standalone question whose "
    "answer is found in that note. The question must stand on its own (no 'this "
    "note', no pronouns referring to unseen context) and use words a person "
    "would actually search. Output only the question, no quotes or preamble."
)

DRAFT_MODEL = "gpt-4o-mini"
EXCERPT_CHARS = 2000


class Command(BaseCommand):
    help = "Generate a DRAFT Notes RAG eval dataset for manual curation."

    def add_arguments(self, parser):
        parser.add_argument("--user-id", type=int, default=1)
        parser.add_argument("--count", type=int, default=30)
        parser.add_argument(
            "--out",
            default=str(
                Path(__file__).resolve().parents[2]
                / "rag_eval_data"
                / "notes_rag_eval.draft.json"
            ),
        )

    def _sample_notes(self, user_id, count):
        """Return up to `count` random note hits with a name + embeddings_vector."""
        es = get_elasticsearch_connection(host=settings.ELASTICSEARCH_ENDPOINT)
        query = {
            "size": count,
            "_source": ["uuid", "name", "title", "contents"],
            "query": {
                "function_score": {
                    "query": {
                        "bool": {
                            "filter": [
                                {"term": {"user_id": user_id}},
                                {"term": {"doctype": "note"}},
                                {"exists": {"field": "embeddings_vector"}},
                                {"exists": {"field": "name"}},
                            ]
                        }
                    },
                    "random_score": {},
                }
            },
        }
        response = es.search(index=settings.ELASTICSEARCH_INDEX, **query)
        return response.get("hits", {}).get("hits", [])

    def handle(self, *args, **options):
        out_path = Path(options["out"])
        if out_path.name == "notes_rag_eval.json":
            raise CommandError(
                "Refusing to write the curated dataset path; choose a draft path."
            )

        hits = self._sample_notes(options["user_id"], options["count"])
        if not hits:
            raise CommandError("No notes with embeddings_vector found for that user.")

        client = OpenAI()
        cases = []
        drafted = 0
        for hit in hits:
            source = hit.get("_source", {})
            uuid = source.get("uuid")
            contents = (source.get("contents") or "").strip()
            name = source.get("name") or source.get("title") or ""
            if not uuid or not contents:
                continue
            try:
                response = client.chat.completions.create(
                    model=DRAFT_MODEL,
                    messages=[
                        {"role": "system", "content": DRAFT_SYSTEM_PROMPT},
                        {"role": "user", "content": contents[:EXCERPT_CHARS]},
                    ],
                    temperature=0.3,
                    max_tokens=64,
                )
                question = (response.choices[0].message.content or "").strip()
            except Exception as exc:  # noqa: BLE001 — skip a note, keep going
                self.stderr.write(f"Skipped {uuid}: {exc}")
                continue
            if not question:
                continue
            cases.append({
                "question": question,
                "expected_uuids": [uuid],
                "note_name": name,
            })
            drafted += 1

        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(json.dumps(cases, indent=2, ensure_ascii=False))
        self.stdout.write(
            f"Drafted {drafted} cases from {len(hits)} sampled notes → {out_path}"
        )
        self.stdout.write("Curate this file, then save it as notes_rag_eval.json.")
