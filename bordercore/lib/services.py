import requests
import trafilatura
from rest_framework.decorators import api_view

from django.http import JsonResponse

from bookmark.models import Bookmark
from drill.models import Question


@api_view(["GET"])
def site_stats(request):

    return JsonResponse(
        {
            "untagged_bookmarks": Bookmark.objects.bare_bookmarks_count(
                user=request.user
            ),
            "bookmarks_total": Bookmark.objects.filter(
                user=request.user
            ).count(),
            "drill_needing_review": Question.objects.total_tag_progress(request.user),
        }
    )


@api_view(["GET"])
def extract_text(request):
    url = request.query_params.get("url")

    if not url:
        return JsonResponse({"error": "URL parameter is required"}, status=400)

    try:
        response = requests.get(url, timeout=10)
        response.raise_for_status()

        # Configure trafilatura
        config = trafilatura.settings.use_config()
        config.set("DEFAULT", "EXTRACTION_TIMEOUT", "10")

        # Extract text using trafilatura
        extracted_text = trafilatura.extract(response.text, config=config, include_comments=False, include_tables=False)

        if extracted_text:
            return JsonResponse({"text": extracted_text})
        return JsonResponse({"error": "No text could be extracted from the given URL"}, status=404)

    except requests.RequestException as e:
        return JsonResponse({"error": f"Error fetching URL: {str(e)}"}, status=500)
    except Exception as e:
        return JsonResponse({"error": f"An unexpected error occurred: {str(e)}"}, status=500)
