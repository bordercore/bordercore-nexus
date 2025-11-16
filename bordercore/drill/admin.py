"""Django admin configuration for the drill app.

This module registers the Question model with Django's admin interface,
allowing administrators to manage drill questions through the admin panel.
"""

from django.contrib import admin

from drill.models import Question

admin.site.register(Question)
