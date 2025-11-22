"""Django forms for the collection application.

This module contains Django form classes for handling collection-related forms,
including validation and field configuration.
"""
from typing import Any, cast

from django.contrib.auth.models import User
from django.forms import ModelForm, Textarea, TextInput
from django.http import HttpRequest

from collection.models import Collection
from lib.fields import ModelCommaSeparatedChoiceField
from tag.models import Tag


class CollectionForm(ModelForm):
    """Form for creating and editing ``Collection`` instances.

    This form handles collection name, description, favorite status, and tag
    management. It includes custom handling for tag display and user-specific
    tag filtering.

    Attributes:
        request: The HTTP request object, used for user-specific tag filtering.
    """

    request: HttpRequest | None

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        """Initialize the CollectionForm instance.

        Sets up form fields with appropriate widgets and initial values.
        The request object is extracted from kwargs to enable user-specific
        tag filtering. If editing an existing collection, tags are populated
        from the instance.

        Args:
            *args: Variable length argument list passed to parent ModelForm.
            **kwargs: Arbitrary keyword arguments. May contain 'request' key
                which is extracted and stored as self.request.
        """
        # The request object is passed in from a view's get_form_kwargs() method
        self.request = kwargs.pop("request", None)

        super().__init__(*args, **kwargs)

        # If this form has a model attached, get the tags and display them separated by commas
        if self.instance.pk:
            self.initial["tags"] = self.instance.get_tags()

        user = cast(User, self.request.user)
        self.fields["tags"] = ModelCommaSeparatedChoiceField(
            request=self.request,
            required=False,
            queryset=Tag.objects.filter(user=user),
            to_field_name="name")

    class Meta:
        """Meta configuration for CollectionForm.

        Defines the model, fields, and widgets used by the form.
        """

        model = Collection
        fields = ("name", "description", "tags", "is_favorite")
        labels = {
            "is_favorite": "Is Favorite",
        }
        widgets = {
            "description": Textarea(attrs={"class": "form-control"}),
            "name": TextInput(attrs={"class": "form-control", "autocomplete": "off"})
        }
