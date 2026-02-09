"""Custom Django form fields.

This module contains custom Django form field classes for handling comma-separated
tag choices and checkbox-based integer fields.
"""
from __future__ import annotations

from typing import Any

from django.forms import IntegerField, ModelMultipleChoiceField, TextInput, ValidationError
from django.http import HttpRequest

from tag.models import Tag


# http://stackoverflow.com/questions/5608576/django-enter-a-list-of-values-form-error-when-rendering-a-manytomanyfield-as-a
class ModelCommaSeparatedChoiceField(ModelMultipleChoiceField):
    """Form field for comma-separated tag choices.

    This field allows users to enter multiple tag choices as a comma-separated
    string in a text input widget. Tags are automatically created if they don't
    exist for the current user.

    Attributes:
        request: The HTTP request object, used for user-specific tag creation.
    """

    widget = TextInput(attrs={"class": "form-control typeahead", "autocomplete": "off"})
    request: HttpRequest | None

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        """Initialize the ModelCommaSeparatedChoiceField instance.

        Sets up the form field with a custom widget and extracts the request
        object from kwargs. Allows a custom id attribute to be supplied for
        the form field.

        Args:
            *args: Variable length argument list passed to parent
                ModelMultipleChoiceField.
            **kwargs: Arbitrary keyword arguments. May contain 'id' key for
                custom field id, and 'request' key which is extracted and
                stored as self.request.
        """
        # Allow the user to supply a custom id attribute for the form field
        tag_id = kwargs.get("id", "")
        if tag_id:
            self.widget.attrs["id"] = tag_id
            # Remove this arg to avoid an "got an unexpected keyword argument" error
            kwargs.pop("id", None)

        self.request = kwargs.pop("request", None)

        super().__init__(*args, **kwargs)

    def clean(self, value: Any) -> Any:
        """Clean and validate the field value.

        Parses comma-separated tag names, strips whitespace, and creates any
        tags that don't exist for the current user. The ORM won't create tags
        automatically and will complain that the tag 'is not one of the
        available choices' if they don't exist, so they need to be explicitly
        created here.

        Args:
            value: The raw input value, typically a comma-separated string of
                tag names.

        Returns:
            The cleaned value after processing tags through the parent field's
            clean method.

        Raises:
            ValidationError: If request is not provided to the field instance.
        """
        if value is not None:
            value = [item for item in (s.strip() for s in value.split(",")) if item]  # remove padding
        # Check if any of these tags are new.  The ORM won't create them for us, and in
        # fact will complain that the tag 'is not one of the available choices.'
        # These need to be explicitly created.
            # Request is required for tag creation
            if self.request is None:
                raise ValidationError("Request must be provided to ModelCommaSeparatedChoiceField")
            for tag in value:
                newtag, created = Tag.objects.get_or_create(user=self.request.user, name=tag)
                if created:
                    newtag.save()
        return super().clean(value)


class CheckboxIntegerField(IntegerField):
    """Form field that converts checkbox values to integers.

    This custom field lets us use a checkbox on the form, which, if checked,
    results in an integer of 1 or 10, representing importance, stored in the
    database rather than the usual boolean value.
    """

    def to_python(self, value: Any) -> int:
        """Convert the checkbox value to an integer.

        Converts a boolean True value, or the strings "true" or "1", to 10
        (high importance) and any other value to 1 (low importance).

        Args:
            value: The raw input value, typically a boolean from a checkbox
                or a string from a hidden input.

        Returns:
            An integer value: 10 if value is True, "true", or "1", otherwise 1.
        """
        if value is True or value == "true" or value == "1":
            return 10
        return 1
