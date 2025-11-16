"""Forms for the drill application.

This module contains Django form classes for handling question-related forms,
including validation and field configuration.
"""
from __future__ import annotations

from typing import Any, Optional, cast

from django.contrib.auth.models import User
from django.forms import CharField, ModelForm, Textarea, ValidationError
from django.http import HttpRequest

from drill.models import Question
from lib.fields import ModelCommaSeparatedChoiceField
from tag.models import Tag


class QuestionForm(ModelForm):
    """Form for creating and editing ``Question`` instances.

    This form handles question input, answer input, reversibility flag, and tag
    management. It includes custom validation for tags and special handling for
    markdown-formatted content.

    Attributes:
        request: The HTTP request object, used for user-specific tag filtering.
    """

    request: Optional[HttpRequest]

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        """Initialize the QuestionForm instance.

        Sets up form fields with appropriate widgets and initial values.
        The request object is extracted from kwargs to enable user-specific
        tag filtering. Answer field whitespace stripping is disabled to preserve
        markdown code indentation.

        Args:
            *args: Variable length argument list passed to parent ModelForm.
            **kwargs: Arbitrary keyword arguments. May contain 'request' key
                which is extracted and stored as self.request.
        """
        # The request object is passed in from a view's get_form_kwargs() method
        self.request = kwargs.pop("request", None)

        super().__init__(*args, **kwargs)

        # Some answers might contain start with code identation required for markdown formatiing,
        #  so disable automatic whitespace stripping
        answer_field = cast(CharField, self.fields["answer"])
        answer_field.strip = False

        # If this form has a model attached, get the tags and display them separated by commas
        if self.instance.id:
            self.initial["tags"] = self.instance.get_tags()

        # Request is required for tag filtering, assert it's present
        assert self.request is not None, "Request must be provided to QuestionForm"
        user = cast(User, self.request.user)
        self.fields["tags"] = ModelCommaSeparatedChoiceField(
            request=self.request,
            required=False,
            queryset=Tag.objects.filter(user=user),
            to_field_name="name")

    def clean_tags(self) -> list[Tag]:
        """Validate the tags field.

        Ensures that at least one tag is provided and that tag names do not
        contain the '/' character, which is reserved for tag hierarchy.

        Returns:
            The cleaned tags data if validation passes.

        Raises:
            ValidationError: If no tags are provided or if any tag name
                contains the '/' character.
        """
        tags = self.cleaned_data["tags"]
        if not tags:
            self.add_error("tags", ValidationError("You must add at least one tag."))
        elif True in [True for x in self.cleaned_data["tags"] if "/" in x.name]:
            self.add_error("tags", ValidationError("You must not use the character '/' in the tag name."))

        return tags

    class Meta:
        """Meta configuration for QuestionForm.

        Defines the model, fields, and widgets used by the form.
        """

        model = Question
        fields = ("question", "answer", "is_reversible", "tags")
        widgets = {
            # Add "v-pre" attribute in case the question or answer happens to contain
            #  any Vue mustache tags
            "question": Textarea(attrs={"rows": 10, "class": "form-control", "v-pre": "true"}),
            "answer": Textarea(attrs={"rows": 10, "class": "form-control", "v-pre": "true"})
        }
