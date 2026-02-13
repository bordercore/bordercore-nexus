"""Django admin configuration for the Quote app."""

from django.contrib import admin

from quote.models import Quote

admin.site.register(Quote)
