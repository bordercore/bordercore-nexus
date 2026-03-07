"""Django forms module for music application.

This module provides form classes for creating and editing songs, playlists,
and albums. It includes custom validation logic and dynamic field handling
based on user context and relationships between models.
"""

from typing import Any, Dict, Optional, Union, cast

from django import forms
from django.contrib.auth.models import User
from django.core.exceptions import ObjectDoesNotExist, ValidationError
from django.forms import (ModelChoiceField, ModelForm, NumberInput, Select,
                          Textarea, TextInput)
from django.forms.fields import BooleanField, CharField, FileField
from django.http import HttpRequest
from django.urls import reverse
from django.utils.html import format_html

from lib.fields import ModelCommaSeparatedChoiceField
from tag.models import Tag

from .models import Album, Artist, Playlist, Song, SongSource


class SongForm(ModelForm):
    """Form for creating and editing songs with dynamic validation and field handling.

    This form handles song creation/editing with automatic artist creation,
    album validation, tag management, and custom field initialization based
    on user preferences and session data.

    Attributes:
        album_name: CharField for specifying album name (creates album if needed).
        artist: CharField for artist name (creates artist if doesn't exist).
        compilation: BooleanField indicating if song is part of a compilation.
        source: ModelChoiceField for selecting song source.
        request: HttpRequest object passed from view for user context.
    """

    album_name: CharField = CharField()
    artist: CharField = CharField(widget=forms.TextInput(
        attrs={"class": "form-control"}
    ))
    compilation: BooleanField = BooleanField()

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        """Initialize the SongForm with request context and dynamic field setup.

        Sets up form fields with appropriate widgets, validation rules, and
        initial values based on user session and existing model instance.

        Args:
            *args: Variable length argument list passed to parent ModelForm.
            **kwargs: Arbitrary keyword arguments. Expected to contain 'request'
                     key with HttpRequest object for user context.
        """
        # The request object is passed in from a view's SongForm() constructor
        self.request: Optional[HttpRequest] = kwargs.pop("request", None)

        super().__init__(*args, **kwargs)

        source_field = self.fields["source"]
        if hasattr(source_field, "empty_label"):
            source_field.empty_label = None  # type: ignore[attr-defined]
        self.fields["rating"].required = False
        self.fields["track"].required = False
        self.fields["note"].required = False
        self.fields["year"].required = False
        self.fields["original_year"].required = False
        self.fields["tags"].required = False

        self.fields["album_name"].required = False
        self.fields["album_name"].widget.attrs["class"] = "form-control"
        self.fields["album_name"].widget.attrs["autocomplete"] = "off"

        self.fields["compilation"].required = False

        # Use the song source stored in the user's session
        if self.request and self.request.session:
            song_source: str = self.request.session.get("song_source", SongSource.DEFAULT)
            self.fields["source"].initial = SongSource.objects.get(name=song_source).id

        # If this form has a model attached, get the tags and display them separated by commas
        if self.instance.id:
            self.initial["tags"] = self.instance.get_tags()
            self.initial["artist"] = Artist.objects.get(pk=self.instance.artist.id)

        if self.request:
            self.fields["tags"] = ModelCommaSeparatedChoiceField(
                request=self.request,
                required=False,
                queryset=Tag.objects.filter(user=self.request.user),
                to_field_name="name")

    def clean_album_name(self) -> Optional[str]:
        """Validate album name and check for conflicts with existing albums.

        Ensures that if an album with the same name and artist already exists,
        it has the same year as the current form data. If there's a year mismatch,
        raises a validation error with a link to the existing album.

        Returns:
            The cleaned album name string, or None if not provided.

        Raises:
            ValidationError: If album exists with same name/artist but different year.

        Example:
            If user tries to create "Abbey Road" by "The Beatles" with year 1970,
            but it already exists with year 1969, a validation error is raised
            with a link to the existing album.
        """
        album_name: Optional[str] = self.cleaned_data.get("album_name")
        artist: Optional[Artist] = self.cleaned_data.get("artist")

        if not album_name or not artist or not self.request:
            return album_name

        try:
            user = cast(User, self.request.user)
            album: Album = Album.objects.get(user=user,
                                             title=album_name,
                                             artist=artist)
            if album.year != self.cleaned_data.get("year"):
                listen_url: str = reverse("music:album_detail", args=[album.uuid])
                raise ValidationError(
                    format_html(
                        'Error: The <a href="{}">same album</a> already exists but with a different year.',
                        listen_url,
                    )
                )
        except ObjectDoesNotExist:
            pass

        return album_name

    def clean_artist(self) -> Optional[Artist]:
        """Clean and normalize artist name, creating Artist object if needed.

        Takes the artist name string from the form, strips whitespace,
        and either retrieves an existing Artist object or creates a new one
        for the current user.

        Returns:
            Artist object corresponding to the provided artist name.
        """
        if not self.request:
            return None

        data: str = self.cleaned_data["artist"].strip()
        artist: Artist
        artist, _ = Artist.objects.get_or_create(name=data, user=self.request.user)
        return artist

    def clean_rating(self) -> Optional[int]:
        """Clean rating field, converting empty strings to None for database NULL.

        Django forms return empty numeric fields as empty strings, but we want
        to store them as NULL in the database for optional rating fields.

        Returns:
            The rating integer, or None if the field was empty.

        Example:
            Empty rating input "" becomes None for database storage.
            Valid rating "5" remains as integer 5.
        """
        rating: Union[str, int, None] = self.cleaned_data.get('rating')

        # An empty rating is returned as an empty string by the
        #  form. Convert it to "None" so that the corresponding
        #  field in the database is set to "NULL".
        if rating == "":
            return None
        return rating  # type: ignore[return-value]

    def clean_year(self) -> Optional[int]:
        """Validate year field, ensuring it's provided when album is specified.

        Enforces business rule that if a user specifies an album name,
        they must also provide the release year for proper album creation
        and identification.

        Returns:
            The year integer, or None if not provided.

        Raises:
            ValidationError: If album name is provided but year is missing.
        """
        year: Optional[int] = self.cleaned_data.get("year")
        if not year and self.data.get("album_name"):
            raise ValidationError("If you specify an album you must also specify the year")
        return year

    def clean(self) -> Dict[str, Any]:
        """Perform final form validation and clean text fields.

        Strips whitespace from text fields (title, note, album_name) to ensure
        clean data storage and prevent issues with leading/trailing spaces.

        Returns:
            Dictionary of cleaned form data with stripped text fields.
        """
        cleaned_data: Optional[Dict[str, Any]] = super().clean()
        if cleaned_data is None:
            return {}

        for field in ["title", "note", "album_name"]:
            if field in cleaned_data and isinstance(cleaned_data[field], str):
                cleaned_data[field] = cleaned_data[field].strip()

        return cleaned_data

    source: ModelChoiceField = ModelChoiceField(
        queryset=SongSource.objects.all(),
        widget=forms.Select(attrs={"class": "form-control form-select"}),
        empty_label="Select Source"
    )

    class Meta:
        """Meta configuration for SongForm.

        Defines the model, fields, and widgets for the form. Includes
        custom widget styling for Bootstrap CSS classes and appropriate
        input types for different field types.
        """
        model = Song
        fields = ("title", "artist", "track", "year", "original_year", "tags", "album_name", "compilation", "rating", "note", "source", "length", "id")
        widgets = {
            "title": TextInput(attrs={"class": "form-control", "autocomplete": "off"}),
            "artist": TextInput(attrs={"class": "form-control", "autocomplete": "off"}),
            "note": Textarea(attrs={"rows": 2, "class": "form-control"}),
            "source": Select(),
            "track": NumberInput(attrs={"class": "form-control", "autocomplete": "off", "min": "1"}),
            "year": NumberInput(attrs={"class": "form-control", "autocomplete": "off"}),
            "original_year": NumberInput(attrs={"class": "form-control", "autocomplete": "off"}),
        }


class PlaylistForm(ModelForm):
    """Form for creating and editing playlists.

    Simple form for playlist management with basic fields like name, note,
    size, and type. Includes Bootstrap styling for consistent UI appearance.

    Attributes:
        name: CharField for playlist name.
        request: HttpRequest object passed from view for user context.
    """

    name: CharField = CharField()

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        """Initialize the PlaylistForm with request context.

        Sets up the form with user context for any user-scoped operations
        that might be needed in future enhancements.

        Args:
            *args: Variable length argument list passed to parent ModelForm.
            **kwargs: Arbitrary keyword arguments. Expected to contain 'request'
                     key with HttpRequest object for user context.
        """
        # The request object is passed in from a view's PlaylistForm() constructor
        self.request: Optional[HttpRequest] = kwargs.pop("request", None)
        super().__init__(*args, **kwargs)

    class Meta:
        """Meta configuration for PlaylistForm.

        Defines the model, fields, and widgets with Bootstrap styling
        for consistent appearance across the application.
        """
        model = Playlist
        fields = ("name", "note", "size", "type")
        widgets = {
            "name": TextInput(attrs={"class": "form-control", "autocomplete": "off"}),
            "note": TextInput(attrs={"class": "form-control", "autocomplete": "off"}),
            "size": NumberInput(attrs={"class": "form-control", "autocomplete": "off"}),
            "type": TextInput(attrs={"class": "form-control", "autocomplete": "off"}),
        }


class AlbumForm(ModelForm):
    """Form for creating and editing albums with artist and tag management.

    Handles album creation/editing with automatic artist creation, tag
    management, and optional cover image upload. Similar to SongForm
    but focused on album-specific fields and validation.

    Attributes:
        artist: CharField for artist name (creates artist if doesn't exist).
        cover_image: FileField for uploading album cover artwork.
        request: HttpRequest object passed from view for user context.
    """

    artist: CharField = CharField(widget=forms.TextInput(
        attrs={"class": "form-control"}
    ))
    cover_image: FileField = FileField()

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        """Initialize the AlbumForm with request context and dynamic field setup.

        Sets up form fields for album editing, including optional cover image
        upload and tag management. For existing albums, populates initial
        values for tags and artist fields.

        Args:
            *args: Variable length argument list passed to parent ModelForm.
            **kwargs: Arbitrary keyword arguments. Expected to contain 'request'
                     key with HttpRequest object for user context.
        """
        # The request object is passed in from a view's AlbumForm() constructor
        self.request: Optional[HttpRequest] = kwargs.pop("request", None)

        super().__init__(*args, **kwargs)

        self.fields["cover_image"].required = False

        if self.instance.id:
            self.initial["tags"] = self.instance.get_tags()
            self.initial["artist"] = Artist.objects.get(pk=self.instance.artist.id)

        if self.request:
            self.fields["tags"] = ModelCommaSeparatedChoiceField(
                request=self.request,
                required=False,
                queryset=Tag.objects.filter(user=self.request.user),
                to_field_name="name")

    def clean_artist(self) -> Optional[Artist]:
        """Clean and normalize artist name, creating Artist object if needed.

        Takes the artist name string from the form and either retrieves
        an existing Artist object or creates a new one for the current user.
        Identical functionality to SongForm's clean_artist method.

        Returns:
            Artist object corresponding to the provided artist name.
        """
        if not self.request:
            return None

        data: str = self.cleaned_data["artist"].strip()
        artist: Artist
        artist, _ = Artist.objects.get_or_create(name=data, user=self.request.user)
        return artist

    class Meta:
        """Meta configuration for AlbumForm.

        Defines the model, fields, and widgets with Bootstrap styling.
        """
        model = Album
        fields = ("title", "artist", "year", "note")
        widgets = {
            "title": TextInput(attrs={"class": "form-control", "autocomplete": "off"}),
            "year": NumberInput(attrs={"class": "form-control", "autocomplete": "off"}),
            "note": TextInput(attrs={"class": "form-control", "autocomplete": "off"}),
        }
