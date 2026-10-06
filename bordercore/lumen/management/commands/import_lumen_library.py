"""Import the local dashboard library without modifying its source files."""

import json
import sqlite3
from contextlib import closing
from pathlib import Path
from typing import Any

from lumen.generation import UserError, canonical_uuid
from lumen.models import LessonVersion, LumenPreferences
from lumen.services import validate_preferences
from lumen.themes import DEFAULT_STYLE, STYLES

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError, CommandParser
from django.db import transaction
from django.utils import timezone
from django.utils.dateparse import parse_datetime

from drill.models import Question


class Command(BaseCommand):
    help = "Import immutable Lumen versions and preferences; repeat runs skip identical versions."

    def add_arguments(self, parser: CommandParser) -> None:
        parser.add_argument("library", type=Path)
        parser.add_argument("--user", required=True)
        parser.add_argument("--dry-run", action="store_true")

    @transaction.atomic
    def handle(self, *args: Any, **options: Any) -> None:
        root = options["library"].expanduser().resolve()
        user = get_user_model().objects.filter(username=options["user"]).first()
        if not user:
            raise CommandError("Unknown user.")
        try:
            with closing(
                sqlite3.connect(
                    (root / "library.sqlite3").as_uri() + "?mode=ro", uri=True
                )
            ) as conn:
                conn.row_factory = sqlite3.Row
                rows = conn.execute(
                    "SELECT * FROM lessons ORDER BY created_at"
                ).fetchall()
                stored_settings = conn.execute(
                    "SELECT value FROM settings WHERE id=1"
                ).fetchone()
            preferences = (
                json.loads(stored_settings["value"]) if stored_settings else None
            )
            if preferences:
                selected = validate_preferences(preferences)
                style = preferences.get("style", DEFAULT_STYLE)
                if style not in STYLES:
                    raise ValueError("Unknown lesson style")
            imported = skipped = 0
            for row in rows:
                lesson_id = canonical_uuid(row["id"])
                question_uuid = canonical_uuid(row["question_uuid"])
                directory = root / "pages" / question_uuid / lesson_id
                html_path = (directory / "index.html").resolve()
                metadata_path = (directory / "metadata.json").resolve()
                if not html_path.is_relative_to(
                    root
                ) or not metadata_path.is_relative_to(root):
                    raise ValueError("Lesson path escapes library")
                metadata = json.loads(metadata_path.read_text())
                source = json.loads(row["source"])
                followups = json.loads(row["followups"])
                for key, value in {
                    "id": lesson_id,
                    "question_uuid": question_uuid,
                    "source": source,
                    "followups": followups,
                    "provider": row["provider"],
                    "model": row["model"],
                    "title": row["title"],
                    "summary": row["summary"],
                    "created_at": row["created_at"],
                }.items():
                    if metadata.get(key) != value:
                        raise ValueError(f"Metadata mismatch for {lesson_id}: {key}")
                question = Question.objects.filter(
                    uuid=question_uuid, user=user
                ).first()
                if not question:
                    if Question.objects.filter(uuid=question_uuid).exists():
                        raise ValueError(
                            f"Question {question_uuid} belongs to another user"
                        )
                    self.stdout.write(
                        f"Missing question {question_uuid}; preserving archived source."
                    )
                created_at = parse_datetime(row["created_at"])
                if created_at is None or timezone.is_naive(created_at):
                    raise ValueError(f"Invalid creation time for {lesson_id}")
                values = dict(
                    question_uuid=question_uuid,
                    created_at=created_at,
                    title=row["title"],
                    summary=row["summary"],
                    html=html_path.read_text(encoding="utf-8"),
                    source=source,
                    followups=followups,
                    provider=row["provider"],
                    model=row["model"],
                    style=metadata.get("style", DEFAULT_STYLE),
                )
                if values["style"] not in STYLES:
                    raise ValueError(f"Unknown style for {lesson_id}")
                existing = LessonVersion.objects.filter(pk=lesson_id).first()
                if existing:
                    if existing.user_id != user.pk or any(
                        (
                            str(getattr(existing, key)) != value
                            if key == "question_uuid"
                            else getattr(existing, key) != value
                        )
                        for key, value in values.items()
                    ):
                        raise ValueError(f"Conflicting existing version {lesson_id}")
                    skipped += 1
                else:
                    if not options["dry_run"]:
                        LessonVersion.objects.create(
                            id=lesson_id, user=user, question=question, **values
                        )
                    imported += 1
            # Never overwrite preferences changed after an earlier import.
            if preferences and not LumenPreferences.objects.filter(user=user).exists():
                if not options["dry_run"]:
                    LumenPreferences.objects.create(user=user, **selected)
                    profile = user.userprofile
                    profile.lumen_theme = style
                    profile.save(update_fields=["lumen_theme"])
            prefix = "Dry run: would import" if options["dry_run"] else "Imported"
            self.stdout.write(
                f"{prefix} {imported} versions; skipped {skipped} identical versions."
            )
        except (
            sqlite3.Error,
            OSError,
            ValueError,
            TypeError,
            KeyError,
            UserError,
        ) as exc:
            raise CommandError(f"Import aborted: {exc}") from exc
