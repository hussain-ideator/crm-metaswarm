from __future__ import annotations

import factory
from factory.django import DjangoModelFactory

from apps.accounts.tests.factories import UserFactory
from apps.companies.models import Company


class CompanyFactory(DjangoModelFactory):
    class Meta:
        model = Company

    name = factory.Faker('company')
    industry = factory.Faker('bs')
    website = factory.LazyAttribute(lambda _: f'https://example-{factory.Faker._get_faker().slug()}.com')
    phone = factory.Faker('phone_number')
    billing_address = factory.Faker('address')
    shipping_address = factory.Faker('address')
    owner = factory.SubFactory(UserFactory)
