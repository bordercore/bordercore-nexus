# Re-index all bookmarks or todo tasks in Elasticsearch
from argparse import ArgumentParser
from typing import Any, Generator, TypeVar

from elasticsearch import helpers

from django.conf import settings
from django.core.management.base import BaseCommand
from django.db.transaction import atomic

from lib.util import get_elasticsearch_connection

from todo.models import Todo  # isort:skip
from bookmark.models import Bookmark  # isort:skip
from music.models import Album, Song  # isort:skip
from drill.models import Question  # isort:skip
from collection.models import Collection  # isort:skip

es: Any = get_elasticsearch_connection(host=settings.ELASTICSEARCH_ENDPOINT)

BATCH_SIZE = 10

T = TypeVar("T")


def chunker(seq: list[T], size: int) -> Generator[list[T], None, None]:
    return (seq[pos:pos + size] for pos in range(0, len(seq), size))


class Command(BaseCommand):
    help = "Re-index all albums, bookmarks, songs, drill questions, collections, or todo tasks in Elasticsearch"

    def add_arguments(self, parser: ArgumentParser) -> None:
        parser.add_argument(
            "--model",
            choices=["album", "bookmark", "collection", "drill", "song", "todo"],
            help="The model to index: 'album', 'bookmark', 'collection', 'drill', 'song', or 'todo'",
            required=True
        )

    @atomic
    def handle(self, *args: Any, model: str, **kwargs: Any) -> None:

        if model == "album":
            self.index_albums_all()
        if model == "bookmark":
            self.index_bookmarks_all()
        elif model == "collection":
            self.index_collection_all()
        elif model == "drill":
            self.index_drill_all()
        elif model == "song":
            self.index_song_all()
        elif model == "todo":
            self.index_todo_all()

    def index_albums_all(self) -> None:

        for group in chunker(list(Album.objects.all()), BATCH_SIZE):
            count, errors = helpers.bulk(es, [x.elasticsearch_document for x in group])
            self.stdout.write(f"Albums added: {count}")

            if errors:
                raise IOError(f"Error indexing albums: {errors}")

    def index_bookmarks_all(self) -> None:

        es: Any = get_elasticsearch_connection(host=settings.ELASTICSEARCH_ENDPOINT)

        for group in chunker(list(Bookmark.objects.all()), BATCH_SIZE):
            count, errors = helpers.bulk(es, [x.elasticsearch_document for x in group])
            self.stdout.write(f"Bookmarks added: {count}")

            if errors:
                raise IOError(f"Error indexing bookmarks: {errors}")

    def index_drill_all(self) -> None:

        es: Any = get_elasticsearch_connection(host=settings.ELASTICSEARCH_ENDPOINT)

        for group in chunker(list(Question.objects.all()), BATCH_SIZE):
            count, errors = helpers.bulk(es, [x.elasticsearch_document for x in group])
            self.stdout.write(f"Drill questions added: {count}")

    def index_song_all(self) -> None:

        es: Any = get_elasticsearch_connection(host=settings.ELASTICSEARCH_ENDPOINT)

        for group in chunker(list(Song.objects.all()), BATCH_SIZE):
            count, errors = helpers.bulk(es, [x.elasticsearch_document for x in group])
            self.stdout.write(f"Songs added: {count}")

            if errors:
                raise IOError(f"Error indexing songs: {errors}")

    def index_todo_all(self) -> None:

        es: Any = get_elasticsearch_connection(host=settings.ELASTICSEARCH_ENDPOINT)

        for group in chunker(list(Todo.objects.all()), BATCH_SIZE):
            count, errors = helpers.bulk(es, [x.elasticsearch_document for x in group])
            self.stdout.write(f"Todos added: {count}")

            if errors:
                raise IOError(f"Error indexing todos: {errors}")

    def index_collection_all(self) -> None:

        es: Any = get_elasticsearch_connection(host=settings.ELASTICSEARCH_ENDPOINT)

        for group in chunker(list(Collection.objects.all()), BATCH_SIZE):
            count, errors = helpers.bulk(es, [x.elasticsearch_document for x in group])
            self.stdout.write(f"Collections added: {count}")

            if errors:
                raise IOError(f"Error indexing collections: {errors}")
