"""Forms for the accounts application.

This module contains Django form classes for handling user profile-related forms,
including validation and field configuration.
"""
from typing import Any

from django.forms import (ModelChoiceField, ModelForm, Select, Textarea,
                          TextInput)

from accounts.models import UserProfile
from collection.models import Collection
from lib.fields import ModelCommaSeparatedChoiceField
from tag.models import Tag


class UserProfileForm(ModelForm):
    """Form for creating and editing ``UserProfile`` instances.

    This form handles user profile settings including theme, background images,
    homepage collections, drill intervals, muted tags, and API credentials. It
    includes dynamic field configuration based on user's available collections.

    Attributes:
        request: The HTTP request object, used for user-specific data filtering.
    """

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        """Initialize the UserProfileForm instance.

        Sets up form fields with appropriate widgets and labels. The request
        object is extracted from kwargs to enable user-specific collection and
        tag filtering. Collection fields are dynamically added or removed based
        on whether the user has any collections.

        Args:
            *args: Variable length argument list passed to parent ModelForm.
            **kwargs: Arbitrary keyword arguments. May contain 'request' key
                which is extracted and stored as self.request.
        """

        # The request object is passed in from UserProfileUpdateView.get_form_kwargs()
        self.request = kwargs.pop("request", None)

        super().__init__(*args, **kwargs)

        self.fields["drill_intervals"].widget.attrs["class"] = "form-control"
        self.fields["nytimes_api_key"].label = "NYTimes API key"
        self.fields["nytimes_api_key"].required = False

        self.fields["drill_tags_muted"] = ModelCommaSeparatedChoiceField(
            request=self.request,
            required=False,
            queryset=Tag.objects.filter(user=self.request.user),
            to_field_name="name")

        collections_list = Collection.objects.filter(user=self.request.user).exclude(name="")
        if collections_list:
            self.fields["homepage_default_collection"] = ModelChoiceField(
                empty_label="Select Collection",
                label="Default collection",
                queryset=collections_list,
                required=False,
                to_field_name="id"
            )
            self.fields["homepage_image_collection"] = ModelChoiceField(
                empty_label="All Images",
                label="Image collection",
                queryset=collections_list,
                required=False,
                to_field_name="id"
            )
            self.fields["homepage_default_collection"].widget.attrs["class"] = "form-control form-select"
            self.fields["homepage_image_collection"].widget.attrs["class"] = "form-control form-select"
        else:
            # If the user doesn't have any collections, remove the field
            self.fields.pop("homepage_default_collection")

    class Meta:
        """Meta configuration for UserProfileForm.

        Defines the model, fields, and widgets used by the form.
        """

        model = UserProfile
        fields = (
            "theme",
            "background_image",
            "sidebar_image",
            "homepage_default_collection",
            "homepage_image_collection",
            "drill_intervals",
            "drill_tags_muted",
            "nytimes_api_key",
            "instagram_credentials",
            "google_calendar",
            "google_calendar_email",
            "eye_candy"
        )
        widgets = {
            "google_calendar": Textarea(attrs={"class": "form-control"}),
            "google_calendar_email": TextInput(attrs={"class": "form-control"}),
            "nytimes_api_key": TextInput(attrs={"class": "form-control"}),
            "theme": Select(attrs={"class": "form-control form-select"})
        }
