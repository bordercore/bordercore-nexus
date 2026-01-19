"""Views for music application.

This module contains all the views for handling music-related functionality including
songs, albums, artists, playlists, and related operations.
"""

import json
import re
import string
import uuid
from datetime import timedelta
from typing import Any, Union, cast

import boto3
import humanize
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request

from django.conf import settings
from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.contrib.auth.mixins import LoginRequiredMixin
from django.contrib.auth.models import User
from django.core.files.uploadedfile import UploadedFile
from django.db import transaction
from django.db.models import F, Q
from django.db.models.query import QuerySet as QuerySetType
from django.forms.models import model_to_dict
from django.http import (HttpRequest, HttpResponse, HttpResponseRedirect,
                         JsonResponse)
from django.shortcuts import get_object_or_404, redirect, render
from django.urls import reverse, reverse_lazy
from django.views.decorators.http import require_POST
from django.views.generic.base import TemplateView
from django.views.generic.detail import DetailView
from django.views.generic.edit import (CreateView, DeleteView, ModelFormMixin,
                                       UpdateView)
from django.views.generic.list import ListView

from lib.decorators import validate_post_data
from lib.mixins import FormRequestMixin
from lib.time_utils import convert_seconds
from music.services import (create_album_from_zipfile, get_id3_info,
                            get_song_tags, scan_zipfile)
from music.services import search as search_service

from .forms import AlbumForm, PlaylistForm, SongForm
from .models import Album, Artist, Playlist, PlaylistItem, Song, SongSource
from .services import (get_artist_counts, get_playlist_counts,
                       get_playlist_songs)
from .services import get_recent_albums as get_recent_albums_service
from .services import get_unique_artist_letters

SEARCH_RESULTS_LIMIT = 20


@login_required
def music_list(request: HttpRequest) -> HttpResponse:
    """Display the main music list page with recent songs, albums, and playlists.

    Args:
        request: The HTTP request object.

    Returns:
        Rendered HTML response with music list data.
    """
    user = cast(User, request.user)
    recent_songs = Song.objects.filter(
        user=user
    ).select_related(
        "artist"
    ).order_by(
        F("last_time_played").desc(nulls_last=True)
    )[:10]

    # Get a random album to feature
    random_album = Album.objects.filter(user=user).select_related("artist").order_by("?").first()

    # Get all playlists and their song counts
    playlists = get_playlist_counts(user)

    page_number_raw = request.GET.get("page_number")
    try:
        page_number = int(page_number_raw) if page_number_raw is not None else 1
    except (TypeError, ValueError):
        page_number = 1
    # page_number = request.GET.get("page_number", None)
    # Get a list of recently added albums
    recent_albums_list, paginator_info = get_recent_albums_service(user, page_number)

    # Verify that the user has at least one song in their collection
    collection_is_not_empty = Song.objects.filter(user=user).exists()

    # Serialize data for React
    random_album_data = None
    if random_album:
        random_album_data = {
            "uuid": str(random_album.uuid),
            "title": random_album.title,
            "artist_name": random_album.artist.name,
            "artist_uuid": str(random_album.artist.uuid),
            "album_url": reverse("music:album_detail", args=[random_album.uuid]),
            "artist_url": reverse("music:artist_detail", args=[random_album.artist.uuid]),
            "artwork_url": f"{settings.IMAGES_URL}album_artwork/{random_album.uuid}",
        }

    playlists_data = [
        {
            "uuid": str(p.uuid),
            "name": p.name,
            "num_songs": getattr(p, "num_songs"),
            "url": reverse("music:playlist_detail", args=[p.uuid]),
        }
        for p in playlists
    ]

    recent_played_songs_data = [
        {
            "uuid": str(s.uuid),
            "title": s.title,
            "artist_name": s.artist.name,
            "artist_url": reverse("music:artist_detail", args=[s.artist.uuid]),
        }
        for s in recent_songs
    ]

    # Convert UUIDs to strings for JSON serialization
    recent_albums_data = [
        {
            **album,
            "uuid": str(album["uuid"]),
            "artist_uuid": str(album["artist_uuid"]),
        }
        for album in recent_albums_list
    ]

    return render(request, "music/index.html",
                  {
                      "cols": ["Date", "artist", "title", "id"],
                      "recent_songs": recent_songs,
                      "recent_albums": recent_albums_list,
                      "paginator_info": json.dumps(paginator_info),
                      "random_album": random_album,
                      "playlists": playlists,
                      "title": "Music List",
                      "collection_is_not_empty": collection_is_not_empty,
                      # JSON serialized data for React
                      "random_album_json": json.dumps(random_album_data),
                      "playlists_json": json.dumps(playlists_data),
                      "recent_played_songs_json": json.dumps(recent_played_songs_data),
                      "recent_albums_json": json.dumps(recent_albums_data),
                  })


class ArtistDetailView(LoginRequiredMixin, DetailView):
    """Display detailed information about a specific artist."""

    model = Artist
    slug_field = "uuid"
    slug_url_kwarg = "uuid"

    def get_queryset(self) -> QuerySetType[Artist]:
        """Scope artists to the current user.

        Returns:
            QuerySet of Artist objects for this user.
        """
        user = cast(User, self.request.user)
        return Artist.objects.filter(user=user)

    def get_context_data(self, **kwargs: Any) -> dict[str, Any]:
        """Get context data for the artist detail view.

        Args:
            **kwargs: Additional keyword arguments.

        Returns:
            Dictionary containing context data for the template.
        """
        context = super().get_context_data(**kwargs)

        user = cast(User, self.request.user)

        # Get all albums by this artist
        albums = Album.objects.filter(
            user=user,
            artist=self.object
        ).order_by(
            "-original_release_year"
        )

        # Get all songs by this artist that do not appear on an album
        songs = Song.objects.filter(
            user=user,
            artist=self.object,
            album__isnull=True
        ).select_related(
            "artist"
        ).order_by(
            F("year").desc(nulls_last=True),
            "title"
        )

        # Get all songs by this artist that do appear on compilation album
        compilation_albums = Album.objects.filter(
            Q(user=user)
            & Q(song__artist=self.object)
            & ~Q(artist=self.object)
        ).distinct("song__album")

        # Build a mapping of song UUIDs to their playlist UUIDs
        song_uuids = [song.uuid for song in songs]
        song_playlists: dict[Any, list[str]] = {}
        playlist_items = PlaylistItem.objects.filter(
            song__uuid__in=song_uuids,
            playlist__user=user,
            playlist__type="manual"
        ).values_list("song__uuid", "playlist__uuid")

        for song_uuid, playlist_uuid in playlist_items:
            if song_uuid not in song_playlists:
                song_playlists[song_uuid] = []
            song_playlists[song_uuid].append(str(playlist_uuid))

        song_list = []
        for song in songs:
            song_list.append(
                {
                    "uuid": str(song.uuid),
                    "year_effective": song.original_year or song.year,
                    "title": song.title,
                    "rating": song.rating,
                    "length": convert_seconds(song.length),
                    "artist": song.artist.name,
                    "note": re.sub("[\n\r\"]", "", song.note or ""),
                    "playlists": song_playlists.get(song.uuid, [])
                }
            )

        # Serialize artist data for React
        artist_data = {
            "uuid": str(self.object.uuid),
            "name": self.object.name,
        }

        # Serialize albums for React
        albums_data = [
            {"uuid": str(a.uuid), "title": a.title, "year": a.year}
            for a in albums
        ]

        # Serialize compilation albums for React
        compilation_albums_data = [
            {"uuid": str(a.uuid), "title": a.title, "year": a.year}
            for a in compilation_albums
        ]

        # Get manual playlists for the user
        playlists = Playlist.objects.filter(user=user, type="manual")
        playlists_data = [{"uuid": str(p.uuid), "name": p.name} for p in playlists]

        return {
            **context,
            "artist_image": True,
            "artist": self.object,
            "album_list": albums,
            "song_list": song_list,
            "compilation_album_list": compilation_albums,
            "title": self.object,
            # JSON serialized data for React
            "artist_json": json.dumps(artist_data),
            "albums_json": json.dumps(albums_data),
            "compilation_albums_json": json.dumps(compilation_albums_data),
            "songs_json": json.dumps(song_list),
            "playlists_json": json.dumps(playlists_data),
        }


class AlbumListView(LoginRequiredMixin, ListView):
    """Display a paginated list of albums organized by artist."""

    template_name = "music/album_list.html"

    def get_queryset(self) -> QuerySetType[Artist]:
        """Get the queryset of artists filtered by selected letter.

        Returns:
            QuerySet of Artist objects filtered by the selected letter.
        """
        selected_letter = self.request.GET.get("letter", "a")
        user = cast(User, self.request.user)

        queryset = Artist.objects.filter(user=user) \
                                 .filter(album__isnull=False)

        if selected_letter == "other":
            # "other" includes every artist whose name
            #  doesn't start with a letter
            queryset = queryset.exclude(
                Q(*[
                    ("name__istartswith", letter)
                    for letter in
                    list(string.ascii_lowercase)
                ], _connector=Q.OR)
            )
        else:
            queryset = queryset.filter(name__istartswith=selected_letter)
        queryset = queryset.distinct("name").order_by("name")

        return queryset

    def get_context_data(self, **kwargs: Any) -> dict[str, Any]:
        """Get context data for the album list view.

        Args:
            **kwargs: Additional keyword arguments.

        Returns:
            Dictionary containing context data for the template.
        """
        context = super().get_context_data(**kwargs)

        user = cast(User, self.request.user)
        selected_letter = self.request.GET.get("letter", "a")
        artist_counts = get_artist_counts(user, selected_letter)

        for artist in self.object_list:
            artist.album_counts = artist_counts["album_counts"][str(artist.uuid)]
            artist.song_counts = artist_counts["song_counts"][str(artist.uuid)]

        return {
            **context,
            "nav": list(string.ascii_lowercase) + ["other"],
            "title": "Album List",
            "selected_letter": selected_letter,
            "unique_artist_letters": get_unique_artist_letters(user)
        }


class AlbumDetailView(LoginRequiredMixin, FormRequestMixin, ModelFormMixin, DetailView):
    """Display detailed information about a specific album."""

    model = Album
    slug_field = "uuid"
    slug_url_kwarg = "uuid"
    form_class = AlbumForm
    template_name = "music/album_detail.html"

    def get_context_data(self, **kwargs: Any) -> dict[str, Any]:
        """Get context data for the album detail view.

        Args:
            **kwargs: Additional keyword arguments.

        Returns:
            Dictionary containing context data for the template.
        """
        context = super().get_context_data(**kwargs)

        user = cast(User, self.request.user)
        s = Song.objects.filter(user=user, album=self.object).order_by("track")

        playtime = self.object.playtime

        # Build a mapping of song UUIDs to their playlist UUIDs
        song_uuids = [song.uuid for song in s]
        song_playlists: dict[Any, list[str]] = {}
        playlist_items = PlaylistItem.objects.filter(
            song__uuid__in=song_uuids,
            playlist__user=user,
            playlist__type="manual"
        ).values_list("song__uuid", "playlist__uuid")

        for song_uuid, playlist_uuid in playlist_items:
            if song_uuid not in song_playlists:
                song_playlists[song_uuid] = []
            song_playlists[song_uuid].append(str(playlist_uuid))

        song_list = []

        for song in s:
            display_title = song.title + " - " + song.artist.name if \
                self.object.compilation else song.title
            song_list.append(
                {
                    "uuid": str(song.uuid),
                    "track": song.track,
                    "raw_title": song.title.replace("/", "FORWARDSLASH"),
                    "title": display_title,
                    "note": song.note or "",
                    "rating": song.rating,
                    "length_seconds": song.length,
                    "length": convert_seconds(song.length),
                    "playlists": song_playlists.get(song.uuid, [])
                }
            )

        tags = [x.name for x in self.object.tags.all()]

        # Serialize album data for React
        album_data = {
            "uuid": str(self.object.uuid),
            "title": self.object.title,
            "artist_name": self.object.artist.name,
            "artist_uuid": str(self.object.artist.uuid),
            "year": self.object.year,
            "original_release_year": self.object.original_release_year,
            "playtime": playtime,
            "cover_url": f"{settings.IMAGES_URL}album_artwork/{self.object.uuid}",
            "note": self.object.note or "",
            "tags": tags,
            "has_songs": s.exists(),
        }

        # Get manual playlists for the user
        playlists = Playlist.objects.filter(user=user, type="manual")
        playlists_data = [{"uuid": str(p.uuid), "name": p.name} for p in playlists]

        return {
            **context,
            "song_list": song_list,
            "tags": tags,
            "playtime": playtime,
            "title": self.object,
            # JSON serialized data for React
            "album_json": json.dumps(album_data),
            "songs_json": json.dumps(song_list),
            "tags_json": json.dumps(tags),
            "playlists_json": json.dumps(playlists_data),
        }

    def get_queryset(self) -> QuerySetType[Album]:
        """Get the queryset of albums for the current user.

        Returns:
            QuerySet of Album objects filtered by user.
        """
        user = cast(User, self.request.user)
        return Album.objects.filter(user=user).prefetch_related("tags")


class AlbumUpdateView(LoginRequiredMixin, FormRequestMixin, UpdateView):
    """Handle updating album information and cover images."""

    model = Album
    form_class = AlbumForm
    slug_field = "uuid"
    slug_url_kwarg = "uuid"
    template_name = "music/album_detail.html"

    def form_valid(self, form: AlbumForm) -> HttpResponseRedirect:
        """Process valid form submission for album update.

        Args:
            form: The validated ``AlbumForm``.

        Returns:
            HTTP redirect to the success URL.
        """
        if "cover_image" in self.request.FILES:
            self.upload_cover_image_to_s3()

        album = form.instance
        album.tags.set(form.cleaned_data["tags"])
        self.object = form.save()

        messages.add_message(
            self.request,
            messages.INFO,
            "Album edited"
        )

        return HttpResponseRedirect(self.get_success_url())

    def get_success_url(self) -> str:
        """Return the URL to redirect to after successful creation.

        Returns:
            URL string for the album detail page.
        """
        url = reverse(
            "music:album_detail",
            kwargs={
                "uuid": self.object.uuid
            }
        )

        # If we've uploaded a cover image, add a random UUID to the
        #  url to force the browser to evict the old image from cache
        #  so the new one is immediately visible.
        if "cover_image" in self.request.FILES:
            url = url + f"?cache_buster={uuid.uuid4()}"

        return url

    def upload_cover_image_to_s3(self) -> None:
        """Upload the album's cover image to S3.

        Raises:
            Exception: If S3 upload fails.
        """
        s3_client = boto3.client("s3")

        key = f"album_artwork/{self.object.uuid}"
        cover_image = cast(UploadedFile, self.request.FILES["cover_image"])
        s3_client.upload_fileobj(
            cover_image.file,
            settings.AWS_BUCKET_NAME_MUSIC,
            key,
            ExtraArgs={"ContentType": "image/jpeg"}
        )


class SongUpdateView(LoginRequiredMixin, FormRequestMixin, UpdateView):
    """Handle updating song information and metadata."""

    model = Song
    template_name = "music/create_song.html"
    form_class = SongForm
    success_url = reverse_lazy("music:list")
    slug_field = "uuid"
    slug_url_kwarg = "uuid"

    def get_queryset(self) -> QuerySetType[Song]:
        """Limit updates to the current user's songs.

        Returns:
            QuerySet of Song objects for this user.
        """
        user = cast(User, self.request.user)
        return Song.objects.filter(user=user).prefetch_related("tags")

    def get_context_data(self, **kwargs: Any) -> dict[str, Any]:
        """Get context data for the song update view.

        Args:
            **kwargs: Additional keyword arguments.

        Returns:
            Dictionary containing context data for the template.
        """
        user = cast(User, self.request.user)
        context = super().get_context_data(**kwargs)
        context["action"] = "Edit"
        context["artist_name"] = str(self.object.artist)
        context["song_length_pretty"] = convert_seconds(self.object.length)
        context["last_time_played"] = self.object.last_time_played.strftime("%B %d, %Y") \
            if self.object.last_time_played else "Never"
        context["tags"] = [x.name for x in self.object.tags.all()]
        context["tag_counts"] = get_song_tags(user)
        return context

    def form_valid(self, form: SongForm) -> HttpResponseRedirect:
        """Process valid form submission for song update.

        Args:
            form: The validated song form.

        Returns:
            HTTP redirect to the success URL.
        """
        song = form.instance
        song.tags.set(form.cleaned_data["tags"])
        self.object = form.save()

        messages.add_message(
            self.request, messages.INFO,
            "Song edited"
        )

        if "return_url" in self.request.POST and self.request.POST["return_url"] != "":
            success_url = self.request.POST["return_url"]
        else:
            success_url = self.success_url

        return HttpResponseRedirect(success_url)


class SongFormAjaxView(LoginRequiredMixin, DetailView):
    """Return song form data as JSON for React form.

    This view provides a single song's data in JSON format for populating
    the edit form in the React SongEditPage component.
    """

    model = Song
    slug_field = "uuid"
    slug_url_kwarg = "uuid"

    def get_queryset(self) -> QuerySetType[Song]:
        """Limit queryset to current user's songs only.

        Returns:
            QuerySet filtered to songs owned by the authenticated user.
        """
        user = cast(User, self.request.user)
        return Song.objects.filter(user=user).prefetch_related("tags")

    def render_to_response(
        self, context: dict[str, Any], **response_kwargs: Any
    ) -> JsonResponse:
        """Return song form data as JSON.

        Args:
            context: Template context dictionary containing the song.
            **response_kwargs: Additional keyword arguments for the response.

        Returns:
            JsonResponse containing song form data.
        """
        song = self.object
        # Get all available song sources
        source_options = [
            {"id": s.id, "name": s.name}
            for s in SongSource.objects.all()
        ]
        data = {
            "uuid": str(song.uuid),
            "title": song.title,
            "artist": str(song.artist) if song.artist else "",
            "track": song.track or "",
            "year": song.year or "",
            "original_year": song.original_year or "",
            "rating": song.rating,
            "note": song.note or "",
            "album_name": song.album.title if song.album else "",
            "compilation": song.album.compilation if song.album else False,
            "tags": [t.name for t in song.tags.all()],
            "length": song.length,
            "length_pretty": convert_seconds(song.length),
            "last_time_played": song.last_time_played.strftime("%B %d, %Y")
            if song.last_time_played
            else "Never",
            "times_played": song.times_played,
            "source": song.source.id if song.source else None,
            "source_options": source_options,
        }
        return JsonResponse(data)


class SongUpdateReactView(LoginRequiredMixin, FormRequestMixin, UpdateView):
    """Handle updating song information using React frontend.

    This view serves the React-based song edit page and handles form submissions
    via AJAX, returning JSON responses.
    """

    model = Song
    template_name = "music/song_edit_react.html"
    form_class = SongForm
    success_url = reverse_lazy("music:list")
    slug_field = "uuid"
    slug_url_kwarg = "uuid"

    def get_queryset(self) -> QuerySetType[Song]:
        """Limit updates to the current user's songs.

        Returns:
            QuerySet of Song objects for this user.
        """
        user = cast(User, self.request.user)
        return Song.objects.filter(user=user).prefetch_related("tags")

    def get_context_data(self, **kwargs: Any) -> dict[str, Any]:
        """Get context data for the song update view.

        Args:
            **kwargs: Additional keyword arguments.

        Returns:
            Dictionary containing context data for the template.
        """
        user = cast(User, self.request.user)
        context = super().get_context_data(**kwargs)
        context["title"] = "Edit Song"
        context["song"] = self.object
        context["tag_counts"] = get_song_tags(user)
        # Serialize tag_counts for React
        context["tag_counts_json"] = json.dumps(
            [{"name": t["name"], "count": t["count"]} for t in context["tag_counts"]]
        )
        return context

    def form_valid(self, form: SongForm) -> HttpResponse:
        """Process valid form submission for song update.

        Args:
            form: The validated song form.

        Returns:
            JSON response for AJAX requests, HTTP redirect otherwise.
        """
        song = form.instance
        song.tags.set(form.cleaned_data["tags"])
        self.object = form.save()

        # For AJAX requests, return JSON instead of redirect
        if (
            self.request.headers.get("X-Requested-With") == "XMLHttpRequest"
            or self.request.content_type == "application/x-www-form-urlencoded"
        ):
            success_url = self.success_url
            if "return_url" in self.request.POST and self.request.POST["return_url"]:
                success_url = self.request.POST["return_url"]
            return JsonResponse({"success": True, "redirect_url": str(success_url)})

        messages.add_message(self.request, messages.INFO, "Song edited")

        if "return_url" in self.request.POST and self.request.POST["return_url"] != "":
            success_url = self.request.POST["return_url"]
        else:
            success_url = self.success_url

        return HttpResponseRedirect(success_url)

    def form_invalid(self, form: SongForm) -> HttpResponse:
        """Handle invalid form submission.

        Args:
            form: The form with validation errors.

        Returns:
            HttpResponse with form errors, JSON for AJAX requests.
        """
        if (
            self.request.headers.get("X-Requested-With") == "XMLHttpRequest"
            or self.request.content_type == "application/x-www-form-urlencoded"
        ):
            errors: dict[str, Any] = {}
            for field, field_errors in form.errors.items():
                errors[field] = list(field_errors)
            return JsonResponse({"errors": errors}, status=400)
        return super().form_invalid(form)


class SongCreateView(LoginRequiredMixin, FormRequestMixin, CreateView):
    """Handle creating new songs with file uploads."""

    model = Song
    template_name = "music/create_song.html"
    form_class = SongForm
    success_url = reverse_lazy("music:create")

    def get_context_data(self, **kwargs: Any) -> dict[str, Any]:
        """Get context data for the song creation view.

        Args:
            **kwargs: Additional keyword arguments.

        Returns:
            Dictionary containing context data for the template.
        """
        user = cast(User, self.request.user)
        context = super().get_context_data(**kwargs)
        context["action"] = "New"
        context["tag_counts"] = get_song_tags(user)
        return context

    def form_valid(self, form: SongForm) -> HttpResponse:
        """Process valid form submission for song creation.

        Args:
            form: The validated song form.

        Returns:
            HTTP redirect to the success URL.
        """
        user = cast(User, self.request.user)
        album = Song.get_or_create_album(user, form.cleaned_data)

        song = form.save(commit=False)
        song.user = user
        song.save()

        # Save the tags
        form.save_m2m()

        # If an album name was specified, associate it with the song
        if album:
            song.album = album

        song.save()

        # Upload the song and its artwork to S3
        song_file = cast(UploadedFile, self.request.FILES["song"])
        song.upload_song_media_to_s3(song_file.read())

        # Save the song source in the session
        self.request.session["song_source"] = form.cleaned_data["source"].name

        listen_url = song.url
        messages.add_message(
            self.request, messages.INFO,
            f"Song successfully created.  <a href='{listen_url}'>Listen to it here.</a>"
        )

        return super().form_valid(form)


class MusicDeleteView(LoginRequiredMixin, DeleteView):
    """Handle deletion of songs."""

    model = Song
    slug_field = "uuid"
    slug_url_kwarg = "uuid"
    success_url = reverse_lazy("music:list")

    def get_queryset(self) -> QuerySetType[Song]:
        """Get the queryset of songs for the current user.

        Returns:
            QuerySet of Song objects filtered by user.
        """
        # Filter the queryset to only include objects owned by the logged-in user
        user = cast(User, self.request.user)
        return self.model.objects.filter(user=user)

    def form_valid(self, form: Any) -> HttpResponse:
        """Process valid form submission for song deletion.

        Args:
            form: The deletion form (not used but required by interface).

        Returns:
            HTTP redirect to the success URL.
        """
        messages.add_message(
            self.request,
            messages.INFO,
            "Song deleted"
        )
        return super().form_valid(form)


@login_required
def search_artists(request: HttpRequest) -> JsonResponse:
    """Search for artists matching a given term.

    Args:
        request: The HTTP request object containing 'term' parameter.

    Returns:
        JSON response with matching artists.
    """
    artist = request.GET.get("term", "").strip().lower()
    user = cast(User, request.user)

    matches = search_service(user, artist)

    return JsonResponse(matches, safe=False)


class RecentSongsListView(LoginRequiredMixin, ListView):
    """Return a JSON list of recent songs, optionally filtered by tag."""

    def get_queryset(self) -> QuerySetType[Song]:
        """Get the queryset of recent songs, optionally filtered.

        Returns:
            QuerySet of Song objects ordered by creation date.
        """
        search_term = self.request.GET.get("tag", "").strip()
        user = cast(User, self.request.user)

        queryset = Song.objects.filter(user=user, album__isnull=True) \
                               .select_related("artist")

        if search_term:
            queryset = queryset.filter(
                Q(title__icontains=search_term)
                | Q(artist__name__icontains=search_term)
            )

        return queryset.order_by("-created", "artist__name", "title")[:SEARCH_RESULTS_LIMIT]

    def get(self, request: HttpRequest, *args: Any, **kwargs: Any) -> JsonResponse:
        """Handle GET requests for recent songs.

        Args:
            request: The HTTP request object.
            *args: Additional positional arguments.
            **kwargs: Additional keyword arguments.

        Returns:
            JSON response with song list and status.
        """
        queryset = self.get_queryset()

        song_list = []

        for song in queryset:
            song_list.append(
                {
                    "uuid": song.uuid,
                    "title": song.title,
                    "artist": song.artist.name,
                    "year": song.year,
                    "length": convert_seconds(song.length),
                    "artist_url": reverse("music:artist_detail", kwargs={"uuid": song.artist.uuid})
                }
            )

        response = {
            "status": "OK",
            "song_list": song_list
        }

        return JsonResponse(response)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def mark_song_as_listened_to(request: Request, song_uuid: str) -> JsonResponse:
    """Mark a song as having been listened to (production only).

    Args:
        request: The DRF request object.
        song_uuid: UUID of the song to mark as listened to.

    Returns:
        JSON response with status and play count.
    """
    song = Song.objects.get(user=request.user, uuid=song_uuid)
    if not settings.DEBUG:
        song.listen_to()

    return JsonResponse(
        {
            "status": "OK",
            "times_played": song.times_played
        }
    )


@login_required
def get_song_id3_info(request: HttpRequest) -> JsonResponse:
    """Extract ID3 information from an uploaded song file.

    Args:
        request: The HTTP request object containing the uploaded song file.

    Returns:
        JSON response with extracted ID3 metadata.
    """
    song_file = cast(UploadedFile, request.FILES["song"])
    song = song_file.read()
    id3_info = get_id3_info(song)
    return JsonResponse({**id3_info})


class SearchTagListView(LoginRequiredMixin, ListView):
    """Return a list of songs and albums which have a given tag."""

    template_name = "music/tag_search.html"

    def get_queryset(self) -> QuerySetType[Song]:
        """Get the queryset of songs filtered by tag.

        Returns:
            QuerySet of Song objects with the specified tag.
        """
        tag_name = self.request.GET["tag"]
        user = cast(User, self.request.user)

        return Song.objects.filter(
            user=user,
            tags__name=tag_name
        ).select_related(
            "artist"
        ).order_by(
            F("year").desc(nulls_last=True),
            "title"
        )

    def get_context_data(self, **kwargs: Any) -> dict[str, Any]:
        """Get context data for the tag search view.

        Args:
            **kwargs: Additional keyword arguments.

        Returns:
            Dictionary containing context data for the template.
        """
        context = super().get_context_data(**kwargs)

        song_list = list(context["object_list"].values("uuid", "title", "artist__name", "year", "length"))
        for song in song_list:
            song["length"] = convert_seconds(song["length"])

        user = cast(User, self.request.user)

        album_list = []

        for match in Album.objects.filter(
                user=user,
                tags__name=self.request.GET["tag"]
        ).select_related(
            "artist"
        ).order_by("-year"):
            album_list.append(
                {
                    "uuid": match.uuid,
                    "title": match.title,
                    "artist": match.artist,
                    "year": match.year,
                }
            )

        return {
            **context,
            "tag_name": self.request.GET["tag"],
            "song_list": song_list,
            "album_list": album_list,
        }


class PlaylistDetailView(LoginRequiredMixin, DetailView):
    """Display detailed information about a specific playlist."""

    model = Playlist
    slug_field = "uuid"
    slug_url_kwarg = "uuid"
    template_name = "music/playlist_detail.html"

    def get_context_data(self, **kwargs: Any) -> dict[str, Any]:
        """Get context data for the playlist detail view.

        Args:
            **kwargs: Additional keyword arguments.

        Returns:
            Dictionary containing context data for the template.
        """
        context = super().get_context_data(**kwargs)

        playlist = self.object
        obj_dict = model_to_dict(playlist)
        obj_dict["uuid"] = str(playlist.uuid)
        # Ensure parameters is a dict, not None
        if obj_dict.get("parameters") is None:
            obj_dict["parameters"] = {}

        return {
            **context,
            "playlist": playlist,
            "playlist_json": json.dumps(obj_dict),
        }


class CreatePlaylistView(LoginRequiredMixin, FormRequestMixin, CreateView):
    """Handle creation of new playlists."""

    model = Playlist
    form_class = PlaylistForm

    def get_context_data(self, **kwargs: Any) -> dict[str, Any]:
        """Get context data for the playlist creation view.

        Args:
            **kwargs: Additional keyword arguments.

        Returns:
            Dictionary containing context data for the template.
        """
        context = super().get_context_data(**kwargs)
        return context

    def form_valid(self, form: PlaylistForm) -> HttpResponse:
        """Process valid form submission for playlist creation.

        Args:
            form: The validated playlist form.

        Returns:
            HTTP redirect to the success URL.
        """
        playlist = form.save(commit=False)
        playlist.user = self.request.user

        playlist.parameters = {
            x: self.request.POST[x]
            for x in
            ["tag", "start_year", "end_year", "exclude_recent", "rating", "sort_by"]
            if x in self.request.POST and self.request.POST[x] != ""
        }
        playlist.parameters["exclude_albums"] = self.request.POST.get("exclude_albums", "") == "true"
        playlist.save()

        if playlist.type != "manual":
            playlist.populate()

        return super().form_valid(form)


class UpdatePlaylistView(LoginRequiredMixin, FormRequestMixin, UpdateView):
    """Handle updating existing playlists."""

    model = Playlist
    form_class = PlaylistForm
    slug_field = "uuid"
    slug_url_kwarg = "uuid"

    def form_valid(self, form: PlaylistForm) -> HttpResponseRedirect:
        """Process valid form submission for playlist update.

        Args:
            form: The validated playlist form.

        Returns:
            HTTP redirect to the success URL.
        """
        playlist = form.save()

        params_to_extract = ["end_year", "exclude_albums", "exclude_recent", "rating", "start_year", "tag"]
        filtered_params = {
            key: self.request.POST[key]
            for key in params_to_extract
            if key in self.request.POST
            and self.request.POST[key] != ""
        }

        if playlist.type != "manual" and \
           (
               "size" in form.changed_data
               or self.request.POST.get("refresh_song_list", False)
               # If any parameters from a smart playlist have changed, refresh the song list.
               or filtered_params != playlist.parameters
           ):

            playlist.parameters = filtered_params
            playlist.save()

            playlist.populate(refresh=True)

        messages.add_message(
            self.request, messages.INFO,
            "Playlist edited"
        )

        return HttpResponseRedirect(self.get_success_url())


class PlaylistDeleteView(LoginRequiredMixin, DeleteView):
    """Handle deletion of playlists."""

    model = Playlist
    slug_field = "uuid"
    slug_url_kwarg = "uuid"
    success_url = reverse_lazy("music:list")

    def get_queryset(self) -> QuerySetType[Playlist]:
        """Get the queryset of playlists for the current user.

        Returns:
            QuerySet of Playlist objects filtered by user.
        """
        # Filter the queryset to only include objects owned by the logged-in user
        user = cast(User, self.request.user)
        return self.model.objects.filter(user=user)

    def form_valid(self, form: Any) -> HttpResponse:
        """Process valid form submission for playlist deletion.

        Args:
            form: The deletion form (not used but required by interface).

        Returns:
            HTTP redirect to the success URL.
        """
        messages.add_message(
            self.request,
            messages.INFO,
            f"Playlist <strong>{self.object.name}</strong> deleted"
        )
        return super().form_valid(form)


class CreateAlbumView(LoginRequiredMixin, TemplateView):
    """Display the album creation page with song sources."""

    template_name = "music/create_album.html"

    def get_context_data(self, **kwargs: Any) -> dict[str, Any]:
        """Get context data for the album creation view.

        Args:
            **kwargs: Additional keyword arguments.

        Returns:
            Dictionary containing context data for the template.
        """
        context = super().get_context_data(**kwargs)

        song_sources = [
            {
                "id": x.id,
                "name": x.name,
            }
            for x in SongSource.objects.all()
        ]

        return {
            **context,
            "song_source_default": self.request.session.get("song_source", SongSource.DEFAULT),
            "song_sources": json.dumps({"info": song_sources})
        }


@login_required
def scan_album_from_zipfile(request: HttpRequest) -> JsonResponse:
    """Scan a ZIP file to extract album information without creating the album.

    Args:
        request: The HTTP request object containing the uploaded ZIP file.

    Returns:
        JSON response with scanned album information and status.
    """
    if "zipfile" not in request.FILES:
        return JsonResponse({
            "status": "ERROR",
            "message": "No ZIP file provided"
        }, status=400)

    zipfile_upload = cast(UploadedFile, request.FILES["zipfile"])
    zipfile_obj = zipfile_upload.read()
    info = scan_zipfile(zipfile_obj)

    response = {
        **info,
        "status": "OK",
    }

    return JsonResponse(response)


@login_required
@require_POST
@validate_post_data("artist", "source")
def add_album_from_zipfile(request: HttpRequest) -> JsonResponse:
    """Create an album from a ZIP file containing audio tracks.

    Args:
        request: The HTTP request object containing the ZIP file and metadata.

    Returns:
        JSON response with creation status and album URL or error message.
    """
    artist = request.POST.get("artist", "").strip()
    source_id = request.POST.get("source", "").strip()

    if "zipfile" not in request.FILES:
        return JsonResponse({
            "status": "ERROR",
            "message": "No ZIP file provided"
        }, status=400)

    zipfile_upload = cast(UploadedFile, request.FILES["zipfile"])
    zipfile_obj = zipfile_upload.read()

    try:
        user = cast(User, request.user)
        source = SongSource.objects.get(id=source_id)
        album_uuid = create_album_from_zipfile(
            zipfile_obj,
            artist,
            source,
            request.POST.get("tags", None),
            user,
            json.loads(request.POST.get("songListChanges", "{}"))
        )
    except Exception as e:
        return JsonResponse({"status": "Error", "error": str(e)})

    # Save the song source in the session
    request.session["song_source"] = SongSource.objects.get(id=request.POST["source"]).name

    response = {
        "status": "OK",
        "url": reverse("music:album_detail", kwargs={"uuid": album_uuid}),
    }

    return JsonResponse(response)


@login_required
def get_playlist(request: HttpRequest, playlist_uuid: str) -> JsonResponse:
    """Get playlist contents and metadata.

    Args:
        request: The HTTP request object.
        playlist_uuid: UUID of the playlist to retrieve.

    Returns:
        JSON response with playlist songs, total time, and status.
    """
    playlist = Playlist.objects.get(uuid=playlist_uuid)

    playlist_data = get_playlist_songs(playlist)
    playtime_seconds: float = float(cast(int, playlist_data["playtime"]))

    total_time = humanize.precisedelta(
        timedelta(seconds=playtime_seconds),
        minimum_unit="minutes",
        format="%.f"
    )

    response = {
        "status": "OK",
        "totalTime": total_time,
        "playlistitems": playlist_data["song_list"]
    }

    return JsonResponse(response)


@login_required
@require_POST
@validate_post_data("playlistitem_uuid", "position")
def sort_playlist(request: HttpRequest) -> JsonResponse:
    """Move a song to a new position within a playlist.

    Args:
        request: The HTTP request object containing playlist item UUID and new position.

    Returns:
        JSON response with operation status.
    """
    playlistitem_uuid = request.POST.get("playlistitem_uuid", "").strip()
    new_position = int(request.POST.get("position", "").strip())

    with transaction.atomic():
        playlistitem = get_object_or_404(
            PlaylistItem.objects.select_related("playlist"),
            uuid=playlistitem_uuid,
            playlist__user=request.user
        )
        playlistitem.reorder(new_position)

    return JsonResponse({"status": "OK"})


@login_required
def search_playlists(request: HttpRequest) -> JsonResponse:
    """Search for manual playlists by name.

    Args:
        request: The HTTP request object containing search query parameter.

    Returns:
        JSON response with matching playlist names and UUIDs.
    """
    user = cast(User, request.user)
    playlists = Playlist.objects.filter(
        user=user,
        type="manual",
        name__icontains=request.GET.get("query", "")
    )

    return JsonResponse([{"value": x.name, "uuid": x.uuid} for x in playlists], safe=False)


@login_required
@require_POST
@validate_post_data("playlist_uuid", "song_uuid")
def add_to_playlist(request: HttpRequest) -> JsonResponse:
    """Toggle a song's membership in a playlist.

    If the song is already on the playlist, remove it.
    If not, add it.

    Args:
        request: The HTTP request object containing playlist and song UUIDs.

    Returns:
        JSON response with operation status and action taken (added/removed).
    """
    playlist_uuid = request.POST.get("playlist_uuid", "").strip()
    song_uuid = request.POST.get("song_uuid", "").strip()

    playlist = get_object_or_404(Playlist, uuid=playlist_uuid, user=request.user)
    song = get_object_or_404(Song, uuid=song_uuid, user=request.user)

    existing_item = PlaylistItem.objects.filter(playlist=playlist, song=song).first()

    if existing_item:
        # Song is already on playlist - remove it
        existing_item.delete()
        response = {
            "status": "OK",
            "action": "removed"
        }
    else:
        # Song is not on playlist - add it
        playlistitem = PlaylistItem(playlist=playlist, song=song)
        playlistitem.save()

        # Save the playlist in the user's session, so that this will
        #  be the default selection next time.
        request.session["music_playlist"] = playlist_uuid

        response = {
            "status": "OK",
            "action": "added"
        }

    return JsonResponse(response)


@login_required
@require_POST
@validate_post_data("artist_uuid")
def update_artist_image(request: HttpRequest) -> JsonResponse:
    """Edit the image displayed on the artist detail page.

    Args:
        request: The HTTP request object containing artist UUID and image file.

    Returns:
        JSON response with operation status.

    Raises:
        Exception: If S3 upload fails.
    """
    artist_uuid = request.POST.get("artist_uuid", "").strip()

    get_object_or_404(Artist, uuid=artist_uuid, user=request.user)
    image = cast(UploadedFile, request.FILES["image"])

    s3_client = boto3.client("s3")

    key = f"artist_images/{artist_uuid}"
    s3_client.upload_fileobj(
        image.file,
        settings.AWS_BUCKET_NAME_MUSIC,
        key,
        ExtraArgs={"ContentType": "image/jpeg"}
    )

    response = {
        "status": "OK"
    }

    return JsonResponse(response)


@login_required
def dupe_song_checker(request: HttpRequest) -> JsonResponse:
    """Check for potential duplicate songs based on artist name and song title.

    Args:
        request: The HTTP request object containing 'artist' and 'title' parameters.

    Returns:
        JSON response with list of potential duplicate songs.
    """
    artist = request.GET.get("artist", "").strip()
    title = request.GET.get("title", "").strip()
    user = cast(User, request.user)

    song = Song.objects.filter(
        user=user,
        title__icontains=title,
        artist__name__icontains=artist
    ).select_related("album")

    if song:
        dupes = [
            {
                "title": x.title,
                "uuid": x.uuid,
                "url": x.url,
                "note": x.note,
                "album_name": x.album.title if x.album else "",
                "album_url": reverse("music:album_detail", args=[x.album.uuid]) if x.album else "",
            }
            for x in
            song
        ]
    else:
        dupes = []

    return JsonResponse({"dupes": dupes})


@login_required
def missing_artist_images(request: HttpRequest) -> HttpResponse:
    """Temporary view to find and redirect to an artist without an image in S3.

    This is a utility function to help identify artists that need images uploaded.

    Args:
        request: The HTTP request object.

    Returns:
        HTTP redirect to an artist detail page or the main music page if none found.
    """
    s3_resource = boto3.resource("s3")

    unique_uuids = {}

    paginator = s3_resource.meta.client.get_paginator("list_objects_v2")
    page_iterator = paginator.paginate(Bucket=settings.AWS_BUCKET_NAME_MUSIC)

    for page in page_iterator:
        for key in page.get("Contents", []):
            m = re.search(r"^artist_images/(.*)", str(key["Key"]))
            if m:
                unique_uuids[m.group(1)] = True

    artists = Artist.objects.all(
    ).exclude(
        album__artist__name="Various"
    ).exclude(
        album__artist__name="Various Artists"
    ).order_by("?")

    for artist in artists:
        if str(artist.uuid) not in unique_uuids:
            return redirect("music:artist_detail", uuid=artist.uuid)

    return render(request, "music/index.html")


@login_required
def recent_albums(request: HttpRequest, page_number: Union[str, int]) -> JsonResponse:
    """Get a paginated list of recently added albums.

    Args:
        request: The HTTP request object.
        page_number: The page number to retrieve.

    Returns:
        JSON response with album list, pagination info, and status.
    """
    user = cast(User, request.user)
    try:
        page_num = int(page_number)
    except (TypeError, ValueError):
        page_num = 1

    recent_albums_list, paginator = get_recent_albums_service(user, page_num)
    response = {
        "status": "OK",
        "album_list": recent_albums_list,
        "paginator": paginator
    }

    return JsonResponse(response)


@login_required
@require_POST
@validate_post_data("song_uuid")
def set_song_rating(request: HttpRequest) -> JsonResponse:
    """Edit the rating for a specific song.

    Args:
        request: The HTTP request object containing song UUID and rating value.

    Returns:
        JSON response with operation status.
    """
    song_uuid = request.POST.get("song_uuid", "").strip()

    if request.POST.get("rating", "").strip() == "":
        rating = None
    else:
        rating = int(request.POST.get("rating", "").strip())

    song = get_object_or_404(Song, uuid=song_uuid, user=request.user)
    song.rating = rating
    song.save()

    response = {
        "status": "OK"
    }

    return JsonResponse(response)
