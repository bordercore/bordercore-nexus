import logging
import os
import tempfile
from unittest.mock import MagicMock

import boto3
import botocore
import pytest
from faker import Factory as FakerFactory
from faker_file.providers.pdf_file import PdfFileProvider
from faker_file.providers.pdf_file.generators.reportlab_generator import \
    ReportlabPdfGenerator

import django
from django.conf import settings

django.setup()

try:
    from moto import mock_aws
except ModuleNotFoundError:
    # Don't worry if this import doesn't exist in production
    pass

# Suppress noisy AWS SDK credential-resolution logs while keeping application logs intact
logging.getLogger("botocore").setLevel(logging.WARNING)
logging.getLogger("boto3").setLevel(logging.WARNING)

from django.contrib.auth.models import Group

from accounts.models import DrillTag, UserNote
from accounts.tests.factories import TEST_PASSWORD, UserFactory
from tag.models import Tag

# Load fixture modules so all tests can use them without per-app conftest imports
pytest_plugins = [
    "fixtures.blob",
    "fixtures.bookmark",
    "fixtures.music",
    "fixtures.node",
    "fixtures.functional",
    "fixtures.feed",
    "fixtures.habit",
    "fixtures.todo",
    "fixtures.sort_order",
]

# Speed up tests by replacing Django's default PBKDF2 password hashing (very slow)
# with the MD5 hasher. Factories and client.login call set_password, so using the
# fast hasher removes thousands of PBKDF2 iterations per test and keeps profiles
# free of _hashlib.pbkdf2_hmac hotspots.
@pytest.fixture(autouse=True, scope="session")
def fast_password_hashers():
    settings.PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]

# Add an extra Elasticsearch field to indicate test data
settings.ELASTICSEARCH_EXTRA_FIELDS["__test__"] = 1

# Use a dummy cache for testing
settings.CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.dummy.DummyCache"
    }
}

# Disable the Debug Toolbar and thereby prevent it
#  from interfering with functional and views tests
os.environ["DISABLE_DEBUG_TOOLBAR"] = "1"

faker = FakerFactory.create()
faker.add_provider(PdfFileProvider)


@pytest.fixture(autouse=True)
def mock_elasticsearch(request, monkeypatch):
    """Mock all Elasticsearch interactions for every test.

    Patches the ES connection, search service indexing/deletion,
    blob factory indexing, and get_recent_blobs in one place.

    Does not apply to tests marked data_quality; those use a real
    Elasticsearch connection.
    """
    if request.node.get_closest_marker("data_quality") is not None:
        yield
        return
    mock_client = MagicMock()
    mock_client.search.return_value = {
        "hits": {"hits": [], "total": {"value": 0}}
    }
    monkeypatch.setattr("lib.util._get_elasticsearch_connection", lambda *a, **kw: mock_client)
    monkeypatch.setattr("search.services._index_document", lambda *a, **kw: None)
    monkeypatch.setattr("search.services._delete_document", lambda *a, **kw: None)
    monkeypatch.setattr("blob.tests.factories.index_blob", lambda *a, **kw: None)
    monkeypatch.setattr("blob.services.get_recent_blobs", lambda *a, **kw: ([], {}))

    yield mock_client


@pytest.fixture(scope="session")
def temp_blob_directory():
    """
    Create the temporary directory needed by the Elasticsearch indexer.
    Session-scoped: only one temp dir for the entire test run.
    """
    temp_dir = tempfile.TemporaryDirectory()
    os.environ["EFS_DIR"] = temp_dir.name

    yield

    # Note: The temp directory is automatically removed once the test has finished


@pytest.fixture(scope="session")
def aws_credentials():
    """Mocked AWS Credentials for moto."""
    os.environ["AWS_ACCESS_KEY_ID"] = "testing"
    os.environ["AWS_SECRET_ACCESS_KEY"] = "testing"
    os.environ["AWS_SECURITY_TOKEN"] = "testing"
    os.environ["AWS_SESSION_TOKEN"] = "testing"


@pytest.fixture
def authenticated_client(client, _seed_data):
    """Logged-in Django test client factory. No blobs."""

    def make_auto_login(user=None):
        if user is None:
            user = _seed_data["user"]
        client.login(username=user.username, password=TEST_PASSWORD)
        return user, client

    return make_auto_login


@pytest.fixture
def auto_login_user(authenticated_client, _seed_data, blob_text_factory):
    """Logged-in client with 3 pre-created blobs and a UserNote."""

    def make_auto_login(user=None):
        if user is None:
            UserNote.objects.get_or_create(
                userprofile=_seed_data["user"].userprofile,
                blob=blob_text_factory[0],
            )
        return authenticated_client(user)

    return make_auto_login


@pytest.fixture(scope="session")
def _pdf_file_bytes():
    """Generate PDF bytes once per session — ReportLab is expensive."""
    file = faker.pdf_file(pdf_generator_cls=ReportlabPdfGenerator)
    with open(file.data["filename"], "rb") as fh:
        return fh.read()


@pytest.fixture()
def _seed_data(fast_password_hashers, django_db_setup, django_db_blocker):
    """Create the user and tag graph for each test.

    Function-scoped because live_server tests flush all tables after each
    test (TransactionTestCase semantics), destroying session-scoped data.
    """
    with django_db_blocker.unblock():
        user = UserFactory()
        admin_group, _ = Group.objects.get_or_create(name="Admin")
        admin_group.user_set.add(user)

        tag_0, _ = Tag.objects.get_or_create(name="django", user=user)
        tag_1, _ = Tag.objects.get_or_create(name="video", user=user, defaults={"is_meta": True})
        tag_2, _ = Tag.objects.get_or_create(name="linux", user=user)

        DrillTag.objects.get_or_create(userprofile=user.userprofile, tag=tag_0)
        DrillTag.objects.get_or_create(userprofile=user.userprofile, tag=tag_1)

    return {
        "tags": [tag_0, tag_1, tag_2],
        "user": user,
    }


@pytest.fixture(scope="session")
def s3_resource(aws_credentials):
    """Mocked S3 Fixture. Session-scoped: moto context stays open for the entire run."""

    with mock_aws():
        yield boto3.resource(service_name="s3")


@pytest.fixture(scope="session")
def s3_bucket(s3_resource):

    # Verify that the S3 mock is working
    try:
        s3_resource.meta.client.head_bucket(Bucket=settings.AWS_STORAGE_BUCKET_NAME)
    except botocore.exceptions.ClientError:
        pass
    else:
        err = f"Bucket {settings.AWS_STORAGE_BUCKET_NAME} should not exist."
        raise EnvironmentError(err)

    s3_resource.create_bucket(Bucket=settings.AWS_STORAGE_BUCKET_NAME)

    # Verify that the S3 mock is working
    try:
        s3_resource.meta.client.head_bucket(Bucket=settings.AWS_BUCKET_NAME_MUSIC)
    except botocore.exceptions.ClientError:
        pass
    else:
        err = f"Bucket {settings.AWS_BUCKET_NAME_MUSIC} should not exist."
        raise EnvironmentError(err)

    s3_resource.create_bucket(Bucket=settings.AWS_BUCKET_NAME_MUSIC)


@pytest.fixture()
def tag(_seed_data):
    yield _seed_data["tags"]
