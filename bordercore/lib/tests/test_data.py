"""Tests for the data integrity of models using the SortOrderMixin.

This module contains tests to validate the `sort_order` field for all
Django models that inherit from the common `SortOrderMixin`. It ensures
that for any given group of objects, the sort order forms a dense,
1-based sequence (i.e., 1, 2, 3, ..., N) without any gaps or
duplicate values.
"""

import pytest

from django.apps import apps
from django.db.models import Count, Max, Min

pytestmark = [pytest.mark.django_db, pytest.mark.data_quality]


def test_sort_order_mixin():
    """
    Checks that for each model using SortOrderMixin, the 'sort_order' field is a
    dense, 1-based sequence (1, 2, ..., N) for each group of objects.

    This is verified with a single aggregate query per model that checks:
    1. min(sort_order) == 1
    2. max(sort_order) == total object count
    3. count(distinct sort_order) == total object count (ensures no duplicates)
    """
    # Find all models that inherit from your mixin
    models_to_test = [
        model for model in apps.get_models()
        if "SortOrderMixin" in [base.__name__ for base in model.__bases__]
    ]

    for model in models_to_test:
        # This assumes your model defines a `field_name` class attribute
        # that holds the name of the field to group by
        try:
            grouping_field = model.field_name
        except AttributeError:
            pytest.fail(
                f"Model {model.__name__} uses SortOrderMixin but does not define "
                f"the required `field_name` class attribute to specify the grouping field."
            )
            continue

        # Group all objects by the `grouping_field` and calculate
        # all required stats for each group at the database level.
        group_stats = (
            model.objects
            .values(grouping_field)  # This is the GROUP BY clause
            .annotate(
                item_count=Count("pk"),
                min_sort=Min("sort_order"),
                max_sort=Max("sort_order"),
                distinct_sort_count=Count("sort_order", distinct=True)
            )
            .order_by()  # Remove any default model ordering for efficiency
        )

        # Now, loop through the aggregated results in memory and assert the conditions.
        for group in group_stats:
            item_count = group["item_count"]
            group_id = group[grouping_field]

            # Condition 1: min(sort_order) must be 1
            assert group["min_sort"] == 1, (
                f"Model '{model.__name__}', group '{grouping_field}={group_id}': "
                f"Min(sort_order) is {group['min_sort']}, expected 1."
            )

            # Condition 2: max(sort_order) must equal the total count
            assert group["max_sort"] == item_count, (
                f"Model '{model.__name__}', group '{grouping_field}={group_id}': "
                f"Max(sort_order) is {group['max_sort']}, but count is {item_count}."
            )

            # Condition 3: No duplicate sort_order values
            assert group["distinct_sort_count"] == item_count, (
                f"Model '{model.__name__}', group '{grouping_field}={group_id}': "
                f"Found duplicate sort_order values. Total items: {item_count}, "
                f"but found only {group['distinct_sort_count']} distinct sort order values."
            )
