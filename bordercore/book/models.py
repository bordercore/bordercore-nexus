"""
Models for the book app.

This module defines the Author and Book models. A book tracks
bibliographic metadata (title, subtitle, ISBN, ASIN, publisher, year),
optional notes, and ownership status, with a many-to-many relationship
to authors.
"""

from django.contrib.auth.models import User
from django.db import models

from lib.mixins import TimeStampedModel


class Author(TimeStampedModel):
    """An author of one or more books.

    Stores the author's name and is linked to books via a many-to-many
    relationship on the Book model.
    """

    name = models.TextField()

    def __str__(self) -> str:
        return self.name


class Book(TimeStampedModel):
    """A book in the user's collection, with metadata and ownership tracking.

    A book has a title, one or more authors, and optional bibliographic fields
    such as subtitle, ISBN, ASIN, publisher, and year. The `own` flag indicates
    whether the user owns a copy, and `notes` holds free-form annotations.
    """

    title = models.TextField()
    author = models.ManyToManyField(Author)
    subtitle = models.TextField(blank=True, default="")
    isbn = models.TextField(blank=True, default="")
    asin = models.TextField(blank=True, default="")
    year = models.IntegerField(null=True)
    publisher = models.TextField(blank=True, default="")
    notes = models.TextField(blank=True, default="")
    own = models.BooleanField(default=True)
    user = models.ForeignKey(User, on_delete=models.PROTECT)

    def __str__(self) -> str:
        return self.title
