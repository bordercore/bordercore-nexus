import pytest

from accounts.models import UserFeed
from feed.tests.factories import FeedFactory


@pytest.fixture()
def feed(auto_login_user):

    user, _ = auto_login_user()

    feed_0 = FeedFactory(name="Hacker News")
    feed_1 = FeedFactory()
    feed_2 = FeedFactory()

    so = UserFeed(userprofile=user.userprofile, feed=feed_0)
    so.save()
    so = UserFeed(userprofile=user.userprofile, feed=feed_1)
    so.save()
    so = UserFeed(userprofile=user.userprofile, feed=feed_2)
    so.save()

    yield [feed_0, feed_1, feed_2]
