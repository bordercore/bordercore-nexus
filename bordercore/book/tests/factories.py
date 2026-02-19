import factory

from django.contrib.auth.models import User

from book.models import Author, Book


class AuthorFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = Author

    name = factory.Faker("name")


class BookFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = Book

    title = factory.Faker("sentence", nb_words=3)
    year = factory.Faker("year")
    user = factory.LazyAttribute(lambda o: User.objects.first())

    @factory.post_generation
    def author(self, create, extracted, **kwargs):
        if not create:
            return
        if extracted:
            for a in extracted:
                self.author.add(a)
        else:
            self.author.add(AuthorFactory())
