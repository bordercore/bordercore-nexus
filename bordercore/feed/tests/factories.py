import factory
from faker import Factory as FakerFactory

from django.db.models import signals
from django.utils import timezone

from accounts.tests.factories import UserFactory
from feed.models import Feed, FeedItem

faker = FakerFactory.create()


@factory.django.mute_signals(signals.post_save)
class FeedItemFactory(factory.django.DjangoModelFactory):

    class Meta:
        model = FeedItem

    title = faker.text()
    # Sequence guarantees uniqueness — faker.url() samples from a small word
    # pool and can collide, which trips FeedItem's unique (feed, link).
    link = factory.Sequence(lambda n: f"https://example.com/item-{n}/")
    pub_date = factory.LazyFunction(timezone.now)


@factory.django.mute_signals(signals.post_save)
class FeedFactory(factory.django.DjangoModelFactory):

    class Meta:
        model = Feed

    name = faker.text()
    # Same reasoning as FeedItemFactory.link — Feed.url is unique=True.
    url = factory.Sequence(lambda n: f"https://example.com/feed-{n}/")
    homepage = faker.domain_name()
    user = factory.SubFactory(UserFactory)

    @factory.post_generation
    def create_feed_items(obj, create, extracted, **kwargs):
        FeedItemFactory.create_batch(3, feed=obj)
