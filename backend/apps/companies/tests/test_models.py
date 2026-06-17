from __future__ import annotations

import pytest

from apps.companies.tests.factories import CompanyFactory


@pytest.mark.django_db
def test_company_str():
    company = CompanyFactory(name='Acme Corp')
    assert str(company) == 'Acme Corp'


@pytest.mark.django_db
def test_alive_manager_excludes_deleted():
    CompanyFactory(name='Active')
    deleted = CompanyFactory(name='Deleted')
    deleted.delete()

    from apps.companies.models import Company
    names = list(Company.objects.alive().values_list('name', flat=True))
    assert 'Active' in names
    assert 'Deleted' not in names


@pytest.mark.django_db
def test_dead_manager_returns_deleted():
    CompanyFactory(name='Active')
    deleted = CompanyFactory(name='Deleted')
    deleted.delete()

    from apps.companies.models import Company
    dead = list(Company.objects.dead().values_list('name', flat=True))
    assert 'Deleted' in dead
    assert 'Active' not in dead


@pytest.mark.django_db
def test_soft_delete_does_not_remove_row():
    company = CompanyFactory(name='ToDelete')
    pk = company.pk
    company.delete()

    from apps.companies.models import Company
    assert Company.objects.filter(pk=pk).exists()
    company.refresh_from_db()
    assert company.is_deleted is True
    assert company.deleted_at is not None


@pytest.mark.django_db
def test_company_default_ordering():
    CompanyFactory(name='Zebra Corp')
    CompanyFactory(name='Alpha Inc')

    from apps.companies.models import Company
    names = list(Company.objects.alive().values_list('name', flat=True))
    assert names == sorted(names)
