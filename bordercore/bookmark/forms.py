"""Django forms for the bookmark application.

This module contains Django form classes for handling bookmark-related forms,
including validation and field configuration.
"""
from collections.abc import Mapping
from typing import Any

from django.forms import (CheckboxInput, JSONField, ModelForm, Textarea,
                          TextInput, URLInput, ValidationError)

from bookmark.models import Bookmark
from lib.fields import CheckboxIntegerField, ModelCommaSeparatedChoiceField
from tag.models import Tag


class DailyCheckboxInput(CheckboxInput):
    """Custom checkbox widget for the daily bookmark tracking field.

    This widget handles the special case where the daily field stores JSON data
    ({"viewed": "true"}) rather than a simple boolean. It ensures the widget
    renders without a value attribute and returns JavaScript boolean strings.
    """

    def format_value(self, value: Any) -> None:
        """Format the value for widget rendering.

        Ensures that the widget is never rendered with a "value" attribute.
        We only care about whether it's checked or not, not its value.

        Args:
            value: The field value (unused).
        """
        return

    def value_from_datadict(self, data: Mapping[str, Any], files: Any, name: str) -> str:
        """Extract the value from the form data dictionary.

        Returns JavaScript boolean strings rather than the default Python ones.
        This is needed to avoid an error when rendering the field value after
        a form submission that results in validation errors.

        The ToggleSwitch React component always sends a hidden input with
        name="daily", so we check the actual value rather than just the
        presence of the key.

        Args:
            data: The form data dictionary.
            files: The uploaded files dictionary (unused).
            name: The field name.

        Returns:
            "true" if the field value is "true", "false" otherwise.
        """
        return "true" if data.get("daily") == "true" else "false"


class BookmarkForm(ModelForm):
    """Form for creating and editing ``Bookmark`` instances.

    This form handles bookmark URL, name, notes, tags, importance flag, pinned
    status, and daily tracking. It includes custom validation for duplicate URLs
    and special handling for tag management and checkbox fields.

    Attributes:
        request: The HTTP request object, used for user-specific tag filtering.
    """

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        """Initialize the BookmarkForm instance.

        Sets up form fields with appropriate widgets and initial values.
        The request object is extracted from kwargs to enable user-specific
        tag filtering. Configures field requirements and labels, and sets
        initial values for existing bookmark instances.

        Args:
            *args: Variable length argument list passed to parent ModelForm.
            **kwargs: Arbitrary keyword arguments. May contain 'request' key
                which is extracted and stored as self.request.
        """
        # The request object is passed in from a view's get_form_kwargs() method
        self.request = kwargs.pop("request", None)

        super().__init__(*args, **kwargs)

        self.fields["note"].required = False
        self.fields["tags"].required = False
        self.fields["importance"].required = False
        self.fields["importance"].label = "Important"

        if self.instance.id:
            # If this form has a model attached, get the tags and display them separated by commas
            self.initial["tags"] = self.instance.get_tags()
            # If the 'daily' field is not null (ie contains JSON), set the field to True. Otherwise False.
            self.initial["daily"] = self.instance.daily is not None
            # If the "importance" field is > 1 set the field to True. Otherwise False.
            self.initial["importance"] = self.instance.importance > 1
        else:
            self.initial["daily"] = False
            self.initial["importance"] = False

        self.fields["tags"] = ModelCommaSeparatedChoiceField(
            request=self.request,
            required=False,
            queryset=Tag.objects.filter(user=self.request.user),
            to_field_name="name")

    def clean_url(self) -> str:
        """Validate the URL field.

        Ensures that the URL is not a duplicate for the current user. Excludes
        the current bookmark instance when checking for duplicates.

        Returns:
            The cleaned URL data if validation passes.

        Raises:
            ValidationError: If a bookmark with the same URL already exists
                for the current user.
        """
        data = self.cleaned_data["url"]
        # Verify that this url is not a dupe. Exclude current url when searching.
        found = Bookmark.objects.filter(
            user=self.request.user,
            url=data
        ).exclude(
            id=self.instance.id
        )
        if found:
            raise ValidationError("Error: this bookmark already exists")
        return data

    class Meta:
        """Meta configuration for BookmarkForm.

        Defines the model, fields, widgets, and field classes used by the form.
        """

        model = Bookmark
        fields = ("url", "name", "note", "tags", "importance", "is_pinned", "daily", "id")
        widgets = {
            "url": URLInput(attrs={"class": "form-control", "autocomplete": "off"}),
            "name": TextInput(attrs={"class": "form-control", "autocomplete": "off"}),
            "note": Textarea(attrs={"rows": 3, "class": "form-control"}),
            "daily": DailyCheckboxInput(),
        }
        field_classes = {
            "daily": JSONField,
            "importance": CheckboxIntegerField
        }
