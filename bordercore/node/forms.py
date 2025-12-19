"""
Forms for Node.

Provides ``NodeForm`` used to create and update ``Node`` instances with
custom widgets. The form optionally captures the current ``HttpRequest``
(when passed via a view's ``get_form_kwargs``) for use in validation or
``save()`` hooks.
"""

from __future__ import annotations

from typing import Any

from django.forms import ModelForm, Textarea, TextInput

from node.models import Node


class NodeForm(ModelForm):
    """Form for creating and editing ``Node`` instances.

    The current request can be attached by passing ``request`` through the
    view's ``get_form_kwargs``. It is stored on ``self.request`` for
    downstream use (e.g., custom validation, audit trails).
    """

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        """Initialize the form and capture the request if provided.

        Args:
            *args: Positional args forwarded to ``ModelForm``.
            **kwargs: Additional keyword arguments. If present,
                ``request`` will be popped and stored as ``self.request``.

        Note:
            The request object is passed in from a view's get_form_kwargs() method
        """
        self.request = kwargs.pop("request", None)
        super().__init__(*args, **kwargs)

    class Meta:
        """Model binding and widget configuration for the form."""

        model = Node
        fields = ("name", "note")
        widgets = {
            "name": TextInput(attrs={"class": "form-control", "autocomplete": "off"}),
            "note": Textarea(attrs={"class": "form-control"}),
        }
