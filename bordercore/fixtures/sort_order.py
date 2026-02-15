import pytest

from accounts.models import UserTag


@pytest.fixture()
def sort_order_user_tag(auto_login_user, tag):

    user, _ = auto_login_user()

    sort_order = UserTag(userprofile=user.userprofile, tag=tag[0])
    sort_order.save()
    sort_order = UserTag(userprofile=user.userprofile, tag=tag[1])
    sort_order.save()
    sort_order = UserTag(userprofile=user.userprofile, tag=tag[2])
    sort_order.save()
