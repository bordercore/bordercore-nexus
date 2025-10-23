import datetime
import hashlib
import itertools
import json
import os
import re
import urllib.request
from collections import defaultdict
from pathlib import Path
from urllib.parse import urlparse

import humanize
import instaloader
import openai
import requests
from instaloader import Post
from openai import OpenAI

from django.conf import settings
from django.contrib.auth.models import User
from django.core.cache import cache
from django.core.files import File
from django.core.files.temp import NamedTemporaryFile
from django.db.models import Q
from django.urls import reverse
from django.utils import timezone

from blob.models import Blob, MetaData, RecentlyViewedBlob
from drill.models import Question
from fitness.models import Exercise
from lib.util import get_elasticsearch_connection, is_image, is_pdf, is_video
from search.services import semantic_search


def get_recent_blobs(user, limit=10, skip_content=False):
    """
    Return a list of the most recently created blobs,
    along with counts of their doctypes.
    """

    # Create user-specific cache key
    cache_key = f"recent_blobs_{user.id}"

    cached_blobs = cache.get(cache_key)
    if cached_blobs is not None:
        return cached_blobs

    blob_list = Blob.objects.filter(
        user=user
    ).prefetch_related(
        "tags", "metadata"
    ).order_by(
        "-created"
    )[:limit]

    blob_sizes = get_blob_sizes(blob_list)

    doctypes = defaultdict(int)
    doctypes["all"] = len(blob_list)

    returned_blob_list = []

    for blob in blob_list:
        delta = timezone.now() - blob.modified

        blob_dict = {
            "name": blob.name,
            "tags": blob.get_tags(),
            "url": reverse("blob:detail", kwargs={"uuid": blob.uuid}),
            "delta_days": delta.days,
            "uuid": str(blob.uuid),
            "doctype": blob.doctype,
            "type": "blob",
        }

        if blob.content and not skip_content:
            blob_dict["content"] = blob.content[:10000]
            blob_dict["content_size"] = humanize.naturalsize(len(blob.content))

        get_blob_naturalsize(blob_sizes, blob_dict)

        if is_image(blob.file) or is_pdf(blob.file) or is_video(blob.file):
            blob_dict["cover_url"] = blob.get_cover_url(size="large")
            blob_dict["cover_url_small"] = blob.get_cover_url(size="small")

        returned_blob_list.append(blob_dict)

        doctypes[blob.doctype] += 1

    cache.set(cache_key, (returned_blob_list, doctypes))

    return returned_blob_list, doctypes


def get_recent_media(user, limit=10):
    """
    Return a list of the most recently created images and video.
    """

    # Create user-specific cache key
    cache_key = f"recent_media_{user.id}"

    cached_media = cache.get(cache_key)
    if cached_media is not None:
        return cached_media

    image_list = Blob.objects.filter(
        Q(user=user) & (
            Q(file__endswith="bmp") | Q(file__endswith="gif")
            | Q(file__endswith="jpg") | Q(file__endswith="jpeg")
            | Q(file__endswith="png") | Q(file__endswith="tiff")
            | Q(file__endswith="avi") | Q(file__endswith="flv")
            | Q(file__endswith="m4v") | Q(file__endswith="mkv")
            | Q(file__endswith="mp4") | Q(file__endswith="webm")
        )
    ).prefetch_related(
        "tags", "metadata"
    ).order_by(
        "-created"
    )[:limit]

    returned_image_list = []

    for blob in image_list:
        delta = timezone.now() - blob.modified

        blob_dict = {
            "name": blob.name,
            "tags": blob.get_tags(),
            "url": reverse("blob:detail", kwargs={"uuid": blob.uuid}),
            "delta_days": delta.days,
            "uuid": str(blob.uuid),
            "type": "blob",
            "cover_url": blob.get_cover_url(size="large"),
            "cover_url_small": blob.get_cover_url(size="small")
        }

        returned_image_list.append(blob_dict)

    cache.set(cache_key, returned_image_list)

    return returned_image_list


def get_recently_viewed(user):
    """
    Get a list of recently viewed blobs and nodes
    """

    objects = RecentlyViewedBlob.objects.filter(
        Q(blob__user=user) | Q(node__user=user)
    ).order_by(
        "-created"
    ).select_related(
        "blob",
        "node"
    ).prefetch_related(
        "blob__metadata"
    )

    object_list = []
    for x in objects:
        if x.blob:
            object_list.append(
                {
                    "url": reverse("blob:detail", kwargs={"uuid": x.blob.uuid}),
                    "cover_url": x.blob.get_cover_url(size="large"),
                    "cover_url_small": x.blob.get_cover_url(size="small"),
                    "doctype": x.blob.doctype.capitalize(),
                    "name": x.blob.name or "No name",
                    "uuid": x.blob.uuid
                }
            )
        else:
            object_list.append(
                {
                    "url": reverse("node:detail", kwargs={"uuid": x.node.uuid}),
                    "doctype": "Node",
                    "name": x.node.name,
                    "uuid": x.node.uuid
                }
            )

    return object_list


def get_books(user, tag=None, search=None):

    es = get_elasticsearch_connection(host=settings.ELASTICSEARCH_ENDPOINT)

    search_object = {
        "query": {
            "bool": {
                "must": [
                    {
                        "term": {
                            "user_id": user.id
                        }
                    },
                    {
                        "term": {
                            "doctype": "book"
                        }
                    }
                ]
            }
        },
        "sort": [
            {"last_modified": {"order": "desc"}}
        ],
        "from": 0,
        "size": 10,
        "_source": [
            "date",
            "date_unixtime",
            "filename",
            "last_modified",
            "name",
            "tags",
            "title",
            "url",
            "uuid"
        ]
    }

    if tag:
        search_object["query"]["bool"]["must"].append(
            {
                "term": {
                    "tags.keyword": tag
                }
            }
        )
        search_object["size"] = 1000

    if search:
        search_object["query"]["bool"]["must"].append(
            {
                "multi_match": {
                    "query": search,
                    "fields": [
                        "metadata.*",
                        "name",
                        "title",
                    ],
                    "operator": "OR",
                }
            }
        )
        search_object["size"] = 1000

    return es.search(index=settings.ELASTICSEARCH_INDEX, body=search_object)


def get_blob_sizes(blob_list):
    """
    Query Elasticsearch for the sizes of a list of blobs
    """

    search_object = {
        "query": {
            "bool": {
                "should": [
                    {
                        "term": {
                            "_id": str(x.uuid)
                        }
                    }
                    for x
                    in blob_list
                ]
            }
        },
        "_source": ["size", "uuid"]
    }

    es = get_elasticsearch_connection(host=settings.ELASTICSEARCH_ENDPOINT, timeout=5)
    found = es.search(index=settings.ELASTICSEARCH_INDEX, body=search_object)

    blob_cache = {}
    for match in found["hits"]["hits"]:
        blob_cache[match["_source"]["uuid"]] = match["_source"]

    return blob_cache


def get_blob_naturalsize(blob_sizes, blob):
    """
    Get a humanized size for a blob, when given in bytes
    """

    if blob["uuid"] in blob_sizes and "size" in blob_sizes[blob["uuid"]]:
        blob["content_size"] = humanize.naturalsize(blob_sizes[blob["uuid"]]["size"])


def import_blob(user, url):

    parsed_url = urlparse(url)

    # We want the domain part of the hostname (eg bordercore.com instead of www.bordercore.com)
    domain = ".".join(parsed_url.netloc.split(".")[1:])

    if domain == "instagram.com":
        return import_instagram(user, parsed_url)
    if domain == "nytimes.com":
        return import_newyorktimes(user, url)
    if domain == "artstation.com":
        return import_artstation(user, parsed_url)
    raise ValueError(f"Site not supported for importing: <strong>{domain}</strong>")


def parse_shortcode(shortcode):
    """
    If the shortcode was given in the form of a url, extract it.
    """

    patterns = [
        r"^https://www.artstation.com/artwork/([^\/]+)/*",
        r"^https://www.instagram.com/\w+/([^\/]+)/*",
        r"^([\w\d]+)$"
    ]

    # url = "https://www.instagram.com/p/CPLicD6K1uv/?utm_source=ig_web_copy_link"
    # url = "https://www.instagram.com/tv/CWbejF6DD9B/?utm_source=ig_web_copy_link"
    # url = "https://www.artstation.com/artwork/CPLicD6K1uv/"
    # url = "CPLicD6K1uv"

    for pattern in patterns:
        match = re.compile(pattern).match(shortcode)
        if match:
            return match.group(1)

    # If we got this far, we couldn't parse the shortcode
    raise ValueError(f"Can't parse shortcode from {shortcode}")


def get_sha1sum(filename):

    buffer_size = 65536

    sha1 = hashlib.sha1()

    with open(filename, "rb") as f:
        while True:
            data = f.read(buffer_size)
            if not data:
                break
            sha1.update(data)

    return sha1.hexdigest()


def parse_date(date):
    """
    Return the date without the time portion.
    For example, if given '2021-08-15 23:40:56', return '2021-08-15'
    """
    patterns = [r"^(\d\d\d\d-\d\d-\d\d)", r"^(\d\d\d\d-\d\d-\d\d)"]

    for p in patterns:
        matches = re.compile(p).match(str(date))
        if matches:
            return matches.group(1)

    return date


def import_instagram(user, parsed_url):

    if not user.userprofile.instagram_credentials:
        raise ValueError("Please provide your Instagram credentials in <a href='" + reverse('accounts:prefs') + "'>preferences</a>.")

    loader = instaloader.Instaloader(download_videos=True)

    try:
        loader.login(
            user.userprofile.instagram_credentials["username"],
            user.userprofile.instagram_credentials["password"]
        )
    except Exception as e:
        if str(e).find("Wrong password") != -1:
            raise ValueError("Login error. Please check your Instagram password in <a href='" + reverse('accounts:prefs') + "'>preferences</a>.")
        if str(e).find("does not exist") != -1:
            raise ValueError("Login error. Please check your Instagram username in <a href='" + reverse('accounts:prefs') + "'>preferences</a>.")
        raise Exception(f"{type(e)}: {e}")

    short_code = parse_shortcode(parsed_url.geturl())

    try:
        post = Post.from_shortcode(loader.context, short_code)
    except Exception as e:
        if str(e).find("Fetching Post metadata failed") != -1:
            raise ValueError("Instagram post not found.")
        raise Exception(e)

    o = urlparse(post.url)
    base_name, ext = os.path.splitext(Path(o.path).name)
    temp_file = NamedTemporaryFile(delete=True)

    loader.download_pic(temp_file.name, post.url, post.date_utc)

    # Instaloader adds a file extension to the file path you give
    #  it, whether you want that or not. So I need to rename the
    #  resulting file to match the temp file generated by
    #  NamedTemporaryFile.
    os.rename(f"{temp_file.name}{ext}", temp_file.name)

    date = parse_date(post.date)

    user = User.objects.get(username=user.username)
    blob = Blob(
        user=user,
        name=post.caption,
        date=date,
        sha1sum=get_sha1sum(temp_file.name)
    )
    blob.file_modified = int(os.path.getmtime(temp_file.name))
    blob.save()

    myfile = File(open(temp_file.name, "rb"))
    filename = f"{base_name}{ext}"
    blob.file.save(filename, myfile)

    url = f"https://instagram.com/p/{post.shortcode}/"
    artist_name = post.owner_profile.full_name

    MetaData.objects.create(user=user, name="Url", value=url, blob=blob)
    MetaData.objects.create(user=user, name="Artist", value=artist_name, blob=blob)

    blob.index_blob()

    return blob


def import_artstation(user, parsed_url):

    short_code = parse_shortcode(parsed_url.geturl())
    url = f"https://www.artstation.com/projects/{short_code}.json"
    result = requests.get(url)

    if not result.ok:
        raise ValueError(f"Error importing image: {result.reason}")

    result = result.json()

    date = parse_date(result["created_at"])

    user = User.objects.get(username=user.username)
    filename = os.path.basename(urlparse(result["assets"][0]["image_url"]).path)

    opener = urllib.request.build_opener()
    opener.addheaders = [("User-agent", "Bordercore/1.0")]
    urllib.request.install_opener(opener)

    temp_file = NamedTemporaryFile(delete=True)

    urllib.request.urlretrieve(result["assets"][0]["image_url"], temp_file.name)

    blob = Blob(
        user=user,
        name=result["title"],
        date=date,
        sha1sum=get_sha1sum(temp_file.name)
    )
    blob.file_modified = int(os.path.getmtime(str(temp_file.name)))
    blob.save()

    myfile = File(open(temp_file.name, "rb"))
    blob.file.save(filename, myfile)

    url = result["permalink"]
    artist_name = result["user"]["full_name"]

    MetaData.objects.create(user=user, name="Url", value=url, blob=blob)
    MetaData.objects.create(user=user, name="Artist", value=artist_name, blob=blob)

    blob.index_blob()

    return blob


def get_authors(byline):
    """
    Parses a byline string and extracts a list of author names.

    The function handles bylines that:
    - May begin with "By " (case-insensitive), which will be stripped.
    - Use commas to separate multiple authors.
    - Use "and" before the final author's name (Oxford comma optional).

    Example:
        parse_authors("By Michael D. Shear, Aaron Boxerman and Adam Rasgon")
        returns ["Michael D. Shear", "Aaron Boxerman", "Adam Rasgon"]

    Args:
        byline (str): A byline string containing one or more author names.

    Returns:
        list[str]: A list of author names, stripped of extra whitespace.
    """

    if byline.lower().startswith("by "):
        byline = byline[3:]  # remove "By "

    # Split on " and " first (last separator)
    parts = byline.rsplit(" and ", 1)

    # If there was an "and", split the first part by comma
    if len(parts) == 2:
        authors = [author.strip() for author in parts[0].split(",")]
        authors.append(parts[1].strip())
    else:
        authors = [author.strip() for author in byline.split(",")]

    return [author for author in authors if author]  # remove any empty strings


def import_newyorktimes(user, url):

    api_key = user.userprofile.nytimes_api_key
    if not api_key:
        raise ValueError("Please provide your NYTimes API key in <a href='" + reverse('accounts:prefs') + "'>preferences</a>.")

    # Remove any extraneous search-args from the url
    url = url.split("?")[0]

    url = f"https://api.nytimes.com/svc/search/v2/articlesearch.json?api-key={api_key}&fq=url:(\"{url}\")"
    r = requests.get(url)
    result = r.json()

    if result["status"] == "ERROR":
        raise ValueError(f"There was an error retrieving the article: {result['errors']}")

    matches = result["response"]["docs"]

    if not matches:
        raise ValueError("Error: API returned null")

    if len(matches) > 1:
        raise ValueError("Error: found more than one article matching that url")

    if len(matches) == 0:
        raise ValueError("Error: no articles found matching that url")

    date = datetime.datetime.strptime(matches[0]["pub_date"], "%Y-%m-%dT%H:%M:%S%z").strftime("%Y-%m-%d")

    user = User.objects.get(username=user.username)
    blob = Blob(
        user=user,
        name=matches[0]["headline"]["main"],
        date=date
    )
    blob.save()

    url = matches[0]["web_url"]
    MetaData.objects.create(user=user, name="Url", value=url, blob=blob)

    subtitle = matches[0]["abstract"]
    MetaData.objects.create(user=user, name="Subtitle", value=subtitle, blob=blob)

    author_list = get_authors(matches[0]["byline"]["original"])
    for author in author_list:
        MetaData.objects.create(user=user, name="Author", value=author, blob=blob)

    blob.index_blob()

    return blob


def chatbot(request, args):

    openai.api_key = os.environ.get("OPENAI_API_KEY")
    model = "gpt-4.1"
    messages = None
    added_values = []

    if "blob_uuid" in args:
        blob_content = Blob.objects.get(uuid=args["blob_uuid"]).content
        messages = [
            {
                "role": "user",
                "content": f"{args['content']}: Follow all instructions and answer all questions solely based on the following text: {blob_content}"
            }
        ]
    elif "question_uuid" in args:
        question = Question.objects.get(uuid=args["question_uuid"])
        tags = ",".join([x.name for x in question.tags.all()])
        messages = [
            {
                "role": "user",
                "content": f"Assume the following question is tagged with {tags}. Please answer it: {question.question}"
            }
        ]
    elif "exercise_uuid" in args:
        exercise = Exercise.objects.get(uuid=args["exercise_uuid"])
        messages = [
            {
                "role": "user",
                "content": f"Tell me about the strength training exercise '{exercise.name}. Include a description and talk about proper form and which muscles are targeted."
            }
        ]
    elif args["mode"] == "notes":
        chat_history = json.loads(args["chat_history"])
        prompt = chat_history[-1]['content']
        results = semantic_search(request, prompt)["hits"]["hits"][0]["_source"]
        text = results["contents"]
        messages = [
            {
                "role": "user",
                "content": f"Answer the following question based ONLY on the following text. Do not use any other source of information. The question is '{prompt}'. The text is '{text}'"
            }
        ]

        added_values.append(
            {
                "choices": [
                    {
                        "delta": {
                            "content": f"\n\n\nSource: [{results['name'] or 'No title'}]({reverse('blob:detail', kwargs={'uuid': results['uuid']})})"
                        }
                    }
                ]
            }
        )
    else:
        chat_history = json.loads(args["chat_history"])
        messages = [{k: v for k, v in d.items() if k != "id"} for d in chat_history]

    client = OpenAI()

    response = client.chat.completions.create(
        model=model,
        messages=messages,
        stream=True
    )

    for chunk in itertools.chain(response, added_values):
        if chunk.choices[0].delta.content:
            yield chunk.choices[0].delta.content
