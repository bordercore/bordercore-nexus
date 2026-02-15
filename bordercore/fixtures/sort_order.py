import pytest

from accounts.models import UserTag


@pytest.fixture()
def sort_order_user_tag(authenticated_client, tag):

    user, _ = authenticated_client()

    sort_order = UserTag(userprofile=user.userprofile, tag=tag[0])
    sort_order.save()
    sort_order = UserTag(userprofile=user.userprofile, tag=tag[1])
    sort_order.save()
    sort_order = UserTag(userprofile=user.userprofile, tag=tag[2])
    sort_order.save()
