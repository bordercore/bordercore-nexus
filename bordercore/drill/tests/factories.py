import factory
from faker import Factory as FakerFactory

from accounts.tests.factories import UserFactory
from drill.models import Question

faker = FakerFactory.create()


class QuestionFactory(factory.django.DjangoModelFactory):

    class Meta:
        model = Question

    question = factory.LazyFunction(faker.text)
    answer = factory.LazyFunction(faker.text)
    times_failed = factory.LazyFunction(lambda: faker.pyint(max_value=50))
    user = factory.SubFactory(UserFactory)
