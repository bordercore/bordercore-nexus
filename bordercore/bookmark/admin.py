"""Django admin configuration for the bookmark app.

This module registers the Bookmark model with Django's admin interface,
allowing administrators to manage bookmarks through the admin panel.
"""

from django.contrib import admin

from bookmark.models import Bookmark

admin.site.register(Bookmark)
