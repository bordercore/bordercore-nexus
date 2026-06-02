"""Tests for the add_image_embedding_mapping management command."""
from io import StringIO
from unittest.mock import patch

import pytest
from django.core.management import call_command


@pytest.mark.django_db
@patch("blob.management.commands.add_image_embedding_mapping.get_elasticsearch_connection")
def test_command_puts_dense_vector_mapping(mock_get_es):
    """add_image_embedding_mapping calls put_mapping with a cosine int8_hnsw dense_vector field."""
    es = mock_get_es.return_value
    out = StringIO()
    call_command("add_image_embedding_mapping", stdout=out)

    assert es.indices.put_mapping.called
    _, kwargs = es.indices.put_mapping.call_args
    prop = kwargs["properties"]["image_embedding"]
    assert prop["type"] == "dense_vector"
    assert prop["dims"] == 512
    assert prop["similarity"] == "cosine"
    assert prop["index_options"]["type"] == "int8_hnsw"
