"""Unit tests for the gold answer-phrase draft generator."""

import pytest

from django.core.management import CommandError


class TestPhraseInNote:
    def test_true_for_verbatim_substring(self):
        from blob.management.commands.gen_notes_rag_answers import _phrase_in_note
        assert _phrase_in_note("1536-dim", "indexed with a 1536-dim vector") is True

    def test_case_insensitive(self):
        from blob.management.commands.gen_notes_rag_answers import _phrase_in_note
        assert _phrase_in_note("Embeddings_Vector", "the embeddings_vector field") is True

    def test_false_for_paraphrase_not_in_note(self):
        from blob.management.commands.gen_notes_rag_answers import _phrase_in_note
        assert _phrase_in_note("1536 dimensions", "indexed with a 1536-dim vector") is False

    def test_false_for_empty_phrase(self):
        from blob.management.commands.gen_notes_rag_answers import _phrase_in_note
        assert _phrase_in_note("", "anything") is False


class TestRefusesCuratedPath:
    def test_refuses_to_write_curated_dataset(self):
        from django.core.management import call_command
        with pytest.raises(CommandError, match="Refusing to write the curated dataset"):
            call_command("gen_notes_rag_answers", "--out", "notes_rag_eval.json")
