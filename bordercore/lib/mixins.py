"""Mixins for Django models and views.

This module provides reusable mixin classes for common Django patterns:
- TimeStampedModel: Adds created and modified timestamp fields
- FormRequestMixin: Passes request object to forms
- SortOrderMixin: Manages sort order for model instances
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from django.apps import apps
from django.db import models, transaction
from django.db.models import F, QuerySet

if TYPE_CHECKING:
    from django.http import HttpRequest


class TimeStampedModel(models.Model):
    """Abstract base class model that provides created and modified timestamp fields.

    This mixin adds automatic timestamp tracking to any model that inherits from it.
    The created field is set when the object is first created, and the modified
    field is updated whenever the object is saved.

    Attributes:
        created: DateTimeField automatically set when the object is created.
        modified: DateTimeField automatically updated on each save.
    """

    created = models.DateTimeField(auto_now_add=True)
    modified = models.DateTimeField(auto_now=True)

    class Meta:
        get_latest_by = "modified"
        ordering = ("-modified", "-created",)
        abstract = True


class FormRequestMixin():
    """Mixin to pass the request object to a form.

    Use this mixin in class-based views to pass the request object to a form so
    that it has access to the request in the constructor and clean_* methods.
    This is useful when form validation or initialization depends on request
    data or the authenticated user.
    """

    request: HttpRequest

    def get_form_kwargs(self) -> dict[str, Any]:
        """Get keyword arguments for form instantiation.

        Adds the request object to the form kwargs so it's available in the
        form's constructor and validation methods.

        Returns:
            Dictionary of keyword arguments including the request object.
        """
        kwargs = super().get_form_kwargs()  # type: ignore[misc]
        kwargs["request"] = self.request
        return kwargs


class SortOrderMixin(models.Model):
    """Abstract model mixin for managing sort order of related objects.

    This mixin provides functionality to maintain a sort_order field for objects
    that belong to a parent object (e.g., nodes within a collection). It
    automatically adjusts sort orders when objects are created, deleted, or
    reordered.

    Subclasses must define a field_name class attribute that specifies the foreign
    key field name used to group objects for sorting (e.g., "node", "collection").
    The field_name must correspond to a valid ForeignKey field on the model, and
    that field must be set (not None) before calling save() or reorder().

    Attributes:
        sort_order: Integer field indicating the position in the sorted list.
        note: Optional text field for annotations.
        field_name: Class attribute (defined in subclasses) specifying the
            foreign key field name used for grouping. Must be a valid ForeignKey
            field name on the model.
    """

    sort_order = models.IntegerField(default=1)
    note = models.TextField(blank=True, null=True)
    field_name: str

    def handle_delete(self) -> None:
        """Handle sort order adjustment when this object is deleted.

        Decrements the sort_order of all objects with the same parent that have
        a sort_order greater than or equal to this object's sort_order. This
        maintains sequential ordering after deletion.

        The foreign key field specified by field_name must be set (not None) for
        this method to work correctly. This method is typically called from a
        Django pre_delete signal handler.
        """
        try:
            # ignore spurious nplusone warning about "Potential n+1 query detected"
            from nplusone.core import signals
            with signals.ignore(signals.lazy_load):
                filter_kwargs = {self.field_name: getattr(self, self.field_name)}
        except ModuleNotFoundError:
            # nplusone won't be installed in production
            filter_kwargs = {self.field_name: getattr(self, self.field_name)}

        self.get_queryset().filter(
            **filter_kwargs,
            sort_order__gte=self.sort_order
        ).update(
            sort_order=F("sort_order") - 1
        )

    def save(self, *args: Any, **kwargs: Any) -> None:
        """Save the object and adjust sort orders for new objects.

        For new objects (pk is None), increments the sort_order of all existing
        objects with the same parent to make room for the new object at the
        beginning of the list. The foreign key field specified by field_name must
        be set (not None) before calling this method.

        Args:
            *args: Variable length argument list passed to parent save method.
            **kwargs: Arbitrary keyword arguments passed to parent save method.
        """
        filter_kwargs = {self.field_name: getattr(self, self.field_name)}

        with transaction.atomic():
            # Only do this for new objects
            if self.pk is None:
                self.get_queryset().filter(
                    **filter_kwargs
                ).update(
                    sort_order=F("sort_order") + 1
                )

            super().save(*args, **kwargs)

    def reorder(self, new_order: int) -> None:
        """Change this object's sort order and adjust other objects accordingly.

        Moves this object to a new position in the sort order and adjusts all
        affected objects to maintain sequential ordering. If the new order is
        the same as the current order, no changes are made.

        The foreign key field specified by field_name must be set (not None) for
        this method to work correctly.

        Args:
            new_order: The new sort order position for this object. Should be a
                positive integer.
        """
        # Equivalent to, say, node=self.node
        filter_kwargs = {self.field_name: getattr(self, self.field_name)}

        if self.sort_order == new_order:
            return

        with transaction.atomic():
            if self.sort_order > int(new_order):
                self.get_queryset().filter(
                    **filter_kwargs,
                    sort_order__lt=self.sort_order,
                    sort_order__gte=new_order,
                ).exclude(
                    pk=self.pk
                ).update(
                    sort_order=F("sort_order") + 1,
                )
            else:
                self.get_queryset().filter(
                    **filter_kwargs,
                    sort_order__lte=new_order,
                    sort_order__gt=self.sort_order,
                ).exclude(
                    pk=self.pk,
                ).update(
                    sort_order=F("sort_order") - 1,
                )

            self.sort_order = new_order
            self.save()

    def get_queryset(self) -> QuerySet[models.Model]:
        """Get the queryset for this model class.

        Dynamically retrieves the model class and returns its default queryset.
        This is used internally to perform queries on objects of the same type
        and parent relationship.

        Returns:
            QuerySet of model instances matching this object's type.
        """
        model = apps.get_model(self._meta.app_label, type(self).__name__)
        return model.objects.get_queryset()

    class Meta:
        abstract = True
