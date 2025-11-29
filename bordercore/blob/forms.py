"""Django forms for the blob application.

This module contains Django form classes for handling blob-related forms,
including file uploads, metadata editing, and validation.
"""
from __future__ import annotations

import datetime
import hashlib
import re
from typing import Any, cast

from django import forms
from django.contrib.auth.models import User
from django.core.files.uploadedfile import UploadedFile
from django.forms import (CheckboxInput, ModelForm, Textarea, TextInput,
                          ValidationError)
from django.forms.fields import CharField, IntegerField
from django.urls import reverse_lazy
from django.utils.safestring import mark_safe

from blob.models import ILLEGAL_FILENAMES, Blob
from lib.fields import CheckboxIntegerField, ModelCommaSeparatedChoiceField
from lib.time_utils import get_javascript_date
from tag.models import Tag


class BlobForm(ModelForm):
    """Form for creating and editing ``Blob`` instances.

    This form handles file uploads, metadata editing (name, date, tags, content,
    note, importance), filename validation, duplicate file detection via SHA1
    checksum, and date format validation.

    Attributes:
        request: The HTTP request object, used for user-specific tag filtering.
        filename: Optional filename field for manual filename entry.
        file_modified: Hidden integer field for tracking file modification time.
    """

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        """Initialize the BlobForm instance.

        Sets up form fields with appropriate widgets and initial values.
        The request object is extracted from kwargs to enable user-specific
        tag filtering. For existing blobs, pre-populates fields with current
        values including tags and formatted dates.

        Args:
            *args: Variable length argument list passed to parent ModelForm.
            **kwargs: Arbitrary keyword arguments. May contain 'request' key
                which is extracted and stored as self.request.
        """
        # The request object is passed in from a view's BlobForm() constructor
        self.request = kwargs.pop("request", None)

        super().__init__(*args, **kwargs)

        self.fields["file"].label = "File"
        self.fields["date"].required = False

        date_field = cast(forms.DateField, self.fields["date"])
        date_field.input_formats = ["%m-%d-%Y"]

        self.fields["date"].initial = ""
        self.fields["content"].required = False
        self.fields["name"].required = False
        self.fields["importance"].required = False

        if self.instance.id:
            self.fields["filename"].initial = self.instance.file

            # If this form has a model attached, get the tags and display them separated by commas
            self.initial["tags"] = self.instance.tags_string

            if self.instance.date:
                self.initial["date"] = get_javascript_date(self.instance.date)
        else:
            self.initial["date"] = datetime.date.today().strftime("%Y-%m-%dT00:00")

        user = cast(User, self.request.user)
        self.fields["tags"] = ModelCommaSeparatedChoiceField(
            request=self.request,
            required=False,
            queryset=Tag.objects.filter(user=user),
            to_field_name="name")

    filename = CharField(required=False, widget=forms.TextInput(attrs={"class": "form-control"}))
    file_modified = IntegerField(required=False, widget=forms.HiddenInput())

    def clean_filename(self) -> str:
        """Validate the filename field.

        Ensures that the filename is not in the list of illegal filenames and
        that it does not exceed the maximum length of 255 characters.

        Returns:
            The cleaned filename string if validation passes.

        Raises:
            ValidationError: If the filename is illegal or exceeds the maximum
                length.
        """
        filename = str(self.cleaned_data.get("filename"))
        if filename in ILLEGAL_FILENAMES:
            raise ValidationError(f"Error: Illegal filename: {filename}")
        if len(filename) > 255:
            raise ValidationError("Error: Filename must not be longer than 255 characters")

        return filename

    def clean_file(self) -> UploadedFile | None:
        """Validate the file field.

        Checks for duplicate files by computing the SHA1 checksum of uploaded
        files and comparing against existing blobs. Only performs duplicate
        checking when a new file is uploaded, not when editing metadata only.

        Returns:
            The cleaned file object if validation passes, or None if no file
            was uploaded.

        Raises:
            ValidationError: If a duplicate file with the same SHA1 checksum
                already exists.
        """
        uploaded_file = self.cleaned_data.get("file")

        # This insures that we only check for a dupe if the user
        #  added a file via file upload rather than simply edit the
        #  metadata for a file. Without this check the actual file
        #  can't be found to compute the sha1sum.
        if "file" in self.files and uploaded_file is not None:
            hasher = hashlib.sha1()
            for chunk in uploaded_file.chunks():
                hasher.update(chunk)

            # If the sha1sum changed (or didn't exist because this is a new object), check for a dupe
            if self.instance.sha1sum != hasher.hexdigest():
                existing_file = Blob.objects.filter(sha1sum=hasher.hexdigest()).first()
                if existing_file:
                    url = reverse_lazy("blob:detail", kwargs={"uuid": existing_file.uuid})
                    raise forms.ValidationError(mark_safe(f"Error: This file <a href='{url}'>already exists.</a>"))

        return uploaded_file

    def clean_date(self) -> str:
        """Validate the date field.

        Ensures that the date string matches one of the accepted formats:
        YYYY-MM-DD HH:MM:SS, YYYY-MM-DD, YYYY-MM, YYYY, or a date range
        format [YYYY-MM TO YYYY-MM]. Empty dates are also allowed.

        Returns:
            The cleaned date string if validation passes.

        Raises:
            ValidationError: If the date format is invalid.
        """
        date = self.cleaned_data.get("date")

        if date is None:
            return ""

        regex1 = r"^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$"
        regex2 = r"^\d{4}-\d{2}-\d{2}$"
        regex3 = r"^\d{4}-\d{2}$"
        regex4 = r"^\d{4}$"
        regex5 = r"^\[(\d{4}-\d{2}) TO \d{4}-\d{2}\]$"
        regex6 = r"^$"  # Empty dates are fine

        if not re.match("|".join([regex1, regex2, regex3, regex4, regex5, regex6]), date):
            raise forms.ValidationError("Error: invalid date format")

        return date

    class Meta:
        """Meta configuration for BlobForm.

        Defines the model, fields, widgets, and field classes used by the form.
        """

        model = Blob
        fields = ("file", "name", "filename", "file_modified", "date", "tags", "content", "note", "importance", "is_note", "id", "math_support")
        widgets = {
            "content": Textarea(attrs={"rows": 5, "class": "form-control"}),
            "note": Textarea(
                attrs={
                    "rows": 3,
                    "class": "form-control",
                    ":class": "{'drag-over': isDragOver.note}",
                    "@dragover.prevent": "isDragOver.note = true",
                    "@dragleave.prevent": "isDragOver.note = false",
                    "@drop": "isDragOver.note = false",
                    "@drop.prevent": "handleLinkDrop"
                }
            ),
            "name": TextInput(attrs={"class": "form-control", "autocomplete": "off"}),
            "importance": CheckboxInput(),
        }
        field_classes = {
            "importance": CheckboxIntegerField
        }
