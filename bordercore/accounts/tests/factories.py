import factory
from faker import Factory as FakerFactory

from django.contrib.auth.models import User
from django.db.models import signals

from accounts.models import UserProfile
from drill.models import INTERVALS_DEFAULT

faker = FakerFactory.create()


TEST_USERNAME = "testuser"
TEST_PASSWORD = "testpassword"


@factory.django.mute_signals(signals.post_save)
class UserFactory(factory.django.DjangoModelFactory):

    class Meta:
        model = User
        django_get_or_create = ("username",)

    username = TEST_USERNAME
    password = factory.PostGenerationMethodCall("set_password", TEST_PASSWORD)
    email = faker.email()

    @factory.post_generation
    def create_userprofile(obj, create, extracted, **kwargs):

        userprofile, _ = UserProfile.objects.get_or_create(
            user=obj,
            theme="light",
            drill_intervals=INTERVALS_DEFAULT
        )
        userprofile.instagram_credentials = {
            "username": faker.text(max_nb_chars=20),
            "password": faker.password()
        }
        userprofile.nytimes_api_key = faker.text(max_nb_chars=32)
        userprofile.save()
