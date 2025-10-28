"""
Question Data Integrity Tests

This module contains integration tests that verify data consistency across multiple
storage systems for question records. These tests ensure that question data remains synchronized
between the database and the Elasticsearch index.
"""

import pytest

import django
from django.conf import settings

from drill.models import Question
from lib.util import get_elasticsearch_connection, get_missing_blob_ids

pytestmark = pytest.mark.data_quality

django.setup()


@pytest.fixture()
def es():
    "Elasticsearch fixture"
    yield get_elasticsearch_connection(host=settings.ELASTICSEARCH_ENDPOINT)


def test_questions_in_db_exist_in_elasticsearch(es):
    "Assert that all questions in the database exist in Elasticsearch"

    questions = Question.objects.all().only("uuid")
    step_size = 100
    question_count = questions.count()

    for batch in range(0, question_count, step_size):
        # The batch_size will always be equal to "step_size", except probably
        #  the last batch, which will be less.
        batch_size = step_size if question_count - batch > step_size else question_count - batch

        query = [
            {
                "term": {
                    "_id": str(x.uuid)
                }
            }
            for x
            in questions[batch:batch + step_size]
        ]

        search_object = {
            "query": {
                "bool": {
                    "should": query
                }
            },
            "size": batch_size,
            "_source": [""]
        }

        found = es.search(index=settings.ELASTICSEARCH_INDEX, **search_object)

        assert found["hits"]["total"]["value"] == batch_size,\
            "questions found in the database but not in Elasticsearch: " + get_missing_blob_ids(questions[batch:batch + step_size], found)


def test_elasticsearch_questions_exist_in_db(es):
    """Assert that all questions in Elasticsearch exist in the database"""

    search_object = {
        "query": {
            "term": {
                "doctype": "drill"
            }
        },
        "from_": 0, "size": 10000,
        "_source": ["uuid"]
    }

    found = es.search(index=settings.ELASTICSEARCH_INDEX, **search_object)["hits"]["hits"]
    es_uuids = [question["_source"]["uuid"] for question in found]

    # Single database query to get all existing UUIDs
    db_uuids = set(
        str(uuid) for uuid in Question.objects.filter(uuid__in=es_uuids)
        .values_list("uuid", flat=True)
    )

    # Find missing UUIDs
    missing_from_db = set(es_uuids) - db_uuids

    assert not missing_from_db, \
        f"Questions found in Elasticsearch but not in the database: {missing_from_db}"
