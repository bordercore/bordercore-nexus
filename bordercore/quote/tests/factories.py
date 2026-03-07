import factory

from accounts.tests.factories import UserFactory
from quote.models import Quote


class QuoteFactory(factory.django.DjangoModelFactory):

    class Meta:
        model = Quote

    quote = factory.Faker("text", max_nb_chars=200)
    source = factory.Faker("text", max_nb_chars=32)
    user = factory.SubFactory(UserFactory)
