"""Django admin configuration for the blob app.

This module registers the Blob, BlobTemplate, and MetaData models with Django's
admin interface, allowing administrators to manage blobs, blob templates, and
metadata through the admin panel.
"""

from django.contrib import admin

from blob.models import Blob, BlobTemplate, MetaData

admin.site.register(Blob)
admin.site.register(BlobTemplate)
admin.site.register(MetaData)
