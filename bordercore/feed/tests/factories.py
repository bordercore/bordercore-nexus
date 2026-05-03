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
    link = factory.LazyAttribute(lambda _: faker.url())
    pub_date = factory.LazyFunction(timezone.now)


@factory.django.mute_signals(signals.post_save)
class FeedFactory(factory.django.DjangoModelFactory):

    class Meta:
        model = Feed

    name = faker.text()
    url = factory.LazyAttribute(lambda _: faker.url())
    homepage = faker.domain_name()
    user = factory.SubFactory(UserFactory)

    @factory.post_generation
    def create_feed_items(obj, create, extracted, **kwargs):
        FeedItemFactory.create_batch(3, feed=obj)
