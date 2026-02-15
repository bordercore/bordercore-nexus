import pytest

from collection.models import Collection
from collection.tests.factories import CollectionFactory
from drill.tests.factories import QuestionFactory
from node.tests.factories import NodeFactory
from tag.tests.factories import TagFactory


@pytest.fixture
def monkeypatch_collection(monkeypatch):
    """
    Prevent the collection object from interacting with AWS
    """

    def mock(*args, **kwargs):
        pass

    monkeypatch.setattr(Collection, "create_collection_thumbnail", mock)


@pytest.fixture()
def collection(monkeypatch_collection, blob_image_factory, blob_pdf_factory):

    collection_0 = CollectionFactory(is_favorite=True)

    tag_1 = TagFactory(name="linux")
    tag_2 = TagFactory(name="django")
    collection_0.tags.add(tag_1, tag_2)

    collection_0.add_object(blob_image_factory[0])
    collection_0.add_object(blob_pdf_factory[0])

    collection_1 = CollectionFactory(name="To Display", is_favorite=True)
    collection_1.add_object(blob_pdf_factory[0])

    yield [collection_0, collection_1]


@pytest.fixture()
def node(monkeypatch_collection, bookmark, blob_image_factory, blob_pdf_factory):

    node = NodeFactory()

    collection = node.add_collection()
    collection.add_object(bookmark[0])
    collection.add_object(bookmark[1])
    collection.add_object(blob_image_factory[0])
    collection.add_object(blob_pdf_factory[0])

    yield node


@pytest.fixture()
def question(tag, bookmark):

    question_0 = QuestionFactory()
    question_1 = QuestionFactory()
    question_2 = QuestionFactory(is_favorite=True)
    question_3 = QuestionFactory(is_favorite=True)

    question_0.tags.add(tag[0])
    question_0.tags.add(tag[1])
    question_0.save()

    # Now that the tags have been added, update Elasticsearch
    question_0.index_question()

    question_0.add_related_object(bookmark[0].uuid)
    question_0.add_related_object(bookmark[1].uuid)

    yield [question_0, question_1, question_2, question_3]
