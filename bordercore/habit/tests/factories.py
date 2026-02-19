import factory

from django.db.models import signals

from accounts.tests.factories import UserFactory
from habit.models import Habit


@factory.django.mute_signals(signals.post_save)
class HabitFactory(factory.django.DjangoModelFactory):

    class Meta:
        model = Habit

    name = factory.Sequence(lambda n: f"habit_{n}")
    purpose = factory.Faker("sentence")
    start_date = factory.Faker("date_object")
    user = factory.SubFactory(UserFactory)
