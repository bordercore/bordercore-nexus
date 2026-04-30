"""Views for music application.

This module contains all the views for handling music-related functionality including
songs, albums, artists, playlists, and related operations.
"""
from __future__ import annotations

import json
import re
import string
import uuid
from datetime import timedelta
from typing import Any, Iterator, cast

import humanize
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from django.conf import settings
from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.contrib.auth.mixins import LoginRequiredMixin
from django.contrib.auth.models import User
from django.core.files.uploadedfile import UploadedFile
from django.db import transaction
from django.db.models import Count, F, Q
from django.db.models.query import QuerySet as QuerySetType
from django.forms.models import model_to_dict
from django.http import (HttpRequest, HttpResponse, HttpResponseRedirect,
                         StreamingHttpResponse)
from django.shortcuts import get_object_or_404, redirect, render
from django.urls import reverse, reverse_lazy
from django.views.generic.base import TemplateView
from django.views.generic.detail import DetailView
from django.views.generic.edit import (CreateView, DeleteView, ModelFormMixin,
                                       UpdateView)
from django.views.generic.list import ListView

from lib.decorators import validate_post_data
from lib.mixins import FormRequestMixin, UserScopedQuerysetMixin, get_user_object_or_404
from lib.time_utils import convert_seconds
from music.services import (create_album_from_zipfile, get_id3_info,
                            get_song_tags, list_artist_image_keys,
                            scan_zipfile, upload_album_artwork,
                            upload_artist_image)
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


class ArtistDetailView(LoginRequiredMixin, UserScopedQuerysetMixin, DetailView):
    """Display detailed information about a specific artist."""

    model = Artist
    slug_field = "uuid"
    slug_url_kwarg = "uuid"

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

        nav = list(string.ascii_lowercase) + ["other"]
        unique_artist_letters = get_unique_artist_letters(user)

        # JSON serialized data for React
        artists_data = [
            {
                "uuid": str(artist.uuid),
                "name": artist.name,
                "album_count": artist.album_counts,
                "song_count": artist.song_counts,
            }
            for artist in self.object_list
        ]

        return {
            **context,
            "nav": nav,
            "title": "Album List",
            "selected_letter": selected_letter,
            "unique_artist_letters": unique_artist_letters,
            # JSON serialized data for React
            "artists_json": json.dumps(artists_data),
            "nav_json": json.dumps(nav),
            "unique_artist_letters_json": json.dumps(list(unique_artist_letters)),
        }


class AlbumDetailView(LoginRequiredMixin, UserScopedQuerysetMixin, FormRequestMixin, ModelFormMixin, DetailView):
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
        return super().get_queryset().prefetch_related("tags")


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
        cover_image = cast(UploadedFile, self.request.FILES["cover_image"])
        upload_album_artwork(str(self.object.uuid), cover_image.file, "image/jpeg")


class SongUpdateView(LoginRequiredMixin, UserScopedQuerysetMixin, FormRequestMixin, UpdateView):
    """Handle updating song information and metadata."""

    model = Song
    template_name = "music/song_edit.html"
    form_class = SongForm
    success_url = reverse_lazy("music:list")
    slug_field = "uuid"
    slug_url_kwarg = "uuid"

    def get_queryset(self) -> QuerySetType[Song]:
        """Limit updates to the current user's songs.

        Returns:
            QuerySet of Song objects for this user.
        """
        return super().get_queryset().prefetch_related("tags")

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
        context["title"] = "Edit Song"
        context["song"] = self.object
        context["artist_name"] = str(self.object.artist)
        context["song_length_pretty"] = convert_seconds(self.object.length)
        context["last_time_played"] = self.object.last_time_played.strftime("%B %d, %Y") \
            if self.object.last_time_played else "Never"
        context["tags"] = [x.name for x in self.object.tags.all()]
        context["tag_counts"] = get_song_tags(user)
        # Add JSON context for React
        context["tag_counts_json"] = json.dumps(
            [{"name": t["name"], "count": t["count"]} for t in context["tag_counts"]]
        )
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


class SongFormAjaxView(APIView):
    """Return song form data as JSON for React form.

    This view provides a single song's data in JSON format for populating
    the edit form in the React SongEditPage component.
    """

    def get(self, request: HttpRequest, uuid: str) -> Response:
        """Return song form data as JSON.

        Args:
            request: The HTTP request object.
            uuid: UUID of the song to retrieve.

        Returns:
            Response containing song form data.
        """
        song = get_user_object_or_404(request.user, Song, uuid=uuid)
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
        return Response(data)


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
        # Add JSON context for React
        context["tag_counts_json"] = json.dumps(
            [{"name": t["name"], "count": t["count"]} for t in context["tag_counts"]]
        )
        source_options = [
            {"id": s.id, "name": s.name}
            for s in SongSource.objects.all()
        ]
        context["source_options_json"] = json.dumps(source_options)
        # Get initial source from session
        song_source_name: str = self.request.session.get("song_source", SongSource.DEFAULT)
        try:
            initial_source = SongSource.objects.get(name=song_source_name)
            context["initial_source_id"] = initial_source.id
        except SongSource.DoesNotExist:
            context["initial_source_id"] = ""
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


class MusicDeleteView(LoginRequiredMixin, UserScopedQuerysetMixin, DeleteView):
    """Handle deletion of songs."""

    model = Song
    slug_field = "uuid"
    slug_url_kwarg = "uuid"
    success_url = reverse_lazy("music:list")

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


@api_view(["GET"])
def search_artists(request: HttpRequest) -> Response:
    """Search for artists matching a given term.

    Args:
        request: The HTTP request object containing 'term' parameter.

    Returns:
        JSON response with matching artists.
    """
    artist = request.GET.get("term", "").strip().lower()
    user = cast(User, request.user)

    matches = search_service(user, artist)

    return Response(matches)



class RecentSongsListView(APIView):
    """Return a JSON list of recent songs, optionally filtered by tag."""

    def get_queryset(self, request: HttpRequest) -> QuerySetType[Song]:
        """Get the queryset of recent songs, optionally filtered.

        Returns:
            QuerySet of Song objects ordered by creation date.
        """
        search_term = request.GET.get("tag", "").strip()
        user = cast(User, request.user)

        queryset = Song.objects.filter(user=user, album__isnull=True) \
                               .select_related("artist")

        if search_term:
            queryset = queryset.filter(
                Q(title__icontains=search_term)
                | Q(artist__name__icontains=search_term)
            )

        return queryset.order_by("-created", "artist__name", "title")[:SEARCH_RESULTS_LIMIT]

    def get(self, request: HttpRequest) -> Response:
        """Handle GET requests for recent songs.

        Args:
            request: The HTTP request object.

        Returns:
            Response with song list and status.
        """
        queryset = self.get_queryset(request).select_related("album").annotate(
            _plays=Count("listen"),
        )

        song_list = []

        for song in queryset:
            song_list.append(
                {
                    "uuid": song.uuid,
                    "title": song.title,
                    "artist": song.artist.name,
                    "year": song.year,
                    "length": convert_seconds(song.length),
                    "artist_url": reverse(
                        "music:artist_detail", kwargs={"uuid": song.artist.uuid}
                    ),
                    "album_title": song.album.title if song.album else None,
                    "rating": song.rating,
                    "plays": song._plays,
                }
            )

        response = {
            "song_list": song_list
        }

        return Response(response)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def mark_song_as_listened_to(request: Request, song_uuid: str) -> Response:
    """Mark a song as having been listened to (production only).

    Args:
        request: The DRF request object.
        song_uuid: UUID of the song to mark as listened to.

    Returns:
        JSON response with status and play count.
    """
    song = get_user_object_or_404(request.user, Song, uuid=song_uuid)
    if not settings.DEBUG:
        song.listen_to()
        song.refresh_from_db(fields=["times_played"])

    return Response(
        {
            "times_played": song.times_played
        }
    )


@api_view(["POST"])
def get_song_id3_info(request: HttpRequest) -> Response:
    """Extract ID3 information from an uploaded song file.

    Args:
        request: The HTTP request object containing the uploaded song file.

    Returns:
        JSON response with extracted ID3 metadata.
    """
    song_file = cast(UploadedFile, request.FILES["song"])
    song = song_file.read()
    id3_info = get_id3_info(song)
    return Response({**id3_info})


class SearchTagListView(LoginRequiredMixin, ListView):
    """Return a list of songs and albums which have a given tag."""

    template_name = "music/tag_search.html"

    def get_queryset(self) -> QuerySetType[Song]:
        """Get the queryset of songs filtered by tag.

        Returns:
            QuerySet of Song objects with the specified tag.
        """
        tag_name = self.request.GET.get("tag", "")
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
            song["uuid"] = str(song["uuid"])
            song["length"] = convert_seconds(song["length"])

        user = cast(User, self.request.user)

        album_list = []

        for match in Album.objects.filter(
                user=user,
                tags__name=self.request.GET.get("tag", "")
        ).select_related(
            "artist"
        ).order_by("-year"):
            album_list.append(
                {
                    "uuid": str(match.uuid),
                    "title": match.title,
                    "artist_name": match.artist.name,
                    "artist_uuid": str(match.artist.uuid),
                    "year": match.year,
                }
            )

        return {
            **context,
            "tag_name": self.request.GET.get("tag", ""),
            "song_list": song_list,
            "album_list": album_list,
            # JSON serialized data for React
            "songs_json": json.dumps(song_list),
            "albums_json": json.dumps(album_list),
        }


class PlaylistDetailView(LoginRequiredMixin, UserScopedQuerysetMixin, DetailView):
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


class UpdatePlaylistView(LoginRequiredMixin, UserScopedQuerysetMixin, FormRequestMixin, UpdateView):
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


class PlaylistDeleteView(LoginRequiredMixin, UserScopedQuerysetMixin, DeleteView):
    """Handle deletion of playlists."""

    model = Playlist
    slug_field = "uuid"
    slug_url_kwarg = "uuid"
    success_url = reverse_lazy("music:list")

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

        # Get default source ID from session or use default
        default_source_name = self.request.session.get("song_source", SongSource.DEFAULT)
        default_source_id = next(
            (s["id"] for s in song_sources if s["name"] == default_source_name),
            song_sources[0]["id"] if song_sources else None
        )

        return {
            **context,
            "song_sources_json": json.dumps(song_sources),
            "default_source_id": default_source_id,
        }


@api_view(["POST"])
def scan_album_from_zipfile(request: HttpRequest) -> Response:
    """Scan a ZIP file to extract album information without creating the album.

    Args:
        request: The HTTP request object containing the uploaded ZIP file.

    Returns:
        JSON response with scanned album information and status.
    """
    if "zipfile" not in request.FILES:
        return Response({
            "detail": "No ZIP file provided"
        }, status=400)

    zipfile_upload = cast(UploadedFile, request.FILES["zipfile"])
    zipfile_obj = zipfile_upload.read()
    info = scan_zipfile(zipfile_obj)

    response = {
        **info,
    }

    return Response(response)


@api_view(["POST"])
@validate_post_data("artist", "source")
def add_album_from_zipfile(request: HttpRequest) -> Response | StreamingHttpResponse:
    """Create an album from a ZIP file, streaming per-track progress as NDJSON.

    Pre-stream validation errors (missing zip, bad source, empty zip)
    return a normal HTTP 400. Once the per-song loop starts, progress
    is streamed line-by-line as ``application/x-ndjson``; mid-stream
    failures end the stream with an ``error`` event and HTTP status
    remains 200 because headers were already sent.

    Args:
        request: The HTTP request object containing the ZIP file and metadata.

    Returns:
        Either a 400 ``Response`` or a streaming NDJSON response.
    """
    artist = request.POST.get("artist", "").strip()
    source_id = request.POST.get("source", "").strip()

    if "zipfile" not in request.FILES:
        return Response({"detail": "No ZIP file provided"}, status=400)

    try:
        source = SongSource.objects.get(id=source_id)
    except SongSource.DoesNotExist:
        return Response({"detail": "Invalid song source"}, status=400)

    zipfile_upload = cast(UploadedFile, request.FILES["zipfile"])
    zipfile_obj = zipfile_upload.read()
    user = cast(User, request.user)

    service_gen = create_album_from_zipfile(
        zipfile_obj,
        artist,
        source,
        request.POST.get("tags", None),
        user,
        json.loads(request.POST.get("songListChanges", "{}")),
    )

    # Drive the generator to its first yield so empty-zip / scan errors
    # surface as a pre-stream 400 instead of mid-stream error events.
    try:
        first_event = next(service_gen)
    except (ValueError, StopIteration) as e:
        return Response({"detail": str(e) or "Album creation failed"}, status=400)

    source_name = source.name

    def stream() -> Iterator[bytes]:
        yield (json.dumps(first_event) + "\n").encode("utf-8")
        try:
            for event in service_gen:
                if event.get("type") == "done":
                    album_uuid = event["album_uuid"]
                    request.session["song_source"] = source_name
                    event = {
                        "type": "done",
                        "url": reverse("music:album_detail", kwargs={"uuid": album_uuid}),
                    }
                yield (json.dumps(event) + "\n").encode("utf-8")
        except Exception as e:
            yield (json.dumps({"type": "error", "detail": str(e)}) + "\n").encode("utf-8")

    return StreamingHttpResponse(stream(), content_type="application/x-ndjson")


@api_view(["GET"])
def get_playlist(request: HttpRequest, playlist_uuid: str) -> Response:
    """Get playlist contents and metadata.

    Args:
        request: The HTTP request object.
        playlist_uuid: UUID of the playlist to retrieve.

    Returns:
        JSON response with playlist songs, total time, and status.
    """
    playlist = get_user_object_or_404(request.user, Playlist, uuid=playlist_uuid)

    playlist_data = get_playlist_songs(playlist)
    playtime_seconds: float = float(cast(int, playlist_data["playtime"]))

    total_time = humanize.precisedelta(
        timedelta(seconds=playtime_seconds),
        minimum_unit="minutes",
        format="%.f"
    )

    response = {
        "totalTime": total_time,
        "playlistitems": playlist_data["song_list"]
    }

    return Response(response)


@api_view(["POST"])
@validate_post_data("playlistitem_uuid", "position")
def sort_playlist(request: HttpRequest) -> Response:
    """Move a song to a new position within a playlist.

    Args:
        request: The HTTP request object containing playlist item UUID and new position.

    Returns:
        JSON response with operation status.
    """
    playlistitem_uuid = request.POST.get("playlistitem_uuid", "").strip()
    try:
        new_position = int(request.POST.get("position", "").strip())
    except (TypeError, ValueError):
        return Response({"detail": "Invalid position"}, status=400)

    with transaction.atomic():
        playlistitem = get_object_or_404(
            PlaylistItem.objects.select_related("playlist"),
            uuid=playlistitem_uuid,
            playlist__user=request.user
        )
        playlistitem.reorder(new_position)

    return Response()


@api_view(["GET"])
def search_playlists(request: HttpRequest) -> Response:
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

    return Response([{"value": x.name, "uuid": x.uuid} for x in playlists])


@api_view(["POST"])
@validate_post_data("playlist_uuid", "song_uuid")
def add_to_playlist(request: HttpRequest) -> Response:
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

    playlist = get_user_object_or_404(request.user, Playlist, uuid=playlist_uuid)
    song = get_user_object_or_404(request.user, Song, uuid=song_uuid)

    existing_item = PlaylistItem.objects.filter(playlist=playlist, song=song).first()

    if existing_item:
        # Song is already on playlist - remove it
        existing_item.delete()
        return Response({"action": "removed"})

    # Song is not on playlist - add it
    playlistitem = PlaylistItem(playlist=playlist, song=song)
    playlistitem.save()

    # Save the playlist in the user's session, so that this will
    #  be the default selection next time.
    request.session["music_playlist"] = playlist_uuid

    return Response({"action": "added"}, status=status.HTTP_201_CREATED)


@api_view(["POST"])
@validate_post_data("artist_uuid")
def update_artist_image(request: HttpRequest) -> Response:
    """Edit the image displayed on the artist detail page.

    Args:
        request: The HTTP request object containing artist UUID and image file.

    Returns:
        JSON response with operation status.

    Raises:
        Exception: If S3 upload fails.
    """
    artist_uuid = request.POST.get("artist_uuid", "").strip()

    get_user_object_or_404(request.user, Artist, uuid=artist_uuid)

    if "image" not in request.FILES:
        return Response({"detail": "No image provided"}, status=400)

    image = cast(UploadedFile, request.FILES["image"])

    upload_artist_image(artist_uuid, image.file)

    return Response()


@api_view(["GET"])
def dupe_song_checker(request: HttpRequest) -> Response:
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

    return Response({"dupes": dupes})


@login_required
def missing_artist_images(request: HttpRequest) -> HttpResponse:
    """Temporary view to find and redirect to an artist without an image in S3.

    This is a utility function to help identify artists that need images uploaded.

    Args:
        request: The HTTP request object.

    Returns:
        HTTP redirect to an artist detail page or the main music page if none found.
    """
    artist_image_keys = list_artist_image_keys()
    unique_uuids = {
        key.removeprefix("artist_images/")
        for key in artist_image_keys
    }

    user = cast(User, request.user)
    artists = Artist.objects.filter(
        user=user,
    ).exclude(
        album__artist__name="Various"
    ).exclude(
        album__artist__name="Various Artists"
    ).order_by("?")

    for artist in artists:
        if str(artist.uuid) not in unique_uuids:
            return redirect("music:artist_detail", uuid=artist.uuid)

    return render(request, "music/index.html")


@api_view(["GET"])
def recent_albums(request: HttpRequest, page_number: str | int) -> Response:
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
        "album_list": recent_albums_list,
        "paginator": paginator
    }

    return Response(response)


@api_view(["POST"])
@validate_post_data("song_uuid")
def set_song_rating(request: HttpRequest) -> Response:
    """Edit the rating for a specific song.

    Args:
        request: The HTTP request object containing song UUID and rating value.

    Returns:
        JSON response with operation status.
    """
    song_uuid = request.POST.get("song_uuid", "").strip()

    rating_raw = request.POST.get("rating", "").strip()
    if rating_raw == "":
        rating = None
    else:
        try:
            rating = int(rating_raw)
        except (TypeError, ValueError):
            return Response({"detail": "Invalid rating"}, status=400)
        if rating < 1 or rating > 5:
            return Response({"detail": "Rating must be between 1 and 5"}, status=400)

    song = get_user_object_or_404(request.user, Song, uuid=song_uuid)
    song.rating = rating
    song.save()

    return Response()
