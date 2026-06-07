"""Tests for project settings helpers (config.settings.base)."""

import pytest

from django.core.exceptions import ImproperlyConfigured

from config.settings.base import require_setting


def test_require_setting_returns_non_empty_value():
    assert require_setting("a-real-secret", "SECRET_KEY") == "a-real-secret"


@pytest.mark.parametrize("value", ["", None])
def test_require_setting_raises_when_empty(value):
    """An unset/empty value must fail loudly so prod never boots without it."""
    with pytest.raises(ImproperlyConfigured):
        require_setting(value, "SECRET_KEY")
