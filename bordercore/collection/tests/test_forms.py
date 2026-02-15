from unittest.mock import Mock

import pytest
from faker import Factory as FakerFactory

from collection.forms import CollectionForm

pytestmark = [pytest.mark.django_db]

faker = FakerFactory.create()


def test_collection_form(authenticated_client):

    user, _ = authenticated_client()

    request_mock = Mock()
    request_mock.user = user

    name = faker.text(max_nb_chars=32)
    description = faker.text(max_nb_chars=100)
    tags = "django,linux"

    data = {
        "description": description,
        "tags": tags
    }

    form = CollectionForm(
        data=data,
        request=request_mock
    )

    # The form is missing the required field 'name'
    assert not form.is_valid()

    # After adding the required field, the form should be valid
    data["name"] = name
    form = CollectionForm(
        data=data,
        request=request_mock
    )

    assert form.is_valid()

    object = form.save(commit=False)
    object.user = user
    object.save()
    form.save_m2m()

    assert object.tags.count() == 2
    assert "django" in [x.name for x in object.tags.all()]
    assert "linux" in [x.name for x in object.tags.all()]

    assert object.name == name
    assert object.description == description
