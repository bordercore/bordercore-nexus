from book.views import BookListView
from feed.views import update_feed_list
from rest_framework import routers

from django.conf import settings
from django.contrib import admin
from django.urls import include, path, re_path

from api.views import (AlbumViewSet, BlobSha1sumViewSet, BlobViewSet,
                       BookmarkViewSet, CollectionViewSet, FeedItemViewSet,
                       FeedViewSet, NodeViewSet, QuestionViewSet, QuoteViewSet,
                       SongSourceViewSet, SongViewSet, TagAliasViewSet,
                       TagNameViewSet, TagViewSet, TodoViewSet)
from bordercore.api.views import PlaylistItemViewSet, PlaylistViewSet
from collection.views import get_images
from homepage.views import handler403, handler404, handler500, robots_txt
from lib.services import extract_text, site_stats
from music.views import mark_song_as_listened_to
from search.views import search_music

admin.autodiscover()

urlpatterns = [

    path("robots.txt", robots_txt),
    path("__admin/", admin.site.urls),
    path(r"books/(\w+)?", BookListView.as_view(), name="book_list"),

]

for app in ("accounts", "blob", "bookmark", "collection", "drill", "feed", "fitness", "metrics", "music", "node", "reminder", "search", "tag", "todo"):
    urlpatterns += [
        path(f"{app}/", include(f"{app}.urls", namespace=app)),
    ]

urlpatterns += [
    path("", include("homepage.urls", namespace="homepage")),
]

if settings.DEBUG:
    from debug_toolbar.toolbar import debug_toolbar_urls

    urlpatterns += [
    ] + debug_toolbar_urls()

router = routers.DefaultRouter()
router.register(r"albums", AlbumViewSet, "album")
router.register(r"blobs", BlobViewSet, "blob")
router.register(r"bookmarks", BookmarkViewSet, "bookmark")
router.register(r"collections", CollectionViewSet, "collection")
router.register(r"feeds", FeedViewSet, "feed")
router.register(r"feeditem", FeedItemViewSet)
router.register(r"nodes", NodeViewSet, "node")
router.register(r"questions", QuestionViewSet, "question")
router.register(r"quotes", QuoteViewSet, "quote")
router.register(r"sha1sums", BlobSha1sumViewSet, "sha1sum")
router.register(r"songs", SongViewSet, "song")
router.register(r"songsources", SongSourceViewSet, "songsource")
router.register(r"playlists", PlaylistViewSet, "playlist")
router.register(r"playlistitems", PlaylistItemViewSet, "playlistitem")
router.register(r"tags", TagViewSet, "tag")
router.register(r"tagaliases", TagAliasViewSet, "tagalias")
router.register(r"tagnames", TagNameViewSet, "tagname")
router.register(r"todos", TodoViewSet, "todo")

urlpatterns += [
    # Specific API paths must come before the router include
    path("api/feeds/update_feed_list/<uuid:feed_uuid>/", update_feed_list),
    path("api/collections/images/<uuid:collection_uuid>/", get_images),
    path("api/music/mark_song_as_listened_to/<uuid:song_uuid>/", mark_song_as_listened_to, name="mark_song_as_listened_to"),
    path("api/site/stats", site_stats),
    path("api/search/music/", search_music),
    path("api/extract_text", extract_text),
    re_path(r"^api/", include(router.urls)),
    path("", include("rest_framework.urls", namespace="rest_framework"))
]

handler403 = "homepage.views.handler403"
handler404 = "homepage.views.handler404"
handler500 = "homepage.views.handler500"
