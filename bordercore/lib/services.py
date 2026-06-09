"""Services for the lib application.

This module contains API views for site statistics and text extraction
functionality.
"""
from urllib.parse import urlparse

import requests
import trafilatura
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response

from bookmark.models import Bookmark
from drill.models import Question
from lib.util import UnsafeURLError, fetch_url_safely


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def site_stats(request: Request) -> Response:
    """Get site statistics for the current user.

    Returns counts of untagged bookmarks, total bookmarks, and drill
    questions needing review.

    Args:
        request: The HTTP request.

    Returns:
        JSON response containing:
            - untagged_bookmarks: Count of bookmarks without tags
            - bookmarks_total: Total count of bookmarks
            - drill_needing_review: Count of drill questions needing review
    """
    return Response(
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
@permission_classes([IsAuthenticated])
def extract_text(request: Request) -> Response:
    """Extract text content from a URL.

    Fetches content from the provided URL and extracts clean text using
    trafilatura. Returns the extracted text or an error message.

    Args:
        request: The HTTP request containing:
            - url: URL to extract text from (query parameter)

    Returns:
        JSON response containing:
            - text: Extracted text content on success
            - error: Error message on failure
    """
    url = request.query_params.get("url")

    if not url:
        return Response({"error": "URL parameter is required"}, status=status.HTTP_400_BAD_REQUEST)

    parsed = urlparse(url)
    # Security: Restrict URL schemes to http/https only to prevent SSRF attacks
    # and access to local files (file://) or other dangerous schemes
    if parsed.scheme not in {"http", "https"}:
        return Response({"error": "Invalid URL scheme"}, status=status.HTTP_400_BAD_REQUEST)

    # SSRF protection (validates every resolved IP, fails closed on resolution
    # errors, and re-checks each redirect hop) lives in fetch_url_safely.
    try:
        response = fetch_url_safely(url, timeout=10)
        response.raise_for_status()

        # Configure trafilatura
        config = trafilatura.settings.use_config()
        config.set("DEFAULT", "EXTRACTION_TIMEOUT", "10")

        # Extract text using trafilatura
        extracted_text = trafilatura.extract(response.text, config=config, include_comments=False, include_tables=False)

        if extracted_text:
            return Response({"text": extracted_text})
        return Response({"error": "No text could be extracted from the given URL"}, status=status.HTTP_422_UNPROCESSABLE_ENTITY)

    except UnsafeURLError as e:
        return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
    except requests.RequestException as e:
        return Response({"error": f"Error fetching URL: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    except Exception as e:
        return Response({"error": f"An unexpected error occurred: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
