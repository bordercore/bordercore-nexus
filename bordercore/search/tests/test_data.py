"""
Data integrity tests for RecentSearch model.

Tests that verify database constraints and business rules are properly maintained.
"""

import pytest

from django.contrib.auth.models import User
from django.db.models import Count, Max, Min

from search.models import RecentSearch

pytestmark = pytest.mark.data_quality


def test_recent_searches_sort_order_mixin():
    """
    This test checks for two things for the RecentSearch model for each user:
    min(sort_order) = 1
    max(sort_order) should equal the total count

    If issues are found, the test will automatically fix them and then verify
    that the fix was successful.
    """

    # Single query to get all necessary data per user
    user_stats = RecentSearch.objects.values("user").annotate(
        min_sort_order=Min("sort_order"),
        max_sort_order=Max("sort_order"),
        total_count=Count("id")
    )

    # Fix any issues found
    users_to_fix = []
    for stats in user_stats:
        user_id = stats["user"]
        min_sort_order = stats["min_sort_order"]
        max_sort_order = stats["max_sort_order"]
        total_count = stats["total_count"]

        if min_sort_order != 1 or max_sort_order != total_count:
            users_to_fix.append(user_id)

    # Fix users with issues
    for user_id in users_to_fix:
        user = User.objects.get(id=user_id)
        RecentSearch.renumber_for_user(user)

    # Re-check after fixing
    user_stats = RecentSearch.objects.values("user").annotate(
        min_sort_order=Min("sort_order"),
        max_sort_order=Max("sort_order"),
        total_count=Count("id")
    )

    # Check min sort_order for each user
    for stats in user_stats:
        user_id = stats["user"]
        min_sort_order = stats["min_sort_order"]
        assert min_sort_order == 1, f"Min(sort_order) is {min_sort_order}, expected 1 for user_id={user_id}"

    # Check each user's max sort_order equals their count
    for stats in user_stats:
        user_id = stats["user"]
        max_sort_order = stats["max_sort_order"]
        total_count = stats["total_count"]

        assert max_sort_order == total_count, (
            f"Max(sort_order) {max_sort_order} != total count {total_count} "
            f"for user_id={user_id}"
        )
