import pytest

from django.contrib.auth.models import User
from django.core.exceptions import ValidationError

from accounts.models import UserTag
from accounts.tests.factories import TEST_USERNAME

pytestmark = [pytest.mark.django_db]


def test_get_tags(sort_order_user_tag):

    user = User.objects.get(username=TEST_USERNAME)

    assert user.userprofile.get_tags() == "linux, video, django"


def test_reorder(sort_order_user_tag, tag):

    user = User.objects.get(username=TEST_USERNAME)

    tags = user.userprofile.pinned_tags.all().order_by("usertag__sort_order")

    # New order: 2, 3, 1
    s = UserTag.objects.get(userprofile=user.userprofile, tag=tag[1])
    UserTag.reorder(s, 1)

    tags = user.userprofile.pinned_tags.all().order_by("usertag__sort_order")

    assert tags[0] == tag[1]
    assert tags[1] == tag[2]
    assert tags[2] == tag[0]
    assert len(tags) == 3

    # New order: 1, 3, 2
    s = UserTag.objects.get(userprofile=user.userprofile, tag=tag[2])
    UserTag.reorder(s, 3)
    tags = user.userprofile.pinned_tags.all().order_by("usertag__sort_order")
    assert tags[0] == tag[1]
    assert tags[1] == tag[0]
    assert tags[2] == tag[2]
    assert len(tags) == 3

    # Delete tag2, so we're left with 1, 3
    sort_order = UserTag.objects.get(userprofile=user.userprofile, tag=tag[2])
    sort_order.delete()
    tags = user.userprofile.pinned_tags.all().order_by("usertag__sort_order")
    assert tags[0] == tag[1]
    assert tags[1] == tag[0]
    assert len(tags) == 2


def test_topbar_animation_defaults_to_aurora(django_user_model):
    user = django_user_model.objects.create(username="topbar-anim-user")
    assert user.userprofile.topbar_animation == "aurora"


def test_topbar_animation_accepts_known_choices(django_user_model):
    user = django_user_model.objects.create(username="topbar-anim-user-2")
    # Exclude OneToOneFields that are null=True but not blank=True (pre-existing
    # model gap unrelated to this test) so validation focuses on topbar_animation.
    exclude = ["homepage_default_collection", "homepage_image_collection"]
    for value in ("aurora", "constellations", "none"):
        user.userprofile.topbar_animation = value
        user.userprofile.full_clean(exclude=exclude)  # raises ValidationError if value rejected


def test_topbar_animation_rejects_unknown_choice(django_user_model):
    user = django_user_model.objects.create(username="topbar-anim-user-3")
    user.userprofile.topbar_animation = "bogus"
    with pytest.raises(ValidationError) as exc_info:
        user.userprofile.full_clean(exclude=["homepage_default_collection", "homepage_image_collection"])
    assert "topbar_animation" in exc_info.value.message_dict
