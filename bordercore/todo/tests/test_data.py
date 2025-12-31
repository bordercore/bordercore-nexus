import pytest

import django
from django.conf import settings
from django.db.models import Count

from lib.util import get_elasticsearch_connection

pytestmark = pytest.mark.data_quality

django.setup()

from todo.models import Todo  # isort:skip
from tag.models import TagTodo  # isort:skip


@pytest.fixture()
def es():
    "Elasticsearch fixture"
    yield get_elasticsearch_connection(host=settings.ELASTICSEARCH_ENDPOINT)

def test_todo_tasks_in_db_exist_in_elasticsearch(es):
    """Assert that all todo tasks in the database exist in Elasticsearch"""

    # Get all todos from database. Convert to list to avoid re-querying.
    todos = list(Todo.objects.all().only("uuid"))

    if not todos:
        return

    db_uuids = [task.uuid for task in todos]

    # Single Elasticsearch query to get all todos at once
    search_object = {
        "query": {
            "terms": {
                "uuid": db_uuids  # Search for all UUIDs at once
            }
        },
        "size": len(db_uuids),  # Make sure we get all results
        "_source": ["uuid"]
    }

    found = es.search(index=settings.ELASTICSEARCH_INDEX, **search_object)

    # Convert ES results to set for fast O(1) lookups
    es_uuids = {hit["_source"]["uuid"] for hit in found["hits"]["hits"]}

    # Check each database todo against Elasticsearch
    for task in todos:
        assert str(task.uuid) in es_uuids, \
            f"todo task found in the database but not in Elasticsearch, id={task.uuid}"


def test_todo_tags_match_elasticsearch(es):
    """Assert that all todo tags match those found in Elasticsearch"""

    todos = Todo.objects.filter(tags__isnull=False).prefetch_related("tags").only("uuid", "tags")

    # Convert to list to avoid re-querying
    todos_list = list(todos)

    if not todos_list:
        return

    # Batch all searches into one multi-search request
    search_requests = []

    for task in todos_list:
        tag_query = [
            {
                "term": {
                    "tags.keyword": tag.name
                }
            }
            for tag in task.tags.all()
        ]

        search_object = {
            "query": {
                "bool": {
                    "must": [
                        {
                            "term": {
                                "uuid": task.uuid
                            }
                        },
                        *tag_query
                    ]
                }
            },
            "_source": ["id"]
        }

        # Add to multi-search batch
        search_requests.extend([
            {"index": settings.ELASTICSEARCH_INDEX},
            search_object
        ])

    # Execute all searches in ONE Elasticsearch request
    if search_requests:
        results = es.msearch(body=search_requests)

        # Check results (one result per todo)
        for i, task in enumerate(todos_list):
            response = results["responses"][i]
            if "error" in response:
                assert False, f"Elasticsearch error for todo {task.uuid}: {response["error"]}"

            found = response["hits"]["total"]["value"]
            assert found == 1, f"todo's tags don't match those found in Elasticsearch, id={task.uuid}"


def test_elasticsearch_todo_tasks_exist_in_db(es):
    """Assert that all todo tasks in Elasticsearch exist in the database"""

    # Get all todos from Elasticsearch
    search_object = {
        "query": {
            "term": {
                "doctype": "todo"
            }
        },
        "from_": 0, "size": 10000,
        "_source": ["_id", "bordercore_id"]
    }
    found = es.search(index=settings.ELASTICSEARCH_INDEX, **search_object)["hits"]["hits"]

    if not found:
        return

    # Extract all bordercore_ids from Elasticsearch results
    es_bordercore_ids = [task["_source"]["bordercore_id"] for task in found]

    # Single database query to get all existing Todo IDs
    # Convert to set for O(1) lookup performance
    existing_todo_ids = set(
        Todo.objects.filter(id__in=es_bordercore_ids).values_list("id", flat=True)
    )

    # Check each Elasticsearch todo against the database set
    for task in found:
        bordercore_id = task["_source"]["bordercore_id"]
        assert bordercore_id in existing_todo_ids, \
            f"todo exists in Elasticsearch but not in database, id={task['_id']}, bordercore_id={bordercore_id}"


def test_todo_sortorder():
    """
    For every todo task, the number of tags should equal the number
    of TagTodo objects.
    """
    # Get all tasks with prefetched tags
    tasks = Todo.objects.all().prefetch_related("tags")

    # Convert to list to avoid re-querying
    tasks_list = list(tasks)

    if not tasks_list:
        return

    # Get all TagTodo counts in one query, grouped by todo
    tag_todo_counts = dict(
        TagTodo.objects.filter(todo__in=tasks_list)
        .values("todo")
        .annotate(count=Count("id"))
        .values_list("todo", "count")
    )

    # Check each task
    for task in tasks_list:
        tag_count = len(task.tags.all())  # Uses prefetched data
        so_count = tag_todo_counts.get(task.id, 0)  # O(1) dict lookup
        assert tag_count == so_count, f"todo sort order corruption, todo.uuid = {task.uuid}"


def test_todo_tag_counts_consistency():
    """
    For every Todo, verify the M2M tag count matches the explicit
    TagTodo through model count.
    """
    # This single query gets all tasks, each annotated with the two counts.
    # Using "distinct=True" on BOTH counts is crucial to prevent the
    # JOINs from creating a cartesian product and inflating the results.
    tasks_with_counts = Todo.objects.annotate(
        # Counts the tags via the standard "tags" M2M relationship
        m2m_tag_count=Count("tags", distinct=True),
        # Counts the rows in the explicit "TagTodo" through model
        through_model_count=Count("tagtodo", distinct=True)
    )

    # This loop iterates over the results without making more database queries.
    for task in tasks_with_counts:
        assert task.m2m_tag_count == task.through_model_count, (
            f"Tag count mismatch for todo.uuid = {task.uuid}. "
            f"M2M count: {task.m2m_tag_count}, "
            f"Through model count: {task.through_model_count}"
        )
