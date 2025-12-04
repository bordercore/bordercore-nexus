"""Reset overdue spaced-repetition intervals for a user's questions.

This script finds all non-disabled ``drill.Question`` rows for the given user
that are either past due (``interval <= now - last_reviewed``) or have never
been reviewed, then resets each qualifying question's ``interval`` to a new
value based on how overdue it is plus a small random bump.

Usage:
    python reset_question_intervals.py <username> [--dry-run] [--max-interval=N]

Environment:
    - Must run within your Django environment (``django.setup()`` is called).
    - Expects the ``drill.Question`` model with fields: ``user``, ``is_disabled``,
      ``interval`` (a ``timedelta``), ``last_reviewed`` (a ``datetime``), and ``uuid``.

Args:
    <username>: The Django username whose questions should be processed.
    --dry-run: Show what would be changed without making actual changes.
    --max-interval=N: Maximum days to add as random component (default: 52).

Config:
    MAX_NEW_INTERVAL (int): Upper bound (inclusive) for the random component
        added to the overdue days. Can be overridden with --max-interval.
    MIN_NEW_INTERVAL (int): Minimum interval for never-reviewed questions.
"""

import argparse
import random
import sys
from datetime import datetime, timedelta
from typing import Any, List, Optional, Protocol, Tuple, Union

import django
from django.apps import apps
from django.contrib.auth import get_user_model
from django.core.exceptions import ObjectDoesNotExist
from django.db import transaction
from django.db.models import F, Q, QuerySet
from django.utils import timezone

django.setup()

from django.contrib.auth.models import AbstractUser

# Configuration
MAX_NEW_INTERVAL: int = 52
MIN_NEW_INTERVAL: int = 1
BATCH_SIZE: int = 100


class QuestionProtocol(Protocol):
    """Protocol defining the expected interface for Question model instances.

    This protocol defines the attributes that must be present on Question
    objects for this script to work properly. Using a Protocol allows
    mypy to type-check our code without requiring the actual Django model
    to be available at type-checking time.
    """
    uuid: str
    last_reviewed: Optional[datetime]
    interval: timedelta
    user: AbstractUser
    is_disabled: bool

    def save(self) -> None:
        """Save the model instance to the database."""
        ...


def parse_args() -> argparse.Namespace:
    """Parse command line arguments.

    Returns:
        Parsed command line arguments containing:
            - username (str): Django username to process
            - dry_run (bool): Whether to run in dry-run mode
            - max_interval (int): Maximum random interval to add in days
            - min_interval (int): Minimum interval for never-reviewed questions in days
    """
    parser = argparse.ArgumentParser(
        description='Reset overdue spaced-repetition intervals'
    )
    parser.add_argument(
        'username',
        help='Django username to process'
    )
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Show changes without applying them'
    )
    parser.add_argument(
        '--max-interval',
        type=int,
        default=MAX_NEW_INTERVAL,
        help=f'Maximum random interval to add (default: {MAX_NEW_INTERVAL})'
    )
    parser.add_argument(
        '--min-interval',
        type=int,
        default=MIN_NEW_INTERVAL,
        help=f'Minimum interval for never-reviewed questions (default: {MIN_NEW_INTERVAL})'
    )
    return parser.parse_args()


def get_user_or_exit(username: str) -> AbstractUser:
    """Get user object or exit with error.

    Args:
        username: The username to look up in the database.

    Returns:
        The Django user object for the given username.

    Raises:
        SystemExit: If the user does not exist in the database.
    """
    try:
        User = get_user_model()
        return User.objects.get(username=username)
    except ObjectDoesNotExist:
        print(f"Error: User does not exist: {username}")
        sys.exit(1)


def calculate_new_interval(
    question: QuestionProtocol,
    now: datetime,
    max_interval: int,
    min_interval: int
) -> timedelta:
    """Calculate new interval for a question based on its review history.

    Args:
        question: The Question model instance to calculate interval for.
        now: Current datetime for calculating overdue periods.
        max_interval: Maximum number of days for the random component.
        min_interval: Minimum number of days for any interval.

    Returns:
        New interval to assign to the question.

    Note:
        For never-reviewed questions, assigns a random interval between min_interval
        and max_interval. For overdue questions, adds random component to overdue
        days, but caps the overdue component to prevent extremely long intervals.
    """
    if not question.last_reviewed:
        # Never reviewed - give it a small random interval
        days = random.randint(min_interval, max_interval)
    else:
        # Calculate time since last_reviewed
        time_since_review = now - question.last_reviewed
        time_since_review_days = time_since_review.days

        # The question is due if interval <= time_since_review
        # To make it no longer due, we need: new_interval > time_since_review
        # So we set new_interval = time_since_review + random_component
        # This ensures the question won't be due again until the new interval elapses
        random_component = random.randint(min_interval, max_interval)
        # Cap the base to prevent extremely long intervals
        capped_base = min(time_since_review_days, max_interval * 2)
        days = max(capped_base + random_component, min_interval)

        # Ensure the new interval is always greater than time_since_review
        # to guarantee the question is no longer due after the update
        if days <= time_since_review_days:
            days = time_since_review_days + 1

    return timedelta(days=days)


def get_overdue_questions(user: AbstractUser) -> QuerySet[Any]:
    """Get all overdue or never-reviewed questions for the user.

    Args:
        user: Django user object whose questions to retrieve.

    Returns:
        QuerySet of Question objects that are either:
            - Past due (interval <= now - last_reviewed, matching frontend query)
            - Never reviewed (last_reviewed is null)

    Note:
        This matches the exact query logic used by start_study_session when
        question_filter == "review". Results are ordered randomly to avoid
        pathological batching patterns. Return type is QuerySet[Any] because
        Django's F expressions make exact typing difficult, but the actual
        objects conform to QuestionProtocol.
    """

    Question = apps.get_model("drill", "Question")

    # Match the exact query logic used by start_study_session in models.py
    # when question_filter == "review". This is what the frontend uses.
    return Question.objects.filter(
        user=user,
        is_disabled=False
    ).filter(
        Q(interval__lte=timezone.now() - F("last_reviewed"))  # type: ignore
        | Q(last_reviewed__isnull=True)
    ).order_by("?")


def process_questions_bulk(
    questions: Union[QuerySet[Any], List[Any]],
    now: datetime,
    max_interval: int,
    min_interval: int,
    dry_run: bool = False
) -> Tuple[int, int]:
    """Process questions in batches for efficiency.

    Args:
        questions: QuerySet or list of Question objects to process.
        now: Current datetime for interval calculations.
        max_interval: Maximum number of days for random interval component.
        min_interval: Minimum number of days for any interval.
        dry_run: If True, show what would be changed without making changes.

    Returns:
        A tuple containing:
            - processed_count (int): Number of questions successfully processed
            - skipped_count (int): Number of questions skipped due to errors

    Note:
        Updates are performed in batches of BATCH_SIZE to optimize database
        operations and memory usage. Individual question processing errors
        are logged but don't stop the overall operation.
    """
    processed_count = 0
    skipped_count = 0
    updates: List[QuestionProtocol] = []

    for q in questions:
        # Cast to our protocol type for better type checking
        question: QuestionProtocol = q

        try:
            new_interval = calculate_new_interval(
                question, now, max_interval, min_interval
            )

            status = "never reviewed" if not question.last_reviewed else "overdue"
            action = "Would reset" if dry_run else "Resetting"

            print(f"{action} {question.uuid} ({status}): "
                  f"new interval = {new_interval.days} days")

            if not dry_run:
                question.interval = new_interval
                updates.append(question)

                # Process in batches to avoid memory issues
                if len(updates) >= BATCH_SIZE:
                    Question = apps.get_model("drill", "Question")
                    Question.objects.bulk_update(updates, ['interval'])
                    updates.clear()

            processed_count += 1

        except Exception as e:
            print(f"Warning: Failed to process question {question.uuid}: {e}")
            skipped_count += 1
            continue

    # Process remaining updates
    if updates and not dry_run:
        Question = apps.get_model("drill", "Question")
        Question.objects.bulk_update(updates, ['interval'])

    return processed_count, skipped_count


def main() -> None:
    """Main execution function.

    Parses command line arguments, validates inputs, retrieves overdue questions,
    and processes them according to the specified parameters. Handles all user
    interaction, error reporting, and transaction management.

    Raises:
        SystemExit: On invalid arguments, missing user, or critical errors.
        KeyboardInterrupt: When user cancels operation with Ctrl+C.

    Note:
        All database operations are wrapped in a transaction to ensure
        consistency. In dry-run mode, changes are previewed but not committed.
    """
    args = parse_args()

    # Validate arguments
    if args.max_interval < 1:
        print("Error: max-interval must be at least 1")
        sys.exit(1)

    if args.min_interval < 1:
        print("Error: min-interval must be at least 1")
        sys.exit(1)

    if args.min_interval > args.max_interval:
        print("Error: min-interval cannot be greater than max-interval")
        sys.exit(1)

    user = get_user_or_exit(args.username)
    now = timezone.now()

    print(f"Finding overdue questions for user: {args.username}")
    if args.dry_run:
        print("DRY RUN MODE - No changes will be made")

    questions = get_overdue_questions(user)
    total_questions = questions.count()

    if total_questions == 0:
        print("No overdue or never-reviewed questions found.")
        return

    print(f"Found {total_questions} questions to process")
    print(f"Using interval range: {args.min_interval} to {args.max_interval} days")

    # Convert queryset to list to ensure we process all questions that were
    # overdue at query time, avoiding any issues with lazy evaluation or
    # queryset re-evaluation during processing
    questions_list = list(questions)
    actual_count = len(questions_list)

    if actual_count != total_questions:
        print(f"Warning: Count mismatch - queryset.count()={total_questions}, "
              f"but list length={actual_count}")

    try:
        with transaction.atomic():
            processed, skipped = process_questions_bulk(
                questions_list, now, args.max_interval, args.min_interval,
                dry_run=args.dry_run
            )

        print("\nSummary:")
        print(f"  Processed: {processed}")
        print(f"  Skipped: {skipped}")
        print(f"  Total found: {total_questions}")
        print(f"  Actual in list: {actual_count}")
        if processed + skipped != actual_count:
            print(f"  WARNING: processed + skipped ({processed + skipped}) != "
                  f"actual count ({actual_count})")

        if args.dry_run:
            print("\nNo changes were made (dry run mode)")
        else:
            print("\nInterval reset complete!")

    except KeyboardInterrupt:
        print("\nOperation cancelled by user")
        sys.exit(1)
    except Exception as e:
        print(f"Error during processing: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
