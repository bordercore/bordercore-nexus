"""Django admin configuration for the Book app."""

from django.contrib import admin

from book.models import Author, Book


@admin.register(Author)
class AuthorAdmin(admin.ModelAdmin):
    """Admin configuration for the Author model."""

    list_display = ("name",)
    search_fields = ("name",)


@admin.register(Book)
class BookAdmin(admin.ModelAdmin):
    """Admin configuration for the Book model."""

    list_display = ("title", "user", "year", "own")
    list_filter = ("own", "user")
    search_fields = ("title",)
