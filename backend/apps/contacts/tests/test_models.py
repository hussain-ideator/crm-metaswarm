from __future__ import annotations

import pytest

from apps.contacts.models import Contact
from apps.contacts.tests.factories import ContactFactory
from apps.companies.tests.factories import CompanyFactory


@pytest.mark.django_db
def test_contact_str_full_name():
    contact = ContactFactory(first_name='Jane', last_name='Doe')
    assert str(contact) == 'Jane Doe'


@pytest.mark.django_db
def test_alive_excludes_deleted():
    ContactFactory(first_name='Active', last_name='One')
    dead = ContactFactory(first_name='Dead', last_name='Two')
    dead.delete()

    names = list(Contact.objects.alive().values_list('last_name', flat=True))
    assert 'One' in names
    assert 'Two' not in names


@pytest.mark.django_db
def test_soft_delete_preserves_row():
    contact = ContactFactory()
    pk = contact.pk
    contact.delete()

    assert Contact.objects.filter(pk=pk).exists()
    contact.refresh_from_db()
    assert contact.is_deleted is True
    assert contact.deleted_at is not None


@pytest.mark.django_db
def test_default_ordering_is_last_name():
    ContactFactory(first_name='Z', last_name='Zebra')
    ContactFactory(first_name='A', last_name='Alpha')

    names = list(Contact.objects.alive().values_list('last_name', flat=True))
    assert names == sorted(names)


@pytest.mark.django_db
def test_company_soft_delete_nullifies_contact_company(settings):
    company = CompanyFactory()
    contact = ContactFactory(company=company)

    company.delete()
    # Signal fires on post_save — company.delete() calls save()
    contact.refresh_from_db()
    assert contact.company is None


@pytest.mark.django_db
def test_contact_without_company_is_valid():
    contact = ContactFactory(company=None)
    assert contact.company is None
    assert Contact.objects.alive().filter(pk=contact.pk).exists()
