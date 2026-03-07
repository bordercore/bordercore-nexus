"""
Common decorators for Django views.

This module contains reusable decorators for Django views.
"""

from functools import wraps
from typing import Callable, Concatenate, ParamSpec

from django.http import HttpRequest, JsonResponse
from django.http.response import HttpResponseBase

P = ParamSpec("P")


def validate_post_data(*required_fields: str) -> Callable[
        [Callable[Concatenate[HttpRequest, P], HttpResponseBase]],
        Callable[Concatenate[HttpRequest, P], HttpResponseBase],
]:
    """Decorator to validate required POST fields.

    This decorator ensures that all specified fields are present in the request's
    POST data before the view function is executed. If any required fields are
    missing, it returns a JSON error response with HTTP 400 status.

    Args:
        *required_fields: Variable number of field names (strings) that must be
            present in request.POST. Each field is checked for existence and
            non-empty string values.

    Returns:
        A decorator function that wraps the original view function. The wrapped
        function returns either the original view's response or a JsonResponse
        with error details if validation fails.
    """
    def decorator(
            view_func: Callable[Concatenate[HttpRequest, P], HttpResponseBase]
    ) -> Callable[Concatenate[HttpRequest, P], HttpResponseBase]:
        """Inner decorator function that performs the actual wrapping.

        Args:
            view_func: The Django view function to be decorated. Must accept
                HttpRequest as its first parameter.

        Returns:
            The wrapped view function with validation logic applied.
        """
        @wraps(view_func)
        def wrapper(request: HttpRequest, *args: P.args, **kwargs: P.kwargs) -> HttpResponseBase:
            """Wrapper function that performs POST data validation.

            Args:
                request: The incoming HTTP request.
                *args: Positional arguments passed to the original view function.
                    The first argument is expected to be an HttpRequest object.
                **kwargs: Keyword arguments passed to the original view function.

            Returns:
                Either a JsonResponse with validation errors (HTTP 400) or the
                result of calling the original view function.
            """
            missing_fields = [field for field in required_fields
                              if field not in request.POST]

            if missing_fields:
                return JsonResponse(
                    {
                        "status": "ERROR",
                        "message": f"Missing required fields: {', '.join(missing_fields)}"
                    }, status=400)
            return view_func(request, *args, **kwargs)
        return wrapper
    return decorator
