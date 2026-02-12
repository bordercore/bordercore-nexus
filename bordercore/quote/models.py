"""
Models for the quote app.

This module defines the Quote model, which stores user-saved quotations
along with their source attribution. Quotes can be marked as favorites
for easy retrieval.
"""

import uuid

from django.contrib.auth.models import User
from django.db import models

from lib.mixins import TimeStampedModel


class Quote(TimeStampedModel):
    """A saved quotation with its source, optionally marked as a favorite.

    A quote stores the quoted text and its source attribution. It can be
    flagged as a favorite for filtering and quick access.
    """

    uuid = models.UUIDField(default=uuid.uuid4, editable=False)
    quote = models.TextField()
    source = models.TextField()
    is_favorite = models.BooleanField(default=False)
    user = models.ForeignKey(User, on_delete=models.PROTECT)

    def __str__(self) -> str:
        return self.quote[:100]
