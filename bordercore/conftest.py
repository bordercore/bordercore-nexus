import datetime
import getpass
import hashlib
import os
import random
import tempfile
from collections.abc import Generator
from datetime import timedelta
from io import BytesIO
from pathlib import Path
from unittest.mock import MagicMock, patch

import boto3
import botocore
import pytest
from _pytest.config import Config
from faker import Factory as FakerFactory
from faker_file.providers.pdf_file import PdfFileProvider
from faker_file.providers.pdf_file.generators.reportlab_generator import \
    ReportlabPdfGenerator
from PIL import Image

import django
from django.conf import settings
from django.utils import timezone

try:
    import fitz
    from pyvirtualdisplay import Display
    from selenium import webdriver
    from selenium.webdriver.firefox.service import Service

    from homepage.tests.pages.homepage import LoginPage
except (ModuleNotFoundError, NameError, django.core.exceptions.AppRegistryNotReady):
    # Don't worry if these imports don't exist in production
    pass

django.setup()

from accounts.models import UserTag, UserNote, UserFeed, DrillTag  # isort:skip
from accounts.tests.factories import TEST_PASSWORD, UserFactory  # isort:skip
from blob.models import MetaData  # isort:skip
from blob.tests.factories import BlobFactory  # isort:skip
from bookmark.models import Bookmark  # isort:skip
from bookmark.tests.factories import BookmarkFactory  # isort:skip
from collection.tests.factories import CollectionFactory  # isort:skip
from collection.models import Collection  # isort:skip
from django.contrib.auth.models import Group  # isort:skip
from drill.tests.factories import QuestionFactory  # isort:skip
from fitness.models import Exercise, ExerciseUser, Muscle, MuscleGroup, Data, Workout  # isort:skip
from feed.tests.factories import FeedFactory  # isort:skip
from metrics.models import Metric, MetricData  # isort:skip
from music.models import Listen, SongSource, PlaylistItem  # isort:skip
from music.tests.factories import SongFactory, AlbumFactory, PlaylistFactory  # isort:skip
from node.tests.factories import NodeFactory  # isort:skip
from quote.tests.factories import QuoteFactory  # isort:skip
from tag.tests.factories import TagFactory  # isort:skip
from todo.tests.factories import TodoFactory  # isort:skip

try:
    from moto import mock_aws
except ModuleNotFoundError:
    # Don't worry if this import doesn't exist in production
    pass

# Add an extra Elasticsearch field to indicate test data
settings.ELASTICSEARCH_EXTRA_FIELDS["__test__"] = 1

# Use a dummy cache for testing
settings.CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.dummy.DummyCache"
    }
}

GECKO_DRIVER_LOGFILE = f"/tmp/geckodriver-{getpass.getuser()}.log"

# Disable the Debug Toolbar and thereby prevent it
#  from interfering with functional and views tests
os.environ["DISABLE_DEBUG_TOOLBAR"] = "1"

faker = FakerFactory.create()
faker.add_provider(PdfFileProvider)


def pytest_configure(config: Config) -> None:
    """Configure pytest to disable django-webpack-loader during tests.

    This hook runs once when pytest starts. It replaces the default
    WebpackLoader with the ``FakeWebpackLoader`` so that Django templates
    can render without requiring a real ``webpack-stats.json`` file.
    This prevents errors in CI environments or containers where webpack
    has not been run.

    Args:
        config: The pytest configuration object provided by pytest.
            It is not used directly here but is required by the hook
            signature.
    """
    settings.WEBPACK_LOADER["DEFAULT"]["LOADER_CLASS"] = "webpack_loader.loaders.FakeWebpackLoader"


BLOCKED_CONTEXT_PROCESSORS = {
    "context_processors.get_recent_objects"
}


@pytest.fixture(autouse=True)
def no_es_context_processors() -> None:
    """Remove context processors that hit Elasticsearch for every test.

    This fixture filters out any blocked context processors from all configured
    Django template backends.

    Args:
        settings: The pytest-django settings fixture.
    """
    for tmpl in settings.TEMPLATES:
        opts = tmpl.setdefault("OPTIONS", {})
        cps = opts.setdefault("context_processors", [])
        # Reassign (don’t mutate in-place with remove)
        opts["context_processors"] = [
            cp for cp in cps if cp not in BLOCKED_CONTEXT_PROCESSORS
        ]


@pytest.fixture(autouse=True)
def mock_elasticsearch_service() -> Generator[dict[str, MagicMock], None, None]:
    """Auto-mocked Elasticsearch service functions for all tests.

    This pytest fixture automatically patches out the Elasticsearch service
    layer functions `index_document` and `delete_document` for the duration
    of each test. This prevents real Elasticsearch interactions during tests
    and allows assertions on calls if needed.

    Yields:
        dict: A dictionary containing the mocked functions:
            - "index_document" (MagicMock): Mock of the index_document function.
            - "delete_document" (MagicMock): Mock of the delete_document function.
    """
    with patch("search.services._index_document"), \
         patch("search.services._delete_document"), \
         patch("blob.tests.factories.index_blob"):
        yield


@pytest.fixture(autouse=True)
def mock_es_client():
    """
    Automatically mock the Elasticsearch client if the MOCK_ELASTICSEARCH environment variable is set.

    This fixture patches the `get_elasticsearch_connection` function in the
    `lib.util` module, replacing it with a `MagicMock` instance. The mock client
    is yielded for use in tests, allowing you to configure return values as needed.

    If the environment variable `MOCK_ELASTICSEARCH` is not set to "1",
    the fixture yields without patching, and no mocking is applied.

    Yields:
        MagicMock: A mock Elasticsearch client, or `None` if mocking is disabled.
    """
    if os.getenv("MOCK_ELASTICSEARCH") != "1":
        yield  # No-op if env var isn't set
        return

    with patch("lib.util._get_elasticsearch_connection") as mock_get_es:
        mock_client = MagicMock()
        mock_get_es.return_value = mock_client
        yield mock_client


@pytest.fixture()
def temp_blob_directory():
    """
    Create the temporary directory needed by the Elasticsearch indexer
    """
    temp_dir = tempfile.TemporaryDirectory()
    os.environ["EFS_DIR"] = temp_dir.name

    yield

    # Note: The temp directory is automatically removed once the test has finished


@pytest.fixture()
def aws_credentials():
    """Mocked AWS Credentials for moto."""
    os.environ["AWS_ACCESS_KEY_ID"] = "testing"
    os.environ["AWS_SECRET_ACCESS_KEY"] = "testing"
    os.environ["AWS_SECURITY_TOKEN"] = "testing"
    os.environ["AWS_SESSION_TOKEN"] = "testing"


@pytest.fixture
def auto_login_user(client, blob_text_factory, tag):

    def make_auto_login(user=None):

        if user is None:
            user = UserFactory()
            UserNote.objects.get_or_create(userprofile=user.userprofile, note=blob_text_factory[0])

            # Make the user an admin
            admin_group, _ = Group.objects.get_or_create(name="Admin")
            admin_group.user_set.add(user)

            DrillTag.objects.get_or_create(userprofile=user.userprofile, tag=tag[0])
            DrillTag.objects.get_or_create(userprofile=user.userprofile, tag=tag[1])

        client.login(username=user.username, password=TEST_PASSWORD)
        return user, client

    return make_auto_login


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


@pytest.fixture
def monkeypatch_collection(monkeypatch):
    """
    Prevent the collection object from interacting with AWS
    """

    def mock(*args, **kwargs):
        pass

    monkeypatch.setattr(Collection, "create_collection_thumbnail", mock)


@pytest.fixture
def monkeypatch_bookmark(monkeypatch):
    """
    Prevent the bookmark objects from interacting with external services
    AWS and Elasticsearch
    """

    def mock(*args, **kwargs):
        pass

    monkeypatch.setattr(Bookmark, "generate_cover_image", mock)
    monkeypatch.setattr(Bookmark, "snarf_favicon", mock)
    monkeypatch.setattr(Bookmark, "delete", mock)


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
def blob_pdf_factory(temp_blob_directory, db, s3_resource, s3_bucket):

    file = faker.pdf_file(pdf_generator_cls=ReportlabPdfGenerator)

    with open(file.data["filename"], "rb") as fh:
        file_contents = fh.read()

    yield _create_blob(file_contents=file_contents, extension="pdf")


@pytest.fixture()
def blob_image_factory(temp_blob_directory, db, s3_resource, s3_bucket):
    yield _create_blob(file_contents=None, category="image")


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

        BlobFactory.index_blob(blob)

        blob_list.append(blob)

    yield blob_list


@pytest.fixture()
def bookmark(tag, monkeypatch_bookmark):

    bookmark_1 = BookmarkFactory(daily={"viewed": "false"})
    bookmark_2 = BookmarkFactory()
    bookmark_3 = BookmarkFactory(is_pinned=True)
    bookmark_4 = BookmarkFactory()
    bookmark_5 = BookmarkFactory()

    bookmark_3.tags.add(tag[0])
    bookmark_2.tags.add(tag[0])
    bookmark_1.tags.add(tag[0])
    bookmark_1.tags.add(tag[1])

    yield [bookmark_1, bookmark_2, bookmark_3, bookmark_4, bookmark_5]


@pytest.fixture(scope="session")
def browser():

    if not os.environ.get("DISABLE_HEADLESS_DISPLAY", None):
        # Set screen resolution to 1366 x 768 like most 15" laptops
        display = Display(visible=0, size=(1366, 768))
        display.start()

    service = Service(executable_path="/snap/bin/geckodriver", log_path=GECKO_DRIVER_LOGFILE)
    driver = webdriver.Firefox(service=service)

    yield driver

    if not os.environ.get("DISABLE_HEADLESS_DISPLAY", None):
        # Quit the Xvfb display
        display.stop()

    driver.quit()


@pytest.fixture()
def login(auto_login_user, live_server, browser, settings, request):

    settings.DEBUG = True
    os.environ["DISABLE_DEBUG_TOOLBAR"] = "1"

    auto_login_user()

    page = LoginPage(browser)
    page.load(live_server, request.param)
    page.login()


@pytest.fixture()
def feed(auto_login_user):

    user, _ = auto_login_user()

    feed_0 = FeedFactory(name="Hacker News")
    feed_1 = FeedFactory()
    feed_2 = FeedFactory()

    so = UserFeed(userprofile=user.userprofile, feed=feed_0)
    so.save()
    so = UserFeed(userprofile=user.userprofile, feed=feed_1)
    so.save()
    so = UserFeed(userprofile=user.userprofile, feed=feed_2)
    so.save()

    yield [feed_0, feed_1, feed_2]


@pytest.fixture
def fitness(auto_login_user):

    user, _ = auto_login_user()

    muscle_group = MuscleGroup.objects.create(name="Chest")
    muscle = Muscle.objects.create(name="Pectoralis Major", muscle_group=muscle_group)
    note = "### Trying to make some **gains**"
    exercise_0 = Exercise.objects.create(name="Bench Press", note=note)
    exercise_0.muscle.add(muscle)
    ExerciseUser.objects.create(
        user=user,
        exercise=exercise_0,
        started=datetime.datetime.now(),
        schedule=[True, False, False, False, False, False, False]
    )

    # Generate a bunch of workouts for one exercise, helpful for
    #  testing pagination
    for i in range(10):
        workout = Workout.objects.create(user=user, exercise=exercise_0)
        Data.objects.create(workout=workout, weight=random.randint(200, 220), reps=random.randint(7, 12))
        Data.objects.create(workout=workout, weight=random.randint(200, 220), reps=random.randint(7, 12))
        Data.objects.create(workout=workout, weight=random.randint(200, 220), reps=random.randint(7, 12))
        Data.objects.create(workout=workout, weight=random.randint(200, 220), reps=random.randint(7, 12))

    workout = Workout.objects.create(user=user, exercise=exercise_0)
    Data.objects.create(workout=workout, weight=200, reps=8)
    Data.objects.create(workout=workout, weight=205, reps=8)
    Data.objects.create(workout=workout, weight=210, reps=8)
    Data.objects.create(workout=workout, weight=220, reps=8)

    muscle_group = MuscleGroup.objects.create(name="Back")
    muscle = Muscle.objects.create(name="Latissimus Dorsi", muscle_group=muscle_group)
    exercise_1 = Exercise.objects.create(name="Pull Ups")
    exercise_1.muscle.add(muscle)
    workout = Workout.objects.create(user=user, exercise=exercise_1)
    Data.objects.create(workout=workout, duration=0, weight=0, reps=12)
    Data.objects.create(workout=workout, duration=0, weight=0, reps=11)
    Data.objects.create(workout=workout, duration=0, weight=0, reps=8)

    muscle_group = MuscleGroup.objects.create(name="Legs")
    muscle = Muscle.objects.create(name="Glutes", muscle_group=muscle_group)
    exercise_2 = Exercise.objects.create(name="Squats")
    exercise_2.muscle.add(muscle)

    ExerciseUser.objects.create(
        user=user,
        exercise=exercise_2,
        schedule=[True, False, False, False, False, False, False]
    )
    workout = Workout.objects.create(user=user, exercise=exercise_2)

    # Force this exercise to be overdue
    data = Data.objects.create(workout=workout, weight=200, reps=8)
    data.date = data.date - timedelta(days=10)
    data.save()

    # Force this exercise to be overdue
    data = Data.objects.create(workout=workout, weight=205, reps=8)
    data.date = data.date - timedelta(days=10)
    data.save()

    # Add a related exercise to exercise_0
    exercise_3 = Exercise.objects.create(name="Push Ups", note=note)
    muscle = Muscle.objects.get(name="Pectoralis Major")
    exercise_3.muscle.add(muscle)

    # Add an exercise with a duration
    muscle_group = MuscleGroup.objects.get(name="Back")
    muscle = Muscle.objects.get(name="Latissimus Dorsi", muscle_group=muscle_group)
    exercise_4 = Exercise.objects.create(name="Dead Hang")
    exercise_4.muscle.add(muscle)
    for i in range(10):
        workout = Workout.objects.create(user=user, exercise=exercise_4)
        Data.objects.create(workout=workout, duration=random.randint(90, 120), weight=0, reps=random.randint(1, 2))
        Data.objects.create(workout=workout, duration=random.randint(90, 120), weight=0, reps=random.randint(1, 2))
        Data.objects.create(workout=workout, duration=random.randint(90, 120), weight=0, reps=random.randint(1, 2))
        Data.objects.create(workout=workout, duration=random.randint(90, 120), weight=0, reps=random.randint(1, 2))

    yield [exercise_0, exercise_1, exercise_2, exercise_3, exercise_4]


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
def metrics(auto_login_user):

    user, _ = auto_login_user()

    m_0 = Metric.objects.create(name="Bordercore Unit Tests", user=user)
    m_1 = Metric.objects.create(name="Bordercore Functional Tests", user=user)
    m_2 = Metric.objects.create(name="Bordercore Test Coverage", user=user)

    md = MetricData.objects.create(
        metric=m_0,
        value={
            "test_failures": 2,
            "test_errors": 1,
            "test_skipped": 0,
            "test_count": 10,
            "test_time_elapsed": "03:18",
            "test_output": ""
        }
    )

    md = MetricData.objects.create(
        metric=m_1,
        value={
            "test_failures": 0,
            "test_errors": 1,
            "test_skipped": 0,
            "test_count": 20,
            "test_time_elapsed": "01:53",
            "test_output": ""
        }
    )
    # Overdue metrics
    md.created = timezone.now() - timedelta(days=3)
    md.save()

    # Test coverage metrics
    md = MetricData.objects.create(
        metric=m_2,
        value={
            "line_rate": 0.82
        }
    )

    yield [m_0, m_1, m_2]


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


@pytest.fixture()
def quote():

    quote = QuoteFactory()
    yield quote


@pytest.fixture()
def s3_resource(aws_credentials):
    """Mocked S3 Fixture."""

    with mock_aws():
        yield boto3.resource(service_name="s3")


@pytest.fixture()
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
def song_source(auto_login_user):

    song_source, _ = SongSource.objects.get_or_create(name=SongSource.DEFAULT)
    return song_source


@pytest.fixture()
def song(song_source, tag):

    album = AlbumFactory()

    song_0 = SongFactory()
    song_0.tags.add(tag[0])
    song_1 = SongFactory(album=album)
    song_2 = SongFactory()

    listen = Listen(user=song_2.user, song=song_2)
    listen.save()

    yield [song_0, song_1, song_2]


@pytest.fixture()
def playlist(auto_login_user, song, tag):

    user, _ = auto_login_user()

    # Create a "manual" playlist
    playlist_0 = PlaylistFactory(user=user)
    playlistitem = PlaylistItem(playlist=playlist_0, song=song[0])
    playlistitem.save()
    playlistitem = PlaylistItem(playlist=playlist_0, song=song[1])
    playlistitem.save()

    # Create a "smart" playlist
    playlist_1 = PlaylistFactory(user=user, type="tag")
    playlist_1.parameters = {"tag": tag[0].name}
    playlist_1.save()

    yield [playlist_0, playlist_1]


@pytest.fixture()
def sort_order_user_tag(auto_login_user, tag):

    user, _ = auto_login_user()

    sort_order = UserTag(userprofile=user.userprofile, tag=tag[0])
    sort_order.save()
    sort_order = UserTag(userprofile=user.userprofile, tag=tag[1])
    sort_order.save()
    sort_order = UserTag(userprofile=user.userprofile, tag=tag[2])
    sort_order.save()


@pytest.fixture()
def tag():

    TagFactory.reset_sequence(0)

    tag_0 = TagFactory(name="django")
    tag_1 = TagFactory(name="video", is_meta=True)
    tag_2 = TagFactory(name="linux")

    yield [tag_0, tag_1, tag_2]


@pytest.fixture()
def todo():

    TagFactory.reset_sequence(0)
    TodoFactory.reset_sequence(0)

    task_1 = TodoFactory(priority=1)
    task_2 = TodoFactory(priority=1)
    task_3 = TodoFactory()

    tag_1 = TagFactory()
    tag_2 = TagFactory()

    task_1.tags.add(tag_1)
    task_2.tags.add(tag_1)
    task_3.tags.add(tag_1)
    task_3.tags.add(tag_2)

    yield task_3


def handle_s3_info_image(s3_resource, s3_bucket, blob, file_path, cover_filename):

    filepath = Path(__file__).parent / file_path
    width, height = Image.open(filepath).size

    filepath_cover = Path(__file__).parent / f"blob/tests/resources/{cover_filename}"
    width_cover, height_cover = Image.open(filepath_cover).size

    key = blob.s3_key

    s3_object = s3_resource.Object(settings.AWS_STORAGE_BUCKET_NAME, key)
    s3_object.metadata.update({"image-width": str(width), "image-height": str(height)})
    s3_object.copy_from(CopySource={"Bucket": settings.AWS_STORAGE_BUCKET_NAME, "Key": key}, Metadata=s3_object.metadata, MetadataDirective="REPLACE")

    # "Upload" a cover for the image to S3
    s3_resource.meta.client.upload_file(
        str(filepath_cover),
        settings.AWS_STORAGE_BUCKET_NAME,
        f"{settings.MEDIA_ROOT}/{blob.uuid}/{cover_filename}",
        ExtraArgs={"Metadata": {"image-width": str(width_cover),
                                "image-height": str(height_cover),
                                "cover-image": "Yes"}}
    )


def handle_s3_info_pdf(s3_resource, s3_bucket, blob, file_path, cover_filename):

    filepath_cover = Path(__file__).parent / f"blob/tests/resources/{cover_filename}"
    width_cover, height_cover = Image.open(filepath_cover).size

    # "Upload" a cover for the image to S3
    s3_resource.meta.client.upload_file(
        str(filepath_cover),
        settings.AWS_STORAGE_BUCKET_NAME,
        f"{settings.MEDIA_ROOT}/{blob.uuid}/{cover_filename}",
        ExtraArgs={"Metadata": {"image-width": str(width_cover),
                                "image-height": str(height_cover),
                                "cover-image": "Yes"}}
    )
