import pytest

from django.core.management import call_command
from django.core.management.base import CommandError

pytestmark = [pytest.mark.django_db]


def test_tag_summary(authenticated_client, capsys):
    """tag_summary prints a summary for a valid tag."""

    user, _ = authenticated_client()

    call_command("tag_summary", "django", username=user.username)

    output = capsys.readouterr().out
    assert "Tag Summary: django" in output
    assert user.username in output


def test_tag_summary_missing_user(capsys):
    """tag_summary raises CommandError for nonexistent user."""

    with pytest.raises(CommandError):
        call_command("tag_summary", "django", username="nonexistent-user")


def test_tag_summary_missing_tag(authenticated_client, capsys):
    """tag_summary raises CommandError for nonexistent tag."""

    user, _ = authenticated_client()

    with pytest.raises(CommandError):
        call_command("tag_summary", "zzz-no-such-tag", username=user.username)


def test_tag_summary_verbose(authenticated_client, bookmark, tag, capsys):
    """tag_summary --verbose shows object details."""

    user, _ = authenticated_client()

    call_command("tag_summary", tag[0].name, username=user.username, verbose=True)

    output = capsys.readouterr().out
    assert "Tag Summary:" in output
