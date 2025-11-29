"""Services for the lib application.

This module contains API views for site statistics and text extraction
functionality.
"""
import ipaddress
import socket
from http import HTTPStatus
from urllib.parse import urlparse

import requests
import trafilatura
from rest_framework.decorators import api_view
from rest_framework.request import Request

from django.http import JsonResponse

from bookmark.models import Bookmark
from drill.models import Question


@api_view(["GET"])
def site_stats(request: Request) -> JsonResponse:
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
def extract_text(request: Request) -> JsonResponse:
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
        return JsonResponse({"error": "URL parameter is required"}, status=HTTPStatus.BAD_REQUEST)

    parsed = urlparse(url)
    # Security: Restrict URL schemes to http/https only to prevent SSRF attacks
    # and access to local files (file://) or other dangerous schemes
    if parsed.scheme not in {"http", "https"}:
        return JsonResponse({"error": "Invalid URL scheme"}, status=HTTPStatus.BAD_REQUEST)

    # Security: Block private/internal IPs to prevent SSRF attacks against
    # internal services (localhost, private networks, etc.)
    hostname = parsed.hostname
    if hostname:
        try:
            # Resolve hostname to IP address
            ip = socket.gethostbyname(hostname)
            ip_obj = ipaddress.ip_address(ip)
            # Check if IP is private, loopback, link-local, or reserved
            if ip_obj.is_private or ip_obj.is_loopback or ip_obj.is_link_local or ip_obj.is_reserved:
                return JsonResponse({"error": "Access to private/internal IPs is not allowed"}, status=HTTPStatus.BAD_REQUEST)
        except (socket.gaierror, ValueError):
            # If hostname resolution fails or IP parsing fails, allow the request
            # to proceed and let requests library handle the error
            pass

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
        return JsonResponse({"error": "No text could be extracted from the given URL"}, status=HTTPStatus.UNPROCESSABLE_ENTITY)

    except requests.RequestException as e:
        return JsonResponse({"error": f"Error fetching URL: {str(e)}"}, status=HTTPStatus.INTERNAL_SERVER_ERROR)
    except Exception as e:
        return JsonResponse({"error": f"An unexpected error occurred: {str(e)}"}, status=HTTPStatus.INTERNAL_SERVER_ERROR)
