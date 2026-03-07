import pytest
from django.http import HttpResponse
from django.test import RequestFactory

from lib.decorators import validate_post_data


@validate_post_data("field1", "field2")
def dummy_view(request):
    """Simple view for testing the decorator."""
    return HttpResponse("OK")


@pytest.fixture
def rf():
    """Provide a Django RequestFactory instance."""
    return RequestFactory()


def test_returns_400_when_required_fields_missing(rf):
    """Returns 400 JSON error when required POST fields are missing."""
    request = rf.post("/fake-url/", data={"field1": "value1"})
    response = dummy_view(request)
    assert response.status_code == 400
    assert response["Content-Type"] == "application/json"


def test_passes_through_when_all_fields_present(rf):
    """Passes through to the view when all required fields are present."""
    request = rf.post("/fake-url/", data={"field1": "value1", "field2": "value2"})
    response = dummy_view(request)
    assert response.status_code == 200
    assert response.content == b"OK"


def test_field_with_value_zero_is_treated_as_present(rf):
    """Treats a field with value '0' as present, not missing."""
    request = rf.post("/fake-url/", data={"field1": "value1", "field2": "0"})
    response = dummy_view(request)
    assert response.status_code == 200
    assert response.content == b"OK"
