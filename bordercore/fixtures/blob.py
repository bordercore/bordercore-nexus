import hashlib
from io import BytesIO

import pytest
from faker import Factory as FakerFactory

from blob.models import MetaData
from blob.tests.factories import BlobFactory

try:
    import fitz
except (ModuleNotFoundError, NameError):
    pass

faker = FakerFactory.create()


def _create_blob(file_contents=None, **file_info):

    blob = BlobFactory.create(
        metadata=3,
        tags=("django", "linux", "video"),
    )

    MetaData.objects.create(
        user=blob.user,
        blob=blob,
        name="Author",
        value=faker.text(max_nb_chars=40),
    )
    # BlobFactory.metadata post_generation already creates a "Url"
    # MetaData unconditionally, so use update_or_create to avoid
    # violating the unique_metadata_name_value_blob constraint if
    # faker generates the same URL string.
    MetaData.objects.update_or_create(
        blob=blob,
        name="Url",
        defaults={"user": blob.user, "value": faker.url()},
    )

    if not file_contents:
        # If we weren't given the blob contents, generate some randomly.
        # Insure that the bytes are unique per blob, since we need each
        #  sha1sum to also be unique.
        file_contents = bytes(f"mybinarydata{blob.uuid}", "utf-8")

    blob_file = BytesIO(file_contents)
    blob_file.name = faker.file_name(**file_info)
    blob.file_modified = 1638644921
    blob.file.save(blob_file.name, blob_file)
    blob.sha1sum = hashlib.sha1(file_contents).hexdigest()
    blob.save()

    try:
        BlobFactory.index_blob(blob)
    except fitz.fitz.FileDataError:
        # Ignore any errors when attempting to process the bogus pdf
        pass

    return [blob]


@pytest.fixture
def monkeypatch_blob(monkeypatch):
    """
    Prevent the blob object from interacting with Elasticsearch by
    patching out various methods.
    """

    def mock(*args, **kwargs):
        pass

    from elasticsearch import Elasticsearch

    from blob.models import Blob

    monkeypatch.setattr(Elasticsearch, "delete", mock)
    monkeypatch.setattr(Blob, "get_elasticsearch_info", mock)
    monkeypatch.setattr(Blob, "index_blob", mock)


@pytest.fixture()
def blob_note(temp_blob_directory, db, s3_resource, s3_bucket):

    blob_1 = BlobFactory(
        is_note=True,
        metadata=3,
        tags=("django", "linux", "video"),
    )
    blob_2 = BlobFactory(
        is_note=True,
        metadata=3,
        tags=("django", "linux", "video"),
    )

    BlobFactory.index_blob(blob_1)
    BlobFactory.index_blob(blob_2)

    yield blob_1, blob_2


@pytest.fixture()
def blob_pdf_factory(temp_blob_directory, db, s3_resource, s3_bucket, _pdf_file_bytes):
    yield _create_blob(file_contents=_pdf_file_bytes, extension="pdf")


@pytest.fixture()
def blob_image_factory(temp_blob_directory, db, s3_resource, s3_bucket):
    yield _create_blob(file_contents=None, category="image")


@pytest.fixture()
def blob_text_factory(db, s3_resource, s3_bucket):

    blob_list = []

    for i in range(3):
        blob = BlobFactory.create(
            tags=("django", "linux"),
        )

        MetaData.objects.create(
            user=blob.user,
            blob=blob,
            name="Author",
            value=faker.text(max_nb_chars=40),
        )
        # BlobFactory.metadata post_generation already creates a "Url"
        # MetaData unconditionally, so use update_or_create to avoid
        # violating the unique_metadata_name_value_blob constraint if
        # faker generates the same URL string.
        MetaData.objects.update_or_create(
            blob=blob,
            name="Url",
            defaults={"user": blob.user, "value": faker.url()},
        )

        BlobFactory.index_blob(blob)

        blob_list.append(blob)

    yield blob_list
