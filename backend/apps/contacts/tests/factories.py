from __future__ import annotations

import factory
from factory.django import DjangoModelFactory

from apps.accounts.tests.factories import UserFactory
from apps.companies.tests.factories import CompanyFactory
from apps.contacts.models import Contact


class ContactFactory(DjangoModelFactory):
    class Meta:
        model = Contact

    first_name = factory.Faker('first_name')
    last_name = factory.Faker('last_name')
    email = factory.LazyAttribute(
        lambda o: f'{o.first_name.lower()}.{o.last_name.lower()}@example.com'
    )
    phone = factory.Faker('phone_number')
    title = factory.Faker('job')
    company = factory.SubFactory(CompanyFactory)
    owner = factory.SubFactory(UserFactory)
