"""Django admin configuration for the Tag app."""

from django.contrib import admin

from tag.models import Tag, TagAlias

admin.site.register(Tag)
admin.site.register(TagAlias)
